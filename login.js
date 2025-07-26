import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Default admin credentials (you can later move this to Firebase)
const DEFAULT_ADMIN = {
  username: '9876543210',
  password: 'sunny@123'
};

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
  const isLoggedIn = localStorage.getItem('adminLoggedIn');
  const loginTime = localStorage.getItem('adminLoginTime');
  
  // Check if login is still valid (24 hours)
  if (isLoggedIn === 'true' && loginTime) {
    const currentTime = new Date().getTime();
    const loginTimestamp = parseInt(loginTime);
    const hoursPassed = (currentTime - loginTimestamp) / (1000 * 60 * 60);
    
    if (hoursPassed < 24) {
      // Still logged in, redirect to dashboard
      window.location.href = 'index.html';
      return;
    } else {
      // Login expired, clear storage
      localStorage.removeItem('adminLoggedIn');
      localStorage.removeItem('adminLoginTime');
      localStorage.removeItem('adminUsername');
    }
  }
  
  initializeLoginPage();
});

function initializeLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const usernameInput = document.getElementById('username');

  // Toggle password visibility
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    const eyeIcon = togglePassword.querySelector('.eye-icon');
    eyeIcon.textContent = type === 'password' ? '👁️' : '🙈';
  });

  // Handle form submission
  loginForm.addEventListener('submit', handleLogin);

  // Handle Enter key on form fields
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      passwordInput.focus();
    }
  });

  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLogin(e);
    }
  });

  // Auto-focus username field
  usernameInput.focus();
}

async function handleLogin(event) {
  event.preventDefault();
  
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  
  // Validation
  if (!username || !password) {
    showError('Please enter both username and password');
    return;
  }

  // Show loading state
  showLoadingState(true);

  try {
    // Check credentials
    const isValidLogin = await validateCredentials(username, password);
    
    if (isValidLogin) {
      // Store login state
      localStorage.setItem('adminLoggedIn', 'true');
      localStorage.setItem('adminLoginTime', new Date().getTime().toString());
      localStorage.setItem('adminUsername', username);
      
      if (rememberMe) {
        localStorage.setItem('rememberAdmin', 'true');
      }

      // Show success and redirect
      showSuccessMessage();
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
      
    } else {
      showError('Invalid username or password. Please check your credentials and try again.');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    showError('An error occurred during login. Please try again.');
  } finally {
    showLoadingState(false);
  }
}

async function validateCredentials(username, password) {
  // For now, use default admin credentials
  // Later you can implement Firebase-based admin authentication
  
  if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
    return true;
  }
  
  // You can later add Firebase admin collection check here
  /*
  try {
    const adminsRef = collection(db, "admins");
    const q = query(adminsRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const adminDoc = querySnapshot.docs[0];
      const adminData = adminDoc.data();
      
      // In a real app, you should hash passwords
      return adminData.password === password && adminData.active === true;
    }
  } catch (error) {
    console.error("Error checking admin credentials:", error);
  }
  */
  
  return false;
}

function showLoadingState(isLoading) {
  const loginBtn = document.getElementById('loginBtn');
  const btnText = loginBtn.querySelector('.btn-text');
  const loadingSpinner = document.getElementById('loadingSpinner');
  
  if (isLoading) {
    loginBtn.disabled = true;
    btnText.style.opacity = '0';
    loadingSpinner.style.display = 'block';
  } else {
    loginBtn.disabled = false;
    btnText.style.opacity = '1';
    loadingSpinner.style.display = 'none';
  }
}

function showError(message) {
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorModal').style.display = 'block';
  
  // Clear form fields
  document.getElementById('password').value = '';
  document.getElementById('username').focus();
}

function showSuccessMessage() {
  const loginBtn = document.getElementById('loginBtn');
  const btnText = loginBtn.querySelector('.btn-text');
  
  btnText.textContent = 'Login Successful! ✅';
  loginBtn.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
}

function closeErrorModal() {
  document.getElementById('errorModal').style.display = 'none';
}

// Handle modal clicks
window.onclick = function(event) {
  const modal = document.getElementById('errorModal');
  if (event.target === modal) {
    closeErrorModal();
  }
}

// Handle escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeErrorModal();
  }
});

// Make functions globally available
window.closeErrorModal = closeErrorModal;

// Console welcome message
console.log(`
🏛️ Mahakal Admin Panel
===================
Default Login Credentials:
Username: admin
Password: admin123

For security purposes, please change these credentials in production.
`);
