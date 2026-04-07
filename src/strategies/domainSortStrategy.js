class DomainSortStrategy {
  constructor(urlParser) {
    this.urlParser = urlParser;
  }

  async execute(tabs) {
    const sortableTabs = tabs.map((tab, index) => ({
      tab,
      index,
      key: this.urlParser.getDomainKey(tab)
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
}

export { DomainSortStrategy };