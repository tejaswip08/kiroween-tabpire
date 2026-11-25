// Plain-word messages for action results. No browser APIs.
import type { ActionResult, DawnResult, FailReason } from './tabs';
import { formatMb } from './hunger';

export type Notice = { kind: 'ok' | 'error'; text: string };
export type ActionName = 'stake' | 'coffin' | 'crypt' | 'garlic' | 'ungarlic' | 'wake';

const MAX_TITLE = 40;

export function shortTitle(title: string): string {
  const t = title.trim();
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1).trimEnd()}…` : t;
}

const FAIL_TEXT: Record<FailReason, string> = {
  'no-tab': 'That tab is already gone.',
  'not-allowed': 'A tab that is in use cannot be put to sleep.',
  'no-site': 'This page has no site, so it cannot be saved or protected.',
  'not-found': 'That site is not protected.',
  'save-failed': 'Could not save to the Crypt, so nothing was closed.',
  'browser-error': 'The browser would not do that. Nothing was changed.',
};

export function actionNotice(
  action: ActionName,
  result: ActionResult,
  ctx: { title: string; site: string | null },
): Notice {
  if (!result.ok) return { kind: 'error', text: FAIL_TEXT[result.reason] };

  const name = shortTitle(ctx.title) || ctx.site || 'this tab';
  const site = ctx.site ?? 'this site';
  const mb = formatMb(result.mb);
  switch (action) {
    case 'stake':
      return { kind: 'ok', text: `Staked ${name} \u00b7 ${mb} reclaimed` };
    case 'coffin':
      return { kind: 'ok', text: `${name} sleeps in its coffin \u00b7 ${mb} freed` };
    case 'crypt':
      return { kind: 'ok', text: `Sealed ${name} in the crypt \u00b7 ${mb} reclaimed` };
    case 'garlic':
      return { kind: 'ok', text: `Garlic hung on ${site}. It will never be flagged.` };
    case 'ungarlic':
      return { kind: 'ok', text: `Garlic removed from ${site}` };
    case 'wake':
      return { kind: 'ok', text: `${name} is awake` };
  }
}
export function dawnNotice(result: DawnResult): Notice {
  if (!result.ok) {
    return {
      kind: 'error',
      text:
        result.reason === 'save-failed'
          ? 'Could not save the tabs to the Crypt, so no tabs were closed.'
          : 'Dawn could not run. No tabs were closed.',
    };
  }
  if (result.closed === 0) return { kind: 'ok', text: 'No tabs were ready to close.' };
  const what = result.closed === 1 ? '1 vampire' : `${result.closed} vampires`;
  return { kind: 'ok', text: `Dawn burned ${what} \u00b7 ${formatMb(result.mb)} reclaimed. They rest in the crypt.` };
}

/** Message for choosing a Crypt item in the search box. */
export function resurrectNotice(result: ActionResult, title: string): Notice {
  if (result.ok) return { kind: 'ok', text: `Reopened "${shortTitle(title) || 'that page'}" from the Crypt.` };
  return {
    kind: 'error',
    text:
      result.reason === 'not-found'
        ? 'That page is no longer in the Crypt.'
        : 'The browser could not open that page. It is still in the Crypt.',
  };
}
