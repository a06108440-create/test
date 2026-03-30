// Utility functions

const AutoMetaUtils = {
  // Wait for element to appear
  waitForElement: function(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  },

  // Wait for multiple elements
  waitForElements: function(selectors, timeout = 10000) {
    return Promise.all(
      selectors.map(selector => this.waitForElement(selector, timeout))
    );
  },

  // Simulate human-like typing
  simulateTyping: async function(element, text, delay = 50) {
    element.focus();
    
    for (let char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await this.wait(delay + Math.random() * 50);
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
  },

  // Wait function
  wait: function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Check if element is visible
  isElementVisible: function(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  // Scroll element into view
  scrollIntoView: function(element) {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
  },

  // Safe click with retries
  safeClick: async function(element, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        if (!this.isElementVisible(element)) {
          this.scrollIntoView(element);
          await this.wait(500);
        }
        
        element.click();
        return true;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.wait(1000);
      }
    }
    return false;
  },

  // Get text content safely
  getTextContent: function(selector) {
    const element = document.querySelector(selector);
    return element ? element.textContent.trim() : '';
  },

  // Download blob as file
  downloadBlob: function(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Format timestamp
  formatTimestamp: function(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-').split('.')[0];
  },

  // Generate unique ID
  generateId: function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
};

// Make utils available globally
window.AutoMetaUtils = AutoMetaUtils;
