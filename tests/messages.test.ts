import { describe, expect, it } from 'vitest';
import { actionNotice, dawnNotice, resurrectNotice, shortTitle } from '../lib/messages';
import type { FailReason } from '../lib/tabs';

const ctx = { title: 'My page', site: 'example.com' };
const ok = (mb: number, changed = true) => ({ ok: true as const, changed, mb });

describe('actionNotice', () => {
  it('describes each success in plain words', () => {
    expect(actionNotice('stake', ok(120), ctx)).toEqual({ kind: 'ok', text: 'Closed "My page". About ~120 MB freed.' });
    expect(actionNotice('coffin', ok(120), ctx)).toEqual({ kind: 'ok', text: 'Put "My page" to sleep. About ~120 MB freed.' });
    expect(actionNotice('crypt', ok(120), ctx)).toEqual({ kind: 'ok', text: 'Saved "My page" to the Crypt and closed it.' });
    expect(actionNotice('garlic', ok(0), ctx).text).toBe('example.com is now protected.');
    expect(actionNotice('garlic', ok(0, false), ctx).text).toBe('example.com was already protected.');
    expect(actionNotice('ungarlic', ok(0), ctx).text).toBe('example.com is no longer protected.');
  });

  it('shows large memory in GB', () => {
    expect(actionNotice('stake', ok(1500), ctx).text).toContain('~1.5 GB');
  });

  it('maps every failure reason to a plain message', () => {
    const reasons: FailReason[] = ['no-tab', 'not-allowed', 'no-site', 'not-found', 'save-failed', 'browser-error'];
    const texts = reasons.map((reason) => {
      const n = actionNotice('stake', { ok: false, reason }, ctx);
      expect(n.kind).toBe('error');
      expect(n.text.length).toBeGreaterThan(10);
      return n.text;
    });
    expect(new Set(texts).size).toBe(reasons.length);
    expect(actionNotice('crypt', { ok: false, reason: 'save-failed' }, ctx).text).toBe(
      'Could not save to the Crypt, so nothing was closed.',
    );
  });

  it('falls back to the site, then a generic name, when the title is empty', () => {
    expect(actionNotice('stake', ok(10), { title: '  ', site: 'a.com' }).text).toContain('"a.com"');
    expect(actionNotice('stake', ok(10), { title: '', site: null }).text).toContain('"this tab"');
  });
});

describe('shortTitle', () => {
  it('cuts long titles at 40 characters with an ellipsis', () => {
    const long = 'x'.repeat(100);
    const t = shortTitle(long);
    expect(t).toHaveLength(40);
    expect(t.endsWith('…')).toBe(true);
    expect(shortTitle('short')).toBe('short');
  });
});

describe('dawnNotice', () => {
  it('uses plural and singular text', () => {
    expect(dawnNotice({ ok: true, closed: 4, mb: 480 }).text).toBe(
      'Dawn closed 4 tabs and saved them to the Crypt. About ~480 MB freed.',
    );
    expect(dawnNotice({ ok: true, closed: 1, mb: 120 }).text).toBe(
      'Dawn closed 1 tab and saved it to the Crypt. About ~120 MB freed.',
    );
  });
  it('says so when nothing was ready', () => {
    expect(dawnNotice({ ok: true, closed: 0, mb: 0 })).toEqual({ kind: 'ok', text: 'No tabs were ready to close.' });
  });
  it('says no tabs were closed on failure', () => {
    expect(dawnNotice({ ok: false, reason: 'save-failed' })).toEqual({
      kind: 'error',
      text: 'Could not save the tabs to the Crypt, so no tabs were closed.',
    });
    expect(dawnNotice({ ok: false, reason: 'browser-error' }).text).toContain('No tabs were closed');
  });
});

describe('resurrectNotice', () => {
  it('says what happened in plain words', () => {
    expect(resurrectNotice({ ok: true, changed: true, mb: 0 }, 'Old story')).toEqual({
      kind: 'ok',
      text: 'Reopened "Old story" from the Crypt.',
    });
    expect(resurrectNotice({ ok: false, reason: 'not-found' }, 'x').text).toBe('That page is no longer in the Crypt.');
    expect(resurrectNotice({ ok: false, reason: 'browser-error' }, 'x').text).toBe(
      'The browser could not open that page. It is still in the Crypt.',
    );
  });
});
