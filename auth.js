// Authentication utility functions

// Check if user is logged in
function checkAuthStatus() {
  const isLoggedIn = localStorage.getItem('adminLoggedIn');
  const loginTime = localStorage.getItem('adminLoginTime');
  
  if (isLoggedIn !== 'true' || !loginTime) {
    redirectToLogin();
    return false;
  }
  
  // Check if login has expired (24 hours)
  const currentTime = new Date().getTime();
  const loginTimestamp = parseInt(loginTime);
  const hoursPassed = (currentTime - loginTimestamp) / (1000 * 60 * 60);
  
  if (hoursPassed >= 24) {
    logout();
    return false;
  }
  
  return true;
}

// Logout function
function logout() {
  // Clear all login data
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminLoginTime');
  localStorage.removeItem('adminUsername');
  localStorage.removeItem('rememberAdmin');
  
  // Show logout message
  alert('You have been logged out successfully.');
  
  // Redirect to login page
  redirectToLogin();
}

// Redirect to login page
function redirectToLogin() {
  window.location.href = 'login.html';
}

// Get current admin username
function getCurrentAdmin() {
  return localStorage.getItem('adminUsername') || 'Admin';
}

// Add logout event listeners to all logout buttons
function initializeLogout() {
  // Find all logout elements (by class or specific selector)
  const logoutElements = document.querySelectorAll('.nav-item:last-child, [data-action="logout"]');
  
  logoutElements.forEach(element => {
    element.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (confirm('Are you sure you want to logout?')) {
        logout();
      }
    });
    
    // Make it look clickable
    element.style.cursor = 'pointer';
  });
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  // Skip auth check for login page
  if (window.location.pathname.includes('login.html')) {
    return;
  }
  
  // Check authentication for all other pages
  if (!checkAuthStatus()) {
    return; // Will redirect to login
  }
  
  // Initialize logout functionality
  initializeLogout();
  
  // Update any admin name displays
  const adminNameElements = document.querySelectorAll('.admin-name');
  adminNameElements.forEach(element => {
    element.textContent = getCurrentAdmin();
  });
});

// Export functions for global use
window.logout = logout;
window.checkAuthStatus = checkAuthStatus;
window.getCurrentAdmin = getCurrentAdmin;
