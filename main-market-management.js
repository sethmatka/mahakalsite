import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where, runTransaction, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let mainMarkets = [];
let filteredMarkets = [];
let currentUpdateMarket = null;

// Function to search markets
function searchMarkets() {
  const searchTerm = document.getElementById('marketSearch').value.toLowerCase().trim();
  
  if (!searchTerm) {
    filteredMarkets = [...mainMarkets];
  } else {
    filteredMarkets = mainMarkets.filter(market => {
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
  filteredMarkets = [...mainMarkets];
  displayFilteredMarkets();
  updateStats();
}

// Function to display filtered markets
function displayFilteredMarkets() {
  const marketsContainer = document.getElementById('marketsContainer');
  const markets = filteredMarkets.length > 0 ? filteredMarkets : mainMarkets;
  
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
        <p>There are no main markets available at the moment.</p>
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

// Function to fetch main markets from buttons collection
async function fetchMainMarkets() {
  try {
    const marketsContainer = document.getElementById('marketsContainer');
    marketsContainer.innerHTML = '<div class="loading">Loading main markets...</div>';

    // Fetch all documents from buttons collection
    const buttonsCollection = collection(db, "buttons");
    const querySnapshot = await getDocs(buttonsCollection);
    
    mainMarkets = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      mainMarkets.push({
        id: doc.id,
        ...data
      });
    });
    
    // Sort markets by document ID for consistent display
    mainMarkets.sort((a, b) => a.id.localeCompare(b.id));
    
    // Initialize filtered markets
    filteredMarkets = [...mainMarkets];
    
    displayFilteredMarkets();
    updateStats();
    
    console.log("Fetched main markets:", mainMarkets);
  } catch (error) {
    console.error("Error fetching main markets:", error);
    const marketsContainer = document.getElementById('marketsContainer');
    marketsContainer.innerHTML = '<div class="loading">Error loading main markets</div>';
  }
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
  const totalMarkets = mainMarkets.length;
  const activeMarkets = mainMarkets.filter(market => 
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
    const marketRef = doc(db, "buttons", currentUpdateMarket.id);
    await updateDoc(marketRef, {
      number: newNumber,
    });
    
    // Check winning bids after updating the number
    await checkWinningBids(currentUpdateMarket.name, newNumber);
    console.log(`Market ${currentUpdateMarket.name} updated to number ${newNumber}`);
    
    // Store daily results to Firestore
    await storeDailyResultsToFirestoreMain();
    
    // Show success message
    alert(`Market number updated successfully to ${newNumber}!`);
    
    // Close modal and refresh data
    closeUpdateModal();
    fetchMainMarkets();
    
    console.log(`Market ${currentUpdateMarket.id} updated to number ${newNumber}`);
  } catch (error) {
    
    const updateBtn = document.querySelector('.modal-footer .btn-update');
    updateBtn.disabled = false;
    updateBtn.textContent = 'Update Number';
  }
}

// Function to check winning bids after number update
async function checkWinningBids(buttonName, resultNumber) {
  console.log(`🔄 Checking for winning bids for button: ${buttonName}, result: ${resultNumber}`);
  
  try {
    // Fetch all pending bids for this button
    const bidsQuery = query(
      collection(db, "bids"),
      where("selectedButton", "==", buttonName),
      where("status", "==", "Pending")
    );
    
    const bidsSnapshot = await getDocs(bidsQuery);
    
    if (bidsSnapshot.empty) {
      console.log("No pending bids found for this button");
      return;
    }
    
    // Process each bid
    for (const bidDoc of bidsSnapshot.docs) {
      const bidData = bidDoc.data();
      const bidId = bidDoc.id;
      
      const bidNumber = bidData.bidNumber || "";
      const bidAmount = bidData.bidAmount || 0;
      const userPhone = bidData.userPhone || "";
      const gameType = bidData.gameType || "";
      const sessionStatus = bidData.sessionStatus || "Open"; // Open or Close
      const secondNumber = bidData.secondNumber || "";
      
      console.log(`Processing bid: ${bidId}, gameType: ${gameType}, bidNumber: ${bidNumber}`);
      
      // Parse result number
      if (!resultNumber || resultNumber === "N/A") continue;
      
      const parts = resultNumber.split("-");
      
      let openHalf = "";
      let closeHalf = "";
      let singleDigit = "";
      let midDigit = "";
      let isCloseResultAvailable = false;
      
      switch (parts.length) {
        case 2: // Only Open result is available (XXX-X)
          openHalf = parts[0];
          singleDigit = parts[1];
          break;
        case 3: // Full result is available (XXX-XX-XXX)
          openHalf = parts[0];
          singleDigit = parts[1];
          midDigit = parts[1];
          closeHalf = parts[2];
          isCloseResultAvailable = true;
          break;
        default:
          continue; // Unexpected format, skip
      }
      
      // Skip if bid's session doesn't match available session
      if ((sessionStatus === "Close" && !isCloseResultAvailable) ||
          (sessionStatus === "Open" && isCloseResultAvailable)) {
        continue;
      }
      
      let winningAmount = 0;
      let isWinner = false;
      
      // Check winning conditions based on game type
      switch (gameType) {
        case "Single Digit":
          const digitToMatch = sessionStatus === "Open" ? singleDigit : singleDigit.slice(-1);
          console.log(`Single digit check: ${bidNumber} vs ${digitToMatch}`);
          if (bidNumber === digitToMatch) {
            winningAmount = bidAmount * 10;
            isWinner = true;
          }
          break;
          
        case "Double Digit":
          if (sessionStatus === "Close" && midDigit.length === 2) {
            console.log(`Double digit check: ${bidNumber} vs ${midDigit}`);
            if (bidNumber === midDigit) {
              winningAmount = bidAmount * 100;
              isWinner = true;
            }
          }
          break;
          
        case "Single Panna":
          const singlePanna = sessionStatus === "Open" ? openHalf : closeHalf;
          console.log(`Single panna check: ${bidNumber} vs ${singlePanna}`);
          if (bidNumber === singlePanna && isValidSinglePanna(singlePanna)) {
            winningAmount = bidAmount * 160;
            isWinner = true;
          }
          break;
          
        case "Double Panna":
          const doublePanna = sessionStatus === "Open" ? openHalf : closeHalf;
          console.log(`Double panna check: ${bidNumber} vs ${doublePanna}`);
          if (bidNumber === doublePanna && isValidDoublePanna(doublePanna)) {
            winningAmount = bidAmount * 320;
            isWinner = true;
          }
          break;
          
        case "Triple Panna":
          const triplePanna = sessionStatus === "Open" ? openHalf : closeHalf;
          console.log(`Triple panna check: ${bidNumber} vs ${triplePanna}`);
          if (bidNumber === triplePanna && isValidTriplePanna(triplePanna)) {
            winningAmount = bidAmount * 700;
            isWinner = true;
          }
          break;
          
        case "Half Sangam":
          const digit = bidNumber;
          const panna = secondNumber;
          console.log(`Half sangam check: digit ${digit}, panna ${panna}`);
          
          if (sessionStatus === "Open" && digit === singleDigit && panna === openHalf) {
            winningAmount = bidAmount * 1000;
            isWinner = true;
          } else if (sessionStatus === "Close" && digit === singleDigit.slice(-1) && panna === closeHalf) {
            winningAmount = bidAmount * 1000;
            isWinner = true;
          }
          break;
          
        case "Full Sangam":
          if (sessionStatus === "Close") {
            const panna1 = bidNumber;
            const panna2 = secondNumber;
            
            console.log(`Full sangam check: ${panna1} & ${panna2} vs ${openHalf} & ${closeHalf}`);
            
            if (openHalf === panna1 && closeHalf === panna2) {
              winningAmount = bidAmount * 1000;
              isWinner = true;
              console.log(`🎯 Full Sangam Winner! Amount: ${winningAmount}`);
            }
          }
          break;
      }
      
      // Update bid status and user balance if winner
      if (isWinner) {
        console.log(`🎉 Winner found: ${bidId}, Amount: ${winningAmount}`);
        await addWinningAmountToBalance(bidId, userPhone, winningAmount);
      } else {
        // Update bid status to "Lose"
        await updateDoc(doc(db, "bids", bidId), {
          status: "Lose"
        });
        console.log(`❌ Bid ${bidId} marked as lose`);
      }
    }
    
    console.log("✅ Winning bid check completed");
    
  } catch (error) {
    console.error("❌ Error checking winning bids:", error);
  }
}

// Function to add winning amount to user balance
async function addWinningAmountToBalance(bidId, userPhone, winningAmount) {
  try {
    const userRef = doc(db, "users", userPhone);
    const bidRef = doc(db, "bids", bidId);

    await runTransaction(db, async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      const currentBalance = userSnapshot.data()?.balance || 0;
      const newBalance = currentBalance + winningAmount;

      transaction.update(userRef, { balance: newBalance });
      transaction.update(bidRef, { 
        winningAmount: winningAmount,
        status: "Win"
      });
    });

    console.log(`✅ Winning balance updated for ${userPhone}: +${winningAmount}`);
    
  } catch (error) {
    console.error("❌ Error updating balance:", error);
  }
}

// Validation functions for different panna types
function isValidSinglePanna(number) {
  return number.length === 3 && new Set(number).size === 3;
}

function isValidDoublePanna(number) {
  if (number.length !== 3) return false;
  const counts = {};
  for (let char of number) {
    counts[char] = (counts[char] || 0) + 1;
  }
  const values = Object.values(counts);
  return values.includes(2) && values.includes(1);
}

function isValidTriplePanna(number) {
  return number.length === 3 && number[0] === number[1] && number[1] === number[2];
}

// Function to store daily results to Firestore for Main Markets
async function storeDailyResultsToFirestoreMain() {
  console.log("📦 Starting daily results storage for Main Markets...");
  
  try {
    // Get current date in dd-MM-yyyy format
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateString = `${day}-${month}-${year}`;
    
    // Fetch all documents from buttons collection
    const buttonsCollection = collection(db, "buttons");
    const querySnapshot = await getDocs(buttonsCollection);
    
    const resultMap = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const name = data.name || doc.id; // fallback to doc ID if name is missing
      const number = data.number;
      
      if (number && number !== "N/A" && number !== undefined) {
        resultMap[name] = number;
      }
    });
    
    console.log(`📦 Final resultMap for ${dateString}:`, resultMap);
    
    if (Object.keys(resultMap).length === 0) {
      console.warn("⚠️ No button data to upload. Check Firestore 'buttons' collection.");
      return;
    }
    
    // Store results to dailyResults collection - this will completely replace the document
    const dailyResultDoc = doc(db, "dailyResults", dateString);
    await setDoc(dailyResultDoc, resultMap, { merge: false });
    
    console.log(`✅ Main Market results saved for ${dateString}`);
    
  } catch (error) {
    console.error("❌ Failed to save daily Main Market results:", error);
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

// Function to clear all numbers at once
async function clearAllNumbers() {
  const confirmed = confirm("Are you sure you want to clear all numbers in all markets? This action cannot be undone.");
  
  if (!confirmed) {
    return;
  }

  try {
    // Show loading state
    const clearBtn = document.querySelector('.clear-all-btn');
    const originalText = clearBtn.innerHTML;
    clearBtn.innerHTML = '⏳ Clearing...';
    clearBtn.disabled = true;

    const buttonsCollection = collection(db, "buttons");
    const querySnapshot = await getDocs(buttonsCollection);
    
    const updatePromises = [];
    
    querySnapshot.forEach((doc) => {
      const buttonRef = doc.ref;
      updatePromises.push(updateDoc(buttonRef, { number: "" }));
    });
    
    await Promise.all(updatePromises);
    
    alert(`Successfully cleared numbers for ${updatePromises.length} markets!`);
    
    // Refresh the markets display
    fetchMainMarkets();
    
    console.log("All market numbers cleared successfully");
  } catch (error) {
    console.error("Error clearing all numbers:", error);
    alert("Error clearing numbers. Please try again.");
  } finally {
    // Reset button state
    const clearBtn = document.querySelector('.clear-all-btn');
    clearBtn.innerHTML = '🗑️ Clear All Numbers';
    clearBtn.disabled = false;
  }
}

// Make functions globally available
window.fetchMainMarkets = fetchMainMarkets;
window.openUpdateModal = openUpdateModal;
window.closeUpdateModal = closeUpdateModal;
window.updateMarketNumber = updateMarketNumber;
window.searchMarkets = searchMarkets;
window.clearSearch = clearSearch;
window.clearAllNumbers = clearAllNumbers;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeHamburgerMenu();
  fetchMainMarkets();
  
  // Auto-refresh every 2 minutes
  setInterval(fetchMainMarkets, 2 * 60 * 1000);
});
