const { EmbeddingService } = require('./core/embedding');
const { cosineSimilarity } = require('./core/similarity');
const { cleanTitle } = require('./core/titleCleaner');
const { getHostname, getDomainKey, getSubdomainKey } = require('./core/urlParser');
const { DomainSortStrategy } = require('./strategies/domainSortStrategy');
const { SubdomainSortStrategy } = require('./strategies/subdomainSortStrategy');
const { SimilaritySortStrategy } = require('./strategies/similaritySortStrategy');
const { StorageAdapter } = require('./infrastructure/storage');
const { MessageHandler, ContextMenuManager } = require('./infrastructure/messages');

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
    try {
      await storage.getApiKey();
      await strategies.similarity.execute(
        await browser.tabs.query({ currentWindow: true }),
        tab.id,
        info.menuItemId === 'sort-similarity-group' ? 'group' : 'sort',
        0.5
      );
    } catch (err) {
      browser.action.openPopup();
    }
  }
});
contextMenu.setup();

browser.action.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ currentWindow: true });
  await strategies.subdomain.execute(tabs);
});