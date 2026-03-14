import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

// Authentication state management
const authState = {
  token: null,
  user: null,
  isMenuOpen: false
};

// Initialize authentication state
function initAuthState() {
  authState.token = localStorage.getItem("access_token");
  if (authState.token) {
    // Try to fetch user info
    fetchUserInfo();
  }
}

// Fetch user information
async function fetchUserInfo() {
  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        "Authorization": `Bearer ${authState.token}`
      }
    });
    
    if (response.ok) {
      authState.user = await response.json();
    } else {
      // Token is invalid, clear it
      localStorage.removeItem("access_token");
      authState.token = null;
      authState.user = null;
    }
  } catch (error) {
    console.error("Failed to fetch user info:", error);
  }
}

// Logout function
async function logout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authState.token}`
      }
    });
  } catch (error) {
    console.warn("Logout endpoint failed:", error);
  } finally {
    // Always clear local state
    localStorage.removeItem("access_token");
    authState.token = null;
    authState.user = null;
    authState.isMenuOpen = false;
  }
}

// Create Vue app for authentication UI
const app = createApp({
  data() {
    return {
      token: null,
      user: null,
      isMenuOpen: false,
      searchQuery: '',
      searchResults: [],
      searchLoading: false
    };
  },
  
  computed: {
    isLoggedIn() {
      return !!this.token;
    },
    
    avatarText() {
      if (this.user?.username) {
        return this.user.username[0].toUpperCase();
      }
      return 'U';
    },
    
    avatarUrl() {
      if (this.user?.avatar_url) {
        return this.user.avatar_url;
      }
      return '/assets/default-avatar.png';
    }
  },
  
  methods: {
    async init() {
      this.token = localStorage.getItem("access_token");
      if (this.token) {
        await this.fetchUserInfo();
      }
    },
    
    async fetchUserInfo() {
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            "Authorization": `Bearer ${this.token}`
          }
        });
        
        if (response.ok) {
          this.user = await response.json();
        } else {
          this.logout();
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error);
        this.logout();
      }
    },
    
    toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
    },
    
    closeMenu() {
      this.isMenuOpen = false;
    },
    
    async logout() {
      try {
        await fetch("/api/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.token}`
          }
        });
      } catch (error) {
        console.warn("Logout endpoint failed:", error);
      } finally {
        localStorage.removeItem("access_token");
        this.token = null;
        this.user = null;
        this.isMenuOpen = false;
      }
    },
    
    async searchUsers(query) {
      if (!query.trim()) {
        this.searchResults = [];
        this.searchLoading = false;
        return;
      }
      
      this.searchLoading = true;
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          this.searchResults = data.users || [];
        } else {
          this.searchResults = [];
        }
      } catch (error) {
        console.error("Search failed:", error);
        this.searchResults = [];
      } finally {
        this.searchLoading = false;
      }
    },
    
    goToProfile(username) {
      window.location.href = `/profile.html?username=${encodeURIComponent(username)}`;
    },
    
    clearSearch() {
      this.searchQuery = '';
      this.searchResults = [];
    }
  },
  
  mounted() {
    this.init();
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('user-menu');
      const avatar = document.getElementById('user-avatar');
      
      if (menu && !menu.contains(e.target) && !avatar.contains(e.target)) {
        this.isMenuOpen = false;
      }
    });
    
    // Close menu on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.isMenuOpen = false;
      }
    });
  }
});

// Mount the app to the body since we're using the whole page
app.mount('body');

// Initialize immediately to prevent flicker
document.addEventListener('DOMContentLoaded', () => {
  // The Vue app will handle the initialization
});