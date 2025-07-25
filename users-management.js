import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
let itemsPerPage = 20;
let totalPages = 1;
let currentUser = null;

// Function to fetch all users from the users collection
async function fetchUsers() {
  try {
    document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="5" class="loading">Loading users...</td></tr>';

    // Fetch all documents from users collection
    const usersCollection = collection(db, "users");
    const querySnapshot = await getDocs(usersCollection);
    
    allUsers = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allUsers.push({
        id: doc.id,
        name: data.name || 'N/A',
        phone: data.phone || 'N/A',
        balance: parseFloat(data.balance) || 0,
        ...data
      });
    });
    
    filteredUsers = [...allUsers];
    updateStats();
    displayUsers();
    
    console.log("Fetched users:", allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="5" class="loading">Error loading users</td></tr>';
  }
}

// Function to update statistics
function updateStats() {
  const totalUsers = filteredUsers.length;
  const totalBalance = filteredUsers.reduce((sum, user) => sum + user.balance, 0);
  const avgBalance = totalUsers > 0 ? totalBalance / totalUsers : 0;
  const activeUsers = filteredUsers.filter(user => user.balance > 0).length;

  document.getElementById('totalUsers').textContent = totalUsers.toLocaleString();
  document.getElementById('totalBalance').textContent = `₹${totalBalance.toLocaleString()}`;
  document.getElementById('avgBalance').textContent = `₹${Math.round(avgBalance).toLocaleString()}`;
  document.getElementById('activeUsers').textContent = activeUsers;
}

// Function to display users in table
function displayUsers() {
  const tbody = document.getElementById('usersTableBody');
  
  if (filteredUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="no-data">
          <div class="icon">👥</div>
          <h3>No Users Found</h3>
          <p>There are no users matching your criteria.</p>
        </td>
      </tr>
    `;
    updatePagination();
    return;
  }

  // Calculate pagination
  totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  let tableHTML = '';
  
  currentUsers.forEach((user, index) => {
    const serialNumber = startIndex + index + 1;
    const balanceClass = user.balance === 0 ? 'balance-zero' : user.balance > 1000 ? 'balance-high' : '';

    tableHTML += `
      <tr onclick="showUserDetails('${user.id}')">
        <td>
          <span class="serial-number">${serialNumber}</span>
        </td>
        <td>
          <span class="user-name">${user.name}</span>
        </td>
        <td>
          <span class="phone-number">${user.phone}</span>
        </td>
        <td>
          <span class="balance-amount ${balanceClass}">₹${user.balance.toLocaleString()}</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="view-btn" onclick="event.stopPropagation(); showUserDetails('${user.id}')">👁️ View</button>
            <button class="edit-btn" onclick="event.stopPropagation(); openBalanceUpdateModal('${user.id}')">✏️ Edit</button>
          </div>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = tableHTML;
  updatePagination();
}

// Function to show user details in modal
function showUserDetails(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  currentUser = user;

  document.getElementById('modalUserName').textContent = user.name;
  document.getElementById('modalUserPhone').textContent = user.phone;
  document.getElementById('modalUserBalance').textContent = `₹${user.balance.toLocaleString()}`;
  document.getElementById('modalUserId').textContent = user.id;

  document.getElementById('userDetailsModal').style.display = 'block';
}

// Function to close user details modal
function closeUserDetailsModal() {
  document.getElementById('userDetailsModal').style.display = 'none';
  currentUser = null;
}

// Function to copy phone number
function copyPhoneNumber() {
  if (currentUser && currentUser.phone) {
    navigator.clipboard.writeText(currentUser.phone).then(() => {
      // Show visual feedback
      const copyBtn = document.querySelector('.copy-btn');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✅';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1000);
    }).catch(err => {
      console.error('Failed to copy phone number:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentUser.phone;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Phone number copied to clipboard!');
    });
  }
}

// Function to view user bids (placeholder)
function viewUserBids() {
  if (currentUser) {
    alert(`Viewing bids for ${currentUser.name} (${currentUser.phone})\n\nThis feature will redirect to bid report with user filter.`);
    // TODO: Implement navigation to bid report with user filter
    // window.location.href = `bid-report-management.html?user=${currentUser.phone}`;
  }
}

// Function to open balance update modal
function openBalanceUpdateModal(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  currentUser = user;

  document.getElementById('updateUserName').textContent = user.name;
  document.getElementById('updateUserPhone').textContent = user.phone;
  document.getElementById('updateCurrentBalance').textContent = `₹${user.balance.toLocaleString()}`;
  
  // Reset form
  document.getElementById('balanceAction').value = 'add';
  document.getElementById('balanceAmount').value = '';
  document.getElementById('balanceReason').value = '';

  document.getElementById('balanceUpdateModal').style.display = 'block';
}

// Function to close balance update modal
function closeBalanceUpdateModal() {
  document.getElementById('balanceUpdateModal').style.display = 'none';
  currentUser = null;
}

// Function to update user balance
async function updateUserBalance() {
  if (!currentUser) return;

  const action = document.getElementById('balanceAction').value;
  const amount = parseFloat(document.getElementById('balanceAmount').value);
  const reason = document.getElementById('balanceReason').value.trim();

  // Validation
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  if (!reason) {
    alert('Please enter a reason for the balance update');
    return;
  }

  let newBalance = currentUser.balance;

  switch (action) {
    case 'add':
      newBalance += amount;
      break;
    case 'deduct':
      newBalance -= amount;
      if (newBalance < 0) {
        if (!confirm('This will result in a negative balance. Are you sure?')) {
          return;
        }
      }
      break;
    case 'set':
      newBalance = amount;
      break;
  }

  try {
    const updateBtn = document.querySelector('.btn-update-balance');
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';

    // Update the user's balance in Firestore
    const userRef = doc(db, "users", currentUser.id);
    await updateDoc(userRef, {
      balance: newBalance,
      lastUpdated: new Date().getTime(),
      lastUpdateReason: reason,
      lastUpdateAction: action,
      lastUpdateAmount: amount
    });

    // Show success message
    alert(`Balance updated successfully!\nNew Balance: ₹${newBalance.toLocaleString()}`);

    // Close modal and refresh data
    closeBalanceUpdateModal();
    fetchUsers();

    console.log(`User ${currentUser.id} balance updated from ₹${currentUser.balance} to ₹${newBalance}`);
  } catch (error) {
    console.error("Error updating user balance:", error);
    alert("Error updating balance. Please try again.");

    // Re-enable button
    const updateBtn = document.querySelector('.btn-update-balance');
    updateBtn.disabled = false;
    updateBtn.textContent = 'Update Balance';
  }
}

// Function to apply filters
function applyFilters() {
  const searchTerm = document.getElementById('searchUser').value.toLowerCase().trim();
  const balanceFilter = document.getElementById('balanceFilter').value;
  const sortBy = document.getElementById('sortBy').value;

  filteredUsers = allUsers.filter(user => {
    let matches = true;

    // Search filter
    if (searchTerm) {
      const searchMatch = 
        user.name.toLowerCase().includes(searchTerm) ||
        user.phone.includes(searchTerm) ||
        user.id.toLowerCase().includes(searchTerm);
      if (!searchMatch) matches = false;
    }

    // Balance range filter
    if (balanceFilter && matches) {
      switch (balanceFilter) {
        case '0':
          if (user.balance !== 0) matches = false;
          break;
        case '1-100':
          if (user.balance < 1 || user.balance > 100) matches = false;
          break;
        case '101-500':
          if (user.balance < 101 || user.balance > 500) matches = false;
          break;
        case '501-1000':
          if (user.balance < 501 || user.balance > 1000) matches = false;
          break;
        case '1001-5000':
          if (user.balance < 1001 || user.balance > 5000) matches = false;
          break;
        case '5000+':
          if (user.balance < 5000) matches = false;
          break;
      }
    }

    return matches;
  });

  // Apply sorting
  switch (sortBy) {
    case 'name':
      filteredUsers.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'balance-high':
      filteredUsers.sort((a, b) => b.balance - a.balance);
      break;
    case 'balance-low':
      filteredUsers.sort((a, b) => a.balance - b.balance);
      break;
    case 'phone':
      filteredUsers.sort((a, b) => a.phone.localeCompare(b.phone));
      break;
  }

  currentPage = 1;
  updateStats();
  displayUsers();
}

// Function to clear filters
function clearFilters() {
  document.getElementById('searchUser').value = '';
  document.getElementById('balanceFilter').value = '';
  document.getElementById('sortBy').value = 'name';
  
  filteredUsers = [...allUsers];
  currentPage = 1;
  updateStats();
  displayUsers();
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
  
  displayUsers();
}

// Function to export users to CSV
function exportUsers() {
  if (filteredUsers.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = ['Sr. No.', 'Name', 'Phone Number', 'Current Balance'];
  
  let csvContent = headers.join(',') + '\n';
  
  filteredUsers.forEach((user, index) => {
    const row = [
      index + 1,
      `"${user.name}"`,
      `"${user.phone}"`,
      `"₹${user.balance.toLocaleString()}"`
    ];
    
    csvContent += row.join(',') + '\n';
  });

  // Create and download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `users_report_${new Date().toISOString().split('T')[0]}.csv`);
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
      closeUserDetailsModal();
      closeBalanceUpdateModal();
    }
  });
}

// Close modals when clicking outside
window.onclick = function(event) {
  const userModal = document.getElementById('userDetailsModal');
  const balanceModal = document.getElementById('balanceUpdateModal');
  
  if (event.target === userModal) {
    closeUserDetailsModal();
  }
  if (event.target === balanceModal) {
    closeBalanceUpdateModal();
  }
}

// Make functions globally available
window.fetchUsers = fetchUsers;
window.showUserDetails = showUserDetails;
window.closeUserDetailsModal = closeUserDetailsModal;
window.copyPhoneNumber = copyPhoneNumber;
window.viewUserBids = viewUserBids;
window.openBalanceUpdateModal = openBalanceUpdateModal;
window.closeBalanceUpdateModal = closeBalanceUpdateModal;
window.updateUserBalance = updateUserBalance;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.changePage = changePage;
window.exportUsers = exportUsers;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  initializeHamburgerMenu();
  fetchUsers();
  
  // Auto-refresh every 5 minutes
  setInterval(fetchUsers, 5 * 60 * 1000);
});
