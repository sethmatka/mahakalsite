import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let starlineMarkets = [];
let filteredMarkets = [];
let currentUpdateMarket = null;

// Function to search markets
function searchMarkets() {
  const searchTerm = document.getElementById('marketSearch').value.toLowerCase().trim();
  
  if (!searchTerm) {
    filteredMarkets = [...starlineMarkets];
  } else {
    filteredMarkets = starlineMarkets.filter(market => {
      const marketName = (market.name || market.id).toLowerCase();
      return marketName.includes(searchTerm);
    });
  }
  
  displayFilteredMarkets();
  updateStats();
}

// Function to clear search
function clearSearch() {
  document.getElementById('marketSearch').value = '';
  filteredMarkets = [...starlineMarkets];
  displayFilteredMarkets();
  updateStats();
}

// Function to fetch Starline markets from button_play collection
async function fetchStarlineMarkets() {
  try {
    const marketsContainer = document.getElementById('marketsContainer');
    marketsContainer.innerHTML = '<div class="loading">Loading Starline markets...</div>';

    // Fetch all documents from button_play collection
    const buttonsCollection = collection(db, "button_play");
    const querySnapshot = await getDocs(buttonsCollection);
    
    starlineMarkets = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      starlineMarkets.push({
        id: doc.id,
        ...data
      });
    });
    
    // Sort markets by document ID for consistent display
    starlineMarkets.sort((a, b) => a.id.localeCompare(b.id));
    
    // Initialize filtered markets
    filteredMarkets = [...starlineMarkets];
    
    displayFilteredMarkets();
    updateStats();
    
    console.log("Fetched Starline markets:", starlineMarkets);
  } catch (error) {
    console.error("Error fetching Starline markets:", error);
    const marketsContainer = document.getElementById('marketsContainer');
    marketsContainer.innerHTML = '<div class="loading">Error loading Starline markets</div>';
  }
}

// Function to display filtered markets
function displayFilteredMarkets() {
  const marketsContainer = document.getElementById('marketsContainer');
  const markets = filteredMarkets.length > 0 ? filteredMarkets : starlineMarkets;
  
  if (markets.length === 0) {
    const searchTerm = document.getElementById('marketSearch').value;
    const message = searchTerm ? 
      `<div class="no-markets">
        <div class="icon">🔍</div>
        <h3>No Markets Found</h3>
        <p>No markets match your search "${searchTerm}"</p>
        <button class="clear-search-btn" onclick="clearSearch()">Clear Search</button>
      </div>` :
      `<div class="no-markets">
        <div class="icon">🏪</div>
        <h3>No Markets Found</h3>
        <p>There are no Starline markets available at the moment.</p>
      </div>`;
    
    marketsContainer.innerHTML = message;
    return;
  }
  
  let marketsHTML = '<div class="markets-grid">';
  
  markets.forEach((market) => {
    const isOpen = isMarketOpen(market.openTime, market.closeTime);
    const statusClass = isOpen ? 'status-open' : 'status-closed';
    const statusText = isOpen ? 'Open' : 'Closed';
    
    marketsHTML += `
      <div class="market-card">
        <div class="market-header">
          <h3 class="market-name">${market.name || market.id}</h3>
          <span class="market-status ${statusClass}">${statusText}</span>
        </div>
        
        <div class="market-details">
          <div class="detail-item">
            <div class="detail-label">Open Time</div>
            <div class="detail-value">${market.openTime || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Close Time</div>
            <div class="detail-value">${market.closeTime || 'N/A'}</div>
          </div>
        </div>
        
        <div class="market-number">
          <div class="number-label">Current Number</div>
          <div class="number-value">${market.number !== undefined ? market.number : 'N/A'}</div>
        </div>
        
        <div class="market-actions">
          <button class="update-btn" onclick="openUpdateModal('${market.id}', '${market.name || market.id}', '${market.number !== undefined ? market.number : 0}')">
            ✏️ Update Number
          </button>
        </div>
      </div>
    `;
  });
  
  marketsHTML += '</div>';
  marketsContainer.innerHTML = marketsHTML;
}

// Function to check if market is currently open
function isMarketOpen(openTime, closeTime) {
  if (!openTime || !closeTime) return false;
  
  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  // Convert time strings to numbers (assuming format like "10:30" or "1030")
  const openTimeNum = parseTime(openTime);
  const closeTimeNum = parseTime(closeTime);
  
  if (openTimeNum <= closeTimeNum) {
    // Same day market
    return currentTime >= openTimeNum && currentTime <= closeTimeNum;
  } else {
    // Overnight market
    return currentTime >= openTimeNum || currentTime <= closeTimeNum;
  }
}

// Helper function to parse time string to number
function parseTime(timeStr) {
  if (!timeStr) return 0;
  
  // Remove any non-digit characters and convert to number
  const cleanTime = timeStr.toString().replace(/[^\d]/g, '');
  return parseInt(cleanTime) || 0;
}

// Function to update statistics
function updateStats() {
  const totalMarkets = starlineMarkets.length;
  const activeMarkets = starlineMarkets.filter(market => 
    isMarketOpen(market.openTime, market.closeTime)
  ).length;
  const closedMarkets = totalMarkets - activeMarkets;
  
  document.getElementById('totalMarkets').textContent = totalMarkets;
  document.getElementById('activeMarkets').textContent = activeMarkets;
  document.getElementById('closedMarkets').textContent = closedMarkets;
}

// Function to open update modal
function openUpdateModal(marketId, marketName, currentNumber) {
  currentUpdateMarket = { id: marketId, name: marketName, number: currentNumber };
  
  document.getElementById('modalMarketName').textContent = marketName;
  document.getElementById('modalCurrentNumber').textContent = currentNumber;
  document.getElementById('newNumber').value = '';
  document.getElementById('updateModal').style.display = 'block';
}

// Function to close update modal
function closeUpdateModal() {
  document.getElementById('updateModal').style.display = 'none';
  currentUpdateMarket = null;
}

// Function to update market number
async function updateMarketNumber() {
  const newNumber = document.getElementById('newNumber').value;
  
  try {
    const updateBtn = document.querySelector('.modal-footer .btn-update');
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';
    
    // Update the document in Firestore
    const marketRef = doc(db, "button_play", currentUpdateMarket.id);
    await updateDoc(marketRef, {
      number: newNumber,
    });
    
    // Show success message
    alert(`Starline market number updated successfully to ${newNumber}!`);
    
    // Close modal and refresh data
    closeUpdateModal();
    fetchStarlineMarkets();
    
    console.log(`Starline market ${currentUpdateMarket.id} updated to number ${newNumber}`);
  } catch (error) {
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
      closeUpdateModal();
    }
  });
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('updateModal');
  if (event.target === modal) {
    closeUpdateModal();
  }
}

// Make functions globally available
window.fetchStarlineMarkets = fetchStarlineMarkets;
window.openUpdateModal = openUpdateModal;
window.closeUpdateModal = closeUpdateModal;
window.updateMarketNumber = updateMarketNumber;
window.searchMarkets = searchMarkets;
window.clearSearch = clearSearch;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeHamburgerMenu();
  fetchStarlineMarkets();
  
  // Auto-refresh every 2 minutes
  setInterval(fetchStarlineMarkets, 2 * 60 * 1000);
});
