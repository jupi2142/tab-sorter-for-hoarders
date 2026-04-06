async function fetchEmbeddingsSequential(texts, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:batchEmbedContents`,
    {
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
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const results = [];
  
  for (let i = 0; i < texts.length; i++) {
    results.push({ text: texts[i], embedding: data.embeddings[i].values });
  }
  
  return results;
}

const CHUNK_SIZE = 30;

async function getEmbeddingsBatch(texts) {
  const results = [];
  const textsToFetch = [];

  for (const text of texts) {
    const key = text.toLowerCase().trim();
    if (embeddingCache.has(key)) {
      results.push({ text, embedding: embeddingCache.get(key) });
    } else {
      const stored = await browser.storage.local.get('embedding_' + key);
      if (stored['embedding_' + key]) {
        const cached = stored['embedding_' + key];
        embeddingCache.set(key, cached);
        results.push({ text, embedding: cached });
      } else {
        textsToFetch.push(text);
      }
    }
  }

  if (textsToFetch.length === 0) return results;

  const apiKey = await getApiKey();
  for (let i = 0; i < textsToFetch.length; i += CHUNK_SIZE) {
    const chunk = textsToFetch.slice(i, i + CHUNK_SIZE);
    const embeddings = await fetchEmbeddingsSequential(chunk, apiKey);

    for (const { text, embedding } of embeddings) {
      const key = text.toLowerCase().trim();
      embeddingCache.set(key, embedding);
      await browser.storage.local.set({ ['embedding_' + key]: embedding });
      results.push({ text, embedding });
    }
  }

  return results;
}

const SITE_NAMES = [
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

let embeddingCache = new Map();

async function getApiKey() {
  const stored = await browser.storage.local.get('googleApiKey');
  if (!stored.googleApiKey) {
    throw new Error('API key not configured. Please set up your Google AI API key in settings.');
  }
  return stored.googleApiKey;
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

  const tabTitles = [];
  const tabMap = new Map();

  tabTitles.push(sourceCleanTitle);
  tabMap.set(sourceCleanTitle, { tab: sourceTab, isSource: true });

  for (const tab of tabs) {
    if (tab.id === sourceTabId) continue;
    
    const cleanTitleText = cleanTitle(tab.title);
    if (!cleanTitleText) continue;
    
    tabTitles.push(cleanTitleText);
    tabMap.set(cleanTitleText, { tab, isSource: false });
  }

  const embeddingResults = await getEmbeddingsBatch(tabTitles);

  const embeddingMap = new Map();
  for (const result of embeddingResults) {
    embeddingMap.set(result.text, result.embedding);
  }

  const sourceEmbedding = embeddingMap.get(sourceCleanTitle);
  if (!sourceEmbedding) {
    throw new Error('Failed to get source embedding');
  }

  const tabEmbeddings = [];
  let processedCount = 0;
  const totalTabs = tabTitles.length - 1;

  for (const [text, data] of tabMap) {
    if (data.isSource) continue;

    const embedding = embeddingMap.get(text);
    if (!embedding) continue;

    const similarity = cosineSimilarity(sourceEmbedding, embedding);
    
    tabEmbeddings.push({
      tab: data.tab,
      similarity,
      isSimilar: similarity >= threshold
    });

    processedCount++;
    if (popupTabId && processedCount % 5 === 0) {
      browser.tabs.sendMessage(popupTabId, { 
        action: 'progress', 
        message: `Processing tabs... (${processedCount}/${totalTabs})` 
      }).catch(() => {});
    }
  }

  tabEmbeddings.sort((a, b) => b.similarity - a.similarity);

  console.log(`%c Similarity Sort Results for: "${sourceCleanTitle}" `, 'background: #222; color: #bada55; font-size: 14px;');
  console.table(tabEmbeddings.map((item, index) => ({
    rank: index + 1,
    title: item.tab.title.substring(0, 60) + (item.tab.title.length > 60 ? '...' : ''),
    similarity: item.similarity.toFixed(4),
    tabId: item.tab.id
  })));

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
  id: 'sort-domain',
  title: 'Sort by domain',
  contexts: ['tab'],
});

browser.contextMenus.create({
  id: 'sort-subdomain',
  title: 'Sort by subdomain',
  contexts: ['tab'],
});

browser.contextMenus.create({
  id: 'sort-similarity-sort',
  title: 'Sort by similarity',
  contexts: ['tab'],
});

browser.contextMenus.create({
  id: 'sort-similarity-group',
  title: 'Group similar tabs',
  contexts: ['tab'],
});

browser.contextMenus.create({
  id: 'close-all',
  title: 'Close all tabs from this website',
  contexts: ['tab'],
});

browser.contextMenus.create({
  id: 'close-others',
  title: 'Close other tabs from this website',
  contexts: ['tab'],
});


browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'close-all' || info.menuItemId === 'close-others') {
    await closeTabsByHostname(info, tab);
  } else if (info.menuItemId === 'sort-domain') {
    await sortTabsByDomain();
  } else if (info.menuItemId === 'sort-subdomain') {
    await sortTabsBySubdomain();
  } else if (info.menuItemId === 'sort-similarity-group' || info.menuItemId === 'sort-similarity-sort') {
    try {
      await getApiKey();
      await sortBySimilarity(tab.id, info.menuItemId === 'sort-similarity-group' ? 'group' : 'sort', 0.5);
    } catch (err) {
      browser.action.openPopup();
    }
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
