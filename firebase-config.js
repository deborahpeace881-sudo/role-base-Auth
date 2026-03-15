// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDZFe7WckxIAM_qA-j4WeZoQdcnhWV1Bic",
    authDomain: "role-base-auth-d2d90.firebaseapp.com",
    projectId: "role-base-auth-d2d90",
    storageBucket: "role-base-auth-d2d90.firebasestorage.app",
    messagingSenderId: "674891775049",
    appId: "1:674891775049:web:20beb5bbcd7f1a772e5398"
};

// Initialize Firebase only if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized
}

const auth = firebase.auth();
const db = firebase.firestore();

// Enable persistence for better offline support
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Persistence failed - multiple tabs open');
        } else if (err.code == 'unimplemented') {
            console.log('Persistence not available');
        }
    });

// Make auth and db available globally
window.auth = auth;
window.db = db;