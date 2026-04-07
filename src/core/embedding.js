const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:batchEmbedContents';

var EmbeddingService = class EmbeddingService {
  constructor(storage) {
    this.storage = storage;
    this.cache = new Map();
  }

  async fetchFromApi(texts, apiKey) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        requests: texts.map(text => ({
          model: 'models/gemini-embedding-2-preview',
          content: { parts: [{ text }] },
          output_dimensionality: 128
        }))
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return texts.map((text, i) => ({ text, embedding: data.embeddings[i].values }));
  }

  async getEmbeddings(texts, progressCallback) {
    const results = [];
    const textsToFetch = [];

    for (let i = 0; i < texts.length; i++) {
      const key = texts[i].toLowerCase().trim();
      if (this.cache.has(key)) {
        results.push({ text: texts[i], embedding: this.cache.get(key) });
      } else {
        const stored = await this.storage.get('embedding_' + key);
        if (stored['embedding_' + key]) {
          this.cache.set(key, stored['embedding_' + key]);
          results.push({ text: texts[i], embedding: stored['embedding_' + key] });
        } else {
          textsToFetch.push(texts[i]);
        }
      }
    }

    if (textsToFetch.length === 0) return results;

    const apiKey = await this.storage.getApiKey();
    const chunkSize = await this.storage.getChunkSize();
    
    for (let i = 0; i < textsToFetch.length; i += chunkSize) {
      const chunk = textsToFetch.slice(i, i + chunkSize);
      const embeddings = await this.fetchFromApi(chunk, apiKey);

      for (const { text, embedding } of embeddings) {
        const key = text.toLowerCase().trim();
        this.cache.set(key, embedding);
        await this.storage.set({ ['embedding_' + key]: embedding });
        results.push({ text, embedding });
        
        if (progressCallback && (i + embeddings.length) % 5 === 0) {
          progressCallback(i + embeddings.length, textsToFetch.length);
        }
      }
    }

    return results;
  }
};

export { EmbeddingService };