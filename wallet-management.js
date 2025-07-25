import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let walletRequests = [];

// Function to fetch pending add money requests
async function fetchWalletRequests() {
  try {
    const requestsContainer = document.getElementById('requestsContainer');
    requestsContainer.innerHTML = '<div class="loading">Loading add money requests...</div>';

    // Query add_money_requests collection for pending status
    const walletCollection = collection(db, "add_money_requests");
    const q = query(
      walletCollection,
      where("status", "==", "Pending"),
      orderBy("timestamp", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    walletRequests = [];
    
    querySnapshot.forEach((doc) => {
      walletRequests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    displayWalletRequests();
    await updateStats();
    
    console.log("Fetched add money requests:", walletRequests);
  } catch (error) {
    console.error("Error fetching add money requests:", error);
    const requestsContainer = document.getElementById('requestsContainer');
    requestsContainer.innerHTML = '<div class="loading">Error loading add money requests</div>';
  }
}

// Function to display add money requests
function displayWalletRequests() {
  const requestsContainer = document.getElementById('requestsContainer');
  
  if (walletRequests.length === 0) {
    requestsContainer.innerHTML = `
      <div class="no-requests">
        <div class="icon">💰</div>
        <h3>No Pending Requests</h3>
        <p>There are no pending add money requests at the moment.</p>
      </div>
    `;
    return;
  }
  
  let requestsHTML = '';
  
  walletRequests.forEach((request) => {
    const date = new Date(request.timestamp).toLocaleString();
    const submittedDate = request.submittedAt ? new Date(request.submittedAt).toLocaleString() : 'N/A';
    
    requestsHTML += `
      <div class="request-card">
        <div class="request-info">
          <div class="request-header">
            <div class="request-id">Request #${request.id.substring(0, 8)}</div>
            <div class="request-amount">₹${request.amount.toLocaleString()}</div>
          </div>
          
          <div class="request-details">
            <div class="detail-item">
              <div class="detail-label">User ID</div>
              <div class="detail-value user-id" onclick="copyUserId('${request.userId}', this)" title="Click to copy User ID">${request.userId}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Amount</div>
              <div class="detail-value">₹${request.amount.toLocaleString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Submitted At</div>
              <div class="detail-value">${submittedDate}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Status</div>
              <div class="detail-value">
                <span class="status-badge status-pending">${request.status}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="request-actions">
          <button class="action-btn approve-btn" onclick="updateRequestStatus('${request.id}', 'Approved')">
            ✅ Approve
          </button>
          <button class="action-btn reject-btn" onclick="updateRequestStatus('${request.id}', 'rejected')">
            ❌ Reject
          </button>
        </div>
      </div>
    `;
  });
  
  requestsContainer.innerHTML = requestsHTML;
}

// Function to update request status
async function updateRequestStatus(requestId, newStatus) {
  try {
    // Disable buttons to prevent multiple clicks
    const buttons = document.querySelectorAll(`[onclick*="${requestId}"]`);
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    });

    // Prepare update data
    const updateData = {
      status: newStatus,
    };

    // Add approvedOn field if status is Approved
    if (newStatus === 'Approved') {
      const now = new Date();
      const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
        timeZoneName: 'short'
      };
      const formattedDate = now.toLocaleString('en-US', options).replace('IST', 'UTC+5:30');
      updateData.approvedOn = formattedDate;
    }

    // Update the document in Firestore
    const requestRef = doc(db, "add_money_requests", requestId);
    await updateDoc(requestRef, updateData);
    
    // Show success message
    alert(`Request ${newStatus} successfully!`);
    
    // Refresh the list
    fetchWalletRequests();
    
    console.log(`Request ${requestId} updated to ${newStatus}`);
  } catch (error) {
    console.error("Error updating request status:", error);
    alert("Error updating request. Please try again.");
    
    // Re-enable buttons on error
    const buttons = document.querySelectorAll(`[onclick*="${requestId}"]`);
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  }
}

// Function to update stats
async function updateStats() {
  const pendingCount = walletRequests.length;
  const totalAmount = walletRequests.reduce((sum, request) => sum + request.amount, 0);
  
  // Calculate today's Approved amount
  const todayApprovedAmount = await fetchTodayApprovedAmount();
  
  document.getElementById('pendingCount').textContent = pendingCount;
  document.getElementById('totalAmount').textContent = `₹${totalAmount.toLocaleString()}`;
  document.getElementById('approvedAmount').textContent = `₹${todayApprovedAmount.toLocaleString()}`;
}

// Function to fetch today's Approved amount
async function fetchTodayApprovedAmount() {
  try {
    // Get today's date in the same format for comparison
    const today = new Date();
    const todayFormatted = today.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
    
    console.log("Looking for approved requests on:", todayFormatted);
    
    const walletCollection = collection(db, "add_money_requests");
    const q = query(
      walletCollection,
      where("status", "==", "Approved")
    );
    
    const querySnapshot = await getDocs(q);
    let ApprovedAmount = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log("Checking document:", doc.id, "approvedOn:", data.approvedOn, "type:", typeof data.approvedOn);
      
      // Check if approvedOn exists and is a string before using includes
      if (data.approvedOn && typeof data.approvedOn === 'string' && data.approvedOn.includes(todayFormatted)) {
        ApprovedAmount += data.amount || 0;
        console.log("Added amount:", data.amount, "Total so far:", ApprovedAmount);
      }
    });
    
    console.log("Today's Approved amount:", ApprovedAmount);
    return ApprovedAmount;
  } catch (error) {
    console.error("Error fetching today's Approved amount:", error);
    return 0;
  }
}

// Function to copy User ID to clipboard
async function copyUserId(userId, element) {
  try {
    await navigator.clipboard.writeText(userId);
    
    // Add copied class for visual feedback
    element.classList.add('copied');
    
    // Show success message
    const originalTitle = element.title;
    element.title = 'Copied to clipboard!';
    
    // Remove copied class and restore title after animation
    setTimeout(() => {
      element.classList.remove('copied');
      element.title = originalTitle;
    }, 1500);
    
    console.log('User ID copied to clipboard:', userId);
  } catch (error) {
    console.error('Failed to copy User ID:', error);
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = userId;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Show feedback
    element.classList.add('copied');
    element.title = 'Copied to clipboard!';
    
    setTimeout(() => {
      element.classList.remove('copied');
      element.title = 'Click to copy User ID';
    }, 1500);
  }
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

  hamburgerMenu.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });
}

// Make functions globally available
window.fetchWalletRequests = fetchWalletRequests;
window.updateRequestStatus = updateRequestStatus;
window.copyUserId = copyUserId;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeHamburgerMenu();
  fetchWalletRequests();
  
  // Auto-refresh every 5 minutes
  setInterval(fetchWalletRequests, 5 * 60 * 1000);
});
