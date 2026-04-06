// Admin Dashboard Configuration
const ADMIN_CONFIG = {
    apiBase: 'http://localhost:3000/api',
    itemsPerPage: 10,
    currentPage: 1
};

// Mock Data (Replace with actual API calls)
const mockOrders = [
    {
        id: 'MBH-001',
        phone: '0550123456',
        network: 'mtn',
        plan: '1GB - 7 days',
        amount: 5.00,
        paymentStatus: 'paid',
        deliveryStatus: 'delivered',
        createdAt: new Date('2024-01-15T10:30:00')
    },
    {
        id: 'MBH-002',
        phone: '0549876543',
        network: 'airteltigo',
        plan: '5GB - 7 days',
        amount: 21.50,
        paymentStatus: 'paid',
        deliveryStatus: 'pending',
        createdAt: new Date('2024-01-15T11:15:00')
    },
    {
        id: 'MBH-003',
        phone: '0531122334',
        network: 'telecel',
        plan: '10GB - 30 days',
        amount: 43.00,
        paymentStatus: 'paid',
        deliveryStatus: 'failed',
        createdAt: new Date('2024-01-15T12:00:00')
    }
];

const mockTransactions = [
    {
        id: 'txn_001',
        email: 'customer1@email.com',
        amount: 5.00,
        status: 'success',
        createdAt: new Date('2024-01-15T10:30:00'),
        orderId: 'MBH-001',
        reference: 'MBH-001-ref'
    }
];

const mockProducts = [
    { network: 'mtn', size: '1GB', validity: '7 days', price: 5.00 },
    { network: 'mtn', size: '5GB', validity: '7 days', price: 23.00 },
    { network: 'airteltigo', size: '1GB', validity: '7 days', price: 5.00 },
    { network: 'telecel', size: '5GB', validity: '7 days', price: 23.00 }
];

// Initialize Admin Dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
    loadDashboardData();
    loadOrders();
    loadTransactions();
    loadProducts();
    initializeCharts();
});

// Core Functions
function initializeAdmin() {
    setupEventListeners();
    updateActiveNav('dashboard');
}

function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    
    // Filter events
    document.getElementById('searchOrders').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('networkFilter').addEventListener('change', applyFilters);
}

// Section Management
function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('[id$="-section"]').forEach(section => {
        section.classList.add('section-hidden');
        section.classList.remove('section-active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.remove('section-hidden');
        targetSection.classList.add('section-active');
        
        // Update page title
        const titles = {
            dashboard: 'Dashboard Overview',
            orders: 'Orders Management',
            transactions: 'Transactions',
            products: 'Products Management',
            settings: 'Settings'
        };
        document.getElementById('pageTitle').textContent = titles[sectionName];
        
        // Load section-specific data
        if (sectionName === 'dashboard') {
            loadDashboardData();
        } else if (sectionName === 'orders') {
            loadOrders();
        } else if (sectionName === 'transactions') {
            loadTransactions();
        } else if (sectionName === 'products') {
            loadProducts();
        }
    }
    
    updateActiveNav(sectionName);
}

function updateActiveNav(activeSection) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeNav = document.querySelector(`[onclick="switchSection('${activeSection}')"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
}

// Sidebar Management
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('ml-0');
    mainContent.classList.toggle('ml-64');
}

// Dashboard Functions
function loadDashboardData() {
    // Load recent orders for dashboard
    const recentOrders = mockOrders.slice(0, 5);
    displayRecentOrders(recentOrders);
}

function displayRecentOrders(orders) {
    const container = document.getElementById('recentOrdersTable');
    
    if (orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="ri-inbox-line text-4xl mb-4"></i>
                <p>No recent orders</p>
            </div>
        `;
        return;
    }
    
    const ordersHTML = orders.map(order => `
        <div class="flex items-center justify-between p-4 border-b border-gray-700 table-row">
            <div class="flex-1">
                <div class="font-medium">${order.id}</div>
                <div class="text-sm text-gray-400">${order.phone}</div>
            </div>
            <div class="flex-1">
                <span class="status-badge ${getNetworkBadgeClass(order.network)}">${order.network.toUpperCase()}</span>
            </div>
            <div class="flex-1 text-sm">${order.plan}</div>
            <div class="flex-1 font-medium">₵${order.amount.toFixed(2)}</div>
            <div class="flex-1">
                <span class="status-badge status-${order.deliveryStatus}">${order.deliveryStatus}</span>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = ordersHTML;
}

// Orders Management
function loadOrders() {
    displayOrders(mockOrders);
}

function displayOrders(orders) {
    const container = document.getElementById('ordersTable');
    
    if (orders.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-8 text-gray-500">
                    <i class="ri-inbox-line text-4xl mb-4"></i>
                    <p>No orders found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const ordersHTML = orders.map(order => `
        <tr class="border-b border-gray-700 table-row">
            <td class="py-3 px-4">
                <div class="font-medium">${order.id}</div>
            </td>
            <td class="py-3 px-4">
                <div class="font-medium">${order.phone}</div>
            </td>
            <td class="py-3 px-4">
                <span class="status-badge ${getNetworkBadgeClass(order.network)}">${order.network.toUpperCase()}</span>
            </td>
            <td class="py-3 px-4">${order.plan}</td>
            <td class="py-3 px-4 font-medium">₵${order.amount.toFixed(2)}</td>
            <td class="py-3 px-4">
                <span class="status-badge status-${order.paymentStatus}">${order.paymentStatus}</span>
            </td>
            <td class="py-3 px-4">
                <span class="status-badge status-${order.deliveryStatus}">${order.deliveryStatus}</span>
            </td>
            <td class="py-3 px-4 text-sm text-gray-400">
                ${formatDate(order.createdAt)}
            </td>
            <td class="py-3 px-4">
                <div class="flex space-x-2">
                    <button onclick="markDelivered('${order.id}')" class="p-1 text-green-400 hover:bg-green-400/20 rounded transition-colors" title="Mark Delivered">
                        <i class="ri-check-line"></i>
                    </button>
                    <button onclick="markFailed('${order.id}')" class="p-1 text-red-400 hover:bg-red-400/20 rounded transition-colors" title="Mark Failed">
                        <i class="ri-close-line"></i>
                    </button>
                    <button onclick="sendToWhatsApp('${order.id}')" class="p-1 text-blue-400 hover:bg-blue-400/20 rounded transition-colors" title="Send to WhatsApp">
                        <i class="ri-whatsapp-line"></i>
                    </button>
                    <button onclick="deleteOrder('${order.id}')" class="p-1 text-gray-400 hover:bg-red-400/20 rounded transition-colors" title="Delete">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    container.innerHTML = ordersHTML;
    
    // Update pagination info
    updatePaginationInfo(orders.length);
}

function applyFilters() {
    const status = document.getElementById('statusFilter').value;
    const network = document.getElementById('networkFilter').value;
    const search = document.getElementById('searchOrders').value.toLowerCase();
    
    let filteredOrders = mockOrders;
    
    if (status !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.deliveryStatus === status);
    }
    
    if (network !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.network === network);
    }
    
    if (search) {
        filteredOrders = filteredOrders.filter(order => 
            order.phone.includes(search) || 
            order.id.toLowerCase().includes(search)
        );
    }
    
    displayOrders(filteredOrders);
}

// Order Actions
function markDelivered(orderId) {
    showLoading();
    setTimeout(() => {
        hideLoading();
        showNotification(`Order ${orderId} marked as delivered`, 'success');
        // In real app, update via API
    }, 1000);
}

function markFailed(orderId) {
    showLoading();
    setTimeout(() => {
        hideLoading();
        showNotification(`Order ${orderId} marked as failed`, 'warning');
        // In real app, update via API
    }, 1000);
}

function sendToWhatsApp(orderId) {
    const order = mockOrders.find(o => o.id === orderId);
    if (order) {
        const message = `Order Details:\nID: ${order.id}\nPhone: ${order.phone}\nPlan: ${order.plan}\nAmount: ₵${order.amount}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }
}

function deleteOrder(orderId) {
    if (confirm(`Are you sure you want to delete order ${orderId}?`)) {
        showLoading();
        setTimeout(() => {
            hideLoading();
            showNotification(`Order ${orderId} deleted`, 'success');
            // In real app, delete via API
        }, 1000);
    }
}

// Transactions Management
function loadTransactions() {
    displayTransactions(mockTransactions);
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsTable');
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-gray-500">
                    <i class="ri-inbox-line text-4xl mb-4"></i>
                    <p>No transactions found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const transactionsHTML = transactions.map(transaction => `
        <tr class="border-b border-gray-700 table-row">
            <td class="py-3 px-4 font-mono text-sm">${transaction.id}</td>
            <td class="py-3 px-4">${transaction.email}</td>
            <td class="py-3 px-4 font-medium">₵${transaction.amount.toFixed(2)}</td>
            <td class="py-3 px-4">
                <span class="status-badge status-${transaction.status}">${transaction.status}</span>
            </td>
            <td class="py-3 px-4 text-sm text-gray-400">
                ${formatDate(transaction.createdAt)}
            </td>
            <td class="py-3 px-4 font-mono text-sm">${transaction.orderId}</td>
            <td class="py-3 px-4 font-mono text-sm">${transaction.reference}</td>
        </tr>
    `).join('');
    
    container.innerHTML = transactionsHTML;
}

// Products Management
function loadProducts() {
    displayProducts(mockProducts);
}

function displayProducts(products) {
    const container = document.getElementById('productsGrid');
    
    const productsHTML = products.map(product => `
        <div class="stat-card rounded-xl p-6" data-network="${product.network}">
            <div class="flex items-center justify-between mb-4">
                <span class="status-badge ${getNetworkBadgeClass(product.network)}">${product.network.toUpperCase()}</span>
                <div class="flex space-x-2">
                    <button onclick="editProduct('${product.network}', '${product.size}')" class="p-1 text-blue-400 hover:bg-blue-400/20 rounded transition-colors">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button onclick="deleteProduct('${product.network}', '${product.size}')" class="p-1 text-red-400 hover:bg-red-400/20 rounded transition-colors">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </div>
            <h3 class="text-xl font-bold mb-2">${product.size}</h3>
            <p class="text-gray-400 mb-4">${product.validity}</p>
            <div class="flex items-center justify-between">
                <span class="text-2xl font-bold text-hubGreen">₵${product.price.toFixed(2)}</span>
                <span class="text-sm text-gray-400">Active</span>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = productsHTML;
}

function filterProducts(network) {
    const products = document.querySelectorAll('#productsGrid > div');
    products.forEach(product => {
        if (network === 'all' || product.getAttribute('data-network') === network) {
            product.style.display = 'block';
        } else {
            product.style.display = 'none';
        }
    });
}

function showAddProductModal() {
    document.getElementById('addProductModal').classList.remove('hidden');
}

function closeAddProductModal() {
    document.getElementById('addProductModal').classList.add('hidden');
}

function saveProduct() {
    const network = document.getElementById('productNetwork').value;
    const size = document.getElementById('productSize').value;
    const validity = document.getElementById('productValidity').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    
    if (!size || !validity || !price) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    showLoading();
    setTimeout(() => {
        hideLoading();
        closeAddProductModal();
        showNotification('Product added successfully', 'success');
        // In real app, save via API and reload products
    }, 1000);
}

function editProduct(network, size) {
    // Implementation for editing product
    showNotification(`Editing ${network} ${size}`, 'info');
}

function deleteProduct(network, size) {
    if (confirm(`Delete ${network} ${size}?`)) {
        showLoading();
        setTimeout(() => {
            hideLoading();
            showNotification('Product deleted', 'success');
            // In real app, delete via API and reload products
        }, 1000);
    }
}

// Settings Management
function saveWhatsAppSettings() {
    const number = document.getElementById('whatsappNumber').value;
    const apiKey = document.getElementById('whatsappApiKey').value;
    
    showLoading();
    setTimeout(() => {
        hideLoading();
        showNotification('WhatsApp settings saved successfully', 'success');
    }, 1000);
}

function updateAdminProfile() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    
    if (password && password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    showLoading();
    setTimeout(() => {
        hideLoading();
        showNotification('Profile updated successfully', 'success');
    }, 1000);
}

// Utility Functions
function getNetworkBadgeClass(network) {
    switch(network) {
        case 'mtn': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'airteltigo': return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'telecel': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg glass border-l-4 ${
        type === 'success' ? 'border-green-400' :
        type === 'error' ? 'border-red-400' :
        type === 'warning' ? 'border-yellow-400' : 'border-blue-400'
    } z-50 transform translate-x-full transition-transform duration-300`;
    
    notification.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="ri-${type === 'success' ? 'check' : type === 'error' ? 'close' : type === 'warning' ? 'alert' : 'information'}-line text-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-400"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function refreshOrders() {
    showLoading();
    setTimeout(() => {
        hideLoading();
        loadOrders();
        showNotification('Orders refreshed', 'success');
    }, 1000);
}

function refreshTransactions() {
    showLoading();
    setTimeout(() => {
        hideLoading();
        loadTransactions();
        showNotification('Transactions refreshed', 'success');
    }, 1000);
}

function exportOrders() {
    showLoading();
    setTimeout(() => {
        hideLoading();
        showNotification('Orders exported successfully', 'success');
        // In real app, generate and download CSV/Excel
    }, 1000);
}

function updatePaginationInfo(totalItems) {
    const start = (ADMIN_CONFIG.currentPage - 1) * ADMIN_CONFIG.itemsPerPage + 1;
    const end = Math.min(start + ADMIN_CONFIG.itemsPerPage - 1, totalItems);
    
    document.getElementById('ordersStart').textContent = start;
    document.getElementById('ordersEnd').textContent = end;
    document.getElementById('ordersTotal').textContent = totalItems;
}

function previousPage() {
    if (ADMIN_CONFIG.currentPage > 1) {
        ADMIN_CONFIG.currentPage--;
        loadOrders();
    }
}

function nextPage() {
    ADMIN_CONFIG.currentPage++;
    loadOrders();
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        showLoading();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
}

// Chart Initialization
function initializeCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            datasets: [{
                label: 'Revenue (₵)',
                data: [8500, 9200, 10500, 11400, 12458, 13800, 15200],
                borderColor: '#00e07a',
                backgroundColor: 'rgba(0, 224, 122, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });

    // Network Performance Chart
    const networkCtx = document.getElementById('networkChart').getContext('2d');
    new Chart(networkCtx, {
        type: 'doughnut',
        data: {
            labels: ['MTN', 'AirtelTigo', 'Telecel'],
            datasets: [{
                data: [65, 25, 10],
                backgroundColor: [
                    'rgba(255, 204, 0, 0.8)',
                    'rgba(228, 0, 43, 0.8)',
                    'rgba(0, 161, 224, 0.8)'
                ],
                borderColor: [
                    '#ffcc00',
                    '#e4002b',
                    '#00a1e0'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}