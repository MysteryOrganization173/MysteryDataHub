// Paystack Configuration
const PAYSTACK_CONFIG = {
    publicKey: "pk_test_fe583185a7778864a062d8d0fa468bfc4295873b", // Replace with your actual key
    secretKey: "sk_test_290393e88f20f3d1cb573b4a0f58f244b2a3ca64",   // Replace with your actual key
    baseUrl: "https://api.paystack.co",
    
    // Payment endpoints
    endpoints: {
        initialize: "/transaction/initialize",
        verify: "/transaction/verify",
        bankList: "/bank",
        resolveAccount: "/bank/resolve"
    },
    
    // Default currency
    currency: "GHS",
    
    // Channels
    channels: ["card", "bank", "ussd", "qr", "mobile_money"],
    
    // Bearer countries
    bearer: "account"
};

// Network-specific configurations
const NETWORK_CONFIG = {
    mtn: {
        code: "MTN",
        channels: ["mobile_money"],
        currency: "GHS"
    },
    airteltigo: {
        code: "ATL",
        channels: ["mobile_money"], 
        currency: "GHS"
    },
    telecel: {
        code: "TCL",
        channels: ["mobile_money"],
        currency: "GHS"
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PAYSTACK_CONFIG, NETWORK_CONFIG };
}