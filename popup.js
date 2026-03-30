// Tab functionality
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked tab and corresponding content
    tab.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
  });
});

// Auto-generate video checkbox handler
document.getElementById('autoGenerateVideo').addEventListener('change', (e) => {
  document.getElementById('videoPromptSection').style.display = 
    e.target.checked ? 'block' : 'none';
});

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get({
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

  document.getElementById('autoClickGenerate').checked = settings.autoClickGenerate;
  document.getElementById('autoDownload').checked = settings.autoDownload;
  document.getElementById('showNotifications').checked = settings.showNotifications;
  document.getElementById('imageWaitTime').value = settings.imageWaitTime;
  document.getElementById('videoWaitTime').value = settings.videoWaitTime;
  document.getElementById('maxRetries').value = settings.maxRetries;
  document.getElementById('addImagePrefix').checked = settings.addImagePrefix;
  document.getElementById('addVideoPrefix').checked = settings.addVideoPrefix;
  document.getElementById('queueDelay').value = settings.queueDelay;
  document.getElementById('imagesGenerated').textContent = settings.imagesGenerated;
  document.getElementById('videosGenerated').textContent = settings.videosGenerated;
}

// Save settings
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const settings = {
    autoClickGenerate: document.getElementById('autoClickGenerate').checked,
    autoDownload: document.getElementById('autoDownload').checked,
    showNotifications: document.getElementById('showNotifications').checked,
    imageWaitTime: parseInt(document.getElementById('imageWaitTime').value),
    videoWaitTime: parseInt(document.getElementById('videoWaitTime').value),
    maxRetries: parseInt(document.getElementById('maxRetries').value),
    addImagePrefix: document.getElementById('addImagePrefix').checked,
    addVideoPrefix: document.getElementById('addVideoPrefix').checked,
    queueDelay: parseInt(document.getElementById('queueDelay').value)
  };

  await chrome.storage.sync.set(settings);
  showStatus('Settings saved successfully!', 'success');
});

// Reset settings
document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
  await chrome.storage.sync.clear();
  await loadSettings();
  showStatus('Settings reset to default!', 'info');
});

// Generate button handler
document.getElementById('generateBtn').addEventListener('click', async () => {
  const imagePrompt = document.getElementById('imagePrompt').value.trim();
  
  if (!imagePrompt) {
    showStatus('Please enter an image prompt!', 'error');
    return;
  }

  const autoGenerateVideo = document.getElementById('autoGenerateVideo').checked;
  const videoPrompt = document.getElementById('videoPrompt').value.trim();

  const settings = await chrome.storage.sync.get([
    'addImagePrefix', 
    'addVideoPrefix',
    'autoClickGenerate',
    'imageWaitTime',
    'videoWaitTime',
    'showNotifications'
  ]);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('meta.ai')) {
    showStatus('Please navigate to meta.ai first!', 'error');
    return;
  }

  showStatus('Generating...', 'info');

  chrome.tabs.sendMessage(tab.id, {
    action: 'generate',
    imagePrompt,
    videoPrompt: autoGenerateVideo ? videoPrompt : null,
    settings
  }, (response) => {
    if (response && response.success) {
      showStatus('Generation started successfully!', 'success');
      updateStats();
    } else {
      showStatus(response?.error || 'Failed to start generation', 'error');
    }
  });
});

// Add to queue button handler
document.getElementById('addToQueueBtn').addEventListener('click', async () => {
  const imagePrompt = document.getElementById('imagePrompt').value.trim();
  
  if (!imagePrompt) {
    showStatus('Please enter an image prompt!', 'error');
    return;
  }

  const autoGenerateVideo = document.getElementById('autoGenerateVideo').checked;
  const videoPrompt = document.getElementById('videoPrompt').value.trim();

  const { queue = [] } = await chrome.storage.local.get('queue');
  
  queue.push({
    id: Date.now(),
    imagePrompt,
    videoPrompt: autoGenerateVideo ? videoPrompt : null,
    timestamp: new Date().toISOString()
  });

  await chrome.storage.local.set({ queue });
  
  showStatus('Added to queue!', 'success');
  document.getElementById('imagePrompt').value = '';
  document.getElementById('videoPrompt').value = '';
  
  loadQueue();
});

// Load queue
async function loadQueue() {
  const { queue = [] } = await chrome.storage.local.get('queue');
  const queueList = document.getElementById('queueList');

  if (queue.length === 0) {
    queueList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No items in queue</p>';
    return;
  }

  queueList.innerHTML = queue.map(item => `
    <div class="queue-item">
      <div class="queue-item-prompt" title="${item.imagePrompt}">
        ${item.imagePrompt}
        ${item.videoPrompt ? ' → 🎥' : ''}
      </div>
      <button class="queue-item-remove" data-id="${item.id}">Remove</button>
    </div>
  `).join('');

  // Add remove handlers
  queueList.querySelectorAll('.queue-item-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const { queue = [] } = await chrome.storage.local.get('queue');
      const newQueue = queue.filter(item => item.id !== id);
      await chrome.storage.local.set({ queue: newQueue });
      loadQueue();
      showStatus('Item removed from queue', 'info');
    });
  });
}

// Process queue button handler
document.getElementById('processQueueBtn').addEventListener('click', async () => {
  const { queue = [] } = await chrome.storage.local.get('queue');
  
  if (queue.length === 0) {
    showStatus('Queue is empty!', 'error');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('meta.ai')) {
    showStatus('Please navigate to meta.ai first!', 'error');
    return;
  }

  const settings = await chrome.storage.sync.get([
    'addImagePrefix', 
    'addVideoPrefix',
    'autoClickGenerate',
    'imageWaitTime',
    'videoWaitTime',
    'queueDelay'
  ]);

  showStatus('Processing queue...', 'info');

  chrome.tabs.sendMessage(tab.id, {
    action: 'processQueue',
    queue,
    settings
  }, async (response) => {
    if (response && response.success) {
      await chrome.storage.local.set({ queue: [] });
      loadQueue();
      showStatus('Queue processing started!', 'success');
    } else {
      showStatus(response?.error || 'Failed to process queue', 'error');
    }
  });
});

// Clear queue button handler
document.getElementById('clearQueueBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ queue: [] });
  loadQueue();
  showStatus('Queue cleared!', 'info');
});

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';

  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// Update stats
async function updateStats() {
  const stats = await chrome.storage.sync.get(['imagesGenerated', 'videosGenerated']);
  document.getElementById('imagesGenerated').textContent = stats.imagesGenerated || 0;
  document.getElementById('videosGenerated').textContent = stats.videosGenerated || 0;
}

// Initialize
loadSettings();
loadQueue();
updateStats();

// Refresh queue every 2 seconds when on queue tab
setInterval(() => {
  if (document.getElementById('queue-tab').classList.contains('active')) {
    loadQueue();
  }
}, 2000);
