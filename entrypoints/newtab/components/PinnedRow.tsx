import { useEffect, useRef, useState } from 'react';
import { fnv1a32 } from '../../../lib/hunger';
import { MAX_PINNED, pinnedLetter, unpinPage } from '../../../lib/pinned';
import type { PinnedPage } from '../../../lib/store';
import { siteOf } from '../../../lib/hunger';
import { AddPageForm } from './AddPageForm';
import { CloseIcon, PlusIcon } from './icons';
import { Tooltip } from './Tooltip';

function Letter({ page }: { page: PinnedPage }) {
  const colour = (fnv1a32(siteOf(page.url) ?? page.url) % 6) + 1;
  return (
    <span className="site-icon">
      <span className="site-letter" style={{ ['--badge' as string]: `var(--badge-${colour})` }}>
        {pinnedLetter(page)}
      </span>
    </span>
  );
}

/** Pinned pages under the search box, with the "Add page" button last. */
export function PinnedRow({ pages }: { pages: readonly PinnedPage[] }) {
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const holder = useRef<HTMLLIElement>(null);
  const wasAdding = useRef(false);
  const full = pages.length >= MAX_PINNED;

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
    <section className="pinned" aria-label="Pinned pages">
      <ul className="pinned-list" role="list">
        {pages.map((page) => (
          <li key={page.url} className="pinned-item">
            <a className="pinned-tile" href={page.url} referrerPolicy="no-referrer">
              <Letter page={page} />
              <span className="pinned-title">{page.title}</span>
            </a>
            <Tooltip text="Remove this page from the list">
              {(describedBy) => (
                <button
                  type="button"
                  className="pinned-remove"
                  aria-label={`Remove ${page.title}`}
                  onClick={() => void unpinPage(page.url)}
                  {...describedBy}
                >
                  <CloseIcon size={10} />
                </button>
              )}
            </Tooltip>
          </li>
        ))}

        <li className="pinned-add" ref={holder}>
          <Tooltip hidden={adding} text={full ? `You can add up to ${MAX_PINNED} pages. Remove one first.` : 'Add a page to this list'}>
            {(describedBy) => (
              <button
                ref={addButton}
                type="button"
                className="add-page-btn"
                aria-disabled={full || undefined}
                aria-expanded={adding}
                aria-haspopup="dialog"
                onClick={() => {
                  if (!full) setAdding((a) => !a);
                }}
                {...describedBy}
              >
                <PlusIcon size={16} />
                Add page
              </button>
            )}
          </Tooltip>
          {adding && !full && <AddPageForm onClose={() => setAdding(false)} />}
        </li>
      </ul>
    </section>
  );
}
