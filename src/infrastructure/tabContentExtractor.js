const DEFAULT_MAX_CHARS = 4000;

function extractReaderMarkdownFromPage(maxChars = DEFAULT_MAX_CHARS) {
  const chromeSelector = [
    'script',
    'style',
    'noscript',
    'svg',
    'canvas',
    'iframe',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    'button',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]'
  ].join(',');
  const contentSelector = 'article, main, [role="main"]';
  const markdownSelector = 'h1, h2, h3, p, li, blockquote, pre, code';

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function scoreElement(element) {
    const paragraphs = Array.from(element.querySelectorAll('p, li'));
    const textLength = normalizeText(element.textContent).length;
    return paragraphs.length * 120 + textLength;
  }

  function findMainContent(root) {
    const explicitCandidates = Array.from(root.querySelectorAll(contentSelector));
    if (explicitCandidates.length > 0) {
      return explicitCandidates.sort((a, b) => scoreElement(b) - scoreElement(a))[0];
    }

    const fallbackCandidates = Array.from(root.querySelectorAll('section, div'))
      .filter(element => normalizeText(element.textContent).length > 80);

    if (fallbackCandidates.length === 0) {
      return root.body || root.documentElement;
    }

    return fallbackCandidates.sort((a, b) => scoreElement(b) - scoreElement(a))[0];
  }

  function formatMarkdownElement(element) {
    const text = normalizeText(element.textContent);
    if (!text) return '';

    const tagName = element.tagName.toLowerCase();
    if (tagName === 'h1') return `# ${text}`;
    if (tagName === 'h2') return `## ${text}`;
    if (tagName === 'h3') return `### ${text}`;
    if (tagName === 'li') return `- ${text}`;
    if (tagName === 'blockquote') return `> ${text}`;
    if (tagName === 'pre' || tagName === 'code') return `\`\`\`\n${text}\n\`\`\``;
    return text;
  }

  const clone = document.cloneNode(true);
  for (const element of clone.querySelectorAll(chromeSelector)) {
    element.remove();
  }

  const main = findMainContent(clone);
  const blocks = [];
  let previous = '';

  for (const element of main.querySelectorAll(markdownSelector)) {
    const markdown = formatMarkdownElement(element);
    if (!markdown || markdown === previous) continue;

    blocks.push(markdown);
    previous = markdown;

    if (blocks.join('\n\n').length >= maxChars) break;
  }

  return blocks.join('\n\n').slice(0, maxChars).trim();
}

class TabContentExtractor {
  constructor(maxChars = DEFAULT_MAX_CHARS) {
    this.maxChars = maxChars;
  }

  async getTabMarkdown(tab) {
    if (!tab?.id || !browser.scripting?.executeScript) return '';

    try {
      const results = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractReaderMarkdownFromPage,
        args: [this.maxChars]
      });

      return results?.[0]?.result || '';
    } catch {
      return '';
    }
  }
}

export { TabContentExtractor, extractReaderMarkdownFromPage };
