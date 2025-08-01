import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM elements
let noticeMessage, charCounter, sendBtn, previewBtn, clearBtn, loadingSpinner;
let currentNoticeContent, noticeStatus, noticeTimestamp;
let previewModal, confirmModal, successModal;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
  loadCurrentNotice();
  initializeHamburgerMenu();
});

function initializeElements() {
  // Form elements
  noticeMessage = document.getElementById('noticeMessage');
  charCounter = document.getElementById('charCounter');
  sendBtn = document.getElementById('sendBtn');
  previewBtn = document.getElementById('previewBtn');
  clearBtn = document.getElementById('clearBtn');
  loadingSpinner = document.getElementById('loadingSpinner');

  // Display elements
  currentNoticeContent = document.getElementById('currentNoticeContent');
  noticeStatus = document.getElementById('noticeStatus');
  noticeTimestamp = document.getElementById('noticeTimestamp');

  // Modals
  previewModal = document.getElementById('previewModal');
  confirmModal = document.getElementById('confirmModal');
  successModal = document.getElementById('successModal');
}

function setupEventListeners() {
  // Character counter
  noticeMessage.addEventListener('input', updateCharCounter);
  
  // Button events
  previewBtn.addEventListener('click', showPreview);
  sendBtn.addEventListener('click', showConfirmation);
  clearBtn.addEventListener('click', clearForm);
  
  // Confirmation modal
  document.getElementById('confirmSendBtn').addEventListener('click', sendNotice);
  
  // Modal close events
  window.addEventListener('click', handleModalClick);
  document.addEventListener('keydown', handleEscapeKey);
}

function updateCharCounter() {
  const length = noticeMessage.value.length;
  const maxLength = 500;
  
  charCounter.textContent = `${length} / ${maxLength} characters`;
  
  // Update button state
  const isEmpty = length === 0;
  const isTooLong = length > maxLength;
  
  sendBtn.disabled = isEmpty || isTooLong;
  previewBtn.disabled = isEmpty;
  
  if (isEmpty || isTooLong) {
    sendBtn.classList.add('btn-disabled');
    previewBtn.classList.add('btn-disabled');
  } else {
    sendBtn.classList.remove('btn-disabled');
    previewBtn.classList.remove('btn-disabled');
  }
  
  // Update counter color
  charCounter.classList.remove('warning', 'danger');
  if (length > maxLength * 0.8) {
    charCounter.classList.add('warning');
  }
  if (length > maxLength * 0.95) {
    charCounter.classList.add('danger');
  }
}

async function loadCurrentNotice() {
  try {
    const noticeDoc = await getDoc(doc(db, "notifications", "notify"));
    
    if (noticeDoc.exists()) {
      const data = noticeDoc.data();
      const message = data.message;
      
      if (message && message.trim() !== '') {
        // Display current notice
        currentNoticeContent.innerHTML = `<div>${message}</div>`;
        noticeStatus.innerHTML = '<span class="status-active">Active</span>';
        
        // Show timestamp if available
        if (data.timestamp) {
          const date = data.timestamp.toDate();
          noticeTimestamp.textContent = `Last updated: ${formatDate(date)}`;
          noticeTimestamp.style.display = 'block';
        }
      } else {
        showEmptyNotice();
      }
    } else {
      showEmptyNotice();
    }
  } catch (error) {
    console.error('Error loading current notice:', error);
    showEmptyNotice();
  }
}

function showEmptyNotice() {
  currentNoticeContent.innerHTML = '<div class="notice-empty">No notice has been set yet. Create your first notice below.</div>';
  noticeStatus.innerHTML = '<span class="status-empty">No Active Notice</span>';
  noticeTimestamp.style.display = 'none';
}

function showPreview() {
  const message = noticeMessage.value.trim();
  if (!message) return;
  
  document.getElementById('previewText').textContent = message;
  previewModal.style.display = 'block';
}

function showConfirmation() {
  const message = noticeMessage.value.trim();
  if (!message) return;
  
  confirmModal.style.display = 'block';
}

async function sendNotice() {
  const message = noticeMessage.value.trim();
  if (!message) return;
  
  // Close confirmation modal
  closeConfirmModal();
  
  // Show loading state
  setLoadingState(true);
  
  try {
    // Save to Firebase
    await setDoc(doc(db, "notifications", "notify"), {
      message: message,
      timestamp: serverTimestamp(),
      sentBy: localStorage.getItem('adminUsername') || 'Admin',
      active: true
    });
    
    // Show success
    showSuccess();
    
    // Clear form
    clearForm();
    
    // Reload current notice
    setTimeout(() => {
      loadCurrentNotice();
    }, 1000);
    
  } catch (error) {
    console.error('Error sending notice:', error);
    alert('Error sending notice. Please try again.');
  } finally {
    setLoadingState(false);
  }
}

function clearForm() {
  noticeMessage.value = '';
  updateCharCounter();
  noticeMessage.focus();
}

function setLoadingState(isLoading) {
  if (isLoading) {
    sendBtn.disabled = true;
    sendBtn.classList.add('btn-disabled');
    sendBtn.querySelector('span').style.opacity = '0';
    loadingSpinner.style.display = 'block';
  } else {
    sendBtn.disabled = false;
    sendBtn.classList.remove('btn-disabled');
    sendBtn.querySelector('span').style.opacity = '1';
    loadingSpinner.style.display = 'none';
  }
}

function showSuccess() {
  successModal.style.display = 'block';
  
  // Add success animation to the form
  document.querySelector('.notice-form-card').classList.add('success-animation');
  setTimeout(() => {
    document.querySelector('.notice-form-card').classList.remove('success-animation');
  }, 600);
}

// Modal close functions
function closePreviewModal() {
  previewModal.style.display = 'none';
}

function closeConfirmModal() {
  confirmModal.style.display = 'none';
}

function closeSuccessModal() {
  successModal.style.display = 'none';
}

function handleModalClick(event) {
  if (event.target === previewModal) {
    closePreviewModal();
  } else if (event.target === confirmModal) {
    closeConfirmModal();
  } else if (event.target === successModal) {
    closeSuccessModal();
  }
}

function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    closePreviewModal();
    closeConfirmModal();
    closeSuccessModal();
  }
}

// Utility functions
function formatDate(date) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleDateString('en-US', options);
}

// Hamburger menu functionality
function initializeHamburgerMenu() {
  const hamburgerMenu = document.getElementById('hamburgerMenu');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function toggleSidebar() {
    hamburgerMenu.classList.toggle('active');
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
  }

  function closeSidebar() {
    hamburgerMenu.classList.remove('active');
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  }

  // Enhanced navigation click effects
  function addNavClickEffects() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
      // Add click ripple effect
      item.addEventListener('click', function(e) {
        // Create ripple element
        const ripple = document.createElement('div');
        ripple.className = 'nav-ripple';
        
        // Calculate position
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        this.appendChild(ripple);
        
        // Remove ripple after animation
        setTimeout(() => {
          if (ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
          }
        }, 600);
        
        // Add click animation class
        this.classList.add('nav-clicked');
        setTimeout(() => {
          this.classList.remove('nav-clicked');
        }, 200);
      });
      
      // Add hover sound effect (visual feedback)
      item.addEventListener('mouseenter', function() {
        this.style.filter = 'brightness(1.1)';
      });
      
      item.addEventListener('mouseleave', function() {
        this.style.filter = 'brightness(1)';
      });
    });
  }

  // Event listeners
  hamburgerMenu.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Initialize enhanced navigation effects
  addNavClickEffects();

  // Close sidebar on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });
}

// Make functions globally available
window.closePreviewModal = closePreviewModal;
window.closeConfirmModal = closeConfirmModal;
window.closeSuccessModal = closeSuccessModal;
