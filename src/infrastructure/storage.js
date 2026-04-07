class StorageAdapter {
  async get(key) {
    return await browser.storage.local.get(key);
  }

  async set(data) {
    return await browser.storage.local.set(data);
  }

  async getApiKey() {
    const stored = await this.get('googleApiKey');
    if (!stored.googleApiKey) {
      throw new Error('API key not configured. Please set up your Google AI API key in settings.');
    }
    return stored.googleApiKey;
  }

  async hasApiKey() {
    try {
      await this.getApiKey();
      return true;
    } catch {
      return false;
    }
  }
}

export { StorageAdapter };