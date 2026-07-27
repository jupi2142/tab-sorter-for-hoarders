class SimilaritySortStrategy {
  constructor(config) {
    this.embeddingService = config.embeddingService;
    this.similarityCalculator = config.similarityCalculator;
    this.titleCleaner = config.titleCleaner;
    this.contentExtractor = config.contentExtractor || { getTabMarkdown: async () => '' };
    this.progressCallback = config.progressCallback || (() => {});
  }

  async execute(tabs, sourceTabId, method, threshold) {
    const tabsAll = await browser.tabs.query({ currentWindow: true });
    const sourceTab = tabsAll.find(t => t.id === sourceTabId);
    
    if (!sourceTab) {
      throw new Error('Source tab not found');
    }

    const sourceCleanTitle = this.titleCleaner.cleanTitle(sourceTab.title);
    if (!sourceCleanTitle) {
      throw new Error('Source tab has no valid title');
    }

    const tabRecords = [{
      tab: sourceTab,
      isSource: true,
      cleanTitle: sourceCleanTitle,
      embeddingText: await this.getEmbeddingText(sourceTab, sourceCleanTitle)
    }];

    for (const tab of tabsAll) {
      if (tab.id === sourceTabId) continue;
      
      const cleanTitleText = this.titleCleaner.cleanTitle(tab.title);
      if (!cleanTitleText) continue;
      
      tabRecords.push({
        tab,
        isSource: false,
        cleanTitle: cleanTitleText,
        embeddingText: await this.getEmbeddingText(tab, cleanTitleText)
      });
    }

    const embeddingResults = await this.embeddingService.getEmbeddings(
      tabRecords.map(record => record.embeddingText),
      (processed, total) => this.progressCallback(
        typeof processed === 'string'
          ? processed
          : `Processing tabs... (${processed}/${total})`
      )
    );

    const embeddingMap = new Map();
    for (const result of embeddingResults) {
      embeddingMap.set(result.text, result.embedding);
    }

    const sourceEmbedding = embeddingMap.get(tabRecords[0].embeddingText);
    if (!sourceEmbedding) {
      throw new Error('Failed to get source embedding');
    }

    if (sourceTab.index !== 0) {
      await browser.tabs.move(sourceTabId, { index: 0 });
      sourceTab.index = 0;
    }

    const tabEmbeddings = [];

    for (const record of tabRecords) {
      if (record.isSource) continue;

      const embedding = embeddingMap.get(record.embeddingText);
      if (!embedding) continue;

      const similarity = this.similarityCalculator(sourceEmbedding, embedding);
      
      tabEmbeddings.push({
        tab: record.tab,
        similarity,
        isSimilar: similarity >= threshold
      });
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

  async getEmbeddingText(tab, cleanTitle) {
    const markdown = await this.contentExtractor.getTabMarkdown(tab);
    return markdown || cleanTitle;
  }
}

export { SimilaritySortStrategy };
