// State Management
let complaints = JSON.parse(localStorage.getItem('complaints')) || [];
let currentAdminUpdateId = null;
let isLoggedIn = false;

// Initialize Lucide Icons
function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Mobile Menu Logic
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navLinksContainer = document.getElementById('nav-links');

if (mobileMenuBtn && navLinksContainer) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinksContainer.classList.toggle('active');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
            const isMenuOpen = navLinksContainer.classList.contains('active');
            icon.setAttribute('data-lucide', isMenuOpen ? 'x' : 'menu');
            initIcons();
        }
    });
}

// Navigation Logic
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = link.getAttribute('data-section');
        navigateTo(sectionId);
        
        // Close mobile menu on navigate
        if (navLinksContainer) {
            navLinksContainer.classList.remove('active');
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', 'menu');
                initIcons();
            }
        }
    });
});

function navigateTo(sectionId) {
    // Update Navbar links
    document.querySelectorAll('.nav-link').forEach(nav => {
        nav.classList.remove('active');
        if (nav.getAttribute('data-section') === sectionId) {
            nav.classList.add('active');
        }
    });

    // Show/Hide Sections
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
        if (section.id === `${sectionId}-section`) {
            section.classList.add('active');
        }
    });

    // Special logic for Admin initialization
    if (sectionId === 'admin') {
        checkAdminAuth();
    }

    window.scrollTo(0, 0);
    initIcons();
}

// Admin Authentication Logic
function checkAdminAuth() {
    const adminPassword = localStorage.getItem('adminPassword');
    const authView = document.getElementById('admin-auth');
    const dashboardView = document.getElementById('admin-dashboard-view');
    const setPassView = document.getElementById('set-password-view');
    const loginView = document.getElementById('login-view');

    if (!adminPassword) {
        authView.style.display = 'block';
        dashboardView.style.display = 'none';
        setPassView.style.display = 'block';
        loginView.style.display = 'none';
    } else if (!isLoggedIn) {
        authView.style.display = 'block';
        dashboardView.style.display = 'none';
        setPassView.style.display = 'none';
        loginView.style.display = 'block';
    } else {
        authView.style.display = 'none';
        dashboardView.style.display = 'block';
        renderComplaintsTable();
    }
}

function setAdminPassword() {
    const newPass = document.getElementById('newAdminPassword').value;
    if (newPass.length < 4) {
        alert('Password must be at least 4 characters long.');
        return;
    }
    localStorage.setItem('adminPassword', newPass);
    isLoggedIn = true;
    checkAdminAuth();
}

function adminLogin() {
    const inputPass = document.getElementById('adminPasswordInput').value;
    const savedPass = localStorage.getItem('adminPassword');
    if (inputPass === savedPass) {
        isLoggedIn = true;
        checkAdminAuth();
    } else {
        alert('Incorrect Password');
    }
}

function adminLogout() {
    isLoggedIn = false;
    checkAdminAuth();
}

// Form Conditional Logic
function handleCategoryChange() {
    const category = document.getElementById('category').value;
    const roomFields = document.getElementById('room-fields');
    const fileFields = document.getElementById('file-fields');
    const mealFields = document.getElementById('meal-fields');
    const otherFields = document.getElementById('other-fields');

    // Reset visibility
    roomFields.style.display = 'none';
    fileFields.style.display = 'none';
    mealFields.style.display = 'none';
    otherFields.style.display = 'none';

    // Toggle fields based on category
    if (['Electricity', 'Water', 'Wi-Fi', 'Washrooms', 'Cleanliness'].includes(category)) {
        roomFields.style.display = 'block';
        fileFields.style.display = 'block';
    } else if (category === 'Food') {
        mealFields.style.display = 'block';
        fileFields.style.display = 'block'; // New requirement: Food also has file upload
    } else if (category === 'Other') {
        otherFields.style.display = 'block';
    }
}

// Form Submission
document.getElementById('complaint-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const category = document.getElementById('category').value;
    const refId = 'COMP-' + Math.floor(Math.random() * 90000 + 10000);
    
    const complaintData = {
        id: refId,
        studentName: document.getElementById('studentName').value,
        studentId: document.getElementById('studentId').value,
        hostel: document.getElementById('hostelName').value,
        wing: document.getElementById('wing').value,
        category: category,
        description: document.getElementById('description').value,
        urgency: document.getElementById('urgency').value,
        date: new Date().toLocaleDateString(),
        status: 'Pending',
        adminComments: '',
        details: {} // Extra fields based on category
    };

    if (['Electricity', 'Water', 'Wi-Fi', 'Washrooms', 'Cleanliness', 'Food'].includes(category)) {
        if (category !== 'Food') {
            complaintData.details.roomNumber = document.getElementById('roomNumber').value;
        } else {
            complaintData.details.mealType = document.getElementById('mealType').value;
        }
    } else if (category === 'Other') {
        complaintData.details.issueTitle = document.getElementById('issueTitle').value;
    }

    complaints.push(complaintData);
    localStorage.setItem('complaints', JSON.stringify(complaints));

    showToast(refId);
    this.reset();
    handleCategoryChange(); // reset fields
});

function showToast(refId) {
    const toast = document.getElementById('toast');
    const display = document.getElementById('ref-id-display');
    display.innerText = `Reference ID: ${refId}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

// Tracking Logic
function trackComplaint() {
    const trackId = document.getElementById('trackId').value.trim().toUpperCase();
    const resultSection = document.getElementById('track-result');
    const errorMsg = document.getElementById('track-error');
    
    // Hide previous state
    resultSection.style.display = 'none';
    errorMsg.style.display = 'none';

    if (!trackId) return;

    const complaint = complaints.find(c => c.id === trackId);

    if (complaint) {
        resultSection.style.display = 'block';
        document.getElementById('result-header').innerHTML = `
            <div>
                <h3>Complaint ${complaint.id}</h3>
                <small>${complaint.category} Issue</small>
            </div>
            <div class="status-badge badge-${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</div>
        `;

        // Update Stepper
        updateStepper(complaint.status);

        // Update Comments
        const commentsDiv = document.getElementById('admin-comments-display');
        if (complaint.adminComments) {
            commentsDiv.style.display = 'block';
            commentsDiv.innerHTML = `<strong>Admin Update:</strong> <p>${complaint.adminComments}</p>`;
        } else {
            commentsDiv.style.display = 'none';
        }
        
        initIcons();
    } else {
        errorMsg.style.display = 'block';
    }
}

function updateStepper(status) {
    const steps = ['submitted', 'review', 'progress', 'resolved'];
    const statusMap = {
        'Pending': 0,
        'Under Review': 1,
        'In Progress': 2,
        'Resolved': 3
    };
    
    const currentIndex = statusMap[status] || 0;
    
    steps.forEach((step, idx) => {
        const stepEl = document.getElementById(`step-${step}`);
        if (stepEl) {
            if (idx <= currentIndex) {
                stepEl.classList.add('active');
            } else {
                stepEl.classList.remove('active');
            }
        }
    });

    // Update lines
    const lines = document.querySelectorAll('.step-line');
    lines.forEach((line, idx) => {
        if (idx < currentIndex) {
            line.classList.add('active');
        } else {
            line.classList.remove('active');
        }
    });
}

// Admin Logic
function renderComplaintsTable() {
    const tbody = document.getElementById('complaints-body');
    const filterCat = document.getElementById('filterCategory').value;
    const filterStat = document.getElementById('filterStatus').value;

    tbody.innerHTML = '';

    const filtered = complaints.filter(c => {
        const catMatch = filterCat === 'all' || c.category === filterCat;
        const statMatch = filterStat === 'all' || c.status === filterStat;
        return catMatch && statMatch;
    });

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.id}</strong></td>
            <td>${c.studentName}</td>
            <td>${c.category}</td>
            <td><span class="urgency-${c.urgency.toLowerCase()}">${c.urgency}</span></td>
            <td>${c.date}</td>
            <td><span class="status-badge badge-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span></td>
            <td>
                <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="openAdminModal('${c.id}')">
                    Update
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem; color: #64748b;">No complaints found.</td></tr>';
    }
}

function applyFilters() {
    renderComplaintsTable();
}

function openAdminModal(id) {
    if (!isLoggedIn) {
        alert('Authentication required.');
        navigateTo('admin');
        return;
    }
    currentAdminUpdateId = id;
    const complaint = complaints.find(c => c.id === id);
    document.getElementById('updateStatus').value = complaint.status;
    document.getElementById('adminComments').value = complaint.adminComments || '';
    document.getElementById('admin-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('admin-modal').style.display = 'none';
    currentAdminUpdateId = null;
}

function saveAdminUpdate() {
    if (!isLoggedIn) {
        alert('Authentication required.');
        return;
    }
    const complaint = complaints.find(c => c.id === currentAdminUpdateId);
    complaint.status = document.getElementById('updateStatus').value;
    complaint.adminComments = document.getElementById('adminComments').value;
    
    localStorage.setItem('complaints', JSON.stringify(complaints));
    closeModal();
    renderComplaintsTable();
}

// Initial state
window.addEventListener('load', () => {
    initIcons();
});
