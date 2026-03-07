// Authentication Guard for deeltrack
// Uses sp_session from sp-core.js for consistency

(function() {
  // Skip if on public pages
  const publicPages = ['login.html', 'signup.html', 'pricing.html', 'landing.html'];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  if (publicPages.includes(currentPage)) return;
  
  // Check for logged in user using sp_session (consistent with sp-core.js)
  const session = (typeof SP !== 'undefined') ? SP.getSession() : null;
  
  if (!session || !session.loggedIn) {
    // Redirect to login
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    return;
  }
  
  // Add user info to page
  document.addEventListener('DOMContentLoaded', () => {
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => el.textContent = session.name || session.email);
    
    const userAvatarElements = document.querySelectorAll('.user-avatar');
    userAvatarElements.forEach(el => {
      if (el.tagName === 'IMG') {
        el.src = session.photoURL || 'default-avatar.png';
      } else {
        el.textContent = (session.name || session.email || '?').charAt(0).toUpperCase();
      }
    });
  });
})();