import { describe, expect, it, vi } from 'vitest';
import { SimilaritySortStrategy } from '../src/strategies/similaritySortStrategy.js';

describe('SimilaritySortStrategy progress', () => {
  it('forwards model-load status text without numeric placeholders', async () => {
    globalThis.browser = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, index: 0, title: 'Source tab' },
          { id: 2, index: 1, title: 'Related tab' }
        ]),
        move: vi.fn()
      }
    };
    const progressCallback = vi.fn();
    const strategy = new SimilaritySortStrategy({
      embeddingService: {
        getEmbeddings: async (titles, onProgress) => {
          onProgress('Loading offline model…');
          onProgress(1, 2);
          return titles.map((text, index) => ({ text, embedding: [index + 1, 1] }));
        }
      },
      similarityCalculator: () => 1,
      titleCleaner: { cleanTitle: title => title },
      progressCallback
    });

    await strategy.execute([], 1, 'group', 0.5);

    expect(progressCallback).toHaveBeenNthCalledWith(1, 'Loading offline model…');
    expect(progressCallback).toHaveBeenNthCalledWith(2, 'Processing tabs... (1/2)');
  });

  it('does not move the source tab when embedding fails', async () => {
    globalThis.browser = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, index: 2, title: 'Source tab' },
          { id: 2, index: 0, title: 'Related tab' }
        ]),
        move: vi.fn()
      }
    };
    const strategy = new SimilaritySortStrategy({
      embeddingService: { getEmbeddings: vi.fn().mockRejectedValue(new Error('model failed')) },
      similarityCalculator: () => 1,
      titleCleaner: { cleanTitle: title => title }
    });

    await expect(strategy.execute([], 1, 'group', 0.5)).rejects.toThrow('model failed');

    expect(browser.tabs.move).not.toHaveBeenCalled();
  });

  it('embeds reader markdown content instead of hostnames when content is available', async () => {
    globalThis.browser = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, index: 0, title: 'Source tab', url: 'https://source.example/path' },
          { id: 2, index: 1, title: 'Related tab', url: 'https://related.example/path' }
        ]),
        move: vi.fn()
      }
    };
    const embeddedTexts = [];
    const strategy = new SimilaritySortStrategy({
      embeddingService: {
        getEmbeddings: async (texts) => {
          embeddedTexts.push(...texts);
          return texts.map((text, index) => ({ text, embedding: [index + 1, 1] }));
        }
      },
      contentExtractor: {
        getTabMarkdown: vi.fn(async tab => `# ${tab.title}\n\nImportant article body for tab ${tab.id}`)
      },
      similarityCalculator: () => 1,
      titleCleaner: { cleanTitle: title => title }
    });

    await strategy.execute([], 1, 'group', 0.5);

    expect(embeddedTexts).toEqual([
      '# Source tab\n\nImportant article body for tab 1',
      '# Related tab\n\nImportant article body for tab 2'
    ]);
    expect(embeddedTexts.join('\n')).not.toContain('source.example');
    expect(embeddedTexts.join('\n')).not.toContain('related.example');
  });
});
