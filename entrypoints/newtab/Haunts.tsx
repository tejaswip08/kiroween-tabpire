import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { capabilities } from '../../lib/capabilities';
import { fnv1a32, siteOf } from '../../lib/hunger';
import { hauntLetter, removeHaunt } from '../../lib/haunts';
import { MAX_HAUNTS, type Haunt } from '../../lib/store';
import { AddPageForm } from './components/AddPageForm';
import { CloseIcon, PlusIcon } from './components/icons';
import { Tooltip } from './components/Tooltip';

const SAFE_ICON_URL = /^(https?:|data:image\/)/i;

/**
 * The places an icon is looked for, in the order they are tried:
 * 1. the icon of an open tab on that site (`tabIcon`),
 * 2. Chrome's own icon cache (the `_favicon` address of this extension, `chromeBase`),
 * 3. the site's own `/favicon.ico`,
 * 4. the DuckDuckGo icon service for the host name.
 * If every one fails, the page shows a letter. Pure: the caller passes what it knows.
 */
export function faviconSources(pageUrl: string, opts: { tabIcon?: string; chromeBase?: string } = {}): string[] {
  const list: string[] = [];
  if (opts.tabIcon && SAFE_ICON_URL.test(opts.tabIcon)) list.push(opts.tabIcon);
  if (!capabilities.remoteIcons) return list;
  if (opts.chromeBase?.startsWith('chrome-extension://')) {
    list.push(`${opts.chromeBase}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`);
  }
  let url: URL | null = null;
  try {
    url = new URL(pageUrl);
  } catch {
    url = null;
  }
  if (url && (url.protocol === 'http:' || url.protocol === 'https:')) {
    list.push(`${url.origin}/favicon.ico`);
    list.push(`https://icons.duckduckgo.com/ip3/${url.hostname}.ico`);
  }
  return [...new Set(list)];
}

/** The icon of Chrome's cache, or undefined when there is none (Firefox) or the browser cannot say. */
function chromeFaviconBase(): string | undefined {
  try {
    return browser.runtime.getURL('/_favicon/' as never);
  } catch {
    return undefined;
  }
}

/** Tries each source in turn, and shows the letter badge when all of them fail. */
function HauntIcon({ page, tabIcon }: { page: Haunt; tabIcon?: string }) {
  const sources = faviconSources(page.url, { tabIcon, chromeBase: chromeFaviconBase() });
  const key = sources.join('|');
  const [failed, setFailed] = useState({ key, count: 0 });
  // A new list of sources starts again from the first one.
  const tried = failed.key === key ? failed.count : 0;
  const src = sources[tried];
  const colour = (fnv1a32(siteOf(page.url) ?? page.url) % 6) + 1;
  return (
    <span className="site-icon" data-kind={src ? 'image' : 'letter'}>
      {src ? (
        <img
          key={src}
          src={src}
          width={16}
          height={16}
          alt=""
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed({ key, count: tried + 1 })}
        />
      ) : (
        <span className="site-letter" style={{ ['--badge' as string]: `var(--badge-${colour})` }}>
          {hauntLetter(page)}
        </span>
      )}
    </span>
  );
}

/** The haunts under the search box, with the "Add page" button last. `tabIcons` maps a site's origin to the icon of an open tab. */
export function Haunts({ pages, tabIcons = {} }: { pages: readonly Haunt[]; tabIcons?: Readonly<Record<string, string>> }) {
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const holder = useRef<HTMLLIElement>(null);
  const wasAdding = useRef(false);
  const full = pages.length >= MAX_HAUNTS;

  // Give focus back to the button when the form closes.
  useEffect(() => {
    if (wasAdding.current && !adding) addButton.current?.focus();
    wasAdding.current = adding;
  }, [adding]);

  // A click outside the form closes it.
  useEffect(() => {
    if (!adding) return undefined;
    const onDown = (e: MouseEvent) => {
      if (holder.current && !holder.current.contains(e.target as Node)) setAdding(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [adding]);

  return (
    <section className="haunts" aria-label="Pinned pages">
      <ul className="haunts-list" role="list">
        {pages.map((page) => (
          <li key={page.url} className="haunts-item">
            <a className="haunts-tile" href={page.url} referrerPolicy="no-referrer">
              <HauntIcon page={page} tabIcon={tabIcons[originOf(page.url)]} />
              <span className="haunts-title">{page.title}</span>
            </a>
            <Tooltip text="Remove this page from the list">
              {(describedBy) => (
                <button
                  type="button"
                  className="haunts-remove"
                  aria-label={`Remove ${page.title}`}
                  onClick={() => void removeHaunt(page.url)}
                  {...describedBy}
                >
                  <CloseIcon size={10} />
                </button>
              )}
            </Tooltip>
          </li>
        ))}

        <li className="haunts-add" ref={holder}>
          <Tooltip hidden={adding} text={full ? `You can add up to ${MAX_HAUNTS} pages. Remove one first.` : 'Add a page to this list'}>
            {(describedBy) => (
              <button
                ref={addButton}
                type="button"
                // With no pinned pages it is a round + button with its name under it, centred under the search box.
                className={pages.length === 0 ? 'add-page-btn add-page-round' : 'add-page-btn'}
                aria-disabled={full || undefined}
                aria-expanded={adding}
                aria-haspopup="dialog"
                onClick={() => {
                  if (!full) setAdding((a) => !a);
                }}
                {...describedBy}
              >
                <span className="add-page-plus">
                  <PlusIcon size={pages.length === 0 ? 18 : 16} />
                </span>
                <span className="add-page-label">Add page</span>
              </button>
            )}
          </Tooltip>
          {adding && !full && <AddPageForm onClose={() => setAdding(false)} />}
        </li>
      </ul>
    </section>
  );
}

/** The origin of an address, or "" when it is not one. */
export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}
