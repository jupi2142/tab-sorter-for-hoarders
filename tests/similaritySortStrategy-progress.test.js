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
});
