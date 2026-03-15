// auth-check.js - Handle authentication state globally
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a page that doesn't require auth
    const publicPages = ['index.html', 'login.html', 'register.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (publicPages.includes(currentPage)) {
        // On public pages, redirect to dashboard if already logged in
        firebase.auth().onAuthStateChanged((user) => {
            if (user && user.emailVerified) {
                window.location.href = 'dashboard.html';
            }
        });
    } else {
        // On protected pages, redirect to login if not authenticated
        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = 'login.html';
            } else if (!user.emailVerified && currentPage !== 'verify-email.html') {
                window.location.href = 'login.html?verify=required';
            }
        });
    }
});