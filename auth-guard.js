// Authentication Guard for deeltrack
// Checks if user is logged in before allowing access to protected pages

(function() {
  // Skip if on public pages
  const publicPages = ['login.html', 'signup.html', 'pricing.html', 'landing.html'];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  if (publicPages.includes(currentPage)) return;
  
  // Check for logged in user
  const currentUser = localStorage.getItem('currentUser');
  const authToken = localStorage.getItem('authToken');
  
  if (!currentUser || !authToken) {
    // Redirect to login
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    return;
  }
  
  // Optional: Validate token with backend
  // fetch('/api/validate-token', { headers: { 'Authorization': 'Bearer ' + authToken }})
  
  // Add user info to page
  const user = JSON.parse(currentUser);
  document.addEventListener('DOMContentLoaded', () => {
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => el.textContent = user.displayName || user.email);
    
    const userAvatarElements = document.querySelectorAll('.user-avatar');
    userAvatarElements.forEach(el => {
      if (el.tagName === 'IMG') {
        el.src = user.photoURL || 'default-avatar.png';
      } else {
        el.textContent = (user.displayName || user.email).charAt(0).toUpperCase();
      }
    });
  });
})();