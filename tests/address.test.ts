import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addressOf } from '../lib/address';

describe('addressOf: the search box opens typed addresses and searches everything else', () => {
  it.each([
    ['example.com', 'https://example.com/'],
    ['docs.google.com/document/d/1', 'https://docs.google.com/document/d/1'],
    ['https://claude.ai/new', 'https://claude.ai/new'],
    ['HTTP://Example.com', 'http://example.com/'],
    ['localhost:3000', 'http://localhost:3000/'],
    ['192.168.0.1/admin', 'http://192.168.0.1/admin'],
    ['  github.com  ', 'https://github.com/'],
  ])('opens %s', (text, url) => {
    expect(addressOf(text)).toBe(url);
  });
  it.each(['', 'vampire tabs', 'hello', 'what is 2.5', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'chrome://settings', 'e.g', 'about:blank'])(
    'searches %j',
    (text) => {
      expect(addressOf(text)).toBeNull();
    },
  );
  it('only ever returns an http or https address', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const url = addressOf(text);
        if (url !== null) expect(/^https?:\/\//.test(url)).toBe(true);
      }),
    );
  });
  it('never opens text with a space inside it (outer spaces are trimmed)', () => {
    const word = fc.string({ minLength: 1 }).filter((s) => s.trim() === s && s !== '');
    fc.assert(fc.property(word, word, (a, b) => {
      expect(addressOf(`${a} ${b}`)).toBeNull();
    }));
  });
});
