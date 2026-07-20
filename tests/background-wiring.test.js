import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  contextMenuListener: null,
  similarity: { execute: vi.fn().mockResolvedValue(0) },
  storage: { hasApiKey: vi.fn().mockResolvedValue(false) }
}));

vi.mock('../src/strategies/similaritySortStrategy.js', () => ({
  SimilaritySortStrategy: class {
    constructor() {
      return state.similarity;
    }
  }
}));

describe('background local similarity wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    state.contextMenuListener = null;
    state.similarity.execute.mockReset();
    state.similarity.execute.mockResolvedValue(0);
    state.storage.hasApiKey.mockClear();

    globalThis.browser = {
      action: { onClicked: { addListener: vi.fn() }, openPopup: vi.fn() },
      contextMenus: {
        create: vi.fn(),
        onClicked: {
          addListener: vi.fn(listener => {
            state.contextMenuListener = listener;
          })
        }
      },
      runtime: {
        getURL: path => `moz-extension://test/${path}`,
        onMessage: { addListener: vi.fn() }
      },
      notifications: {
        clear: vi.fn().mockResolvedValue(true),
        create: vi.fn().mockResolvedValue('similarity-sort-progress')
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 7, index: 0, title: 'Example' }]),
        move: vi.fn(),
        remove: vi.fn(),
        sendMessage: vi.fn()
      }
    };
  });

  it('runs grouping from the context menu without checking an API key', async () => {
    await import('../src/background.js');

    await state.contextMenuListener(
      { menuItemId: 'sort-similarity-group' },
      { id: 7, index: 0, title: 'Example' }
    );

    expect(state.storage.hasApiKey).not.toHaveBeenCalled();
    expect(state.similarity.execute).toHaveBeenCalledWith(
      expect.any(Array),
      7,
      'group',
      0.5
    );
  });

  it('shows and clears the local model progress notification for context-menu sorting', async () => {
    state.similarity.execute.mockImplementation(async () => {
      state.similarity.progressCallback?.('Loading offline model…');
      state.similarity.progressCallback?.('Processing tabs... (1/1)');
      return 0;
    });
    await import('../src/background.js');

    await state.contextMenuListener(
      { menuItemId: 'sort-similarity-group' },
      { id: 7, index: 0, title: 'Example' }
    );

    expect(browser.notifications.create).toHaveBeenCalledWith(
      'similarity-sort-progress',
      expect.objectContaining({ message: 'Loading offline model…' })
    );
    expect(browser.notifications.clear).toHaveBeenCalledWith('similarity-sort-progress');
  });

  it('clears the progress notification when context-menu sorting fails', async () => {
    state.similarity.execute.mockRejectedValue(new Error('model failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('../src/background.js');

    await state.contextMenuListener(
      { menuItemId: 'sort-similarity-group' },
      { id: 7, index: 0, title: 'Example' }
    );

    expect(browser.notifications.clear).toHaveBeenCalledWith('similarity-sort-progress');
    errorSpy.mockRestore();
  });

  it('allows WebAssembly while keeping the extension CSP self-only', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

    expect(manifest.permissions).toContain('notifications');
    expect(manifest.content_security_policy.extension_pages)
      .toBe("script-src 'self' 'wasm-unsafe-eval'; object-src 'self';");
  });
});
