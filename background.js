import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

const SITE_NAMES = [
  'youtube', 'www.youtube', 'youtu.be',
  'facebook', 'www.facebook', 'fb.com',
  'twitter', 'www.twitter', 'x.com', 'www.x.com',
  'reddit', 'www.reddit', 'old.reddit',
  'instagram', 'www.instagram',
  'linkedin', 'www.linkedin',
  'github', 'www.github',
  'stackoverflow', 'www.stackoverflow',
  'stackexchange', 'www.stackexchange',
  'medium', 'www.medium',
  'quora', 'www.quora',
  'wikipedia', 'www.wikipedia',
  'amazon', 'www.amazon',
  'netflix', 'www.netflix',
  'twitch', 'www.twitch',
  'discord', 'www.discord',
  'slack', 'www.slack',
  'notion', 'www.notion',
  'figma', 'www.figma',
  'jira', 'www.jira',
  'gitlab', 'www.gitlab',
  'bitbucket', 'www.bitbucket',
  'dev.to', 'www.dev.to',
  'hackernews', 'news.ycombinator',
  'producthunt', 'www.producthunt',
  'craigslist', 'www.craigslist',
  'ebay', 'www.ebay',
  'spotify', 'open.spotify',
  'soundcloud', 'www.soundcloud',
  'vimeo', 'www.vimeo',
  'dribbble', 'www.dribbble',
  'behance', 'www.behance',
  'codepen', 'www.codepen',
  'replit', 'www.replit',
  'glitch', 'www.glitch',
  'jsfiddle', 'www.jsfiddle',
  'stackblitz', 'www.stackblitz'
];

const TITLE_SEPARATORS = [
  ' - ', ' : ', ' | ', ' — ', ' – ', ' :: ', ' /// ',
  ' on ', ' - ', ': ', '| '
];

let apiKey = null;
let embeddingCache = new Map();

async function getApiKey() {
  if (apiKey) return apiKey;
  const stored = await browser.storage.local.get('googleApiKey');
  if (!stored.googleApiKey) {
    throw new Error('API key not configured. Please set up your Google AI API key in settings.');
  }
  apiKey = stored.googleApiKey;
  return apiKey;
}

let embeddings = null;

async function getEmbeddings() {
  if (!embeddings) {
    const key = await getApiKey();
    embeddings = new GoogleGenerativeAIEmbeddings({
      model: 'embedding-001',
      apiKey: key,
    });
  }
  return embeddings;
}

async function getEmbedding(text) {
  const cacheKey = text.toLowerCase().trim();
  
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  const stored = await browser.storage.local.get('embedding_' + cacheKey);
  if (stored['embedding_' + cacheKey]) {
    const cached = stored['embedding_' + cacheKey];
    embeddingCache.set(cacheKey, cached);
    return cached;
  }
  
  const embedding = await (await getEmbeddings()).embedQuery(text);
  
  embeddingCache.set(cacheKey, embedding);
  await browser.storage.local.set({ ['embedding_' + cacheKey]: embedding });
  
  return embedding;
}

function cleanTitle(title) {
  if (!title) return '';
  
  let cleaned = title.toLowerCase().trim();
  
  for (const sep of TITLE_SEPARATORS) {
    const idx = cleaned.lastIndexOf(sep);
    if (idx > 5) {
      cleaned = cleaned.substring(0, idx).trim();
    }
  }
  
  const words = cleaned.split(/\s+/);
  const filtered = words.filter(word => {
    const domainWord = word.replace(/[^a-z0-9]/g, '');
    return !SITE_NAMES.includes(domainWord) && 
           !SITE_NAMES.includes('www.' + domainWord);
  });
  
  cleaned = filtered.join(' ');
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

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

function getDomainKey(tab) {
  if (!tab.url || !tab.url.startsWith('http')) {
    return '\uffff';
  }

  try {
    const url = new URL(tab.url);
    const hostname = url.hostname;
    const parts = hostname.split('.');
    
    let domain;
    
    if (parts.length >= 2) {
      domain = parts.slice(-2).join('.');
    } else {
      domain = hostname;
    }

    const path = url.pathname + url.search;
    
    return `${domain}\0${path}`;
  } catch (e) {
    return '\uffff';
  }
}

function getSubdomainKey(tab) {
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

async function sortTabsByDomain() {
  const tabs = await browser.tabs.query({ currentWindow: true });
  
  const sortableTabs = tabs.map((tab, index) => ({
    tab,
    index,
    key: getDomainKey(tab)
  }));

  sortableTabs.sort((a, b) => a.key.localeCompare(b.key));

  let movedCount = 0;
  for (let i = 0; i < sortableTabs.length; i++) {
    const targetTab = sortableTabs[i].tab;
    if (targetTab.index !== i) {
      await browser.tabs.move(targetTab.id, { index: i });
      movedCount++;
    }
  }
  return movedCount;
}

async function sortTabsBySubdomain() {
  const tabs = await browser.tabs.query({ currentWindow: true });
  
  const sortableTabs = tabs.map((tab, index) => ({
    tab,
    index,
    key: getSubdomainKey(tab)
  }));

  sortableTabs.sort((a, b) => a.key.localeCompare(b.key));

  let movedCount = 0;
  for (let i = 0; i < sortableTabs.length; i++) {
    const targetTab = sortableTabs[i].tab;
    if (targetTab.index !== i) {
      await browser.tabs.move(targetTab.id, { index: i });
      movedCount++;
    }
  }
  return movedCount;
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

const EMBEDDING_DELAY_MS = 200;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sortBySimilarity(sourceTabId, method, threshold, popupTabId) {
  const tabs = await browser.tabs.query({ currentWindow: true });
  const sourceTab = tabs.find(t => t.id === sourceTabId);
  
  if (!sourceTab) {
    throw new Error('Source tab not found');
  }

  const sourceCleanTitle = cleanTitle(sourceTab.title);
  if (!sourceCleanTitle) {
    throw new Error('Source tab has no valid title');
  }

  const cacheKey = `title:${sourceCleanTitle}`;
  let sourceEmbedding = embeddingCache.get(cacheKey);
  
  if (!sourceEmbedding) {
    sourceEmbedding = await getEmbedding(sourceCleanTitle);
    embeddingCache.set(cacheKey, sourceEmbedding);
  }

  const tabEmbeddings = [];
  const totalTabs = tabs.length - 1;
  
  for (const tab of tabs) {
    if (tab.id === sourceTabId) continue;
    
    const cleanTitleText = cleanTitle(tab.title);
    if (!cleanTitleText) continue;
    
    const key = `title:${cleanTitleText}`;
    let embedding = embeddingCache.get(key);
    
    if (!embedding) {
      embedding = await getEmbedding(cleanTitleText);
      embeddingCache.set(key, embedding);
      await delay(EMBEDDING_DELAY_MS);
      
      if (popupTabId) {
        browser.tabs.sendMessage(popupTabId, { 
          action: 'progress', 
          message: `Processing tabs... (${tabEmbeddings.length + 1}/${totalTabs})` 
        }).catch(() => {});
      }
    }
    
    const similarity = cosineSimilarity(sourceEmbedding, embedding);
    
    tabEmbeddings.push({
      tab,
      similarity,
      isSimilar: similarity >= threshold
    });
  }

  tabEmbeddings.sort((a, b) => b.similarity - a.similarity);

  let movedCount = 0;
  const sourceIndex = sourceTab.index;

  if (method === 'sort') {
    for (let i = 0; i < tabEmbeddings.length; i++) {
      const targetIndex = sourceIndex + 1 + i;
      if (tabEmbeddings[i].tab.index !== targetIndex) {
        await browser.tabs.move(tabEmbeddings[i].tab.id, { index: targetIndex });
        movedCount++;
      }
    }
  } else {
    const similarTabs = tabEmbeddings.filter(t => t.isSimilar);
    const otherTabs = tabEmbeddings.filter(t => !t.isSimilar);
    
    let insertIndex = sourceIndex + 1;
    
    for (const item of similarTabs) {
      if (item.tab.index !== insertIndex) {
        await browser.tabs.move(item.tab.id, { index: insertIndex });
        movedCount++;
      }
      insertIndex++;
    }
    
    for (const item of otherTabs) {
      if (item.tab.index !== insertIndex) {
        await browser.tabs.move(item.tab.id, { index: insertIndex });
        movedCount++;
      }
      insertIndex++;
    }
  }

  return movedCount;
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

browser.contextMenus.create({
  id: 'sort',
  title: 'Sort tabs',
  contexts: ['tab']
});

browser.contextMenus.create({
  id: 'sort-domain',
  title: 'Sort by domain',
  contexts: ['tab'],
  parentId: 'sort'
});

browser.contextMenus.create({
  id: 'sort-subdomain',
  title: 'Sort by subdomain',
  contexts: ['tab'],
  parentId: 'sort'
});

browser.contextMenus.create({
  id: 'sort-similarity',
  title: 'Sort by Similarity',
  contexts: ['tab']
});

browser.contextMenus.create({
  id: 'sort-similarity-group',
  title: 'Group similar tabs',
  contexts: ['tab'],
  parentId: 'sort-similarity'
});

browser.contextMenus.create({
  id: 'sort-similarity-sort',
  title: 'Sort by similarity',
  contexts: ['tab'],
  parentId: 'sort-similarity'
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'close-all' || info.menuItemId === 'close-others') {
    await closeTabsByHostname(info, tab);
  } else if (info.menuItemId === 'sort-domain') {
    await sortTabsByDomain();
  } else if (info.menuItemId === 'sort-subdomain') {
    await sortTabsBySubdomain();
  } else if (info.menuItemId === 'sort-similarity-group') {
    await sortBySimilarity(tab.id, 'group', 0.5);
  } else if (info.menuItemId === 'sort-similarity-sort') {
    await sortBySimilarity(tab.id, 'sort', 0.5);
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sortByDomain') {
    sortTabsByDomain()
      .then(moved => sendResponse({ success: true, moved }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.action === 'sortBySubdomain') {
    sortTabsBySubdomain()
      .then(moved => sendResponse({ success: true, moved }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.action === 'sortBySimilarity') {
    sortBySimilarity(message.sourceTabId, message.method, message.threshold, sender.tab?.id)
      .then(moved => sendResponse({ success: true, moved }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.action === 'checkApiKey') {
    getApiKey()
      .then(key => sendResponse({ success: true, hasKey: true }))
      .catch(err => sendResponse({ success: true, hasKey: false, error: err.message }));
    return true;
  }
});

browser.action.onClicked.addListener(sortTabsBySubdomain);
