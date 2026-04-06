// ========== CONFIGURATION ==========
const API_BASE = "http://localhost:3000";

// ========== BUNDLE DATA ==========
const bundleData = {
    mtn: [
        { size: '1GB', validity: '7 days', price: 5.00 },
        { size: '2GB', validity: '7 days', price: 9.50 },
        { size: '3GB', validity: '7 days', price: 13.80 },
        { size: '4GB', validity: '7 days', price: 18.80 },
        { size: '5GB', validity: '7 days', price: 23.00 },
        { size: '6GB', validity: '7 days', price: 28.50 },
        { size: '7GB', validity: '7 days', price: 33.00 },
        { size: '8GB', validity: '7 days', price: 37.50 },
        { size: '9GB', validity: '7 days', price: 41.50 },
        { size: '10GB', validity: '7 days', price: 44.50 },
        { size: '12GB', validity: '30 days', price: 56.50 },
        { size: '15GB', validity: '30 days', price: 66.00 },
        { size: '20GB', validity: '30 days', price: 86.00 },
        { size: '25GB', validity: '30 days', price: 108.00 },
        { size: '30GB', validity: '30 days', price: 129.00 },
        { size: '40GB', validity: '30 days', price: 170.00 },
        { size: '50GB', validity: '30 days', price: 205.00 },
        { size: '100GB', validity: '90 days', price: 399.00 }
    ],
    airteltigo: [
        { size: '1GB', validity: '7 days', price: 5.00 },
        { size: '2GB', validity: '7 days', price: 9.00 },
        { size: '3GB', validity: '7 days', price: 13.00 },
        { size: '4GB', validity: '7 days', price: 17.50 },
        { size: '5GB', validity: '7 days', price: 21.50 },
        { size: '6GB', validity: '7 days', price: 25.50 },
        { size: '7GB', validity: '7 days', price: 30.00 },
        { size: '8GB', validity: '7 days', price: 34.00 },
        { size: '9GB', validity: '7 days', price: 38.00 },
        { size: '10GB', validity: '7 days', price: 42.00 },
        { size: '12GB', validity: '30 days', price: 50.00 },
        { size: '15GB', validity: '30 days', price: 63.00 },
        { size: '20GB', validity: '30 days', price: 85.00 },
        { size: '25GB', validity: '30 days', price: 105.00 },
        { size: '30GB', validity: '30 days', price: 125.00 },
        { size: '40GB', validity: '30 days', price: 90.00, bigTime: true },
        { size: '50GB', validity: '30 days', price: 100.00, bigTime: true },
        { size: '60GB', validity: '30 days', price: 117.00, bigTime: true },
        { size: '70GB', validity: '30 days', price: 140.00, bigTime: true },
        { size: '80GB', validity: '30 days', price: 165.00, bigTime: true },
        { size: '90GB', validity: '30 days', price: 182.00, bigTime: true },
        { size: '100GB', validity: '30 days', price: 200.00, bigTime: true }
    ],
    telecel: [
        { size: '5GB', validity: '7 days', price: 23.00 },
        { size: '10GB', validity: '30 days', price: 43.00 },
        { size: '15GB', validity: '30 days', price: 61.00 },
        { size: '20GB', validity: '30 days', price: 80.00 },
        { size: '25GB', validity: '30 days', price: 99.00 },
        { size: '30GB', validity: '30 days', price: 117.00 },
        { size: '40GB', validity: '30 days', price: 157.00 },
        { size: '50GB', validity: '30 days', price: 195.00 },
        { size: '100GB', validity: '90 days', price: 390.00 }
    ]
};

// ========== STATE MANAGEMENT ==========
let appState = {
    currentSection: 'home',
    userBalance: 9.60,
    cart: [],
    currentNetwork: 'all',
    isMobileMenuOpen: false
};

// ========== DOM UTILITIES ==========
const el = (sel) => document.querySelector(sel);
const els = (sel) => Array.from(document.querySelectorAll(sel));

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Initialize all components
    initializeParticles();
    initializeCharts();
    setupAllEventListeners();
    setupNetworkFiltering();
    
    await loadProducts();
    await testBackendConnection();
    
    console.log('🚀 Mystery Bundle Hub initialized successfully!');
}

// ========== BACKEND CONNECTION TEST ==========
async function testBackendConnection() {
    try {
        const response = await fetch(`${API_BASE}/api/test`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend connection successful:', data.message);
        } else {
            console.warn('⚠️ Backend connection test failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Backend connection error:', error.message);
    }
}

// ========== PARTICLES ==========
function initializeParticles() {
    if (typeof tsParticles !== 'undefined') {
        tsParticles.load("tsparticles", {
            fpsLimit: 60,
            background: { color: "transparent" },
            particles: {
                number: { value: 40, density: { enable: true, area: 700 } },
                color: { value: "#00e07a" },
                opacity: { value: 0.12 },
                size: { value: { min: 1, max: 4 } },
                move: { enable: true, speed: 0.8, direction: "none", outModes: "out" },
                links: { enable: true, distance: 120, color: "#00e07a", opacity: 0.04, width: 1 }
            },
            interactivity: {
                events: { onHover: { enable: true, mode: "repulse" }, onClick: { enable: true, mode: "push" } },
                modes: { repulse: { distance: 100 }, push: { quantity: 2 } }
            }
        });
    }
}

// ========== CHARTS ==========
function initializeCharts() {
    // Usage Chart
    const usageCtx = document.getElementById('usageChart')?.getContext('2d');
    if (usageCtx) {
        new Chart(usageCtx, {
            type: 'line',
            data: {
                labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
                datasets: [{
                    label: 'Bundles sold (GB)',
                    data: [2.2, 3.1, 2.8, 4.0, 3.6, 4.2, 3.9],
                    borderColor: '#00e07a',
                    backgroundColor: 'rgba(0,224,122,0.06)',
                    tension: 0.36,
                    pointRadius: 2
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: 'rgba(230,238,246,0.6)' } },
                    y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: 'rgba(230,238,246,0.6)' } }
                }
            }
        });
    }

    // Sales Chart
    const salesCtx = document.getElementById('salesChart')?.getContext('2d');
    if (salesCtx) {
        new Chart(salesCtx, {
            type: 'doughnut',
            data: {
                labels: ['MTN','AirtelTigo','Telecel'],
                datasets: [{ 
                    data: [42,29,19], 
                    backgroundColor: ['#00e07a','#00c86b','#0bd48e'] 
                }]
            },
            options: { 
                plugins: { 
                    legend: { 
                        position: 'bottom', 
                        labels: { color: '#e6eef6' } 
                    } 
                } 
            }
        });
    }

    // User Usage Chart
    const userUsageCtx = document.getElementById('userUsageChart')?.getContext('2d');
    if (userUsageCtx) {
        new Chart(userUsageCtx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                datasets: [{
                    label: 'Your Data Usage (GB)',
                    data: [12, 19, 8, 15, 14],
                    backgroundColor: '#00e07a',
                    borderRadius: 6
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: 'rgba(230,238,246,0.6)' } },
                    y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: 'rgba(230,238,246,0.6)' } }
                }
            }
        });
    }
}

// ========== COMPREHENSIVE EVENT LISTENERS ==========
function setupAllEventListeners() {
    console.log('🔧 Setting up all event listeners...');
    
    // ========== NAVIGATION EVENT LISTENERS ==========
    
    // Desktop navigation items
    const desktopNavItems = els('.nav-item');
    desktopNavItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            console.log('Desktop nav clicked:', section);
            switchSection(section);
        });
    });
    
    // Mobile navigation items
    const mobileNavItems = els('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            console.log('Mobile nav clicked:', section);
            switchSection(section);
            closeMobileMenu();
        });
    });
    
    // Logo home navigation
    const logoHome = el('#logoHome');
    if (logoHome) {
        logoHome.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Logo clicked - going home');
            switchSection('home');
        });
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = el('#mobileMenuToggle');
    const closeMobileMenuBtn = el('#closeMobileMenu');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Mobile menu toggle clicked');
            openMobileMenu();
        });
    }
    
    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Close mobile menu clicked');
            closeMobileMenu();
        });
    }
    
    // ========== BUTTON EVENT LISTENERS ==========
    
    // Explore buttons
    const exploreBtn = el('#exploreBtn');
    const heroExplore = el('#heroExplore');
    
    if (exploreBtn) {
        exploreBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Explore button clicked');
            switchSection('bundles');
        });
    }
    
    if (heroExplore) {
        heroExplore.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Hero explore button clicked');
            switchSection('bundles');
        });
    }
    
    // Buy buttons
    const heroBuy = el('#heroBuy');
    const loginBtn = el('#loginBtn');
    
    if (heroBuy) {
        heroBuy.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Hero buy button clicked');
            openBuyModal('mtn', '5GB');
        });
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Login/Buy button clicked');
            openBuyModal();
        });
    }
    
    // ========== MODAL EVENT LISTENERS ==========
    
    const closeBuy = el('#closeBuy');
    const confirmBuy = el('#confirmBuy');
    
    if (closeBuy) {
        closeBuy.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Close buy modal clicked');
            closeBuyModal();
        });
    }
    
    if (confirmBuy) {
        confirmBuy.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Confirm buy clicked');
            confirmPurchase();
        });
    }
    
    // Phone input formatting
    const phoneInput = el('#phoneInput');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneInput);
        phoneInput.addEventListener('blur', formatPhoneInput);
    }
    
    // Operator select change
    const opSelect = el('#opSelect');
    if (opSelect) {
        opSelect.addEventListener('change', updatePlanOptions);
    }
    
    // ========== GLOBAL EVENT LISTENERS ==========
    
    // ESC key to close modal and mobile menu
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeBuyModal();
            closeMobileMenu();
        }
    });
    
    // Close modal when clicking outside
    document.addEventListener('click', function(e) {
        const buyModal = el('#buyModal');
        if (buyModal && e.target === buyModal) {
            closeBuyModal();
        }
        
        const mobileMenu = el('#mobileMenu');
        if (mobileMenu && e.target === mobileMenu) {
            closeMobileMenu();
        }
    });
    
    // Quick buy buttons (event delegation for dynamically created elements)
    document.addEventListener('click', function(e) {
        // Check if the clicked element or its parent has quick-buy-btn class
        const quickBuyBtn = e.target.closest('.quick-buy-btn');
        if (quickBuyBtn) {
            e.preventDefault();
            const network = quickBuyBtn.getAttribute('data-network');
            const size = quickBuyBtn.getAttribute('data-size');
            console.log('Quick buy clicked:', network, size);
            openBuyModal(network, size);
        }
        
        // Network filter buttons
        const networkBtn = e.target.closest('.network-btn');
        if (networkBtn) {
            e.preventDefault();
            const network = networkBtn.getAttribute('data-network');
            console.log('Network filter clicked:', network);
            filterFeaturedBundles(network);
            
            // Update active state
            els('.network-btn').forEach(btn => btn.classList.remove('active'));
            networkBtn.classList.add('active');
        }
        
        // Bundle section network filters
        const networkFilterBtn = e.target.closest('.network-filter-btn');
        if (networkFilterBtn) {
            e.preventDefault();
            const network = networkFilterBtn.getAttribute('data-network');
            console.log('Bundle network filter clicked:', network);
            filterBundles(network);
            
            // Update active state
            els('.network-filter-btn').forEach(btn => btn.classList.remove('active'));
            networkFilterBtn.classList.add('active');
        }
    });
    
    console.log('✅ All event listeners setup complete');
}

function setupNetworkFiltering() {
    // This is now handled by event delegation above
    console.log('Network filtering setup via event delegation');
}

// ========== MOBILE MENU FUNCTIONS ==========
function openMobileMenu() {
    const mobileMenu = el('#mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.add('open');
        document.body.style.overflow = 'hidden';
        appState.isMobileMenuOpen = true;
        console.log('📱 Mobile menu opened');
    }
}

function closeMobileMenu() {
    const mobileMenu = el('#mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.remove('open');
        document.body.style.overflow = 'auto';
        appState.isMobileMenuOpen = false;
        console.log('📱 Mobile menu closed');
    }
}

// ========== SECTION MANAGEMENT ==========
function switchSection(sectionName) {
    console.log('🔄 Switching to section:', sectionName);
    
    // Hide all sections
    els('[id$="-section"]').forEach(section => {
        section.classList.add('section-hidden');
        section.classList.remove('section-active');
    });
    
    // Show target section
    const targetSection = el(`#${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.remove('section-hidden');
        targetSection.classList.add('section-active');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Load section content if needed
        loadSectionContent(sectionName);
        
        console.log('✅ Section switched to:', sectionName);
    } else {
        console.error('❌ Section not found:', sectionName);
    }
    
    // Update active nav state
    updateActiveNav(sectionName);
    
    appState.currentSection = sectionName;
}

function updateActiveNav(activeSection) {
    // Update desktop nav
    els('.nav-item').forEach(item => {
        if (item.getAttribute('data-section') === activeSection) {
            item.classList.add('text-hubGreen', 'font-semibold');
        } else {
            item.classList.remove('text-hubGreen', 'font-semibold');
        }
    });
    
    // Update mobile nav
    els('.mobile-nav-item').forEach(item => {
        if (item.getAttribute('data-section') === activeSection) {
            item.classList.add('text-hubGreen', 'font-semibold');
        } else {
            item.classList.remove('text-hubGreen', 'font-semibold');
        }
    });
    
    console.log('🎯 Active nav updated for:', activeSection);
}

function loadSectionContent(sectionName) {
    console.log('📦 Loading content for section:', sectionName);
    
    switch(sectionName) {
        case 'bundles':
            loadAllBundles();
            break;
        case 'dashboard':
            loadDashboardData();
            break;
        case 'agent':
            loadAgentContent();
            break;
        case 'home':
            renderFeaturedBundles();
            break;
    }
}

// ========== NETWORK UTILITIES ==========
function getNetworkBorderClass(network) {
    switch(network) {
        case 'mtn': return 'mtn-border';
        case 'airteltigo': return 'airtel-border';
        case 'telecel': return 'telecel-border';
        default: return 'neon-border';
    }
}

function getNetworkButtonClass(network) {
    switch(network) {
        case 'mtn': return 'btn-mtn';
        case 'airteltigo': return 'btn-airtel';
        case 'telecel': return 'btn-telecel';
        default: return 'btn-green';
    }
}

function getNetworkColorClass(network) {
    switch(network) {
        case 'mtn': return 'mtn-color';
        case 'airteltigo': return 'airtel-color';
        case 'telecel': return 'telecel-color';
        default: return 'accent';
    }
}

function getNetworkIcon(network) {
    const icons = {
        mtn: 'ri-fire-fill',
        airteltigo: 'ri-flashlight-fill',
        telecel: 'ri-signal-wifi-3-fill'
    };
    return icons[network] || 'ri-wifi-line';
}

// ========== PHONE NUMBER UTILITIES ==========
function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('233') && cleaned.length === 12) {
        cleaned = '0' + cleaned.substring(3);
    }
    
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
        return cleaned;
    }
    
    if (cleaned.length === 9) {
        return '0' + cleaned;
    }
    
    return cleaned;
}

function validatePhoneNumber(phone) {
    const cleaned = formatPhoneNumber(phone);
    return cleaned.length === 10 && cleaned.startsWith('0');
}

function formatPhoneInput(event) {
    const input = event.target;
    let value = input.value;
    let cleaned = value.replace(/\D/g, '');
    
    if (cleaned.length > 0) {
        if (cleaned.length <= 3) {
            value = cleaned;
        } else if (cleaned.length <= 6) {
            value = cleaned.substring(0, 3) + ' ' + cleaned.substring(3);
        } else {
            value = cleaned.substring(0, 3) + ' ' + cleaned.substring(3, 6) + ' ' + cleaned.substring(6, 10);
        }
    }
    
    input.value = value;
    
    const isValid = validatePhoneNumber(cleaned);
    if (value && !isValid) {
        input.classList.add('border-red-500', 'text-red-400');
        input.classList.remove('border-green-500', 'text-green-400');
    } else if (isValid) {
        input.classList.remove('border-red-500', 'text-red-400');
        input.classList.add('border-green-500', 'text-green-400');
    } else {
        input.classList.remove('border-red-500', 'text-red-400', 'border-green-500', 'text-green-400');
    }
    
    return isValid;
}

// ========== PRODUCTS MANAGEMENT ==========
async function loadProducts() {
    try {
        showLoading();
        const products = await fetchProducts();
        renderProducts(products);
        hideLoading();
    } catch (error) {
        console.error('Failed to load products:', error);
        renderFeaturedBundles();
        hideLoading();
    }
}

async function fetchProducts() {
    try {
        const res = await fetch(`${API_BASE}/api/products`);
        if (!res.ok) throw new Error('No products API');
        const data = await res.json();
        return data.data || generateProductsFromBundleData();
    } catch (err) {
        console.warn('Products API failed - using demo data');
        return generateProductsFromBundleData();
    }
}

function generateProductsFromBundleData() {
    const products = [];
    let id = 1;
    
    for (const [operator, bundles] of Object.entries(bundleData)) {
        bundles.slice(0, 4).forEach(bundle => {
            products.push({
                id: id++,
                operator: operator.charAt(0).toUpperCase() + operator.slice(1),
                name: `${bundle.size} - ${bundle.validity}`,
                price: bundle.price,
                data_amount: bundle.size,
                network: operator,
                validity: bundle.validity,
                bigTime: bundle.bigTime || false
            });
        });
    }
    
    return products;
}

function renderProducts(products) {
    const container = el('#products');
    if (!container) return;
    
    container.innerHTML = '';
    products.forEach(p => {
        const card = createProductCard(p);
        container.appendChild(card);
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = `glass p-4 rounded-lg ${getNetworkBorderClass(product.network)} card-hover transition-all duration-300`;
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <div class="text-sm small-muted">${product.operator} ${product.bigTime ? '• BigTime' : ''}</div>
                <div class="text-lg font-bold">${product.name}</div>
            </div>
            <div class="text-right">
                <div class="small-muted">Price</div>
                <div class="text-xl font-bold ${getNetworkColorClass(product.network)}">₵${product.price}</div>
            </div>
        </div>
        <div class="mt-3 flex items-center justify-between">
            <div class="small-muted text-sm">${product.data_amount}</div>
            <div class="flex gap-2">
                <button class="quick-buy-btn px-3 py-1 rounded ${getNetworkButtonClass(product.network)} font-semibold transition-colors" 
                        data-network="${product.network}" 
                        data-size="${product.data_amount}">
                    <i class="ri-shopping-cart-line mr-1"></i>Buy Now
                </button>
            </div>
        </div>
    `;
    return card;
}

function renderFeaturedBundles() {
    const container = el('#products');
    if (!container) return;
    
    container.innerHTML = '';
    const featuredProducts = generateProductsFromBundleData();
    featuredProducts.forEach(p => {
        const card = createProductCard(p);
        container.appendChild(card);
    });
}

function filterFeaturedBundles(network) {
    const container = el('#products');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (network === 'all') {
        renderFeaturedBundles();
        return;
    }
    
    const bundles = bundleData[network] || [];
    bundles.slice(0, 4).forEach(bundle => {
        const product = {
            operator: network.charAt(0).toUpperCase() + network.slice(1),
            name: `${bundle.size} - ${bundle.validity}`,
            price: bundle.price,
            data_amount: bundle.size,
            network: network,
            validity: bundle.validity,
            bigTime: bundle.bigTime || false
        };
        const card = createProductCard(product);
        container.appendChild(card);
    });
}

// ========== ALL BUNDLES SECTION ==========
async function loadAllBundles() {
    const container = el('#allBundles');
    if (!container) return;
    
    try {
        const products = await fetchProducts();
        container.innerHTML = '';
        Object.keys(bundleData).forEach(network => {
            bundleData[network].forEach(bundle => {
                const card = createBundleCard({
                    network: network,
                    size: bundle.size,
                    validity: bundle.validity,
                    price: bundle.price,
                    bigTime: bundle.bigTime
                });
                container.appendChild(card);
            });
        });
    } catch (error) {
        console.error('Failed to load all bundles:', error);
        renderFallbackBundles();
    }
}

function renderFallbackBundles() {
    const container = el('#allBundles');
    if (!container) return;
    
    container.innerHTML = '';
    Object.keys(bundleData).forEach(network => {
        bundleData[network].forEach(bundle => {
            const card = createBundleCard({
                network: network,
                size: bundle.size,
                validity: bundle.validity,
                price: bundle.price,
                bigTime: bundle.bigTime
            });
            container.appendChild(card);
        });
    });
}

function createBundleCard(bundle) {
    const card = document.createElement('div');
    card.className = `bundle-card glass rounded-xl p-6 card-hover transition-all duration-300 ${getNetworkBorderClass(bundle.network)}`;
    card.setAttribute('data-network', bundle.network);
    
    card.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <div class="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center">
                <i class="${getNetworkIcon(bundle.network)} ${getNetworkColorClass(bundle.network)} text-xl"></i>
            </div>
            <div class="text-right">
                <div class="text-2xl font-black ${getNetworkColorClass(bundle.network)}">₵${bundle.price.toFixed(2)}</div>
                <div class="text-xs small-muted">${bundle.size}</div>
            </div>
        </div>
        
        <h3 class="text-xl font-bold mb-2">${bundle.network.toUpperCase()} ${bundle.size} — ${bundle.validity}</h3>
        <p class="small-muted text-sm mb-4">${bundle.bigTime ? 'BigTime Bundle • ' : ''}High speed internet • Instant delivery</p>
        
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
                <div class="w-2 h-2 ${getNetworkColorClass(bundle.network)} rounded-full animate-pulse"></div>
                <span class="text-xs small-muted">Popular</span>
            </div>
            <button class="quick-buy-btn px-4 py-2 ${getNetworkButtonClass(bundle.network)} rounded-lg font-semibold transition-all duration-200 hover:scale-105"
                    data-network="${bundle.network}" 
                    data-size="${bundle.size}" 
                    data-price="${bundle.price}">
                <i class="ri-shopping-cart-line mr-2"></i>Buy Now
            </button>
        </div>
    `;
    return card;
}

function filterBundles(network) {
    const bundles = document.querySelectorAll('.bundle-card');
    
    bundles.forEach(card => {
        if (network === 'all' || card.getAttribute('data-network') === network) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    
    appState.currentNetwork = network;
}

// ========== DASHBOARD SECTION ==========
function loadDashboardData() {
    console.log('Loading dashboard data...');
}

// ========== AGENT SECTION ==========
function loadAgentContent() {
    console.log('Loading agent section...');
}

// ========== MODAL MANAGEMENT ==========
function openBuyModal(network = 'mtn', size = '') {
    const modal = el('#buyModal');
    const opSelect = el('#opSelect');
    const planSelect = el('#planSelect');
    
    if (!modal || !opSelect || !planSelect) {
        console.error('Modal elements not found');
        return;
    }
    
    // Set network if provided
    if (network) {
        opSelect.value = network;
    }
    
    // Update plan options based on network
    updatePlanOptions();
    
    // Select specific size if provided
    if (size) {
        for (let i = 0; i < planSelect.options.length; i++) {
            if (planSelect.options[i].text.includes(size)) {
                planSelect.selectedIndex = i;
                break;
            }
        }
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    
    const phoneInput = el('#phoneInput');
    if (phoneInput) {
        phoneInput.classList.remove('border-red-500', 'text-red-400', 'border-green-500', 'text-green-400');
        phoneInput.value = '';
        phoneInput.placeholder = `Enter ${opSelect.value.toUpperCase()} number`;
    }
    
    el('#buyStatus').textContent = '';
    el('#confirmBuy').disabled = false;
    
    console.log('💰 Buy modal opened for:', network, size);
}

function closeBuyModal() {
    const modal = el('#buyModal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        el('#buyStatus').textContent = '';
        el('#confirmBuy').disabled = false;
        console.log('💰 Buy modal closed');
    }
}

function updatePlanOptions() {
    const opSelect = el('#opSelect');
    const planSelect = el('#planSelect');
    if (!opSelect || !planSelect) return;
    
    const network = opSelect.value;
    
    // Clear existing options
    planSelect.innerHTML = '';
    
    // Add options for selected network
    if (bundleData[network]) {
        bundleData[network].forEach(bundle => {
            const option = document.createElement('option');
            option.value = bundle.price;
            option.textContent = `${bundle.size} - ${bundle.validity} — ₵${bundle.price.toFixed(2)}`;
            if (bundle.bigTime) {
                option.textContent += ' (BigTime)';
            }
            planSelect.appendChild(option);
        });
    }
    
    // Update phone input placeholder
    const phoneInput = el('#phoneInput');
    if (phoneInput) {
        phoneInput.placeholder = `Enter ${network.toUpperCase()} number`;
    }
}

// ========== PAYMENT FLOW ==========
async function confirmPurchase() {
    console.log('🚀 Pay Now button clicked!');
    
    let phone = el('#phoneInput').value;
    const email = el('#emailInput').value || 'customer@mysterybundlehub.com';
    const amount = Number(el('#planSelect').value);
    const operator = el('#opSelect').value;
    const planText = el('#planSelect').options[el('#planSelect').selectedIndex].text;

    // Validate inputs
    if (!phone || !phone.trim()) {
        showStatus('Please enter your phone number', 'error');
        return;
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(phone);
    const isValidPhone = validatePhoneNumber(phone);

    if (!isValidPhone) {
        showStatus('Please enter a valid 10-digit Ghana number (e.g., 055 123 4567)', 'error');
        el('#phoneInput').classList.add('border-red-500', 'text-red-400');
        return;
    }

    phone = formattedPhone;

    if (!amount || amount <= 0) {
        showStatus('Please select a valid bundle', 'error');
        return;
    }

    showStatus('Processing your order...', 'info');
    showLoading();
    el('#confirmBuy').disabled = true;

    try {
        const reference = 'MBH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        console.log('📦 Creating payment...', { 
            operator, 
            amount, 
            phone, 
            email,
            reference 
        });

        // Check if Paystack is loaded
        if (typeof PaystackPop === 'undefined') {
            throw new Error('Payment system is not available. Please refresh the page and try again.');
        }

        // Initialize Paystack payment
        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: email,
            amount: amount * 100, // Convert to pesewas
            ref: reference,
            currency: 'GHS',
            channels: ['card', 'mobile_money'],
            metadata: {
                custom_fields: [
                    {
                        display_name: "Phone Number",
                        variable_name: "phone_number",
                        value: phone
                    },
                    {
                        display_name: "Network",
                        variable_name: "network",
                        value: operator.toUpperCase()
                    },
                    {
                        display_name: "Bundle",
                        variable_name: "bundle",
                        value: planText
                    }
                ]
            },
            callback: function(response) {
                // Payment successful
                console.log('✅ Payment successful:', response);
                showStatus('Payment successful! Processing your data bundle...', 'success');
                
                // Create order in backend
                createOrderBackend({
                    reference: response.reference,
                    phone: phone,
                    network: operator,
                    bundle: planText,
                    amount: amount,
                    status: 'success'
                });

                setTimeout(() => {
                    showStatus('Data bundle delivered successfully!', 'success');
                    closeBuyModal();
                    hideLoading();
                }, 3000);
            },
            onClose: function() {
                // Payment modal closed
                console.log('❌ Payment cancelled by user');
                hideLoading();
                el('#confirmBuy').disabled = false;
                showStatus('Payment cancelled', 'error');
                
                // Create failed order record
                createOrderBackend({
                    reference: reference,
                    phone: phone,
                    network: operator,
                    bundle: planText,
                    amount: amount,
                    status: 'cancelled'
                });
            }
        });

        // Open payment modal
        handler.openIframe();
        
    } catch (error) {
        console.error('❌ Payment process error:', error);
        showStatus('Payment failed: ' + error.message, 'error');
        hideLoading();
        el('#confirmBuy').disabled = false;
    }
}

// Backend order creation
async function createOrderBackend(orderData) {
    try {
        // Simulate API call to backend
        console.log('📋 Creating order in backend:', orderData);
        
        // In a real implementation, you would call your backend API
        // await apiService.createOrder(orderData);
        
        // For now, just log to console
        const orders = JSON.parse(localStorage.getItem('mbh_orders') || '[]');
        orders.push({
            ...orderData,
            id: 'ORD-' + Date.now(),
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('mbh_orders', JSON.stringify(orders));
        
    } catch (error) {
        console.error('Failed to create order in backend:', error);
    }
}

// Enhanced phone validation
function validatePhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    // Check length
    if (cleaned.length !== 10 && cleaned.length !== 12) {
        return false;
    }

    // Convert to 10-digit format if it's 12 digits (233 format)
    let formatted = cleaned;
    if (cleaned.length === 12 && cleaned.startsWith('233')) {
        formatted = '0' + cleaned.substring(3);
    }

    // Ghana number pattern (starts with 02, 05, or 05)
    const ghanaPattern = /^0[235][0-9]{8}$/;
    return ghanaPattern.test(formatted);
}

function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    
    // Convert from 233 to 0 format
    if (cleaned.startsWith('233') && cleaned.length === 12) {
        cleaned = '0' + cleaned.substring(3);
    }
    
    // Format as 055 123 4567
    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
    }
    
    return phone;
}

// ========== PUBLIC FUNCTIONS (for HTML onclick) ==========
function registerAsAgent(plan) {
    var label = plan ? String(plan) + ' — ' : '';
    alert(label + 'Agent registration is coming soon 🚀');
}

// Make functions globally available
window.openBuyModal = openBuyModal;
window.closeBuyModal = closeBuyModal;
window.quickBuy = openBuyModal;
window.confirmBuy = confirmPurchase;
window.formatPhoneNumber = formatPhoneNumber;
window.validatePhoneNumber = validatePhoneNumber;
window.registerAsAgent = registerAsAgent;
window.filterBundles = filterBundles;
window.filterFeaturedBundles = filterFeaturedBundles;