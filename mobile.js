// SyndicatePro Mobile Gestures & Utilities

// Toggle mobile navigation
function toggleNav() {
  const nav = document.getElementById('mobileNav');
  const overlay = document.querySelector('.nav-overlay');
  const hamburger = document.querySelector('.hamburger');
  
  nav?.classList.toggle('active');
  overlay?.classList.toggle('active');
  hamburger?.classList.toggle('active');
}

// Pull to refresh
class PullToRefresh {
  constructor(element, callback) {
    this.element = element;
    this.callback = callback;
    this.startY = 0;
    this.currentY = 0;
    this.isRefreshing = false;
    
    this.init();
  }
  
  init() {
    this.element.addEventListener('touchstart', (e) => this.start(e), { passive: true });
    this.element.addEventListener('touchmove', (e) => this.move(e), { passive: true });
    this.element.addEventListener('touchend', () => this.end());
  }
  
  start(e) {
    if (this.element.scrollTop === 0) {
      this.startY = e.touches[0].pageY;
    }
  }
  
  move(e) {
    if (this.isRefreshing) return;
    if (this.element.scrollTop > 0) return;
    
    this.currentY = e.touches[0].pageY;
    const diff = this.currentY - this.startY;
    
    if (diff > 0 && diff < 100) {
      this.element.style.transform = `translateY(${diff * 0.5}px)`;
    }
  }
  
  end() {
    const diff = this.currentY - this.startY;
    if (diff > 80 && !this.isRefreshing) {
      this.refresh();
    } else {
      this.element.style.transform = '';
    }
  }
  
  refresh() {
    this.isRefreshing = true;
    this.element.style.transform = 'translateY(60px)';
    
    // Show spinner
    const spinner = document.createElement('div');
    spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    spinner.style.cssText = 'position:absolute;top:-50px;left:50%;transform:translateX(-50%);color:var(--accent)';
    this.element.appendChild(spinner);
    
    this.callback().then(() => {
      this.isRefreshing = false;
      this.element.style.transform = '';
      spinner.remove();
    });
  }
}

// Swipe actions
class SwipeActions {
  constructor(element, actions) {
    this.element = element;
    this.actions = actions;
    this.startX = 0;
    this.currentX = 0;
    this.isOpen = false;
    
    this.init();
  }
  
  init() {
    this.element.addEventListener('touchstart', (e) => this.start(e), { passive: true });
    this.element.addEventListener('touchmove', (e) => this.move(e), { passive: true });
    this.element.addEventListener('touchend', () => this.end());
    
    // Create action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'swipe-actions';
    actionsDiv.style.cssText = 'position:absolute;right:0;top:0;height:100%;display:flex;align-items:center;gap:8px;padding:0 16px;z-index:-1';
    
    this.actions.forEach(action => {
      const btn = document.createElement('button');
      btn.innerHTML = `<i class="${action.icon}"></i>`;
      btn.style.cssText = `width:50px;height:50px;border-radius:10px;border:none;background:${action.color};color:white;font-size:1.2rem`;
      btn.onclick = () => {
        action.handler();
        this.close();
      };
      actionsDiv.appendChild(btn);
    });
    
    this.element.style.position = 'relative';
    this.element.appendChild(actionsDiv);
  }
  
  start(e) {
    this.startX = e.touches[0].pageX;
    this.element.style.transition = 'none';
    this.element.style.zIndex = '1';
  }
  
  move(e) {
    this.currentX = e.touches[0].pageX;
    const diff = this.currentX - this.startX;
    
    if (diff < 0 && diff > -120) {
      this.element.style.transform = `translateX(${diff}px)`;
    }
  }
  
  end() {
    const diff = this.currentX - this.startX;
    this.element.style.transition = 'transform 0.3s ease';
    
    if (diff < -60) {
      this.element.style.transform = 'translateX(-120px)';
      this.isOpen = true;
    } else {
      this.close();
    }
  }
  
  close() {
    this.element.style.transform = 'translateX(0)';
    this.isOpen = false;
    setTimeout(() => {
      this.element.style.zIndex = '';
    }, 300);
  }
}

// Bottom sheet modal
function showBottomSheet(title, content) {
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:2000;display:flex;align-items:flex-end;animation:fadeIn 0.2s';
  sheet.innerHTML = `
    <div style="background:var(--bg-panel);border-top-left-radius:20px;border-top-right-radius:20px;width:100%;max-height:85vh;overflow-y:auto;animation:slideUp 0.3s">
      <div style="padding:20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--bg-panel)">
        <h3 style="font-family:'Space Grotesk'">${title}</h3>
        <button onclick="this.closest('[style*=fixed]').remove()" style="width:36px;height:36px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div style="padding:20px">${content}</div>
    </div>
  `;
  sheet.onclick = (e) => {
    if (e.target === sheet) sheet.remove();
  };
  document.body.appendChild(sheet);
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--accent)'
  };
  
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: ${colors[type]};
    color: white;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    z-index: 3000;
    opacity: 0;
    transition: all 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  }, 100);
  
  // Remove after delay
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/syndicate-pro/sw.js')
    .then(reg => console.log('SW registered'))
    .catch(err => console.log('SW registration failed'));
}

// Add to homescreen prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showToast('Add to homescreen for app-like experience', 'info');
});

// Online/offline handling
window.addEventListener('online', () => showToast('Back online', 'success'));
window.addEventListener('offline', () => showToast('Offline mode - changes will sync', 'warning'));

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
`;
document.head.appendChild(style);