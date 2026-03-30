// Background service worker

// Install event
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      autoClickGenerate: true,
      autoDownload: false,
      showNotifications: true,
      imageWaitTime: 5,
      videoWaitTime: 10,
      maxRetries: 3,
      addImagePrefix: false,
      addVideoPrefix: false,
      queueDelay: 10,
      imagesGenerated: 0,
      videosGenerated: 0
    });

    // Open welcome page
    chrome.tabs.create({
      url: 'https://www.meta.ai/'
    });
  }
});

// Listen for tab updates to inject content script
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('meta.ai')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['utils.js', 'content.js']
    }).catch(err => console.log('Script injection error:', err));
  }
});

// Context menu (right-click) integration
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'autometa-generate',
    title: 'Generate with AutoMeta Pro',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'autometa-generate' && info.selectionText) {
    if (tab.url.includes('meta.ai')) {
      const settings = await chrome.storage.sync.get([
        'addImagePrefix',
        'addVideoPrefix',
        'autoClickGenerate',
        'imageWaitTime',
        'showNotifications'
      ]);

      chrome.tabs.sendMessage(tab.id, {
        action: 'generate',
        imagePrompt: info.selectionText,
        videoPrompt: null,
        settings
      });
    } else {
      // Open Meta AI in new tab with selected text
      chrome.tabs.create({
        url: 'https://www.meta.ai/'
      });
    }
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-generate') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url.includes('meta.ai')) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'quickGenerate'
      });
    }
  }
});

// Statistics tracking
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    chrome.storage.sync.get(['imagesGenerated', 'videosGenerated'], (data) => {
      const updates = {};
      
      if (request.type === 'image') {
        updates.imagesGenerated = (data.imagesGenerated || 0) + 1;
      } else if (request.type === 'video') {
        updates.videosGenerated = (data.videosGenerated || 0) + 1;
      }

      chrome.storage.sync.set(updates);
      sendResponse({ success: true });
    });

    return true;
  }
});
