// script.js - Unified Module for Hostel Maintenance Portal
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, updateDoc, 
    doc, query, where, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration (Updated)
const firebaseConfig = {
  apiKey: "AIzaSyBuQdXFBXa9Y_fyfjM5vlgY5bABxAAKEdg",
  authDomain: "hostelcomplaints-1ad79.firebaseapp.com",
  projectId: "hostelcomplaints-1ad79",
  storageBucket: "hostelcomplaints-1ad79.firebasestorage.app",
  messagingSenderId: "513216002728",
  appId: "1:513216002728:web:cdd88a1c381db84054a09d",
  measurementId: "G-R5RXPDD67P"
};

// Initialize Firebase
let app, db, analytics;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    // Imports for analytics are needed if using getAnalytics
    // import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
    console.log("New Firebase database connected successfully");
} catch (err) {
    console.error("Firebase initialization failed:", err);
}

// App State
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let currentAdminUpdateId = null;

// Initialize Lucide Icons
function initIcons() {
    if (window.lucide) window.lucide.createIcons();
}

// UI Navigation
function navigateTo(sectionId) {
    if (sectionId === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
        navigateTo('login');
        return;
    }
    if ((sectionId === 'raise' || sectionId === 'track') && !currentUser) {
        navigateTo('login');
        return;
    }

    // Nav Link Active State
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) link.classList.add('active');
    });

    // Section Visibility
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId + '-section') section.classList.add('active');
    });

    // Sub-logic per section
    if (sectionId === 'login') {
        const tabs = document.querySelectorAll('.auth-tab');
        if (tabs.length > 0) tabs[0].click();
        clearAuthErrors();
    }
    if (sectionId === 'track' && currentUser) fetchUserComplaints();
    if (sectionId === 'admin' && currentUser?.role === 'admin') renderComplaintsTable();

    window.scrollTo(0, 0);
    initIcons();
}

function clearAuthErrors() {
    ['login-error-msg', 'signup-error-msg', 'signup-success-msg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = '';
            el.style.display = 'none';
        }
    });
}

// Hostel change handler - dynamically update wing options
function handleHostelChange() {
    const hostel = document.getElementById('hostelName')?.value;
    const wingGroup = document.getElementById('wing-group');
    const wingSelect = document.getElementById('wing');
    if (!wingGroup || !wingSelect) return;

    // Wings per hostel
    const wingMap = {
        'YGH': ['North', 'East', 'West'],
        'GGH': ['North', 'East', 'West'],
        'SGH': [],  // Saraswathi - no wing
        'KBH': ['South', 'West', 'East'],
        'GBH': ['South', 'West', 'East']
    };

    const wings = hostel ? wingMap[hostel] : [];

    if (!hostel || wings === undefined) {
        wingGroup.style.display = 'none';
        wingSelect.required = false;
        return;
    }

    if (wings.length === 0) {
        // Saraswathi - hide wing entirely
        wingGroup.style.display = 'none';
        wingSelect.required = false;
        wingSelect.value = '';
    } else {
        wingGroup.style.display = 'block';
        wingSelect.required = true;
        wingSelect.innerHTML = '<option value="">Select Wing</option>' +
            wings.map(w => `<option value="${w}">${w}</option>`).join('');
    }
}

// Category change handler - show/hide conditional fields
function handleCategoryChange() {
    const category = document.getElementById('category')?.value;
    const fileFields = document.getElementById('file-fields');
    const mealFields = document.getElementById('meal-fields');
    const otherFields = document.getElementById('other-fields');

    // File upload: show for every category EXCEPT Wi-Fi (and empty)
    if (fileFields) {
        fileFields.style.display = (category && category !== 'Wi-Fi') ? 'block' : 'none';
    }
    // Meal type: only for Food
    if (mealFields) {
        mealFields.style.display = category === 'Food' ? 'block' : 'none';
    }
    // Issue title: only for Other
    if (otherFields) {
        otherFields.style.display = category === 'Other' ? 'block' : 'none';
    }
}

// Toggle which password field to show based on whether it's an admin login
function togglePasswordField() {
    const username = document.getElementById('loginUsername')?.value.trim();
    const adminGroup = document.getElementById('admin-password-group');
    const studentGroup = document.getElementById('student-password-group');
    if (!adminGroup || !studentGroup) return;

    if (username === 'deepu@admin') {
        adminGroup.style.display = 'block';
        studentGroup.style.display = 'none';
    } else {
        adminGroup.style.display = 'none';
        studentGroup.style.display = 'block';
    }
}

// Authentication Logic
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const adminPass = document.getElementById('adminPassword').value;
    const studentPass = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('login-error-msg');
    
    if (errorEl) { errorEl.innerText = ''; errorEl.style.display = 'none'; }

    // Helper to show error
    function showError(msg) {
        if (errorEl) { errorEl.innerText = msg; errorEl.style.display = 'block'; }
    }

    if (!username) {
        showError('Please enter your Student ID.');
        return;
    }

    if (username === 'deepu@admin') {
        if (!adminPass) {
            showError('Please enter the Admin password.');
            return;
        }
        if (adminPass === 'deepu@rgukt') {
            setUserSession({ username: 'deepu@admin', role: 'admin' });
            navigateTo('admin');
        } else {
            showError('Invalid password. Try again.');
        }
        return;
    }

    if (!studentPass) {
        showError('Please enter your password.');
        return;
    }

    try {
        const q = query(collection(db, "users"), where("studentId", "==", username.toUpperCase()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            if (errorEl) { errorEl.innerText = 'No account found. Please sign up first.'; errorEl.style.display = 'block'; }
            return;
        }

        const userData = querySnapshot.docs[0].data();
        if (userData.password === studentPass) {
            setUserSession({ 
                username: userData.name, 
                studentId: userData.studentId, 
                mobile: userData.mobile,
                role: 'student' 
            });
            navigateTo('home');
        } else {
            if (errorEl) { errorEl.innerText = 'Invalid password. Try again.'; errorEl.style.display = 'block'; }
        }
    } catch (error) {
        console.error("Login Error:", error);
        if (errorEl) { errorEl.innerText = 'Connection failed. Check your internet and try again. (' + error.code + ')'; errorEl.style.display = 'block'; }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const studentId = document.getElementById('signupId').value.trim().toUpperCase();
    const mobile = document.getElementById('signupMobile').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signup-error-msg');
    const successEl = document.getElementById('signup-success-msg');

    function showSignupError(msg) {
        if (errorEl) { errorEl.innerText = msg; errorEl.style.display = 'block'; }
    }

    if (errorEl) { errorEl.innerText = ''; errorEl.style.display = 'none'; }
    if (successEl) successEl.style.display = 'none';

    if (!studentId.startsWith('B')) {
        showSignupError('Student ID must start with B or b.');
        return;
    }

    // Block admin from signing up
    if (studentId.toLowerCase() === 'deepu@admin' || name.toLowerCase().includes('admin')) {
        showSignupError('Admin accounts cannot be created through sign up.');
        return;
    }

    try {
        console.log("Checking for existing user:", studentId);
        const q = query(collection(db, "users"), where("studentId", "==", studentId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            if (errorEl) errorEl.innerText = 'Account already exists for this ID.';
            return;
        }

        console.log("Adding user to Firestore...");
        await addDoc(collection(db, "users"), {
            name,
            studentId,
            mobile,
            password,
            createdAt: new Date().toISOString()
        });

        if (successEl) successEl.style.display = 'block';
        setTimeout(() => {
            document.querySelector('.auth-tab[data-tab="login"]').click();
        }, 2000);
    } catch (error) {
        console.error("Signup Error Stack:", error);
        if (errorEl) errorEl.innerText = 'Backend Error: ' + error.message;
    }
}

function setUserSession(user) {
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    checkAdminAuth();
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    checkAdminAuth();
    navigateTo('home');
}

// Portal Access Control
function checkAdminAuth() {
    const loginLink = document.getElementById('login-nav-link');
    const adminItem = document.getElementById('admin-nav-item');
    const notifyItem = document.getElementById('notification-nav-item');
    const raiseItem = document.getElementById('raise-nav-item');
    const trackItem = document.getElementById('track-nav-item');

    if (!currentUser) {
        if (loginLink) {
            loginLink.innerText = 'Login';
            loginLink.setAttribute('data-section', 'login');
        }
        [adminItem, notifyItem, raiseItem, trackItem].forEach(i => { if (i) i.style.display = 'none'; });
        return;
    }

    if (loginLink) {
        loginLink.innerText = 'Logout';
        loginLink.setAttribute('data-section', 'logout');
    }

    if (currentUser.role === 'admin') {
        if (adminItem) adminItem.style.display = 'block';
        [notifyItem, raiseItem, trackItem].forEach(i => { if (i) i.style.display = 'none'; });
    } else {
        if (adminItem) adminItem.style.display = 'none';
        if (raiseItem) raiseItem.style.display = 'block';
        if (trackItem) trackItem.style.display = 'block';
        if (notifyItem) {
            notifyItem.style.display = 'block';
            checkNotifications();
        }

        // Auto-fill form
        const nInput = document.getElementById('studentName');
        const iInput = document.getElementById('studentId');
        const mInput = document.getElementById('studentMobile');
        if (nInput) nInput.value = currentUser.username;
        if (iInput) iInput.value = currentUser.studentId;
        if (mInput) mInput.value = currentUser.mobile || '';
    }
}

// Student Tracking & Notifications
async function checkNotifications() {
    if (!currentUser || currentUser.role === 'admin') return;
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    try {
        const q = query(collection(db, "complaints"), where("studentId", "==", currentUser.studentId), where("unread", "==", true));
        const querySnapshot = await getDocs(q);
        const count = querySnapshot.size;
        
        badge.innerText = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    } catch (err) {
        console.error("Notifications Sync Err:", err);
    }
}

async function showNotifications() {
    if (!currentUser || currentUser.role === 'admin') return;
    const modal = document.getElementById('notification-modal');
    const list = document.getElementById('notification-list');
    if (!modal || !list) return;

    modal.style.display = 'flex';
    list.innerHTML = '<p class="text-center">Syncing updates...</p>';

    try {
        const q = query(collection(db, "complaints"), where("studentId", "==", currentUser.studentId));
        const snap = await getDocs(q);
        let items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        list.innerHTML = '';
        if (items.length === 0) { list.innerHTML = '<p class="empty-msg">No complaints raised.</p>'; return; }

        items.forEach(c => {
            if (c.adminComments || c.status !== 'Pending') {
                const div = document.createElement('div');
                div.className = `notification-item ${c.unread ? 'unread' : ''}`;
                div.style.borderLeft = c.unread ? '4px solid var(--primary)' : '4px solid transparent';
                
                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <h4 style="margin: 0; color: var(--primary); font-size: 1rem;">${c.category} Issue</h4>
                        <span class="status-badge badge-${c.status.toLowerCase().replace(' ', '-')}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; font-weight: 700;">${c.status}</span>
                    </div>
                    ${c.adminComments ? `<div class="admin-note" style="background: #f1f5f9; padding: 0.75rem; border-radius: 0.5rem; margin: 0.5rem 0; border-left: 3px solid #64748b;"><strong>Warden's Reply:</strong> ${c.adminComments}</div>` : '<p style="font-size: 0.85rem; color: #64748b; margin: 0.5rem 0;">Status has been updated by the warden.</p>'}
                    <div style="text-align: right;"><small style="color: #94a3b8; font-size: 0.7rem;">${new Date(c.timestamp).toLocaleString()}</small></div>
                `;
                div.onclick = async () => {
                    if (c.unread) {
                        await updateDoc(doc(db, "complaints", c.id), { unread: false });
                        checkNotifications();
                        div.classList.remove('unread');
                    }
                };
                list.appendChild(div);
            }
        });
        if (list.innerHTML === '') list.innerHTML = '<p class="empty-msg">No status updates yet.</p>';
    } catch (err) {
        console.error("Show Notifications Err:", err);
    }
}

async function fetchUserComplaints() {
    const container = document.getElementById('track-results-container');
    const emptyMsg = document.getElementById('track-empty');
    if (!container) return;

    container.innerHTML = '<div class="text-center">Loading history...</div>';
    try {
        const q = query(collection(db, "complaints"), where("studentId", "==", currentUser.studentId));
        const snap = await getDocs(q);
        let complaints = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        complaints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        container.innerHTML = '';
        if (complaints.length === 0) { if (emptyMsg) emptyMsg.style.display = 'block'; return; }

        complaints.forEach(c => {
            const card = document.createElement('div');
            card.className = 'card status-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div><h3>${c.complaintId}</h3><small>${c.category} | ${new Date(c.timestamp).toLocaleDateString()}</small></div>
                    <span class="status-badge badge-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span>
                </div>
                <div class="card-desc">${c.description}</div>
                ${c.adminComments ? `<div class="admin-update"><strong>Update:</strong> ${c.adminComments}</div>` : ''}
            `;
            container.appendChild(card);
        });

        // Auto-mark read when viewing tracker
        snap.docs.filter(d => d.data().unread).forEach(async d => await updateDoc(doc(db, "complaints", d.id), { unread: false }));
        checkNotifications();
    } catch (err) {
        container.innerHTML = 'Error loading history.';
    }
}

// Admin Logic
async function renderComplaintsTable() {
    const tbody = document.getElementById('complaints-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Syncing...</td></tr>';

    const filterCat = document.getElementById('filterCategory')?.value || 'all';
    const filterStat = document.getElementById('filterStatus')?.value || 'all';

    try {
        const snap = await getDocs(query(collection(db, "complaints")));
        let items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply filters
        if (filterCat !== 'all') items = items.filter(c => c.category === filterCat);
        if (filterStat !== 'all') items = items.filter(c => c.status === filterStat);

        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:2rem;color:#64748b;">No complaints match the selected filters.</td></tr>';
            return;
        }
        items.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.studentId}</strong></td>
                <td>${c.studentName}</td>
                <td>${c.category}</td>
                <td>${c.date}</td>
                <td><span class="status-badge badge-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span></td>
                <td><button class="btn btn-outline details-btn" data-id="${c.id}">Details</button></td>
                <td><button class="btn btn-primary update-btn" data-id="${c.id}">Update</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.update-btn').forEach(b => b.onclick = () => openAdminModal(b.dataset.id));
        document.querySelectorAll('.details-btn').forEach(b => b.onclick = () => viewDetails(b.dataset.id));
    } catch (err) {
        console.error("Admin Table Err:", err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="color:red;">Error loading complaints.</td></tr>';
    }
}

async function viewDetails(id) {
    const content = document.getElementById('details-content');
    const snap = await getDocs(query(collection(db, "complaints")));
    const d = snap.docs.find(t => t.id === id);
    if (!d) return;
    const c = d.data();
    content.innerHTML = `
        <div class="details-grid">
            <div class="detail-item"><label>Student</label><p>${c.studentName} (${c.studentId})</p></div>
            <div class="detail-item"><label>Category</label><p>${c.category}</p></div>
            ${c.details.roomNumber ? `<div class="detail-item"><label>Room</label><p>${c.details.roomNumber}</p></div>` : ''}
            <div class="detail-item full-width"><label>Description</label><p>${c.description}</p></div>
            <div class="detail-item full-width"><label>Admin Note</label><p>${c.adminComments || 'None'}</p></div>
        </div>
    `;
    document.getElementById('details-modal').style.display = 'flex';
}

function openAdminModal(id) {
    currentAdminUpdateId = id;
    document.getElementById('admin-modal').style.display = 'flex';
}

async function saveAdminUpdate() {
    if (!currentAdminUpdateId) return;
    const status = document.getElementById('updateStatus').value;
    const comments = document.getElementById('adminComments').value;
    try {
        await updateDoc(doc(db, "complaints", currentAdminUpdateId), {
            status,
            adminComments: comments,
            unread: true
        });
        document.getElementById('admin-modal').style.display = 'none';
        renderComplaintsTable();
    } catch (err) {
        console.error("Save Err:", err);
    }
}

// Initialization and Event Listeners
window.addEventListener('load', () => {
    initIcons();
    checkAdminAuth();
    setInterval(checkNotifications, 15000);

    // Set login nav link as active on startup (login page is shown first)
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const loginNavLink = document.getElementById('login-nav-link');
    if (loginNavLink) loginNavLink.classList.add('active');

    // If user is already logged in, go to home instead
    if (currentUser) {
        navigateTo(currentUser.role === 'admin' ? 'admin' : 'home');
    }

    // Nav Links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const section = link.getAttribute('data-section');
            if (section === 'logout') { e.preventDefault(); handleLogout(); }
            else if (section && section !== '#') { e.preventDefault(); navigateTo(section); }
        });
    });

    // Forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
    
    const userIn = document.getElementById('loginUsername');
    if (userIn) {
        userIn.addEventListener('input', togglePasswordField);
        // Call once on load to set correct state
        togglePasswordField();
    }

    // Complaint Form
    const compForm = document.getElementById('complaint-form');
    if (compForm) {
        compForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const refId = 'COMP-' + Math.floor(Math.random() * 90000 + 10000);
            const data = {
                complaintId: refId,
                studentName: document.getElementById('studentName').value,
                studentId: document.getElementById('studentId').value.trim().toUpperCase(),
                studentMobile: document.getElementById('studentMobile')?.value || '',
                hostel: document.getElementById('hostelName').value,
                wing: document.getElementById('wing').value || 'N/A',
                category: document.getElementById('category').value,
                description: document.getElementById('description').value,
                date: new Date().toLocaleDateString(),
                status: 'Pending',
                adminComments: '',
                unread: false,
                timestamp: new Date().toISOString(),
                details: {
                    roomNumber: document.getElementById('roomNumber')?.value || null,
                    mealType: document.getElementById('mealType')?.value || null,
                    issueTitle: document.getElementById('issueTitle')?.value || null
                }
            };
            try {
                await addDoc(collection(db, "complaints"), data);
                const toast = document.getElementById('toast');
                if (toast) {
                    document.getElementById('ref-id-display').innerText = `ID: ${refId}`;
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 5000);
                }
                const successMsg = document.getElementById('submission-success-msg');
                if (successMsg) {
                    successMsg.style.display = 'block';
                    setTimeout(() => { successMsg.style.display = 'none'; }, 15000);
                }
                compForm.reset();
                handleCategoryChange(); // reset conditional fields
                handleHostelChange();   // reset wing dropdown
            } catch (err) {
                console.error("Submission Err:", err);
            }
        });
    }

    // Modal Closures
    document.getElementById('close-notifications-btn')?.addEventListener('click', () => {
        document.getElementById('notification-modal').style.display = 'none';
    });
    document.getElementById('save-update-btn')?.addEventListener('click', saveAdminUpdate);
    document.getElementById('close-modal-btn')?.addEventListener('click', () => {
        document.getElementById('admin-modal').style.display = 'none';
    });
    document.getElementById('close-details-btn')?.addEventListener('click', () => {
        document.getElementById('details-modal').style.display = 'none';
    });

    // Admin Logout
    document.getElementById('admin-logout-btn')?.addEventListener('click', handleLogout);

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
        });
        // Close menu when any nav link is clicked
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('active'));
        });
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                navLinks.classList.remove('active');
            }
        });
    }

    // Hero Buttons
    document.getElementById('hero-report-btn')?.addEventListener('click', () => navigateTo('raise'));
    document.getElementById('hero-track-btn')?.addEventListener('click', () => navigateTo('track'));

    // Notification Link
    document.querySelector('.notification-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showNotifications();
    });

    // Hostel change handler
    const hostelSelect = document.getElementById('hostelName');
    if (hostelSelect) {
        hostelSelect.addEventListener('change', handleHostelChange);
    }

    // Category change handler for conditional complaint fields
    const categorySelect = document.getElementById('category');
    if (categorySelect) {
        categorySelect.addEventListener('change', handleCategoryChange);
    }

    // Admin filter change listeners
    document.getElementById('filterCategory')?.addEventListener('change', renderComplaintsTable);
    document.getElementById('filterStatus')?.addEventListener('change', renderComplaintsTable);

    // Auth Tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const target = tab.dataset.tab; // 'login' or 'signup'
            // Switch tab active state
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Switch form container
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            const targetContainer = document.getElementById(target + '-form-container');
            if (targetContainer) targetContainer.classList.add('active');
            // Clear ALL form fields and errors when switching tabs
            document.getElementById('login-form')?.reset();
            document.getElementById('signup-form')?.reset();
            clearAuthErrors();
            togglePasswordField();
        });
    });
});
