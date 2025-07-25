import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit, startAfter, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let allBids = [];
let filteredBids = [];
let currentPage = 1;
let itemsPerPage = 20;
let totalPages = 1;

// Function to fetch all bids from the bids collection
async function fetchBids() {
  try {
    document.getElementById('bidsTableBody').innerHTML = '<tr><td colspan="9" class="loading">Loading bids...</td></tr>';

    // Fetch all documents from bids collection
    const bidsCollection = collection(db, "bids");
    const bidsQuery = query(bidsCollection, orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(bidsQuery);
    
    allBids = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allBids.push({
        id: doc.id,
        ...data
      });
    });
    
    filteredBids = [...allBids];
    updateStats();
    displayBids();
    
    console.log("Fetched bids:", allBids);
  } catch (error) {
    console.error("Error fetching bids:", error);
    document.getElementById('bidsTableBody').innerHTML = '<tr><td colspan="9" class="loading">Error loading bids</td></tr>';
  }
}

// Function to update statistics
function updateStats() {
  const totalBids = filteredBids.length;
  const totalBidAmount = filteredBids.reduce((sum, bid) => sum + (parseFloat(bid.bidAmount) || 0), 0);
  const totalWinnings = filteredBids.reduce((sum, bid) => sum + (parseFloat(bid.winningAmount) || 0), 0);
  const uniqueUsers = new Set(filteredBids.map(bid => bid.userPhone)).size;

  document.getElementById('totalBids').textContent = totalBids.toLocaleString();
  document.getElementById('totalBidAmount').textContent = `₹${totalBidAmount.toLocaleString()}`;
  document.getElementById('totalWinnings').textContent = `₹${totalWinnings.toLocaleString()}`;
  document.getElementById('uniqueUsers').textContent = uniqueUsers;
}

// Function to display bids in table
function displayBids() {
  const tbody = document.getElementById('bidsTableBody');
  
  if (filteredBids.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="no-data">
          <div class="icon">📊</div>
          <h3>No Bids Found</h3>
          <p>There are no bids matching your criteria.</p>
        </td>
      </tr>
    `;
    updatePagination();
    return;
  }

  // Calculate pagination
  totalPages = Math.ceil(filteredBids.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBids = filteredBids.slice(startIndex, endIndex);

  let tableHTML = '';
  
  currentBids.forEach((bid) => {
    const date = new Date(bid.timestamp);
    const formattedDate = date.toLocaleDateString('en-IN');
    const formattedTime = date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const statusClass = bid.status === 'Win' ? 'status-win' : 'status-lose';
    const sessionClass = bid.sessionStatus === 'Open' ? 'session-open' : 'session-close';

    tableHTML += `
      <tr onclick="showBidDetails('${bid.id}')">
        <td>
          <div>${formattedDate}</div>
          <div style="font-size: 12px; color: #7f8c8d;">${formattedTime}</div>
        </td>
        <td>
          <span class="phone-number">${bid.userPhone || 'N/A'}</span>
        </td>
        <td>${bid.selectedButton || 'N/A'}</td>
        <td>${bid.gameType || 'N/A'}</td>
        <td>
          <span class="bid-number">${bid.bidNumber || 'N/A'}</span>
        </td>
        <td>
          <span class="bid-amount">₹${parseFloat(bid.bidAmount || 0).toLocaleString()}</span>
        </td>
        <td>
          <span class="session-badge ${sessionClass}">${bid.sessionStatus || 'N/A'}</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${bid.status || 'N/A'}</span>
        </td>
        <td>
          <span class="winning-amount">₹${parseFloat(bid.winningAmount || 0).toLocaleString()}</span>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = tableHTML;
  updatePagination();
}

// Function to show bid details in modal
function showBidDetails(bidId) {
  const bid = allBids.find(b => b.id === bidId);
  if (!bid) return;

  const date = new Date(bid.timestamp);
  const formattedDateTime = date.toLocaleString('en-IN');

  document.getElementById('modalUserPhone').textContent = bid.userPhone || 'N/A';
  document.getElementById('modalSelectedButton').textContent = bid.selectedButton || 'N/A';
  document.getElementById('modalGameType').textContent = bid.gameType || 'N/A';
  document.getElementById('modalBidNumber').textContent = bid.bidNumber || 'N/A';
  document.getElementById('modalBidAmount').textContent = `₹${parseFloat(bid.bidAmount || 0).toLocaleString()}`;
  document.getElementById('modalSessionStatus').textContent = bid.sessionStatus || 'N/A';
  document.getElementById('modalStatus').textContent = bid.status || 'N/A';
  document.getElementById('modalWinningAmount').textContent = `₹${parseFloat(bid.winningAmount || 0).toLocaleString()}`;
  document.getElementById('modalTimestamp').textContent = formattedDateTime;

  document.getElementById('bidDetailsModal').style.display = 'block';
}

// Function to close bid details modal
function closeBidDetailsModal() {
  document.getElementById('bidDetailsModal').style.display = 'none';
}

// Function to apply filters
function applyFilters() {
  const statusFilter = document.getElementById('statusFilter').value;
  const gameTypeFilter = document.getElementById('gameTypeFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;

  filteredBids = allBids.filter(bid => {
    let matches = true;

    // Status filter
    if (statusFilter && bid.status !== statusFilter) {
      matches = false;
    }

    // Game type filter
    if (gameTypeFilter && bid.gameType !== gameTypeFilter) {
      matches = false;
    }

    // Date filter
    if (dateFilter) {
      const bidDate = new Date(bid.timestamp);
      const filterDate = new Date(dateFilter);
      if (bidDate.toDateString() !== filterDate.toDateString()) {
        matches = false;
      }
    }

    return matches;
  });

  currentPage = 1;
  updateStats();
  displayBids();
}

// Function to clear filters
function clearFilters() {
  document.getElementById('statusFilter').value = '';
  document.getElementById('gameTypeFilter').value = '';
  document.getElementById('dateFilter').value = '';
  
  filteredBids = [...allBids];
  currentPage = 1;
  updateStats();
  displayBids();
}

// Function to update pagination
function updatePagination() {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Function to change page
function changePage(direction) {
  if (direction === 'prev' && currentPage > 1) {
    currentPage--;
  } else if (direction === 'next' && currentPage < totalPages) {
    currentPage++;
  }
  
  displayBids();
}

// Function to export bids to CSV
function exportBids() {
  if (filteredBids.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = ['Date & Time', 'User Phone', 'Game', 'Game Type', 'Bid Number', 'Bid Amount', 'Session Status', 'Status', 'Winning Amount'];
  
  let csvContent = headers.join(',') + '\n';
  
  filteredBids.forEach(bid => {
    const date = new Date(bid.timestamp);
    const formattedDateTime = date.toLocaleString('en-IN');
    
    const row = [
      `"${formattedDateTime}"`,
      `"${bid.userPhone || 'N/A'}"`,
      `"${bid.selectedButton || 'N/A'}"`,
      `"${bid.gameType || 'N/A'}"`,
      `"${bid.bidNumber || 'N/A'}"`,
      `"₹${parseFloat(bid.bidAmount || 0).toLocaleString()}"`,
      `"${bid.sessionStatus || 'N/A'}"`,
      `"${bid.status || 'N/A'}"`,
      `"₹${parseFloat(bid.winningAmount || 0).toLocaleString()}"`
    ];
    
    csvContent += row.join(',') + '\n';
  });

  // Create and download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `bid_report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
      closeBidDetailsModal();
    }
  });
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('bidDetailsModal');
  if (event.target === modal) {
    closeBidDetailsModal();
  }
}

// Make functions globally available
window.fetchBids = fetchBids;
window.showBidDetails = showBidDetails;
window.closeBidDetailsModal = closeBidDetailsModal;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.changePage = changePage;
window.exportBids = exportBids;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeHamburgerMenu();
  fetchBids();
  
  // Auto-refresh every 5 minutes
  setInterval(fetchBids, 5 * 60 * 1000);
});
