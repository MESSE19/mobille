let currentUser = null;
let currentCampus = 'Premier';
let allProducts = [];
let currentCart = [];
let currentCategory = 'All';
let API_BASE = 'http://localhost:3000/api';
let isCloudMode = false;

const SUPABASE_URL = "https://hogsuxkialcddmdvmeee.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvZ3N1eGtpYWxjZGRtZHZtZWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTIzNjIsImV4cCI6MjA5MzAyODM2Mn0.UeUsr4sS4a8wx0RwayHZA6toOODJO-4K6sXQqtGA62U";

document.addEventListener('DOMContentLoaded', () => {
    if(window.lucide) window.lucide.createIcons();
});

// Network Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    if (isCloudMode) {
        return null; 
    }

    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (!res.ok) {
        let msg = 'Network Error';
        try { const err = await res.json(); msg = err.error || msg; } catch(e){}
        throw new Error(msg);
    }
    return await res.json();
}

// Login Logic
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ip = document.getElementById('login-ip').value.trim().toLowerCase();
    
    isCloudMode = (ip === 'cloud');
    API_BASE = `http://${ip}:3000/api`;
    
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    const org = document.getElementById('login-org').value;
    
    try {
        if (isCloudMode) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/users?username=eq.${u}&password=eq.${p}&select=*`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            const data = await res.json();
            if(!data || data.length === 0) throw new Error('Invalid credentials');
            currentUser = data[0];
        } else {
            currentUser = await apiCall('/login', 'POST', {username: u, password: p});
        }

        currentCampus = org; // Always use the selected campus for mobile POS
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-layout').classList.remove('hidden');
        
        document.getElementById('user-display').innerText = currentUser.username;
        document.getElementById('campus-display').innerText = currentCampus;
        
        loadProducts();
    } catch(err) {
        alert('Login failed: ' + err.message);
    }
});

// Load Products
async function loadProducts() {
    try {
        if (isCloudMode) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            allProducts = await res.json();
        } else {
            allProducts = await apiCall('/products');
        }
        renderGrid();
    } catch(err) {
        alert('Failed to load products: ' + err.message);
    }
}

// Search and Categories
document.getElementById('search-input').addEventListener('input', renderGrid);
document.querySelectorAll('#categories .pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
        document.querySelectorAll('#categories .pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.dataset.cat;
        renderGrid();
    });
});

function renderGrid() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    
    let filtered = allProducts.filter(p => 
        p.campus === currentCampus &&
        (currentCategory === 'All' || p.category === currentCategory) &&
        (p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
    );

    filtered.forEach(p => {
        const isOut = p.stock_level <= 0;
        const div = document.createElement('div');
        div.className = `ptile ${isOut ? 'out' : ''}`;
        div.innerHTML = `
            <div>
                <div class="ptile-name">${p.name}</div>
                <div class="ptile-stock">Stock: ${p.stock_level} • ${p.size || '-'}</div>
            </div>
            <div>
                <div class="ptile-price">$${p.selling_price.toFixed(2)}</div>
                <button class="add-btn"><i data-lucide="plus" style="width:14px;height:14px;"></i> Add</button>
            </div>
        `;
        if(!isOut) {
            div.querySelector('.add-btn').onclick = () => addToCart(p);
        }
        grid.appendChild(div);
    });
    
    if(window.lucide) window.lucide.createIcons();
}

// Cart Logic
function addToCart(product) {
    const existing = currentCart.find(i => i.id === product.id);
    if(existing) {
        if(existing.quantity < product.stock_level) existing.quantity++;
        else alert('Not enough stock');
    } else {
        currentCart.push({...product, quantity: 1});
    }
    updateCartUI();
}

window.updateQty = (index, delta) => {
    const item = currentCart[index];
    if(delta === 1 && item.quantity >= item.stock_level) return alert('No more stock');
    item.quantity += delta;
    if(item.quantity <= 0) currentCart.splice(index, 1);
    updateCartUI();
};

function updateCartUI() {
    const bar = document.getElementById('cart-bar');
    if(currentCart.length === 0) {
        bar.classList.add('hidden');
        toggleCart(false); // Close modal if open and empty
        return;
    }
    bar.classList.remove('hidden');
    
    let subtotal = 0;
    let count = 0;
    const clist = document.getElementById('cart-items');
    clist.innerHTML = '';
    
    currentCart.forEach((item, index) => {
        subtotal += item.selling_price * item.quantity;
        count += item.quantity;
        
        clist.innerHTML += `
            <div class="cart-item">
                <div>
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${item.selling_price.toFixed(2)}</div>
                </div>
                <div class="cart-controls">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)"><i data-lucide="minus" style="width:14px;"></i></button>
                    <span style="color:#fff; font-weight:bold; min-width:16px; text-align:center;">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)"><i data-lucide="plus" style="width:14px;"></i></button>
                </div>
            </div>
        `;
    });
    
    // Tax is 0% for MVP mobile
    const total = subtotal;
    
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-bar-total').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cart-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;
    
    if(window.lucide) window.lucide.createIcons();
}

window.toggleCart = (show) => {
    const modal = document.getElementById('cart-modal');
    if(show) {
        modal.classList.add('open');
    } else {
        modal.classList.remove('open');
    }
};

// Checkout
document.getElementById('checkout-btn').addEventListener('click', async () => {
    if(currentCart.length === 0) return alert('Cart is empty');
    
    const subtotal = currentCart.reduce((sum, i) => sum + (i.selling_price * i.quantity), 0);
    const paymentMethod = document.querySelector('input[name="paymethod"]:checked').value;

    try {
        if (isCloudMode) {
            const date = new Date().toISOString();
            const updated_at = Date.now();
            
            // 1. Insert Sale
            const saleRes = await fetch(`${SUPABASE_URL}/rest/v1/sales`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                body: JSON.stringify({ total_amount: subtotal, payment_method: paymentMethod, date: date, campus_id: currentCampus, updated_at: updated_at })
            });
            if (!saleRes.ok) throw new Error('Failed to create sale');
            const saleData = await saleRes.json();
            const saleId = saleData[0].id;

            // 2. Insert Items & Update Stock (Batch)
            for (let item of currentCart) {
                await fetch(`${SUPABASE_URL}/rest/v1/sale_items`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sale_id: saleId, product_id: item.id, quantity: item.quantity, price: item.selling_price, updated_at: updated_at })
                });

                // Since Supabase REST doesn't easily support decrementing without a stored procedure, 
                // we calculate new stock locally. (This is a simplified cloud MVP).
                const newStock = item.stock_level - item.quantity;
                await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stock_level: newStock, updated_at: updated_at })
                });
            }

        } else {
            await apiCall('/sale', 'POST', { 
                cart: currentCart, 
                totalAmount: subtotal, 
                paymentMethod: paymentMethod, 
                campusId: currentCampus 
            });
        }
        
        alert('Sale completed successfully!');
        
        currentCart = [];
        updateCartUI();
        toggleCart(false);
        loadProducts(); // Refresh stock levels
    } catch(e) { 
        alert('Error: ' + e.message); 
    }
});
