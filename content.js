// Content script for Meta AI automation

let isProcessing = false;
let processingQueue = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generate') {
    generateContent(request.imagePrompt, request.videoPrompt, request.settings)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  } else if (request.action === 'processQueue') {
    processQueue(request.queue, request.settings)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Main generation function
async function generateContent(imagePrompt, videoPrompt, settings) {
  if (isProcessing) {
    throw new Error('Already processing a generation');
  }

  isProcessing = true;

  try {
    // Process image prompt with prefix if needed
    let finalImagePrompt = imagePrompt;
    if (settings.addImagePrefix && !imagePrompt.toLowerCase().startsWith('imagine')) {
      finalImagePrompt = `imagine ${imagePrompt}`;
    }

    // Generate image
    await sendPrompt(finalImagePrompt);
    
    if (settings.autoClickGenerate) {
      await clickGenerateButton();
    }

    await wait(settings.imageWaitTime * 1000);

    // Update image count
    const stats = await chrome.storage.sync.get('imagesGenerated');
    await chrome.storage.sync.set({ 
      imagesGenerated: (stats.imagesGenerated || 0) + 1 
    });

    if (settings.showNotifications) {
      showNotification('Image generated successfully! 🎨');
    }

    // Generate video if requested
    if (videoPrompt !== null) {
      await wait(2000); // Small delay before video generation

      let finalVideoPrompt = videoPrompt || imagePrompt;
      if (settings.addVideoPrefix && !finalVideoPrompt.toLowerCase().startsWith('animate')) {
        finalVideoPrompt = `animate ${finalVideoPrompt}`;
      }

      await sendPrompt(finalVideoPrompt);
      
      if (settings.autoClickGenerate) {
        await clickGenerateButton();
      }

      await wait(settings.videoWaitTime * 1000);

      // Update video count
      const videoStats = await chrome.storage.sync.get('videosGenerated');
      await chrome.storage.sync.set({ 
        videosGenerated: (videoStats.videosGenerated || 0) + 1 
      });

      if (settings.showNotifications) {
        showNotification('Video generated successfully! 🎥');
      }
    }

  } catch (error) {
    console.error('Generation error:', error);
    if (settings.showNotifications) {
      showNotification('Generation failed: ' + error.message, 'error');
    }
    throw error;
  } finally {
    isProcessing = false;
  }
}

// Process queue function
async function processQueue(queue, settings) {
  if (processingQueue) {
    throw new Error('Queue is already being processed');
  }

  processingQueue = true;

  try {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      
      showNotification(`Processing ${i + 1}/${queue.length}: ${item.imagePrompt.substring(0, 30)}...`);

      await generateContent(item.imagePrompt, item.videoPrompt, settings);

      // Wait before next item (except for last item)
      if (i < queue.length - 1) {
        await wait(settings.queueDelay * 1000);
      }
    }

    showNotification(`Queue completed! Processed ${queue.length} items. ✅`);
  } catch (error) {
    console.error('Queue processing error:', error);
    showNotification('Queue processing failed: ' + error.message, 'error');
    throw error;
  } finally {
    processingQueue = false;
  }
}

// Send prompt to Meta AI
async function sendPrompt(prompt) {
  return new Promise((resolve, reject) => {
    // Try multiple selectors for the input field
    const selectors = [
      'textarea[placeholder*="Ask Meta AI"]',
      'textarea[class*="input"]',
      'div[contenteditable="true"]',
      'textarea',
      'input[type="text"]'
    ];

    let inputField = null;
    
    for (const selector of selectors) {
      inputField = document.querySelector(selector);
      if (inputField) break;
    }

    if (!inputField) {
      reject(new Error('Could not find input field. Please make sure you are on meta.ai'));
      return;
    }

    // Clear existing content
    inputField.value = '';
    inputField.textContent = '';

    // Set the prompt
    if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
      inputField.value = prompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      inputField.textContent = prompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Focus the input
    inputField.focus();

    setTimeout(() => resolve(), 500);
  });
}

// Click generate/send button
async function clickGenerateButton() {
  return new Promise((resolve, reject) => {
    // Try multiple selectors for the send button
    const selectors = [
      'button[aria-label*="Send"]',
      'button[type="submit"]',
      'button[class*="send"]',
      'button svg[class*="send"]',
      'button:has(svg)',
      '[role="button"][aria-label*="Send"]'
    ];

    let button = null;

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if button is visible and not disabled
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && !element.disabled) {
          button = element;
          break;
        }
      }
      if (button) break;
    }

    if (!button) {
      // Try pressing Enter key as fallback
      const inputField = document.querySelector('textarea, input[type="text"]');
      if (inputField) {
        inputField.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
        setTimeout(() => resolve(), 500);
        return;
      }

      reject(new Error('Could not find send button'));
      return;
    }

    button.click();
    setTimeout(() => resolve(), 500);
  });
}

// Wait function
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Show notification overlay
function showNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.getElementById('autometa-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'autometa-notification';
  notification.className = `autometa-notification autometa-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('autometa-fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add keyboard shortcut listener
document.addEventListener('keydown', async (e) => {
  // Ctrl+Shift+G to quick generate
  if (e.ctrlKey && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    
    const inputField = document.querySelector('textarea, input[type="text"]');
    if (inputField && inputField.value.trim()) {
      const settings = await chrome.storage.sync.get([
        'addImagePrefix',
        'autoClickGenerate',
        'imageWaitTime',
        'showNotifications'
      ]);

      generateContent(inputField.value.trim(), null, settings);
    }
  }
});

// Initialize
console.log('AutoMeta Pro content script loaded');
