import { describe, expect, it, vi } from 'vitest';
import { TabContentExtractor } from '../src/infrastructure/tabContentExtractor.js';

describe('TabContentExtractor', () => {
  it('extracts reader markdown from a tab through browser scripting', async () => {
    const executeScript = vi.fn().mockResolvedValue([{ result: '# Heading\n\nUseful body text' }]);
    globalThis.browser = { scripting: { executeScript } };
    const extractor = new TabContentExtractor();

    await expect(extractor.getTabMarkdown({ id: 42 })).resolves.toBe('# Heading\n\nUseful body text');

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [4000]
    });
  });

  it('returns empty text when a tab cannot be scripted', async () => {
    globalThis.browser = {
      scripting: {
        executeScript: vi.fn().mockRejectedValue(new Error('Missing host permission'))
      }
    };
    const extractor = new TabContentExtractor();

    await expect(extractor.getTabMarkdown({ id: 42 })).resolves.toBe('');
  });
});
