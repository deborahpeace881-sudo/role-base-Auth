// config.js - Configuration for different environments
const CONFIG = {
    // For local development - use actual values
    development: {
        IPINFO_TOKEN: "906010040ccc69",
        FIREBASE_API_KEY: "AIzaSyDZFe7WckxIAM_qA-j4WeZoQdcnhWV1Bic",
        FIREBASE_AUTH_DOMAIN: "role-base-auth-d2d90.firebaseapp.com",
        FIREBASE_PROJECT_ID: "role-base-auth-d2d90",
        FIREBASE_STORAGE_BUCKET: "role-base-auth-d2d90.firebasestorage.app",
        FIREBASE_MESSAGING_SENDER_ID: "674891775049",
        FIREBASE_APP_ID: "1:674891775049:web:20beb5bbcd7f1a772e5398"
    },
    // For production - these will be replaced by Netlify
    production: {
        IPINFO_TOKEN: "906010040ccc69", // Same token for now
        // Firebase config same as above
        FIREBASE_API_KEY: "AIzaSyDZFe7WckxIAM_qA-j4WeZoQdcnhWV1Bic",
        FIREBASE_AUTH_DOMAIN: "role-base-auth-d2d90.firebaseapp.com",
        FIREBASE_PROJECT_ID: "role-base-auth-d2d90",
        FIREBASE_STORAGE_BUCKET: "role-base-auth-d2d90.firebasestorage.app",
        FIREBASE_MESSAGING_SENDER_ID: "674891775049",
        FIREBASE_APP_ID: "1:674891775049:web:20beb5bbcd7f1a772e5398"
    }
};

// Detect environment
const environment = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' 
                    ? 'development' : 'production';

// Export config
window.APP_CONFIG = CONFIG[environment];