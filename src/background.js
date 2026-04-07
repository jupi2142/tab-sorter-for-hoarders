import { EmbeddingService } from './core/embedding.js';
import { cosineSimilarity } from './core/similarity.js';
import { cleanTitle } from './core/titleCleaner.js';
import { getHostname, getDomainKey, getSubdomainKey } from './core/urlParser.js';
import { DomainSortStrategy } from './strategies/domainSortStrategy.js';
import { SubdomainSortStrategy } from './strategies/subdomainSortStrategy.js';
import { SimilaritySortStrategy } from './strategies/similaritySortStrategy.js';
import { StorageAdapter } from './infrastructure/storage.js';
import { MessageHandler, ContextMenuManager } from './infrastructure/messages.js';

const urlParser = { getHostname, getDomainKey, getSubdomainKey };
const storage = new StorageAdapter();
const embeddingService = new EmbeddingService(storage);

const strategies = {
  domain: new DomainSortStrategy(urlParser),
  subdomain: new SubdomainSortStrategy(urlParser),
  similarity: new SimilaritySortStrategy({
    embeddingService,
    similarityCalculator: cosineSimilarity,
    titleCleaner: { cleanTitle }
  }),
  storage
};

const messageHandler = new MessageHandler(strategies, urlParser);
messageHandler.setup();

const contextMenu = new ContextMenuManager(urlParser);
contextMenu.setSortCallback(async (info, tab) => {
  if (info.menuItemId === 'sort-domain') {
    await strategies.domain.execute(await browser.tabs.query({ currentWindow: true }));
  } else if (info.menuItemId === 'sort-subdomain') {
    await strategies.subdomain.execute(await browser.tabs.query({ currentWindow: true }));
  } else if (info.menuItemId === 'sort-similarity-group' || info.menuItemId === 'sort-similarity-sort') {
    const hasKey = await storage.hasApiKey();
    if (!hasKey) {
      browser.action.openPopup();
      return;
    }
    try {
      await strategies.similarity.execute(
        await browser.tabs.query({ currentWindow: true }),
        tab.id,
        info.menuItemId === 'sort-similarity-group' ? 'group' : 'sort',
        0.5
      );
    } catch (err) {
      console.error('Similarity sort error:', err);
    }
  }
});
contextMenu.setup();

browser.action.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ currentWindow: true });
  await strategies.subdomain.execute(tabs);
});