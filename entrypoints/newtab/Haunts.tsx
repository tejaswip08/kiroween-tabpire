import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { browser } from 'wxt/browser';
import { useTip } from '../../components/Tooltip';
import { hostOf } from '../../lib/hunger';
import { MAX_HAUNTS, removeHaunt, saveHaunt, type Haunt } from '../../lib/store';
import { asUrl } from '../../lib/tabs';

// Pinned pages: the user's shortcuts, like the tiles on a browser's own new-tab page.

/**
 * Icon sources to try in order, until one loads: the icon saved with the page (taken from an open
 * tab), the site's own /favicon.ico, then DuckDuckGo's icon service. If all fail, the tile shows a letter.
 */
function iconSources(haunt: Haunt): string[] {
  const host = hostOf(haunt.url);
  const list = [haunt.icon];
  if (host) {
    list.push(`${new URL(haunt.url).origin}/favicon.ico`, `https://icons.duckduckgo.com/ip3/${host}.ico`);
  }
  return list.filter((x): x is string => !!x && !x.startsWith('chrome://'));
}

/** Icon of an open tab on the same site, if there is one. */
async function iconFromOpenTabs(url: string): Promise<string | undefined> {
  const host = hostOf(url);
  const tabs = await browser.tabs.query({});
  return tabs.find((t) => t.favIconUrl && hostOf(t.url ?? '') === host)?.favIconUrl;
}

export function Haunts({ haunts }: { haunts: Haunt[] }) {
  const [editing, setEditing] = useState<Haunt | 'new' | null>(null);
  return (
    <>
      <ul className="haunts" aria-label="Your pages">
        <AnimatePresence initial={false}>
          {haunts.map((h) => (
            <HauntTile key={h.id} haunt={h} onEdit={() => setEditing(h)} />
          ))}
        </AnimatePresence>
        {haunts.length < MAX_HAUNTS && <AddTile onClick={() => setEditing('new')} />}
      </ul>
      {/* Portalled to <body> so it sits above the 3D canvas, outside the page's stacking context. */}
      {createPortal(
        <AnimatePresence>
          {editing && <HauntDialog haunt={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function HauntTile({ haunt, onEdit }: { haunt: Haunt; onEdit(): void }) {
  const sources = iconSources(haunt);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [haunt.url, haunt.icon]);
  const src = sources[attempt];
  const host = hostOf(haunt.url);
  const tip = useTip(
    <>
      <p className="tip-title">{haunt.title}</p>
      <p className="tip-host">{host}</p>
    </>,
    `haunt-${haunt.id}`,
  );
  return (
    <motion.li
      className="haunt"
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      <a href={haunt.url} className="haunt-link" {...tip}>
        <span className="haunt-icon">
          {src ? (
            <img
              key={src}
              src={src}
              alt=""
              referrerPolicy="no-referrer"
              // Some sites answer with a 1px placeholder instead of an error; treat that as missing too.
              onLoad={(e) => e.currentTarget.naturalWidth < 8 && setAttempt((a) => a + 1)}
              onError={() => setAttempt((a) => a + 1)}
            />
          ) : (
            <b>{(haunt.title || host || '?').charAt(0).toUpperCase()}</b>
          )}
        </span>
        <span className="haunt-name">{haunt.title}</span>
      </a>
      <span className="haunt-tools">
        <button type="button" aria-label={`Edit ${haunt.title}`} title="Edit" onClick={onEdit}>
          ✎
        </button>
        <button type="button" aria-label={`Remove ${haunt.title}`} title="Remove" onClick={() => removeHaunt(haunt.id)}>
          ✕
        </button>
      </span>
    </motion.li>
  );
}

function AddTile({ onClick }: { onClick(): void }) {
  const tip = useTip(
    <>
      <p className="tip-title">Add a page</p>
      <p>Pin a page you visit often, like a bookmark. It opens in one click from every new tab.</p>
    </>,
    'haunt-add',
  );
  return (
    <li className="haunt">
      <button type="button" className="haunt-link haunt-add" onClick={onClick} {...tip}>
        <span className="haunt-icon">+</span>
        <span className="haunt-name">Add page</span>
      </button>
    </li>
  );
}

function HauntDialog({ haunt, onClose }: { haunt: Haunt | null; onClose(): void }) {
  const [title, setTitle] = useState(haunt?.title ?? '');
  const [url, setUrl] = useState(haunt?.url ?? '');
  const [error, setError] = useState('');
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const full = asUrl(url);
    if (!full) {
      setError('Enter a web address, like github.com');
      return;
    }
    const icon = await iconFromOpenTabs(full);
    await saveHaunt({ id: haunt?.id, title: title.trim() || hostOf(full) || full, url: full, icon });
    onClose();
  }

  return (
    <motion.div
      className="dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="haunt-dialog-title"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onSubmit={submit}
      >
        <h2 id="haunt-dialog-title">{haunt ? 'Edit page' : 'Add a page'}</h2>
        <label>
          <span>Name</span>
          <input ref={first} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gmail" maxLength={40} />
        </label>
        <label>
          <span>Web address</span>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            placeholder="mail.google.com"
            aria-invalid={!!error}
            aria-describedby={error ? 'haunt-url-error' : undefined}
          />
        </label>
        {error && (
          <p className="dialog-error" id="haunt-url-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {haunt ? 'Save' : 'Add'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
