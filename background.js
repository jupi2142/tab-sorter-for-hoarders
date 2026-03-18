function getHostname(tab) {
  if (!tab.url || !tab.url.startsWith('http')) {
    return null;
  }
  try {
    return new URL(tab.url).hostname;
  } catch (e) {
    return null;
  }
}

function getTabKey(tab) {
  if (!tab.url || !tab.url.startsWith('http')) {
    return '\uffff';
  }

  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    const parts = hostname.split('.');
    
    let domain, subdomain;
    
    if (parts.length >= 2) {
      domain = parts.slice(-2).join('.');
      subdomain = parts.slice(0, -2).join('.');
    } else {
      domain = hostname;
      subdomain = '';
    }

    const path = url.pathname + url.search;
    
    return `${domain}\0${subdomain}\0${path}`;
  } catch (e) {
    return '\uffff';
  }
}

async function sortTabs() {
  const tabs = await browser.tabs.query({ currentWindow: true });
  
  const sortableTabs = tabs.map((tab, index) => ({
    tab,
    index,
    key: getTabKey(tab)
  }));

  sortableTabs.sort((a, b) => a.key.localeCompare(b.key));

  for (let i = 0; i < sortableTabs.length; i++) {
    const targetTab = sortableTabs[i].tab;
    if (targetTab.index !== i) {
      await browser.tabs.move(targetTab.id, { index: i });
    }
  }
}

async function closeTabsByHostname(info, tab) {
  const targetHostname = getHostname(tab);
  if (!targetHostname) return;

  const tabs = await browser.tabs.query({ currentWindow: true });
  const tabsToClose = tabs
    .filter(t => getHostname(t) === targetHostname)
    .map(t => t.id);

  if (info.menuItemId === 'close-all') {
    await browser.tabs.remove(tabsToClose);
  } else if (info.menuItemId === 'close-others') {
    const currentTabId = tab.id;
    const otherTabs = tabsToClose.filter(id => id !== currentTabId);
    await browser.tabs.remove(otherTabs);
  }
}

browser.contextMenus.create({
  id: 'close-all',
  title: 'Close all tabs from this website',
  contexts: ['tab']
});

browser.contextMenus.create({
  id: 'close-others',
  title: 'Close other tabs from this website',
  contexts: ['tab']
});

browser.contextMenus.onClicked.addListener(closeTabsByHostname);

browser.action.onClicked.addListener(sortTabs);
