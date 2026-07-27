import { describe, expect, it } from 'vitest';
import { extractReaderMarkdownFromPage } from '../src/infrastructure/tabContentExtractor.js';

class TestElement {
  constructor(tagName, text = '', children = [], attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.ownText = text;
    this.children = children;
    this.attributes = attributes;
    this.parent = null;

    for (const child of children) {
      child.parent = this;
    }
  }

  get textContent() {
    return [this.ownText, ...this.children.map(child => child.textContent)].join(' ');
  }

  cloneNode() {
    return new TestElement(
      this.tagName,
      this.ownText,
      this.children.map(child => child.cloneNode(true)),
      { ...this.attributes }
    );
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(',').map(part => part.trim());
    const matches = [];

    function visit(element) {
      if (selectors.some(part => element.matches(part))) {
        matches.push(element);
      }

      for (const child of element.children) {
        visit(child);
      }
    }

    for (const child of this.children) {
      visit(child);
    }

    return matches;
  }

  matches(selector) {
    if (selector === '[role="main"]') return this.attributes.role === 'main';
    if (selector === '[aria-hidden="true"]') return this.attributes['aria-hidden'] === 'true';
    return this.tagName.toLowerCase() === selector;
  }
}

function withDocument(children, callback) {
  const body = new TestElement('body', '', children);
  const documentElement = new TestElement('html', '', [body]);
  const previousDocument = globalThis.document;
  globalThis.document = {
    body,
    documentElement,
    cloneNode: () => documentElement.cloneNode(true),
    querySelectorAll: selector => documentElement.querySelectorAll(selector)
  };

  try {
    return callback();
  } finally {
    globalThis.document = previousDocument;
  }
}

describe('extractReaderMarkdownFromPage', () => {
  it('turns likely main content into markdown and removes page chrome', () => {
    const markdown = withDocument([
      new TestElement('nav', 'Pricing Docs Account'),
      new TestElement('article', '', [
        new TestElement('h1', 'Vector databases in production'),
        new TestElement('p', 'Use embeddings to retrieve semantically related records.'),
        new TestElement('h2', 'Operational checks'),
        new TestElement('ul', '', [
          new TestElement('li', 'Measure recall on known examples.'),
          new TestElement('li', 'Track latency before rollout.')
        ])
      ]),
      new TestElement('footer', 'Cookie settings')
    ], () => extractReaderMarkdownFromPage());

    expect(markdown).toBe([
      '# Vector databases in production',
      'Use embeddings to retrieve semantically related records.',
      '## Operational checks',
      '- Measure recall on known examples.',
      '- Track latency before rollout.'
    ].join('\n\n'));
  });

  it('falls back to the densest content block when no article exists', () => {
    const markdown = withDocument([
      new TestElement('section', '', [
        new TestElement('h1', 'Menu'),
        new TestElement('p', 'Home Docs Blog')
      ]),
      new TestElement('div', '', [
        new TestElement('h1', 'Fixture modelling notes'),
        new TestElement('p', 'Team form, injuries, and market movement can all affect price.'),
        new TestElement('p', 'The useful signal is the reasoning, not the domain hosting it.')
      ])
    ], () => extractReaderMarkdownFromPage());

    expect(markdown).toContain('# Fixture modelling notes');
    expect(markdown).toContain('The useful signal is the reasoning');
    expect(markdown).not.toContain('Home Docs Blog');
  });
});
