import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, collection, getCountFromServer, query, where, getDocs, Timestamp, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Function to fetch total users count
async function fetchTotalUsers() {
  try {
    const usersCollection = collection(db, "users");
    const snapshot = await getCountFromServer(usersCollection);
    const totalUsers = snapshot.data().count;
    
    // Update all elements that display user count
    const userCountElements = document.querySelectorAll('.user-count');
    userCountElements.forEach(element => {
      element.textContent = totalUsers;
    });
    
    console.log("Total users:", totalUsers);
    return totalUsers;
  } catch (error) {
    console.error("Error fetching user count:", error);
    // Fallback to showing error or default value
    const userCountElements = document.querySelectorAll('.user-count');
    userCountElements.forEach(element => {
      element.textContent = "Error";
    });
  }
}

// Function to fetch market amount for selected game
async function fetchMarketAmount(selectedGameName) {
  try {
    if (!selectedGameName) {
      // If no game selected, show N/A
      const amountDisplay = document.querySelector('.amount-display strong');
      if (amountDisplay) {
        amountDisplay.textContent = 'N/A';
      }
      return;
    }

    // Get today's date range (start and end of today) in Unix timestamp format
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Convert to Unix timestamps (milliseconds)
    const startTimestamp = startOfDay.getTime();
    const endTimestamp = endOfDay.getTime();

    // Query bids collection for documents where selectedButton matches the game name and timestamp is from today
    const bidsCollection = collection(db, "bids");
    const q = query(
      bidsCollection,
      where("selectedButton", "==", selectedGameName),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<", endTimestamp)
    );
    
    const querySnapshot = await getDocs(q);
    let totalMarketAmount = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const bidAmount = data.bidAmount || 0;
      totalMarketAmount += bidAmount;
    });
    
    // Update the market amount display
    const amountDisplay = document.querySelector('.amount-display strong');
    if (amountDisplay) {
      amountDisplay.textContent = totalMarketAmount.toLocaleString();
    }
    
    console.log(`Market amount for ${selectedGameName} (today):`, totalMarketAmount);
    return totalMarketAmount;
  } catch (error) {
    console.error("Error fetching market amount:", error);
    const amountDisplay = document.querySelector('.amount-display strong');
    if (amountDisplay) {
      amountDisplay.textContent = 'Error';
    }
  }
}

// Function to fetch game names from all collections
async function fetchGameNames() {
  try {
    const gameNames = [];
    const collections = ['buttons', 'button_play', 'button_gali'];
    
    // Fetch from all three collections
    for (const collectionName of collections) {
      const collectionRef = collection(db, collectionName);
      const querySnapshot = await getDocs(collectionRef);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          gameNames.push({
            id: doc.id,
            name: data.name,
            collection: collectionName
          });
        }
      });
    }
    
    // Populate the dropdown
    const gameSelect = document.getElementById('gameName');
    if (gameSelect) {
      // Clear existing options except the first one
      gameSelect.innerHTML = '<option value="">Select Game Name</option>';
      
      // Add game names to dropdown
      gameNames.forEach(game => {
        const option = document.createElement('option');
        option.value = game.name; // Use the actual game name as value for matching
        option.textContent = game.name;
        option.dataset.collection = game.collection;
        option.dataset.docId = game.id;
        gameSelect.appendChild(option);
      });

      // Add event listener for dropdown change
      gameSelect.addEventListener('change', function() {
        const selectedGameName = this.value;
        fetchMarketAmount(selectedGameName);
      });
    }
    
    console.log("Game names fetched:", gameNames);
    return gameNames;
  } catch (error) {
    console.error("Error fetching game names:", error);
    const gameSelect = document.getElementById('gameName');
    if (gameSelect) {
      gameSelect.innerHTML = '<option value="">Error loading games</option>';
    }
  }
}

// Function to fetch and display total bids by game type
async function fetchTotalBidsByGameType() {
  try {
    // Get today's date range (start and end of today) in Unix timestamp format
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Convert to Unix timestamps (milliseconds)
    const startTimestamp = startOfDay.getTime();
    const endTimestamp = endOfDay.getTime();

    // Query bids collection for documents from today
    const bidsCollection = collection(db, "bids");
    const q = query(
      bidsCollection,
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<", endTimestamp)
    );
    
    const querySnapshot = await getDocs(q);
    const gameTypeBids = {};
    const gameTypeCounts = {};
    
    // Group bids by gameType and sum their bidAmounts, also count the number of bids
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const gameType = data.gameType || 'Unknown';
      const bidAmount = data.bidAmount || 0;
      
      if (gameTypeBids[gameType]) {
        gameTypeBids[gameType] += bidAmount;
        gameTypeCounts[gameType] += 1;
      } else {
        gameTypeBids[gameType] = bidAmount;
        gameTypeCounts[gameType] = 1;
      }
    });
    
    // Update the Total Bids section
    const bidsGrid = document.querySelector('.bids-grid');
    if (bidsGrid) {
      // Clear existing content except the title
      const title = bidsGrid.querySelector('h3');
      bidsGrid.innerHTML = '';
      if (title) {
        bidsGrid.appendChild(title);
      } else {
        bidsGrid.innerHTML = '<h3>Total Bids</h3>';
      }
      
      // Create bid rows dynamically
      const gameTypes = Object.keys(gameTypeBids);
      const itemsPerRow = 3;
      
      // Array of colors for the footer sections
      const colors = [
        '#6c5ce7', '#00b894', '#0984e3', '#fdcb6e', '#a29bfe',
        '#fd79a8', '#e17055', '#d63031', '#00cec9', '#6c5ce7',
        '#fdcb6e', '#fd79a8', '#00b894', '#0984e3', '#e17055'
      ];
      
      for (let i = 0; i < gameTypes.length; i += itemsPerRow) {
        const bidRow = document.createElement('div');
        bidRow.className = 'bid-row';
        
        // Add up to 3 items per row
        for (let j = i; j < Math.min(i + itemsPerRow, gameTypes.length); j++) {
          const gameType = gameTypes[j];
          const totalAmount = gameTypeBids[gameType];
          const bidCount = gameTypeCounts[gameType];
          const cardIndex = j;
          
          const bidCard = document.createElement('div');
          bidCard.className = 'bid-card';
          bidCard.style.cssText = `
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            background: white;
            padding: 0;
            position: relative;
            min-height: 140px;
            display: flex;
            flex-direction: column;
          `;
          
          bidCard.innerHTML = `
            <div style="padding: 8px; text-align: center; color: #888; font-size: 12px; border-bottom: 1px solid #f0f0f0;">
              Total Bids ${bidCount}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 15px;">
              <div style="font-size: 28px; font-weight: bold; color: #333; margin-bottom: 5px;">
                ${totalAmount.toLocaleString()}
              </div>
              <div style="font-size: 11px; color: #888;">
                Total Bid Amount
              </div>
            </div>
            <div style="background-color: ${colors[j % colors.length]}; color: white; text-align: center; padding: 8px; font-size: 12px; font-weight: bold;">
              ${gameType}
            </div>
          `;
          
          bidRow.appendChild(bidCard);
        }
        
        bidsGrid.appendChild(bidRow);
      }
    }
    
    console.log("Total bids by game type (today):", gameTypeBids);
    return gameTypeBids;
  } catch (error) {
    console.error("Error fetching total bids by game type:", error);
    const bidsGrid = document.querySelector('.bids-grid');
    if (bidsGrid) {
      bidsGrid.innerHTML = '<h3>Total Bids</h3><p>Error loading bid data</p>';
    }
  }
}

// Function to fetch total bid amount for pending bids from today
async function fetchTotalBidAmount() {
  try {
    // Get today's date range (start and end of today) in Unix timestamp format
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // Convert to Unix timestamps (milliseconds)
    const startTimestamp = startOfDay.getTime();
    console.log("Start Timestamp:", startTimestamp);
    const endTimestamp = endOfDay.getTime();
    console.log("End Timestamp:", endTimestamp);
    
    // Create query for pending bids from today
    const bidsCollection = collection(db, "bids");
    const q = query(
      bidsCollection,
    //   where("status", "==", "Pending"),
      where("timestamp", ">=", startTimestamp),
      where("timestamp", "<", endTimestamp)
    );
    
    const querySnapshot = await getDocs(q);
    let totalBidAmount = 0;
    console.log("Total pending bids found:", querySnapshot.size);
    querySnapshot.forEach((doc) => {
        console.log("Processing doc:", doc.id);
      const data = doc.data();
      const bidAmount = data.bidAmount || 0;
      console.log("Bid Amount for doc", doc.id, ":", bidAmount);
      totalBidAmount += bidAmount;
    });
    
    // Update the bid amount display
    const bidAmountElements = document.querySelectorAll('.bid-amount');
    bidAmountElements.forEach(element => {
      element.textContent = totalBidAmount.toLocaleString();
    });
    
    console.log("Total pending bid amount for today:", totalBidAmount);
    return totalBidAmount;
  } catch (error) {
    console.error("Error fetching bid amount:", error);
    // Fallback to showing error or default value
    const bidAmountElements = document.querySelectorAll('.bid-amount');
    bidAmountElements.forEach(element => {
      element.textContent = "Error";
    });
  }
}

// Function to fetch UPI ID from settings collection
async function fetchUpiId() {
  try {
    const upiConfigDoc = doc(db, "settings", "upi_config");
    const docSnap = await getDoc(upiConfigDoc);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const upiId = data.upi_id || "Not Set";
      
      // Update UPI ID display
      const upiDisplay = document.getElementById('currentUpiId');
      if (upiDisplay) {
        upiDisplay.textContent = upiId;
      }
      
      // Store current UPI ID for later use
      window.currentUpiId = upiId;
      
      console.log("Current UPI ID:", upiId);
      return upiId;
    } else {
      // Document doesn't exist, create it with default value
      await setDoc(upiConfigDoc, { upi_id: "Not Set" });
      
      const upiDisplay = document.getElementById('currentUpiId');
      if (upiDisplay) {
        upiDisplay.textContent = "Not Set";
      }
      
      window.currentUpiId = "Not Set";
      console.log("UPI config document created with default value");
      return "Not Set";
    }
  } catch (error) {
    console.error("Error fetching UPI ID:", error);
    const upiDisplay = document.getElementById('currentUpiId');
    if (upiDisplay) {
      upiDisplay.textContent = "Error loading";
    }
  }
}

// Function to update UPI ID
async function updateUpiId(newUpiId) {
  try {
    if (!newUpiId || newUpiId.trim() === '') {
      throw new Error('UPI ID cannot be empty');
    }

    const upiConfigDoc = doc(db, "settings", "upi_config");
    await updateDoc(upiConfigDoc, {
      upi_id: newUpiId.trim(),
      last_updated: new Date().toISOString()
    });

    // Update the display
    const upiDisplay = document.getElementById('currentUpiId');
    if (upiDisplay) {
      upiDisplay.textContent = newUpiId.trim();
    }

    // Update stored value
    window.currentUpiId = newUpiId.trim();

    // Show success status
    showUpiStatus('UPI ID updated successfully!', 'success');
    
    console.log("UPI ID updated successfully:", newUpiId);
    return true;
  } catch (error) {
    console.error("Error updating UPI ID:", error);
    showUpiStatus('Failed to update UPI ID: ' + error.message, 'error');
    return false;
  }
}

// Function to show status messages
function showUpiStatus(message, type) {
  const statusElement = document.getElementById('upiStatus');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `upi-status ${type}`;
    statusElement.style.display = 'block';
    
    // Hide status after 3 seconds
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// Function to copy UPI ID to clipboard
async function copyUpiId() {
  try {
    const upiId = window.currentUpiId || document.getElementById('currentUpiId').textContent;
    
    if (upiId && upiId !== 'Not Set' && upiId !== 'Error loading') {
      await navigator.clipboard.writeText(upiId);
      showUpiStatus('UPI ID copied to clipboard!', 'success');
    } else {
      showUpiStatus('No valid UPI ID to copy', 'error');
    }
  } catch (error) {
    console.error("Error copying UPI ID:", error);
    showUpiStatus('Failed to copy UPI ID', 'error');
  }
}

// Function to fetch WhatsApp number from settings collection
async function fetchWhatsAppNumber() {
  try {
    const whatsappConfigDoc = doc(db, "settings", "contact_config");
    const docSnap = await getDoc(whatsappConfigDoc);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const whatsappNumber = data.whatsapp_number || "Not Set";
      
      // Update WhatsApp number display
      const whatsappDisplay = document.getElementById('currentWhatsAppNumber');
      if (whatsappDisplay) {
        whatsappDisplay.textContent = whatsappNumber;
      }
      
      // Store current WhatsApp number for later use
      window.currentWhatsAppNumber = whatsappNumber;
      
      console.log("Current WhatsApp Number:", whatsappNumber);
      return whatsappNumber;
    } else {
      // Document doesn't exist, create it with default value
      await setDoc(whatsappConfigDoc, { whatsapp_number: "Not Set" });
      
      const whatsappDisplay = document.getElementById('currentWhatsAppNumber');
      if (whatsappDisplay) {
        whatsappDisplay.textContent = "Not Set";
      }
      
      window.currentWhatsAppNumber = "Not Set";
      console.log("WhatsApp config document created with default value");
      return "Not Set";
    }
  } catch (error) {
    console.error("Error fetching WhatsApp number:", error);
    const whatsappDisplay = document.getElementById('currentWhatsAppNumber');
    if (whatsappDisplay) {
      whatsappDisplay.textContent = "Error loading";
    }
  }
}

// Function to update WhatsApp number
async function updateWhatsAppNumber(newWhatsAppNumber) {
  try {
    if (!newWhatsAppNumber || newWhatsAppNumber.trim() === '') {
      throw new Error('WhatsApp number cannot be empty');
    }

    const whatsappConfigDoc = doc(db, "settings", "contact_config");
    await updateDoc(whatsappConfigDoc, {
      whatsapp_number: newWhatsAppNumber.trim(),
      last_updated: new Date().toISOString()
    });

    // Update the display
    const whatsappDisplay = document.getElementById('currentWhatsAppNumber');
    if (whatsappDisplay) {
      whatsappDisplay.textContent = newWhatsAppNumber.trim();
    }

    // Update stored value
    window.currentWhatsAppNumber = newWhatsAppNumber.trim();

    // Show success status
    showWhatsAppStatus('WhatsApp number updated successfully!', 'success');
    
    console.log("WhatsApp number updated successfully:", newWhatsAppNumber);
    return true;
  } catch (error) {
    console.error("Error updating WhatsApp number:", error);
    showWhatsAppStatus('Failed to update WhatsApp number: ' + error.message, 'error');
    return false;
  }
}

// Function to show WhatsApp status messages
function showWhatsAppStatus(message, type) {
  const statusElement = document.getElementById('whatsappStatus');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `whatsapp-status ${type}`;
    statusElement.style.display = 'block';
    
    // Hide status after 3 seconds
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// Function to copy WhatsApp number to clipboard
async function copyWhatsAppNumber() {
  try {
    const whatsappNumber = window.currentWhatsAppNumber || document.getElementById('currentWhatsAppNumber').textContent;
    
    if (whatsappNumber && whatsappNumber !== 'Not Set' && whatsappNumber !== 'Error loading') {
      await navigator.clipboard.writeText(whatsappNumber);
      showWhatsAppStatus('WhatsApp number copied to clipboard!', 'success');
    } else {
      showWhatsAppStatus('No valid WhatsApp number to copy', 'error');
    }
  } catch (error) {
    console.error("Error copying WhatsApp number:", error);
    showWhatsAppStatus('Failed to copy WhatsApp number', 'error');
  }
}

// Example function to update data
async function updateData() {
  const data = {
    name: document.getElementById("nameInput").value,
    timestamp: new Date()
  };

  try {
    await setDoc(doc(db, "users", "9664361536"), data);
    alert("Data updated to Firestore!");
  } catch (e) {
    console.error("Error updating:", e);
    alert("Failed to update data.");
  }
}

// Add event listener on page load
window.addEventListener("DOMContentLoaded", () => {
  // Fetch total users when page loads
  fetchTotalUsers();
  
  // Fetch total bid amount when page loads
  fetchTotalBidAmount();
  
  // Fetch game names when page loads
  fetchGameNames();
  
  // Fetch total bids by game type when page loads
  fetchTotalBidsByGameType();
  
  // Fetch UPI ID when page loads
  fetchUpiId();
  
  // Fetch WhatsApp number when page loads
  fetchWhatsAppNumber();
  
  // UPI Configuration Event Listeners
  const editUpiBtn = document.getElementById('editUpiBtn');
  const upiModal = document.getElementById('upiModal');
  const cancelUpiBtn = document.getElementById('cancelUpiBtn');
  const updateUpiBtn = document.getElementById('updateUpiBtn');
  const copyUpiBtn = document.getElementById('copyUpiBtn');
  
  console.log('UPI Elements found:', {
    editUpiBtn: !!editUpiBtn,
    upiModal: !!upiModal,
    cancelUpiBtn: !!cancelUpiBtn,
    updateUpiBtn: !!updateUpiBtn,
    copyUpiBtn: !!copyUpiBtn
  });
  
  // Open UPI modal
  if (editUpiBtn) {
    editUpiBtn.addEventListener('click', () => {
      console.log('Edit UPI button clicked');
      if (upiModal) {
        upiModal.style.display = 'block';
        // Clear previous form data
        document.getElementById('newUpiId').value = '';
        console.log('UPI modal opened');
      } else {
        console.error('UPI modal not found');
      }
    });
  } else {
    console.error('Edit UPI button not found');
  }
  
  // Close UPI modal
  if (cancelUpiBtn) {
    cancelUpiBtn.addEventListener('click', () => {
      if (upiModal) {
        upiModal.style.display = 'none';
      }
    });
  }
  
  // Update UPI ID
  if (updateUpiBtn) {
    updateUpiBtn.addEventListener('click', async () => {
      const newUpiId = document.getElementById('newUpiId').value;
      
      if (newUpiId.trim()) {
        updateUpiBtn.disabled = true;
        updateUpiBtn.textContent = 'Updating...';
        
        const success = await updateUpiId(newUpiId);
        
        if (success) {
          upiModal.style.display = 'none';
        }
        
        updateUpiBtn.disabled = false;
        updateUpiBtn.textContent = 'Update UPI ID';
      } else {
        showUpiStatus('Please enter a valid UPI ID', 'error');
      }
    });
  }
  
  // Copy UPI ID
  if (copyUpiBtn) {
    copyUpiBtn.addEventListener('click', copyUpiId);
  }
  
  // Close modal when clicking outside
  if (upiModal) {
    upiModal.addEventListener('click', (e) => {
      if (e.target === upiModal) {
        upiModal.style.display = 'none';
      }
    });
  }
  
  // WhatsApp Configuration Event Listeners
  const editWhatsAppBtn = document.getElementById('editWhatsAppBtn');
  const whatsappModal = document.getElementById('whatsappModal');
  const cancelWhatsAppBtn = document.getElementById('cancelWhatsAppBtn');
  const updateWhatsAppBtn = document.getElementById('updateWhatsAppBtn');
  const copyWhatsAppBtn = document.getElementById('copyWhatsAppBtn');
  
  console.log('WhatsApp Elements found:', {
    editWhatsAppBtn: !!editWhatsAppBtn,
    whatsappModal: !!whatsappModal,
    cancelWhatsAppBtn: !!cancelWhatsAppBtn,
    updateWhatsAppBtn: !!updateWhatsAppBtn,
    copyWhatsAppBtn: !!copyWhatsAppBtn
  });
  
  // Open WhatsApp modal
  if (editWhatsAppBtn) {
    editWhatsAppBtn.addEventListener('click', () => {
      console.log('Edit WhatsApp button clicked');
      if (whatsappModal) {
        whatsappModal.style.display = 'block';
        // Clear previous form data
        document.getElementById('newWhatsAppNumber').value = '';
        console.log('WhatsApp modal opened');
      } else {
        console.error('WhatsApp modal not found');
      }
    });
  } else {
    console.error('Edit WhatsApp button not found');
  }
  
  // Close WhatsApp modal
  if (cancelWhatsAppBtn) {
    cancelWhatsAppBtn.addEventListener('click', () => {
      if (whatsappModal) {
        whatsappModal.style.display = 'none';
      }
    });
  }
  
  // Update WhatsApp number
  if (updateWhatsAppBtn) {
    updateWhatsAppBtn.addEventListener('click', async () => {
      const newWhatsAppNumber = document.getElementById('newWhatsAppNumber').value;
      
      if (newWhatsAppNumber.trim()) {
        updateWhatsAppBtn.disabled = true;
        updateWhatsAppBtn.textContent = 'Updating...';
        
        const success = await updateWhatsAppNumber(newWhatsAppNumber);
        
        if (success) {
          whatsappModal.style.display = 'none';
        }
        
        updateWhatsAppBtn.disabled = false;
        updateWhatsAppBtn.textContent = 'Update WhatsApp Number';
      } else {
        showWhatsAppStatus('Please enter a valid WhatsApp number', 'error');
      }
    });
  }
  
  // Copy WhatsApp number
  if (copyWhatsAppBtn) {
    copyWhatsAppBtn.addEventListener('click', copyWhatsAppNumber);
  }
  
  // Close WhatsApp modal when clicking outside
  if (whatsappModal) {
    whatsappModal.addEventListener('click', (e) => {
      if (e.target === whatsappModal) {
        whatsappModal.style.display = 'none';
      }
    });
  }
  
  // Add event listener for submit button if it exists
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", updateData);
  }

  // Hamburger menu functionality
  const hamburgerMenu = document.getElementById('hamburgerMenu');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // Toggle sidebar
  function toggleSidebar() {
    hamburgerMenu.classList.toggle('active');
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
  }

  // Close sidebar
  function closeSidebar() {
    hamburgerMenu.classList.remove('active');
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  }

  // Event listeners
  hamburgerMenu.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Close sidebar on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });
});