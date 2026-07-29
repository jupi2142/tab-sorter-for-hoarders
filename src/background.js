import { LocalEmbeddingService } from './core/localEmbeddingService.js';
import { cosineSimilarity } from './core/similarity.js';
import { cleanTitle } from './core/titleCleaner.js';
import { getHostname, getDomainKey, getSubdomainKey } from './core/urlParser.js';
import { DomainSortStrategy } from './strategies/domainSortStrategy.js';
import { SubdomainSortStrategy } from './strategies/subdomainSortStrategy.js';
import { SimilaritySortStrategy } from './strategies/similaritySortStrategy.js';
import { MessageHandler, ContextMenuManager } from './infrastructure/messages.js';
import { TabContentExtractor } from './infrastructure/tabContentExtractor.js';

const urlParser = { getHostname, getDomainKey, getSubdomainKey };
const SIMILARITY_PROGRESS_NOTIFICATION_ID = 'similarity-sort-progress';
const embeddingService = new LocalEmbeddingService();
const contentExtractor = new TabContentExtractor();

const strategies = {
  domain: new DomainSortStrategy(urlParser),
  subdomain: new SubdomainSortStrategy(urlParser),
  similarity: new SimilaritySortStrategy({
    embeddingService,
    similarityCalculator: cosineSimilarity,
    titleCleaner: { cleanTitle },
    contentExtractor
  })
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
    strategies.similarity.progressCallback = message => {
      browser.notifications.create(SIMILARITY_PROGRESS_NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon.svg'),
        title: 'Tab Sorter',
        message
      }).catch(() => {});
    };
    try {
      await strategies.similarity.execute(
        await browser.tabs.query({ currentWindow: true }),
        tab.id,
        info.menuItemId === 'sort-similarity-group' ? 'group' : 'sort',
        0.5
      );
    } catch (error) {
      console.error('Similarity sort error:', error);
    } finally {
      browser.notifications.clear(SIMILARITY_PROGRESS_NOTIFICATION_ID).catch(() => {});
    }
  }
});
contextMenu.setup();

browser.action.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({ currentWindow: true });
  await strategies.subdomain.execute(tabs);
});
