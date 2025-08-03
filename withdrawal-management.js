import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, orderBy, getDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let withdrawalRequests = [];

// Function to fetch pending withdrawal requests
async function fetchWithdrawalRequests() {
  try {
    const requestsContainer = document.getElementById('requestsContainer');
    requestsContainer.innerHTML = '<div class="loading">Loading withdrawal requests...</div>';

    // Query withdrawal_requests collection for pending status
    const withdrawalCollection = collection(db, "withdrawal_requests");
    const q = query(
      withdrawalCollection,
      where("status", "==", "Pending"),
      orderBy("timestamp", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    withdrawalRequests = [];
    
    querySnapshot.forEach((doc) => {
      withdrawalRequests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    displayWithdrawalRequests();
    updateStats();
    
    console.log("Fetched withdrawal requests:", withdrawalRequests);
  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    const requestsContainer = document.getElementById('requestsContainer');
    requestsContainer.innerHTML = '<div class="loading">Error loading withdrawal requests</div>';
  }
}

// Function to display withdrawal requests
function displayWithdrawalRequests() {
  const requestsContainer = document.getElementById('requestsContainer');
  
  if (withdrawalRequests.length === 0) {
    requestsContainer.innerHTML = `
      <div class="no-requests">
        <div class="icon">📭</div>
        <h3>No Pending Requests</h3>
        <p>There are no pending withdrawal requests at the moment.</p>
      </div>
    `;
    return;
  }
  
  let requestsHTML = '';
  
  withdrawalRequests.forEach((request) => {
    const date = new Date(request.timestamp).toLocaleString();
    
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
              <div class="detail-value">${request.userId}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Type</div>
              <div class="detail-value">${request.type}</div>
            </div>
             <div class="detail-item">
              <div class="detail-label">UPI ID</div>
              <div class="detail-value upi-id" onclick="copyUpiId('${request.upiId}', this)" title="Click to copy UPI ID">${request.upiId}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Date & Time</div>
              <div class="detail-value">${date}</div>
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
          <button class="action-btn reject-btn" onclick="updateRequestStatus('${request.id}', 'Rejected')">
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

    // Get the request data first to access userId and amount
    const requestRef = doc(db, "withdrawal_requests", requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists()) {
      throw new Error("Request document not found");
    }
    
    const requestData = requestDoc.data();
    const userId = requestData.userId;
    const amount = requestData.amount;

    // Prepare update data
    const updateData = {
      status: newStatus,
      updatedAt: new Date().getTime()
    };

    // Add approvedOn field and deduct user balance if status is Approved
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

      // Deduct amount from user's balance in the users collection
      try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const currentBalance = userDoc.data().balance || 0;
          
          // Check if user has sufficient balance
          if (currentBalance >= amount) {
            // Deduct balance using negative increment to avoid race conditions
            await updateDoc(userRef, {
              balance: increment(-amount)
            });
            console.log(`Deducted ₹${amount} from user ${userId}'s balance`);
          } else {
            // Insufficient balance - ask admin if they want to proceed
            const continueApproval = confirm(
              `User ${userId} has insufficient balance!\n\nCurrent Balance: ₹${currentBalance}\nWithdrawal Amount: ₹${amount}\n\nDo you want to proceed with approval anyway? This will result in negative balance.`
            );
            
            if (!continueApproval) {
              // Re-enable buttons and return early
              buttons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
              });
              return;
            } else {
              // Proceed with deduction even if it results in negative balance
              await updateDoc(userRef, {
                balance: increment(-amount)
              });
              console.log(`Deducted ₹${amount} from user ${userId}'s balance (resulted in negative balance)`);
            }
          }
        } else {
          console.warn(`User document not found for userId: ${userId}`);
          // Ask admin if they want to continue without balance deduction
          const continueApproval = confirm(
            `User document not found for userId: ${userId}\n\nDo you want to continue with request approval without balance deduction?`
          );
          
          if (!continueApproval) {
            // Re-enable buttons and return early
            buttons.forEach(btn => {
              btn.disabled = false;
              btn.style.opacity = '1';
            });
            return;
          }
        }
      } catch (balanceError) {
        console.error("Error updating user balance:", balanceError);
        // Ask if they want to continue with approval despite balance update failure
        const continueApproval = confirm(
          `Failed to update user balance. Do you want to continue with request approval?\n\nError: ${balanceError.message}`
        );
        if (!continueApproval) {
          // Re-enable buttons and return early
          buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
          });
          return;
        }
      }
    }

    // Update the document in Firestore
    await updateDoc(requestRef, updateData);
    
    // Show success message
    if (newStatus === 'Approved') {
      alert(`Withdrawal request approved successfully! ₹${amount} has been deducted from user ${userId}'s balance.`);
    } else {
      alert(`Request ${newStatus.toLowerCase()} successfully!`);
    }
    
    // Refresh the list
    fetchWithdrawalRequests();
    
    console.log(`Request ${requestId} updated to ${newStatus}`);
  } catch (error) {
    console.error("Error updating request status:", error);
    alert(`Error updating request: ${error.message}. Please try again.`);
    
    // Re-enable buttons on error
    const buttons = document.querySelectorAll(`[onclick*="${requestId}"]`);
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  }
}

// Function to update stats
function updateStats() {
  const pendingCount = withdrawalRequests.length;
  const totalAmount = withdrawalRequests.reduce((sum, request) => sum + request.amount, 0);
  
  document.getElementById('pendingCount').textContent = pendingCount;
  document.getElementById('totalAmount').textContent = `₹${totalAmount.toLocaleString()}`;
}

// Function to copy UPI ID to clipboard
async function copyUpiId(upiId, element) {
  try {
    await navigator.clipboard.writeText(upiId);
    
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
    
    console.log('UPI ID copied to clipboard:', upiId);
  } catch (error) {
    console.error('Failed to copy UPI ID:', error);
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = upiId;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    // Show feedback
    element.classList.add('copied');
    element.title = 'Copied to clipboard!';
    
    setTimeout(() => {
      element.classList.remove('copied');
      element.title = 'Click to copy UPI ID';
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
window.fetchWithdrawalRequests = fetchWithdrawalRequests;
window.updateRequestStatus = updateRequestStatus;
window.copyUpiId = copyUpiId;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeHamburgerMenu();
  fetchWithdrawalRequests();
  
  // Auto-refresh every 5 minutes
  setInterval(fetchWithdrawalRequests, 5 * 60 * 1000);
});
