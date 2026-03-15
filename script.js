// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let currentUserRole = null;
let userDevice = null;
let userIP = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Get device info
    const parser = new UAParser();
    userDevice = parser.getResult();
    
    // Get IP info
    await getUserIP();
    
    // Check auth state
    auth.onAuthStateChanged(handleAuthStateChange);
    
    // Initialize page-specific functionality
    initializePage();
});

// ==================== AUTHENTICATION FUNCTIONS ====================

// Handle auth state changes
async function handleAuthStateChange(user) {
    currentUser = user;
    
    if (user) {
        if (!user.emailVerified) {
            showEmailVerificationAlert();
        } else {
            await updateUserLastLogin(user.uid);
            await getUserRole(user.uid);
        }
    } else {
        currentUserRole = null;
    }
}

// Login with email/password
async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
            Swal.fire({
                icon: 'warning',
                title: 'Email Not Verified',
                text: 'Please verify your email before logging in.',
                showCancelButton: true,
                confirmButtonText: 'Resend Verification',
                cancelButtonText: 'OK'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await user.sendEmailVerification();
                    Swal.fire('Success', 'Verification email sent!', 'success');
                }
            });
            return false;
        }
        
        await createLog('login', 'success', user.uid);
        return true;
    } catch (error) {
        await createLog('login', 'failed', null, error.message);
        throw error;
    }
}

// Register new user
async function registerUser(email, password, role) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Send email verification
        await user.sendEmailVerification();
        
        // Create user in Firestore
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: user.email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            accountStatus: 'active',
            deviceInfo: userDevice,
            ipAddress: userIP
        });
        
        await createLog('registration', 'success', user.uid);
        
        Swal.fire({
            icon: 'success',
            title: 'Registration Successful!',
            text: 'Please check your email to verify your account.',
            timer: 3000
        });
        
        return true;
    } catch (error) {
        await createLog('registration', 'failed', null, error.message);
        throw error;
    }
}

// Google OAuth login
async function googleSignIn() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Check if user exists in Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // Create new user document
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                accountStatus: 'active',
                deviceInfo: userDevice,
                ipAddress: userIP
            });
        }
        
        await createLog('google_login', 'success', user.uid);
        return true;
    } catch (error) {
        await createLog('google_login', 'failed', null, error.message);
        throw error;
    }
}

// Password reset
async function resetPassword(email) {
    try {
        await auth.sendPasswordResetEmail(email);
        await createLog('password_reset', 'success', null);
        return true;
    } catch (error) {
        await createLog('password_reset', 'failed', null, error.message);
        throw error;
    }
}

// Logout
async function logout() {
    try {
        await createLog('logout', 'success', currentUser?.uid);
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ==================== ROLE-BASED FUNCTIONS ====================

// Get user role
async function getUserRole(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            currentUserRole = userDoc.data().role;
            return currentUserRole;
        }
        return null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

// Check if user has required role
async function hasRole(requiredRole) {
    if (!currentUser) return false;
    
    const role = await getUserRole(currentUser.uid);
    
    const roleHierarchy = {
        'admin': 3,
        'manager': 2,
        'user': 1
    };
    
    return roleHierarchy[role] >= roleHierarchy[requiredRole];
}

// Update user role (Admin only)
async function updateUserRole(userId, newRole) {
    try {
        if (!await hasRole('admin')) {
            throw new Error('Unauthorized: Admin access required');
        }
        
        const oldRole = (await db.collection('users').doc(userId).get()).data().role;
        
        await db.collection('users').doc(userId).update({
            role: newRole,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await createLog('role_change', 'success', userId, null, {
            oldRole: oldRole,
            newRole: newRole,
            changedBy: currentUser?.uid
        });
        
        return true;
    } catch (error) {
        console.error('Error updating role:', error);
        throw error;
    }
}

// ==================== SECURITY FUNCTIONS ====================

// Get user IP using IPinfo API
async function getUserIP() {
    try {
        const token = window.APP_CONFIG.IPINFO_TOKEN;
        const response = await fetch(`https://ipinfo.io/json?token=${token}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        userIP = data;
        return data;
    } catch (error) {
        console.error('Error getting IP:', error);
        // Fallback
        userIP = { 
            ip: 'unknown', 
            city: 'Unknown', 
            region: 'Unknown', 
            country: 'Unknown' 
        };
        return userIP;
    }
}

// Check for suspicious activity
async function checkSuspiciousActivity(uid, loginLocation) {
    try {
        const userLogs = await db.collection('loginLogs')
            .where('userId', '==', uid)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();
        
        const previousLocations = userLogs.docs
            .map(doc => doc.data().location?.city)
            .filter(location => location);
        
        if (previousLocations.length > 0 && 
            !previousLocations.includes(loginLocation?.city) &&
            previousLocations[0] !== loginLocation?.city) {
            
            await createLog('suspicious_login', 'warning', uid, null, {
                message: 'Login from new location',
                previousLocations: previousLocations,
                newLocation: loginLocation
            });
            
            // Send alert email or notification
            sendSecurityAlert(uid, loginLocation);
        }
    } catch (error) {
        console.error('Error checking suspicious activity:', error);
    }
}

// Send security alert
async function sendSecurityAlert(uid, location) {
    // Implement email notification or in-app alert
    Swal.fire({
        icon: 'warning',
        title: 'Security Alert',
        text: `New login detected from ${location?.city || 'unknown location'}`,
        timer: 5000
    });
}

// ==================== LOGGING FUNCTIONS ====================

// Create log entry
async function createLog(action, status, userId = null, error = null, metadata = {}) {
    try {
        const logData = {
            action: action,
            status: status,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: userId || currentUser?.uid || 'anonymous',
            email: currentUser?.email || 'unknown',
            deviceInfo: userDevice,
            ipInfo: userIP,
            userAgent: navigator.userAgent,
            metadata: metadata
        };
        
        if (error) {
            logData.error = error;
        }
        
        // Determine which collection to use
        if (action.includes('login')) {
            await db.collection('loginLogs').add(logData);
        } else {
            await db.collection('activityLogs').add(logData);
        }
        
        return true;
    } catch (error) {
        console.error('Error creating log:', error);
        return false;
    }
}

// Get activity logs (Admin only)
async function getActivityLogs(limit = 50) {
    try {
        if (!await hasRole('admin')) {
            throw new Error('Unauthorized');
        }
        
        const snapshot = await db.collection('activityLogs')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting logs:', error);
        throw error;
    }
}

// ==================== USER MANAGEMENT FUNCTIONS ====================

// Get all users (Admin only)
async function getAllUsers() {
    try {
        if (!await hasRole('admin')) {
            throw new Error('Unauthorized');
        }
        
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting users:', error);
        throw error;
    }
}

// Update user account status
async function updateUserStatus(userId, status) {
    try {
        if (!await hasRole('admin')) {
            throw new Error('Unauthorized');
        }
        
        await db.collection('users').doc(userId).update({
            accountStatus: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await createLog('status_change', 'success', userId, null, {
            newStatus: status,
            changedBy: currentUser?.uid
        });
        
        return true;
    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
}

// Update user last login
async function updateUserLastLogin(uid) {
    try {
        await db.collection('users').doc(uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Check for suspicious activity
        if (userIP) {
            await checkSuspiciousActivity(uid, userIP);
        }
    } catch (error) {
        console.error('Error updating last login:', error);
    }
}

// ==================== UI FUNCTIONS ====================

// Show email verification alert
function showEmailVerificationAlert() {
    Swal.fire({
        icon: 'info',
        title: 'Email Verification Required',
        text: 'Please verify your email address to access all features.',
        showCancelButton: true,
        confirmButtonText: 'Resend Email',
        cancelButtonText: 'Later'
    }).then((result) => {
        if (result.isConfirmed) {
            currentUser.sendEmailVerification();
            Swal.fire('Sent!', 'Verification email has been sent.', 'success');
        }
    });
}

// Show loading spinner
function showLoading(elementId) {
    const spinner = document.getElementById(`${elementId}Spinner`);
    const text = document.getElementById(`${elementId}Text`);
    if (spinner && text) {
        spinner.classList.remove('d-none');
        text.classList.add('d-none');
    }
}

// Hide loading spinner
function hideLoading(elementId) {
    const spinner = document.getElementById(`${elementId}Spinner`);
    const text = document.getElementById(`${elementId}Text`);
    if (spinner && text) {
        spinner.classList.add('d-none');
        text.classList.remove('d-none');
    }
}

// Show error message
function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: message,
        timer: 3000
    });
}

// Show success message
function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'Success',
        text: message,
        timer: 3000
    });
}

// ==================== DASHBOARD FUNCTIONS ====================

// Load dashboard based on role
async function loadDashboard() {
    if (!currentUser || !currentUser.emailVerified) {
        window.location.href = 'login.html';
        return;
    }
    
    const role = await getUserRole(currentUser.uid);
    
    // Load user info
    document.getElementById('userName').textContent = currentUser.email;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userRole').textContent = role;
    
    // Load role-specific data
    if (role === 'admin') {
        loadAdminDashboard();
    } else if (role === 'manager') {
        loadManagerDashboard();
    } else {
        loadUserDashboard();
    }
}

// Load user dashboard
async function loadUserDashboard() {
    try {
        // Get user activity
        const activitySnapshot = await db.collection('activityLogs')
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        
        const activities = activitySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Display activities
        const activityList = document.getElementById('userActivity');
        if (activityList) {
            activityList.innerHTML = activities.map(activity => `
                <tr>
                    <td>${activity.action}</td>
                    <td>${activity.status}</td>
                    <td>${activity.timestamp?.toDate().toLocaleString()}</td>
                </tr>
            `).join('');
        }
        
        // Create activity chart
        createActivityChart(activities);
    } catch (error) {
        console.error('Error loading user dashboard:', error);
    }
}

// Load admin dashboard
async function loadAdminDashboard() {
    try {
        // Get all users
        const users = await getAllUsers();
        
        // Get all logs
        const logs = await getActivityLogs(100);
        
        // Display users table
        const usersTable = document.getElementById('usersTable');
        if (usersTable) {
            usersTable.innerHTML = users.map(user => `
                <tr>
                    <td>${user.email}</td>
                    <td><span class="badge bg-${getRoleBadgeColor(user.role)}">${user.role}</span></td>
                    <td><span class="badge bg-${getStatusBadgeColor(user.accountStatus)}">${user.accountStatus}</span></td>
                    <td>${user.lastLogin?.toDate().toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editUser('${user.uid}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        // Create analytics charts
        createUserChart(users);
        createActivityChart(logs);
        
        // Update statistics
        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('activeUsers').textContent = users.filter(u => u.accountStatus === 'active').length;
        document.getElementById('adminCount').textContent = users.filter(u => u.role === 'admin').length;
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

// Get role badge color
function getRoleBadgeColor(role) {
    const colors = {
        'admin': 'danger',
        'manager': 'warning',
        'user': 'info'
    };
    return colors[role] || 'secondary';
}

// Get status badge color
function getStatusBadgeColor(status) {
    const colors = {
        'active': 'success',
        'inactive': 'secondary',
        'suspended': 'danger'
    };
    return colors[status] || 'secondary';
}

// ==================== CHART FUNCTIONS ====================

// Create user chart
function createUserChart(users) {
    const ctx = document.getElementById('userChart')?.getContext('2d');
    if (!ctx) return;
    
    const roleCounts = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
    }, {});
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(roleCounts),
            datasets: [{
                data: Object.values(roleCounts),
                backgroundColor: ['#ff6384', '#36a2eb', '#ffce56']
            }]
        }
    });
}

// Create activity chart
function createActivityChart(activities) {
    const ctx = document.getElementById('activityChart')?.getContext('2d');
    if (!ctx) return;
    
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString();
    }).reverse();
    
    const activityCounts = last7Days.map(date => {
        return activities.filter(a => {
            if (!a.timestamp) return false;
            const activityDate = a.timestamp.toDate().toLocaleDateString();
            return activityDate === date;
        }).length;
    });
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Activities',
                data: activityCounts,
                borderColor: '#667eea',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ==================== PROFILE FUNCTIONS ====================

// Load profile
async function loadProfile() {
    if (!currentUser) return;
    
    document.getElementById('profileEmail').value = currentUser.email;
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        document.getElementById('profileRole').textContent = userData.role;
        document.getElementById('profileCreated').textContent = userData.createdAt?.toDate().toLocaleString();
        document.getElementById('profileLastLogin').textContent = userData.lastLogin?.toDate().toLocaleString();
        document.getElementById('profileStatus').textContent = userData.accountStatus;
    }
}

// Update profile
async function updateProfile(userData) {
    try {
        await db.collection('users').doc(currentUser.uid).update({
            ...userData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await createLog('profile_update', 'success', currentUser.uid);
        showSuccess('Profile updated successfully');
    } catch (error) {
        console.error('Error updating profile:', error);
        showError('Failed to update profile');
    }
}

// ==================== EVENT LISTENERS ====================

// Initialize page-specific functionality
function initializePage() {
    const path = window.location.pathname;
    
    if (path.includes('login.html')) {
        initializeLoginPage();
    } else if (path.includes('register.html')) {
        initializeRegisterPage();
    } else if (path.includes('dashboard.html')) {
        initializeDashboardPage();
    } else if (path.includes('admin.html')) {
        initializeAdminPage();
    } else if (path.includes('profile.html')) {
        initializeProfilePage();
    }
}

// Initialize login page
function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            showLoading('login');
            
            try {
                const success = await loginUser(email, password);
                if (success) {
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                showError(error.message);
            } finally {
                hideLoading('login');
            }
        });
    }
    
    const googleLogin = document.getElementById('googleLogin');
    if (googleLogin) {
        googleLogin.addEventListener('click', async () => {
            try {
                await googleSignIn();
                window.location.href = 'dashboard.html';
            } catch (error) {
                showError(error.message);
            }
        });
    }
    
    const forgotPassword = document.getElementById('forgotPassword');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const { value: email } = await Swal.fire({
                title: 'Reset Password',
                input: 'email',
                text: 'Enter your email to receive password reset link',
                showCancelButton: true
            });
            
            if (email) {
                try {
                    await resetPassword(email);
                    Swal.fire('Success', 'Password reset email sent!', 'success');
                } catch (error) {
                    showError(error.message);
                }
            }
        });
    }
}

// Initialize register page
function initializeRegisterPage() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const role = document.getElementById('role').value;
            const terms = document.getElementById('terms').checked;
            
            if (password !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }
            
            if (!terms) {
                showError('Please accept terms and conditions');
                return;
            }
            
            showLoading('register');
            
            try {
                await registerUser(email, password, role);
                window.location.href = 'login.html';
            } catch (error) {
                showError(error.message);
            } finally {
                hideLoading('register');
            }
        });
    }
    
    const googleRegister = document.getElementById('googleRegister');
    if (googleRegister) {
        googleRegister.addEventListener('click', async () => {
            try {
                await googleSignIn();
                window.location.href = 'dashboard.html';
            } catch (error) {
                showError(error.message);
            }
        });
    }
    
    // Password strength indicator
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', checkPasswordStrength);
    }
}

// Check password strength
function checkPasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthBar = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('strengthText');
    
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]+/)) strength++;
    if (password.match(/[A-Z]+/)) strength++;
    if (password.match(/[0-9]+/)) strength++;
    if (password.match(/[$@#&!]+/)) strength++;
    
    const colors = ['#dc3545', '#ffc107', '#28a745', '#20c997', '#17a2b8'];
    const texts = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
    
    strengthBar.style.width = `${strength * 20}%`;
    strengthBar.style.backgroundColor = colors[strength - 1] || '#6c757d';
    strengthText.textContent = texts[strength - 1] || '';
}

// Initialize dashboard page
function initializeDashboardPage() {
    auth.onAuthStateChanged(user => {
        if (!user || !user.emailVerified) {
            window.location.href = 'login.html';
            return;
        }
        loadDashboard();
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Initialize admin page
function initializeAdminPage() {
    auth.onAuthStateChanged(async user => {
        if (!user || !user.emailVerified) {
            window.location.href = 'login.html';
            return;
        }
        
        const role = await getUserRole(user.uid);
        if (role !== 'admin') {
            window.location.href = 'dashboard.html';
            return;
        }
        
        loadAdminDashboard();
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Initialize profile page
function initializeProfilePage() {
    auth.onAuthStateChanged(user => {
        if (!user || !user.emailVerified) {
            window.location.href = 'login.html';
            return;
        }
        loadProfile();
    });
    
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                displayName: document.getElementById('displayName')?.value,
                phoneNumber: document.getElementById('phoneNumber')?.value,
                // Add other fields as needed
            };
            
            await updateProfile(formData);
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Edit user function
async function editUser(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        const { value: newRole } = await Swal.fire({
            title: 'Edit User',
            html: `
                <p>User: ${userData.email}</p>
                <select id="roleSelect" class="form-select">
                    <option value="user" ${userData.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="manager" ${userData.role === 'manager' ? 'selected' : ''}>Manager</option>
                    <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <select id="statusSelect" class="form-select mt-2">
                    <option value="active" ${userData.accountStatus === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${userData.accountStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    <option value="suspended" ${userData.accountStatus === 'suspended' ? 'selected' : ''}>Suspended</option>
                </select>
            `,
            showCancelButton: true,
            confirmButtonText: 'Update',
            preConfirm: () => {
                return {
                    role: document.getElementById('roleSelect').value,
                    status: document.getElementById('statusSelect').value
                };
            }
        });
        
        if (newRole) {
            await updateUserRole(userId, newRole.role);
            await updateUserStatus(userId, newRole.status);
            showSuccess('User updated successfully');
            loadAdminDashboard();
        }
    } catch (error) {
        showError(error.message);
    }
}