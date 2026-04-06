document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  const stored = await browser.storage.local.get('googleApiKey');
  if (stored.googleApiKey) {
    apiKeyInput.value = stored.googleApiKey;
  }

  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      status.className = 'status error';
      status.textContent = 'Please enter an API key';
      return;
    }

    saveBtn.disabled = true;
    status.className = 'status testing';
    status.textContent = 'Testing API key...';

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:batchEmbedContents',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [{
              model: 'models/gemini-embedding-2-preview',
              content: { parts: [{ text: 'test' }] }
            }]
          })
        }
      );

      if (!response.ok) {
        throw new Error('Invalid API key');
      }

      await browser.storage.local.set({ googleApiKey: apiKey });
      
      status.className = 'status success';
      status.textContent = 'API key saved successfully!';
      
      setTimeout(() => window.close(), 1500);
    } catch (err) {
      status.className = 'status error';
      status.textContent = err.message || 'Failed to validate API key';
    } finally {
      saveBtn.disabled = false;
    }
  });
});
