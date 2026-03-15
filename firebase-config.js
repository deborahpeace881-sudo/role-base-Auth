// firebase-config.js
const firebaseConfig = {
    apiKey: window.APP_CONFIG.FIREBASE_API_KEY,
    authDomain: window.APP_CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: window.APP_CONFIG.FIREBASE_PROJECT_ID,
    storageBucket: window.APP_CONFIG.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.APP_CONFIG.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.APP_CONFIG.FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();