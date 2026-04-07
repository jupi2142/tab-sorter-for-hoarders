class MessageHandler {
  constructor(strategies, urlParser) {
    this.strategies = strategies;
    this.urlParser = urlParser;
  }

  setup() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender).then(sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender) {
    switch (message.action) {
      case 'sortByDomain':
        return this.handleSort('domain');
      case 'sortBySubdomain':
        return this.handleSort('subdomain');
      case 'sortBySimilarity':
        return this.handleSimilaritySort(message, sender);
      case 'checkApiKey':
        return this.handleCheckApiKey();
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  async handleSort(method) {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const moved = await this.strategies[method].execute(tabs);
      return { success: true, moved };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async handleSimilaritySort(message, sender) {
    try {
      const progressCallback = (msg) => {
        if (sender.tab?.id) {
          browser.tabs.sendMessage(sender.tab.id, { action: 'progress', message: msg }).catch(() => {});
        }
      };
      
      this.strategies.similarity.progressCallback = progressCallback;
      
      const tabs = await browser.tabs.query({ currentWindow: true });
      const moved = await this.strategies.similarity.execute(
        tabs,
        message.sourceTabId,
        message.method,
        message.threshold
      );
      return { success: true, moved };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async handleCheckApiKey() {
    const hasKey = await this.strategies.storage.hasApiKey();
    return { success: true, hasKey };
  }
}

class ContextMenuManager {
  constructor(urlParser) {
    this.urlParser = urlParser;
    this.onSortCallback = null;
  }

  setSortCallback(cb) {
    this.onSortCallback = cb;
  }

  setup() {
    this.createMenus();
    this.setupListener();
  }

  createMenus() {
    browser.contextMenus.create({ id: 'sort-domain', title: 'Sort by domain', contexts: ['tab'] });
    browser.contextMenus.create({ id: 'sort-subdomain', title: 'Sort by subdomain', contexts: ['tab'] });
    browser.contextMenus.create({ id: 'sort-similarity-sort', title: 'Sort by similarity', contexts: ['tab'] });
    browser.contextMenus.create({ id: 'sort-similarity-group', title: 'Group similar tabs', contexts: ['tab'] });
    browser.contextMenus.create({ id: 'close-all', title: 'Close all tabs from this website', contexts: ['tab'] });
    browser.contextMenus.create({ id: 'close-others', title: 'Close other tabs from this website', contexts: ['tab'] });
  }

  setupListener() {
    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === 'close-all' || info.menuItemId === 'close-others') {
        await this.handleCloseTabs(info, tab);
      } else if (this.onSortCallback) {
        this.onSortCallback(info, tab);
      }
    });
  }

  async handleCloseTabs(info, tab) {
    const targetHostname = this.urlParser.getHostname(tab);
    if (!targetHostname) return;

    const tabs = await browser.tabs.query({ currentWindow: true });
    const tabsToClose = tabs
      .filter(t => this.urlParser.getHostname(t) === targetHostname)
      .map(t => t.id);

    if (info.menuItemId === 'close-all') {
      await browser.tabs.remove(tabsToClose);
    } else if (info.menuItemId === 'close-others') {
      const currentTabId = tab.id;
      const otherTabs = tabsToClose.filter(id => id !== currentTabId);
      await browser.tabs.remove(otherTabs);
    }
  }
}

export { MessageHandler, ContextMenuManager };