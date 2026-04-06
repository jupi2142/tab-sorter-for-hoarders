document.addEventListener('DOMContentLoaded', async () => {
  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('thresholdValue');
  const methodSelect = document.getElementById('method');
  const runBtn = document.getElementById('runBtn');
  const status = document.getElementById('status');
  const similaritySection = document.getElementById('similaritySection');
  const settingsBtn = document.getElementById('settingsBtn');
  const apiKeyModal = document.getElementById('apiKeyModal');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

  const similarityMethods = ['group', 'sort'];

  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'progress') {
      status.textContent = message.message;
    }
  });

  async function checkApiKey() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'checkApiKey' });
      return response.hasKey;
    } catch (err) {
      return false;
    }
  }

  settingsBtn.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });

  methodSelect.addEventListener('change', () => {
    const isSimilarity = similarityMethods.includes(methodSelect.value);
    similaritySection.classList.toggle('visible', isSimilarity);
    
    const methodLabels = {
      domain: 'Sort by Domain',
      subdomain: 'Sort by Subdomain',
      group: 'Group Similar Tabs',
      sort: 'Sort by Similarity'
    };
    runBtn.textContent = methodLabels[methodSelect.value] || 'Sort';
  });

  thresholdSlider.addEventListener('input', () => {
    thresholdValue.textContent = thresholdSlider.value;
  });

  async function runSort() {
    const method = methodSelect.value;
    const threshold = parseFloat(thresholdSlider.value);

    runBtn.disabled = true;
    runBtn.textContent = 'Processing...';
    status.className = 'status loading';
    status.textContent = 'Sorting tabs...';

    try {
      if (method === 'domain' || method === 'subdomain') {
        const response = await browser.runtime.sendMessage({
          action: 'sortBy' + method.charAt(0).toUpperCase() + method.slice(1)
        });

        if (response.success) {
          status.className = 'status done';
          status.textContent = `Sorted ${response.moved} tabs`;
          setTimeout(() => window.close(), 1000);
        } else {
          status.className = 'status error';
          status.textContent = response.error || 'Failed to sort tabs';
        }
      } else {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        
        const response = await browser.runtime.sendMessage({
          action: 'sortBySimilarity',
          sourceTabId: tab.id,
          method: method,
          threshold: threshold
        });

        if (response.success) {
          status.className = 'status done';
          status.textContent = `Sorted ${response.moved} tabs`;
          setTimeout(() => window.close(), 1000);
        } else {
          status.className = 'status error';
          status.textContent = response.error || 'Failed to sort tabs';
        }
      }
    } catch (err) {
      status.className = 'status error';
      status.textContent = err.message || 'An error occurred';
    } finally {
      runBtn.disabled = false;
      const methodLabels = {
        domain: 'Sort by Domain',
        subdomain: 'Sort by Subdomain',
        group: 'Group Similar Tabs',
        sort: 'Sort by Similarity'
      };
      runBtn.textContent = methodLabels[methodSelect.value] || 'Sort';
    }
  }

  saveApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return;

    console.log('Saving API key:', apiKey.substring(0, 10) + '...');
    await browser.storage.local.set({ googleApiKey: apiKey });
    
    const stored = await browser.storage.local.get('googleApiKey');
    console.log('Verified storage:', stored.googleApiKey ? 'key exists' : 'key NOT found');
    
    apiKeyModal.classList.remove('visible');
    apiKeyInput.value = '';
    await runSort();
  });

  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveApiKeyBtn.click();
    }
  });

  runBtn.addEventListener('click', async () => {
    const method = methodSelect.value;
    const isSimilarity = similarityMethods.includes(method);
    
    if (isSimilarity) {
      const hasKey = await checkApiKey();
      if (!hasKey) {
        apiKeyModal.classList.add('visible');
        apiKeyInput.focus();
        return;
      }
    }

    await runSort();
  });
});
