// Advanced Agent Pricing Management System
class AgentPricingManager {
    constructor() {
        this.basePrices = {};
        this.agentPrices = {};
        this.profitMargins = {};
        this.initialize();
    }

    initialize() {
        this.loadBasePrices();
        this.loadAgentSettings();
        this.setupEventListeners();
    }

    // Load base prices from your main bundle data
    loadBasePrices() {
        this.basePrices = {
            mtn: [
                { code: 'mtn-1gb', size: '1GB', validity: '7 days', price: 5.00 },
                { code: 'mtn-2gb', size: '2GB', validity: '7 days', price: 9.50 },
                { code: 'mtn-3gb', size: '3GB', validity: '7 days', price: 13.80 },
                { code: 'mtn-4gb', size: '4GB', validity: '7 days', price: 18.80 },
                { code: 'mtn-5gb', size: '5GB', validity: '7 days', price: 23.00 },
                { code: 'mtn-6gb', size: '6GB', validity: '7 days', price: 28.50 },
                { code: 'mtn-7gb', size: '7GB', validity: '7 days', price: 33.00 },
                { code: 'mtn-8gb', size: '8GB', validity: '7 days', price: 37.50 },
                { code: 'mtn-9gb', size: '9GB', validity: '7 days', price: 41.50 },
                { code: 'mtn-10gb', size: '10GB', validity: '7 days', price: 44.50 },
                { code: 'mtn-12gb', size: '12GB', validity: '30 days', price: 56.50 },
                { code: 'mtn-15gb', size: '15GB', validity: '30 days', price: 66.00 },
                { code: 'mtn-20gb', size: '20GB', validity: '30 days', price: 86.00 },
                { code: 'mtn-25gb', size: '25GB', validity: '30 days', price: 108.00 },
                { code: 'mtn-30gb', size: '30GB', validity: '30 days', price: 129.00 },
                { code: 'mtn-40gb', size: '40GB', validity: '30 days', price: 170.00 },
                { code: 'mtn-50gb', size: '50GB', validity: '30 days', price: 205.00 },
                { code: 'mtn-100gb', size: '100GB', validity: '90 days', price: 399.00 }
            ],
            airteltigo: [
                { code: 'airtel-1gb', size: '1GB', validity: '7 days', price: 5.00 },
                { code: 'airtel-2gb', size: '2GB', validity: '7 days', price: 9.00 },
                { code: 'airtel-3gb', size: '3GB', validity: '7 days', price: 13.00 },
                { code: 'airtel-4gb', size: '4GB', validity: '7 days', price: 17.50 },
                { code: 'airtel-5gb', size: '5GB', validity: '7 days', price: 21.50 },
                { code: 'airtel-6gb', size: '6GB', validity: '7 days', price: 25.50 },
                { code: 'airtel-7gb', size: '7GB', validity: '7 days', price: 30.00 },
                { code: 'airtel-8gb', size: '8GB', validity: '7 days', price: 34.00 },
                { code: 'airtel-9gb', size: '9GB', validity: '7 days', price: 38.00 },
                { code: 'airtel-10gb', size: '10GB', validity: '7 days', price: 42.00 },
                { code: 'airtel-12gb', size: '12GB', validity: '30 days', price: 50.00 },
                { code: 'airtel-15gb', size: '15GB', validity: '30 days', price: 63.00 },
                { code: 'airtel-20gb', size: '20GB', validity: '30 days', price: 85.00 },
                { code: 'airtel-25gb', size: '25GB', validity: '30 days', price: 105.00 },
                { code: 'airtel-30gb', size: '30GB', validity: '30 days', price: 125.00 },
                { code: 'airtel-40gb', size: '40GB', validity: '30 days', price: 90.00, bigTime: true },
                { code: 'airtel-50gb', size: '50GB', validity: '30 days', price: 100.00, bigTime: true },
                { code: 'airtel-60gb', size: '60GB', validity: '30 days', price: 117.00, bigTime: true },
                { code: 'airtel-70gb', size: '70GB', validity: '30 days', price: 140.00, bigTime: true },
                { code: 'airtel-80gb', size: '80GB', validity: '30 days', price: 165.00, bigTime: true },
                { code: 'airtel-90gb', size: '90GB', validity: '30 days', price: 182.00, bigTime: true },
                { code: 'airtel-100gb', size: '100GB', validity: '30 days', price: 200.00, bigTime: true }
            ],
            telecel: [
                { code: 'telecel-5gb', size: '5GB', validity: '7 days', price: 23.00 },
                { code: 'telecel-10gb', size: '10GB', validity: '30 days', price: 43.00 },
                { code: 'telecel-15gb', size: '15GB', validity: '30 days', price: 61.00 },
                { code: 'telecel-20gb', size: '20GB', validity: '30 days', price: 80.00 },
                { code: 'telecel-25gb', size: '25GB', validity: '30 days', price: 99.00 },
                { code: 'telecel-30gb', size: '30GB', validity: '30 days', price: 117.00 },
                { code: 'telecel-40gb', size: '40GB', validity: '30 days', price: 157.00 },
                { code: 'telecel-50gb', size: '50GB', validity: '30 days', price: 195.00 },
                { code: 'telecel-100gb', size: '100GB', validity: '90 days', price: 390.00 }
            ]
        };
    }

    // Load agent settings from localStorage or set defaults
    loadAgentSettings() {
        const savedPrices = localStorage.getItem('agentPrices');
        const savedMargins = localStorage.getItem('agentProfitMargins');
        
        if (savedPrices) {
            this.agentPrices = JSON.parse(savedPrices);
        } else {
            // Set default agent prices (base price + 10%)
            this.setDefaultPrices();
        }

        if (savedMargins) {
            this.profitMargins = JSON.parse(savedMargins);
        } else {
            // Set default profit margins (10% for all)
            this.setDefaultMargins();
        }
    }

    setDefaultPrices() {
        Object.keys(this.basePrices).forEach(network => {
            this.basePrices[network].forEach(bundle => {
                const defaultPrice = bundle.price * 1.10; // 10% markup
                this.agentPrices[bundle.code] = Math.ceil(defaultPrice * 100) / 100; // Round to 2 decimal places
            });
        });
        this.saveAgentPrices();
    }

    setDefaultMargins() {
        Object.keys(this.basePrices).forEach(network => {
            this.basePrices[network].forEach(bundle => {
                this.profitMargins[bundle.code] = 10; // 10% default margin
            });
        });
        this.saveProfitMargins();
    }

    setupEventListeners() {
        // Global event listeners for pricing features
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('agent-price-input')) {
                this.handlePriceChange(e.target);
            }
            if (e.target.classList.contains('margin-input')) {
                this.handleMarginChange(e.target);
            }
        });
    }

    handlePriceChange(input) {
        const productCode = input.dataset.productCode;
        const newPrice = parseFloat(input.value);
        const basePrice = this.getBasePrice(productCode);

        if (newPrice < basePrice) {
            input.value = basePrice;
            this.showNotification('Price cannot be lower than base price', 'error');
            return;
        }

        this.agentPrices[productCode] = newPrice;
        this.updateProfitDisplay(productCode);
        this.saveAgentPrices();
    }

    handleMarginChange(input) {
        const productCode = input.dataset.productCode;
        const margin = parseFloat(input.value);
        const basePrice = this.getBasePrice(productCode);

        if (margin < 0) {
            input.value = 0;
            this.showNotification('Margin cannot be negative', 'error');
            return;
        }

        this.profitMargins[productCode] = margin;
        const newPrice = basePrice * (1 + margin / 100);
        this.agentPrices[productCode] = Math.ceil(newPrice * 100) / 100;
        
        this.updatePriceDisplay(productCode);
        this.saveAgentPrices();
        this.saveProfitMargins();
    }

    getBasePrice(productCode) {
        for (const network in this.basePrices) {
            const bundle = this.basePrices[network].find(b => b.code === productCode);
            if (bundle) return bundle.price;
        }
        return 0;
    }

    updateProfitDisplay(productCode) {
        const basePrice = this.getBasePrice(productCode);
        const agentPrice = this.agentPrices[productCode];
        const profit = agentPrice - basePrice;
        const profitElement = document.querySelector(`[data-profit-for="${productCode}"]`);
        
        if (profitElement) {
            profitElement.textContent = `₵${profit.toFixed(2)}`;
            profitElement.className = `profit-display ${profit > 0 ? 'text-green-400' : 'text-red-400'}`;
        }
    }

    updatePriceDisplay(productCode) {
        const priceElement = document.querySelector(`[data-price-for="${productCode}"]`);
        if (priceElement) {
            priceElement.value = this.agentPrices[productCode].toFixed(2);
        }
    }

    // Bulk pricing operations
    applyBulkMargin(network, marginPercentage) {
        if (!this.basePrices[network]) return;

        this.basePrices[network].forEach(bundle => {
            this.profitMargins[bundle.code] = marginPercentage;
            this.agentPrices[bundle.code] = Math.ceil(bundle.price * (1 + marginPercentage / 100) * 100) / 100;
        });

        this.saveAgentPrices();
        this.saveProfitMargins();
        this.refreshPricingDisplay();
        this.showNotification(`Applied ${marginPercentage}% margin to all ${network.toUpperCase()} bundles`, 'success');
    }

    applyGlobalMargin(marginPercentage) {
        Object.keys(this.basePrices).forEach(network => {
            this.applyBulkMargin(network, marginPercentage);
        });
    }

    // Advanced pricing strategies
    applyCompetitivePricing() {
        Object.keys(this.basePrices).forEach(network => {
            this.basePrices[network].forEach(bundle => {
                let margin = 8; // Base 8%
                
                // Higher margins for smaller bundles (more competitive)
                if (bundle.size.includes('GB')) {
                    const size = parseInt(bundle.size);
                    if (size <= 5) margin = 12;
                    else if (size <= 10) margin = 10;
                    else if (size <= 20) margin = 8;
                    else margin = 6;
                }

                this.profitMargins[bundle.code] = margin;
                this.agentPrices[bundle.code] = Math.ceil(bundle.price * (1 + margin / 100) * 100) / 100;
            });
        });

        this.saveAgentPrices();
        this.saveProfitMargins();
        this.refreshPricingDisplay();
        this.showNotification('Applied competitive pricing strategy', 'success');
    }

    applyPremiumPricing() {
        Object.keys(this.basePrices).forEach(network => {
            this.basePrices[network].forEach(bundle => {
                let margin = 15; // Base 15%
                
                // Higher margins for larger bundles (premium customers)
                if (bundle.size.includes('GB')) {
                    const size = parseInt(bundle.size);
                    if (size <= 5) margin = 10;
                    else if (size <= 10) margin = 12;
                    else if (size <= 20) margin = 15;
                    else margin = 18;
                }

                this.profitMargins[bundle.code] = margin;
                this.agentPrices[bundle.code] = Math.ceil(bundle.price * (1 + margin / 100) * 100) / 100;
            });
        });

        this.saveAgentPrices();
        this.saveProfitMargins();
        this.refreshPricingDisplay();
        this.showNotification('Applied premium pricing strategy', 'success');
    }

    // Price analysis and insights
    getPricingInsights() {
        const insights = {
            totalProducts: 0,
            totalPotentialProfit: 0,
            averageMargin: 0,
            highestMargin: { product: '', margin: 0 },
            lowestMargin: { product: '', margin: 100 }
        };

        Object.keys(this.basePrices).forEach(network => {
            this.basePrices[network].forEach(bundle => {
                insights.totalProducts++;
                const basePrice = bundle.price;
                const agentPrice = this.agentPrices[bundle.code];
                const profit = agentPrice - basePrice;
                const margin = ((profit / basePrice) * 100);
                
                insights.totalPotentialProfit += profit;
                insights.averageMargin += margin;

                if (margin > insights.highestMargin.margin) {
                    insights.highestMargin = { product: bundle.size, margin: margin };
                }
                if (margin < insights.lowestMargin.margin) {
                    insights.lowestMargin = { product: bundle.size, margin: margin };
                }
            });
        });

        insights.averageMargin = insights.totalProducts > 0 ? insights.averageMargin / insights.totalProducts : 0;
        return insights;
    }

    // Export/Import pricing
    exportPricingSettings() {
        const settings = {
            agentPrices: this.agentPrices,
            profitMargins: this.profitMargins,
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `agent-pricing-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        this.showNotification('Pricing settings exported successfully', 'success');
    }

    importPricingSettings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                this.agentPrices = settings.agentPrices || {};
                this.profitMargins = settings.profitMargins || {};
                
                this.saveAgentPrices();
                this.saveProfitMargins();
                this.refreshPricingDisplay();
                this.showNotification('Pricing settings imported successfully', 'success');
            } catch (error) {
                this.showNotification('Failed to import pricing settings', 'error');
            }
        };
        reader.readAsText(file);
    }

    // Utility methods
    saveAgentPrices() {
        localStorage.setItem('agentPrices', JSON.stringify(this.agentPrices));
    }

    saveProfitMargins() {
        localStorage.setItem('agentProfitMargins', JSON.stringify(this.profitMargins));
    }

    refreshPricingDisplay() {
        // This will be called by the dashboard to refresh the UI
        if (typeof window.loadPricingForm === 'function') {
            window.loadPricingForm();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg glass border-l-4 ${
            type === 'success' ? 'border-green-400 bg-green-400/10' :
            type === 'error' ? 'border-red-400 bg-red-400/10' :
            'border-blue-400 bg-blue-400/10'
        } z-50`;
        
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="ri-${type === 'success' ? 'check' : type === 'error' ? 'close' : 'information'}-line 
                   text-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'}-400"></i>
                <span class="text-white">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    // Get all products with pricing information for display
    getAllProducts() {
        const products = [];
        Object.keys(this.basePrices).forEach(network => {
            this.basePrices[network].forEach(bundle => {
                const basePrice = bundle.price;
                const agentPrice = this.agentPrices[bundle.code] || basePrice;
                const profit = agentPrice - basePrice;
                const margin = this.profitMargins[bundle.code] || 0;

                products.push({
                    code: bundle.code,
                    operator: network.charAt(0).toUpperCase() + network.slice(1),
                    name: `${bundle.size} - ${bundle.validity}`,
                    data_amount: bundle.size,
                    validity: bundle.validity,
                    basePrice: basePrice,
                    agentPrice: agentPrice,
                    markup: profit,
                    margin: margin,
                    bigTime: bundle.bigTime || false
                });
            });
        });
        return products;
    }

    // Quick price update methods
    increaseAllPrices(percentage) {
        Object.keys(this.agentPrices).forEach(code => {
            const currentPrice = this.agentPrices[code];
            this.agentPrices[code] = Math.ceil(currentPrice * (1 + percentage / 100) * 100) / 100;
        });
        this.saveAgentPrices();
        this.refreshPricingDisplay();
        this.showNotification(`Increased all prices by ${percentage}%`, 'success');
    }

    decreaseAllPrices(percentage) {
        Object.keys(this.agentPrices).forEach(code => {
            const currentPrice = this.agentPrices[code];
            const basePrice = this.getBasePrice(code);
            const newPrice = Math.ceil(currentPrice * (1 - percentage / 100) * 100) / 100;
            this.agentPrices[code] = Math.max(newPrice, basePrice);
        });
        this.saveAgentPrices();
        this.refreshPricingDisplay();
        this.showNotification(`Decreased all prices by ${percentage}%`, 'success');
    }
}

// Initialize the pricing manager globally
window.AgentPricingManager = new AgentPricingManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AgentPricingManager;
}