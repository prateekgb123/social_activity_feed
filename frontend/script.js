// frontend/script.js (updated)

// API Configuration
const API_URL = 'https://social-activity-feed-qt3c.onrender.com/api';
let currentUser = null;
let authToken = null;

// Helper to compare IDs (ObjectId or string)
function idEquals(a, b) {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  attachLogoutListener();
  checkAuth();
  testAPIConnection();
});

// Test API Connection (use /api/test which returns JSON)
async function testAPIConnection() {
  try {
    console.log('Testing API connection to:', `${API_URL}/test`);
    const response = await fetch(`${API_URL}/test`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();
    console.log('API Connection: Success', data);
  } catch (error) {
    console.error('API Connection Failed:', error);
    showToast('Cannot connect to server. Make sure backend is running on port 5000', 'error');
  }
}

// Debug function to check authentication
function debugAuth() {
  console.log('=== Authentication Debug ===');
  console.log('Auth Token:', authToken);
  console.log('Current User:', currentUser);
  console.log('LocalStorage Token:', localStorage.getItem('authToken'));
  console.log('LocalStorage User:', localStorage.getItem('currentUser'));
  console.log('API URL:', API_URL);
}
window.debugAuth = debugAuth;

// Auth Functions
function checkAuth() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('currentUser');

  if (token && user) {
    try {
      authToken = token;
      currentUser = JSON.parse(user);
      showApp();
    } catch (err) {
      console.error('Failed to parse stored user:', err);
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      showAuth();
    }
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('authSection')?.classList.remove('hidden');
  document.getElementById('appSection')?.classList.add('hidden');
}

function showApp() {
  document.getElementById('authSection')?.classList.add('hidden');
  document.getElementById('appSection')?.classList.remove('hidden');

  if (!currentUser) return;

  const nameEl = document.getElementById('userDisplayName');
  const roleEl = document.getElementById('userRole');
  const adminTab = document.getElementById('adminTab');

  if (nameEl) nameEl.textContent = currentUser.username || '';
  if (roleEl) roleEl.textContent = currentUser.role || '';

  if (adminTab) {
    if (currentUser.role === 'admin' || currentUser.role === 'owner') adminTab.classList.remove('hidden');
    else adminTab.classList.add('hidden');
  }

  // show feed by default when app opens
  showTab('feed');
}

function showLogin() {
  document.getElementById('loginForm')?.classList.remove('hidden');
  document.getElementById('signupForm')?.classList.add('hidden');
}

function showSignup() {
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('signupForm')?.classList.remove('hidden');
}

async function signup() {
  const username = document.getElementById('signupUsername')?.value;
  const email = document.getElementById('signupEmail')?.value;
  const password = document.getElementById('signupPassword')?.value;

  if (!username || !email || !password) {
    showToast('Please fill all fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      document.getElementById('signupUsername') && (document.getElementById('signupUsername').value = '');
      document.getElementById('signupEmail') && (document.getElementById('signupEmail').value = '');
      document.getElementById('signupPassword') && (document.getElementById('signupPassword').value = '');
      showToast('Account created successfully! Please login.', 'success');

      // Prefill the login username (not email)
      document.getElementById('loginUsername') && (document.getElementById('loginUsername').value = username);

      showLogin();
    } else {
      showToast(data.error || 'Signup failed', 'error');
    }
  } catch (error) {
    console.error('Signup error:', error);
    showToast('Network error', 'error');
  }
}

async function login() {
  const username = document.getElementById("loginUsername")?.value;
  const password = document.getElementById('loginPassword')?.value;

  if (!username || !password) {
    showToast('Please fill all fields', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      authToken = data.token;
      currentUser = data.user;
      if (!authToken || !currentUser) {
        showToast('Login failed: missing token/user', 'error');
        console.error('Bad login response', data);
        return;
      }

      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));

      console.log('Login successful:', currentUser);
      console.log('Auth token:', authToken);

      showToast('Logged in successfully!', 'success');
      showApp();
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Network error. Is the backend running?', 'error');
  }
}

// Robust logout that prevents default and clears UI
function logout(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  authToken = null;
  currentUser = null;

  // Clear UI elements
  document.getElementById('userDisplayName') && (document.getElementById('userDisplayName').textContent = '');
  document.getElementById('userRole') && (document.getElementById('userRole').textContent = '');
  document.getElementById('adminTab') && (document.getElementById('adminTab').classList.add('hidden'));

  ['postsContainer', 'activitiesContainer', 'usersContainer', 'adminUsersContainer', 'ownerControlsContainer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

  showAuth();
  showToast('Logged out successfully', 'success');
}

// Attach logout listener (supports button with id="logoutBtn")
function attachLogoutListener() {
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!t) return;
    // If clicked element or parent has id logoutBtn
    if (t.id === 'logoutBtn' || (t.closest && t.closest('#logoutBtn'))) {
      logout(ev);
    }
  });
}

// Tab Navigation — accept optional event parameter
function showTab(tabName, event) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

  const tabMap = {
    'feed': 'feedTab',
    'activity': 'activityTab',
    'users': 'usersTab',
    'admin': 'adminTab'
  };

  const tabId = tabMap[tabName];
  if (tabId) {
    document.getElementById(tabId)?.classList.add('active');
  } else {
    console.warn('Unknown tab:', tabName);
  }

  try {
    if (event && event.target) event.target.classList.add('active');
  } catch (e) { /* ignore */ }

  // Load content for tab
  if (tabName === 'feed') loadFeed();
  else if (tabName === 'activity') loadActivities();
  else if (tabName === 'users') loadUsers();
  else if (tabName === 'admin') loadAdminPanel();
}

// Post Functions
async function createPost() {
  const content = document.getElementById('postContent')?.value || '';

  if (!content.trim()) {
    showToast('Please write something', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      document.getElementById('postContent') && (document.getElementById('postContent').value = '');
      showToast('Post created!', 'success');
      loadFeed();
    } else {
      showToast(data.error || 'Failed to create post', 'error');
    }
  } catch (error) {
    console.error('createPost error:', error);
    showToast('Network error', 'error');
  }
}

async function loadFeed() {
  try {
    const response = await fetch(`${API_URL}/posts`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const posts = await response.json();
    displayPosts(Array.isArray(posts) ? posts : []);
  } catch (error) {
    console.error('Load feed error:', error);
    showToast('Failed to load posts. Check console for details.', 'error');
    const container = document.getElementById('postsContainer');
    if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Unable to load posts. Please refresh the page.</p>';
  }
}

function displayPosts(posts) {
  const container = document.getElementById('postsContainer');
  if (!container) return;

  if (!Array.isArray(posts) || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No posts yet. Be the first to post!</p>';
    return;
  }

  container.innerHTML = posts.map(post => {
    const postId = post._id || post.id || '';
    const author = post.author || {};
    const authorId = author._id || author;
    const authorName = author.username || String(authorId).slice(0, 8);
    const createdAt = post.createdAt ? new Date(post.createdAt).toLocaleString() : '';
    const likesArray = Array.isArray(post.likes) ? post.likes : [];
    const isLiked = likesArray.some(l => idEquals(l._id || l, currentUser?.id));
    const isOwner = idEquals(author._id || author, currentUser?.id);
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner');
    const adminDeleteFlag = isAdmin && !isOwner;

    return `
      <div class="post">
        <div class="post-header">
          <span class="post-author">${escapeHtml(authorName)}</span>
          <span class="post-date">${createdAt}</span>
        </div>
        <div class="post-content">${escapeHtml(post.content || '')}</div>
        <div class="likes-count">${likesArray.length} likes</div>
        <div class="post-actions">
          ${isLiked ? `<button class="unlike-btn" onclick="unlikePost('${postId}')">Unlike</button>` : `<button class="like-btn" onclick="likePost('${postId}')">Like</button>`}
          ${isOwner || isAdmin ? `<button class="delete-btn" onclick="deletePost('${postId}', ${adminDeleteFlag})">Delete</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function likePost(postId) {
  try {
    const response = await fetch(`${API_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      showToast('Post liked!', 'success');
      loadFeed();
    } else {
      showToast(data.error || 'Failed to like post', 'error');
    }
  } catch (error) {
    console.error('likePost error:', error);
    showToast('Failed to like post', 'error');
  }
}

async function unlikePost(postId) {
  try {
    const response = await fetch(`${API_URL}/posts/${postId}/unlike`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      showToast('Post unliked', 'success');
      loadFeed();
    } else {
      showToast(data.error || 'Failed to unlike post', 'error');
    }
  } catch (error) {
    console.error('unlikePost error:', error);
    showToast('Failed to unlike post', 'error');
  }
}

async function deletePost(postId, isAdminDelete) {
  if (!confirm('Are you sure you want to delete this post?')) return;

  try {
    const url = isAdminDelete ? `${API_URL}/admin/posts/${postId}` : `${API_URL}/posts/${postId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      showToast('Post deleted!', 'success');
      loadFeed();
    } else {
      showToast(data.error || 'Failed to delete post', 'error');
    }
  } catch (error) {
    console.error('deletePost error:', error);
    showToast('Failed to delete post', 'error');
  }
}

// Activity Functions
async function loadActivities() {
  try {
    const response = await fetch(`${API_URL}/activities`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const activities = await response.json();
    displayActivities(Array.isArray(activities) ? activities : []);
  } catch (error) {
    console.error('Load activities error:', error);
    showToast('Failed to load activities. Check console for details.', 'error');
    const container = document.getElementById('activitiesContainer');
    if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Unable to load activities. Please refresh the page.</p>';
  }
}

function displayActivities(activities) {
  const container = document.getElementById('activitiesContainer');
  if (!container) return;

  if (!Array.isArray(activities) || activities.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No activities yet</p>';
    return;
  }

  const iconMap = { post: '📝', follow: '👥', like: '❤️', delete_user: '🗑️', delete_post: '🗑️' };

  container.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <div class="activity-icon activity-${activity.type}">${iconMap[activity.type] || '📌'}</div>
      <div class="activity-text">${escapeHtml(activity.message || '')}</div>
      <div class="activity-time">${activity.createdAt ? new Date(activity.createdAt).toLocaleString() : ''}</div>
    </div>
  `).join('');
}

// User Functions
async function loadUsers() {
  try {
    const [usersResponse, currentUserResponse] = await Promise.all([
      fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
      fetch(`${API_URL}/users/me`, { headers: { 'Authorization': `Bearer ${authToken}` } })
    ]);

    if (!usersResponse.ok || !currentUserResponse.ok) {
      throw new Error('Failed to fetch users');
    }

    const users = await usersResponse.json();
    const userData = await currentUserResponse.json();

    displayUsers(Array.isArray(users) ? users : [], userData || {});
  } catch (error) {
    console.error('Load users error:', error);
    showToast('Failed to load users. Check console for details.', 'error');
    const container = document.getElementById('usersContainer');
    if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Unable to load users. Please refresh the page.</p>';
  }
}

function displayUsers(users, currentUserData) {
  const container = document.getElementById('usersContainer');
  if (!container) return;

  if (!Array.isArray(users) || users.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;padding:40px">No users found</p>';
    return;
  }

  container.innerHTML = users.map(user => {
    // Use the passed-in currentUserData to decide follow/block state
    const isFollowing = Array.isArray(user.followers) && user.followers.some(f => idEquals(f, currentUserData?.id));
    const isBlocked = Array.isArray(currentUserData?.blockedUsers) && currentUserData.blockedUsers.some(b => idEquals(b, user._id));

    return `
      <div class="user-card">
        <div class="user-card-header">
          <span class="user-name">${escapeHtml(user.username)}</span>
          <span class="user-role">${escapeHtml(user.role)}</span>
        </div>
        <div class="user-email">${escapeHtml(user.email)}</div>
        <div class="user-stats">
          <span>Followers: ${Array.isArray(user.followers) ? user.followers.length : 0}</span>
          <span>Following: ${Array.isArray(user.following) ? user.following.length : 0}</span>
        </div>
        <div class="user-actions">
          ${isFollowing ? `<button class="unfollow-btn" onclick="unfollowUser('${user._id}')">Unfollow</button>` : `<button class="follow-btn" onclick="followUser('${user._id}')">Follow</button>`}
          ${isBlocked ? `<button class="unblock-btn" onclick="unblockUser('${user._id}')">Unblock</button>` : `<button class="block-btn" onclick="blockUser('${user._id}')">Block</button>`}
        </div>
      </div>
    `;
  }).join('');
}

async function followUser(userId) {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/follow`, { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } });
    if (response.ok) {
      showToast('User followed!', 'success');
      loadUsers();
    } else {
      const data = await response.json().catch(() => ({}));
      showToast(data.error || 'Failed to follow user', 'error');
    }
  } catch (error) {
    console.error('followUser error:', error);
    showToast('Failed to follow user', 'error');
  }
}

async function unfollowUser(userId) {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/unfollow`, { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } });
    if (response.ok) {
      showToast('User unfollowed', 'success');
      loadUsers();
    } else {
      const data = await response.json().catch(() => ({}));
      showToast(data.error || 'Failed to unfollow user', 'error');
    }
  } catch (error) {
    console.error('unfollowUser error:', error);
    showToast('Failed to unfollow user', 'error');
  }
}

async function blockUser(userId) {
  if (!confirm('Are you sure you want to block this user?')) return;
  try {
    const response = await fetch(`${API_URL}/users/${userId}/block`, { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } });
    if (response.ok) {
      showToast('User blocked!', 'success');
      loadUsers();
      loadFeed();
    } else {
      const data = await response.json().catch(() => ({}));
      showToast(data.error || 'Failed to block user', 'error');
    }
  } catch (error) {
    console.error('blockUser error:', error);
    showToast('Failed to block user', 'error');
  }
}

async function unblockUser(userId) {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/unblock`, { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } });
    if (response.ok) {
      showToast('User unblocked', 'success');
      loadUsers();
      loadFeed();
    } else {
      const data = await response.json().catch(() => ({}));
      showToast(data.error || 'Failed to unblock user', 'error');
    }
  } catch (error) {
    console.error('unblockUser error:', error);
    showToast('Failed to unblock user', 'error');
  }
}

// Admin Functions
async function loadAdminPanel() {
  try {
    const response = await fetch(`${API_URL}/users`, { headers: { 'Authorization': `Bearer ${authToken}` } });
    if (!response.ok) throw new Error('Failed to fetch users');
    const users = await response.json();
    displayAdminUsers(Array.isArray(users) ? users : []);

    if (currentUser && currentUser.role === 'owner') {
      document.getElementById('ownerSection')?.classList.remove('hidden');
      displayOwnerControls(users || []);
    } else {
      document.getElementById('ownerSection')?.classList.add('hidden');
    }
  } catch (error) {
    console.error('loadAdminPanel error:', error);
    showToast('Failed to load admin panel', 'error');
  }
}

function displayAdminUsers(users) {
  const container = document.getElementById('adminUsersContainer');
  if (!container) return;

  if (!Array.isArray(users) || users.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center">No users found</p>';
    return;
  }

  container.innerHTML = users.map(user => `
    <div class="admin-user-item">
      <div class="admin-user-info">
        <span class="admin-user-name">${escapeHtml(user.username)} (${escapeHtml(user.role)})</span>
        <span class="admin-user-email">${escapeHtml(user.email)}</span>
      </div>
      <div class="admin-actions">
        ${user.role !== 'owner' ? `<button class="delete-user-btn" onclick="deleteUser('${user._id}')">Delete User</button>` : ''}
      </div>
    </div>
  `).join('');
}

function displayOwnerControls(users) {
  const container = document.getElementById('ownerControlsContainer');
  if (!container) return;

  const regularUsers = Array.isArray(users) ? users.filter(u => u.role === 'user') : [];
  const admins = Array.isArray(users) ? users.filter(u => u.role === 'admin') : [];

  container.innerHTML = `
    <h4>Promote to Admin</h4>
    ${regularUsers.length > 0 ? regularUsers.map(user => `
      <div class="admin-user-item">
        <div class="admin-user-info">
          <span class="admin-user-name">${escapeHtml(user.username)}</span>
          <span class="admin-user-email">${escapeHtml(user.email)}</span>
        </div>
        <div class="admin-actions">
          <button class="make-admin-btn" onclick="makeAdmin('${user._id}')">Make Admin</button>
        </div>
      </div>
    `).join('') : '<p style="color:#999;">No users to promote</p>'}

    <h4 style="margin-top: 30px;">Current Admins</h4>
    ${admins.length > 0 ? admins.map(admin => `
      <div class="admin-user-item">
        <div class="admin-user-info">
          <span class="admin-user-name">${escapeHtml(admin.username)}</span>
          <span class="admin-user-email">${escapeHtml(admin.email)}</span>
        </div>
        <div class="admin-actions">
          <button class="remove-admin-btn" onclick="removeAdmin('${admin._id}')">Remove Admin</button>
        </div>
      </div>
    `).join('') : '<p style="color:#999;">No admins yet</p>'}
  `;
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user? This will also delete all their posts.')) return;
  try {
    const response = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      showToast('User deleted successfully!', 'success');
      loadAdminPanel();
    } else {
      showToast(data.error || 'Failed to delete user', 'error');
    }
  } catch (error) {
    console.error('deleteUser error:', error);
    showToast('Failed to delete user', 'error');
  }
}

async function makeAdmin(userId) {
  if (!confirm('Are you sure you want to make this user an admin?')) return;
  try {
    const response = await fetch(`${API_URL}/owner/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ userId })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      showToast('Admin created successfully!', 'success');
      loadAdminPanel();
    } else {
      showToast(data.error || 'Failed to create admin', 'error');
    }
  } catch (error) {
    console.error('makeAdmin error:', error);
    showToast('Failed to create admin', 'error');
  }
}

async function removeAdmin(userId) {
  if (!confirm('Are you sure you want to remove this admin?')) return;
  try {
    const response = await fetch(`${API_URL}/owner/admins/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      showToast('Admin removed successfully!', 'success');
      loadAdminPanel();
    } else {
      showToast(data.error || 'Failed to remove admin', 'error');
    }
  } catch (error) {
    console.error('removeAdmin error:', error);
    showToast('Failed to remove admin', 'error');
  }
}

// Toast Notification (simple)
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) {
    console[type === 'error' ? 'error' : 'log'](message);
    return;
  }
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// small helper to escape HTML in dynamic content
function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
