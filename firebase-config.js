// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZFe7WckxIAM_qA-j4WeZoQdcnhWV1Bic",
  authDomain: "role-base-auth-d2d90.firebaseapp.com",
  projectId: "role-base-auth-d2d90",
  storageBucket: "role-base-auth-d2d90.firebasestorage.app",
  messagingSenderId: "674891775049",
  appId: "1:674891775049:web:20beb5bbcd7f1a772e5398"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable persistence
firebase.firestore().enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Persistence failed');
        } else if (err.code == 'unimplemented') {
            console.log('Persistence not available');
        }
    });