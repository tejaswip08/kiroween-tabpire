import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { browser } from 'wxt/browser';
import { hostOf, type TabLike } from '../../lib/hunger';
import type { CryptEntry, Haunt } from '../../lib/store';
import { localSuggestions, suggestionLabel, webSuggestions, webSuggestionsFor, type Suggestion } from '../../lib/suggest';
import { searchWeb } from '../../lib/tabs';

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  tab: 'Switch to tab',
  page: 'Pinned page',
  crypt: 'In your crypt',
  web: '',
};

export function SearchBar({ tabs, pages, crypt }: { tabs: TabLike[]; pages: Haunt[]; crypt: CryptEntry[] }) {
  const [q, setQ] = useState('');
  const [web, setWeb] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  const local = localSuggestions(q, tabs, pages, crypt);
  // The typed query is always first, then Google completions — same as Google's box.
  const items = [...local, ...webSuggestionsFor(q, web)];
  const shown = open && items.length > 0;

  // Fetch web suggestions shortly after typing stops; cancel stale requests.
  useEffect(() => {
    if (!q.trim()) {
      setWeb([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      webSuggestions(q, ctrl.signal)
        .then((next) => {
          if (!ctrl.signal.aborted) setWeb(next);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => setActive(-1), [q]);

  function choose(s: Suggestion) {
    setOpen(false);
    if (s.kind === 'tab') {
      void browser.tabs.update(s.tabId, { active: true });
    } else if (s.kind === 'web') {
      setQ(s.text);
      void searchWeb(s.text);
    } else {
      location.assign(s.url);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!shown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const activeItem = active >= 0 ? items[active] : undefined;

  return (
    <>
      <motion.form
        ref={form}
        className={`search${shown ? ' search-open' : ''}`}
        role="search"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={(e) => {
          e.preventDefault();
          if (activeItem) choose(activeItem);
          else void searchWeb(q);
        }}
      >
        <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20 L16 16" />
        </svg>
        <input
          autoFocus
          type="search"
          value={activeItem?.kind === 'web' ? activeItem.text : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Search the web or type a URL"
          aria-label="Search the web or type a URL"
          role="combobox"
          aria-expanded={shown}
          aria-controls="search-suggestions"
          aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
          aria-autocomplete="list"
          spellCheck={false}
          autoComplete="off"
        />
        <kbd>Enter</kbd>
      </motion.form>
      {createPortal(
        <AnimatePresence>
          {shown && <SuggestionList anchor={form} query={q} items={items} active={active} onHover={setActive} onChoose={choose} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/** The dropdown, portalled above the 3D canvas and pinned under the search box. */
/** Google-style: the letters you typed stay plain, the suggested ending is bold. */
function highlightQuery(text: string, query: string) {
  const typed = query.trim();
  if (!typed || !text.toLowerCase().startsWith(typed.toLowerCase())) return text;
  const rest = text.slice(typed.length);
  if (!rest) return text;
  return (
    <>
      {text.slice(0, typed.length)}
      <span className="suggest-rest">{rest}</span>
    </>
  );
}

function SuggestionList({
  anchor,
  query,
  items,
  active,
  onHover,
  onChoose,
}: {
  anchor: React.RefObject<HTMLFormElement | null>;
  query: string;
  items: Suggestion[];
  active: number;
  onHover(i: number): void;
  onChoose(s: Suggestion): void;
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setBox({ left: r.left, top: r.bottom + 6, width: r.width });
    };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [anchor]);
  if (!box) return null;

  return (
    <motion.ul
      id="search-suggestions"
      role="listbox"
      className="suggestions"
      style={box}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
      transition={{ duration: 0.15 }}
    >
      {items.map((s, i) => (
        <li
          key={`${s.kind}-${s.kind === 'web' ? s.text : s.url}`}
          id={`suggestion-${i}`}
          role="option"
          aria-selected={i === active}
          className={`suggestion suggestion-${s.kind}${i === active ? ' active' : ''}`}
          onMouseEnter={() => onHover(i)}
          // mousedown, not click: fires before the input's blur closes the list
          onMouseDown={(e) => {
            e.preventDefault();
            onChoose(s);
          }}
        >
          <span className="suggestion-icon" aria-hidden="true">
            {s.kind === 'web' ? (
              <svg viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20 L16 16" />
              </svg>
            ) : 'icon' in s && s.icon && !s.icon.startsWith('chrome://') ? (
              <img src={s.icon} alt="" />
            ) : (
              <b>{suggestionLabel(s).charAt(0).toUpperCase()}</b>
            )}
          </span>
          <span className="suggestion-text">
            <span className="suggestion-title">
              {s.kind === 'web' ? highlightQuery(s.text, query) : suggestionLabel(s)}
            </span>
            {s.kind !== 'web' && <span className="suggestion-host">{hostOf(s.url)}</span>}
          </span>
          {KIND_LABEL[s.kind] && <span className={`suggestion-kind kind-${s.kind}`}>{KIND_LABEL[s.kind]}</span>}
        </li>
      ))}
    </motion.ul>
  );
}
