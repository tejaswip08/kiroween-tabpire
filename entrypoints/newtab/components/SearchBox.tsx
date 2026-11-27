import { useId, useState, type KeyboardEvent } from 'react';
import { KIND_LABEL, type Suggestion } from '../../../lib/suggest';
import { useSuggestions, type SuggestionSources } from '../hooks/useSuggestions';
import { SearchIcon } from './icons';

/**
 * Search box with suggestions (ARIA combobox).
 * Enter with no highlighted suggestion searches the typed text (the page opens it instead when it is an address).
 */
export function SearchBox({
  sources,
  onSearch,
  onChoose,
}: {
  sources: SuggestionSources;
  onSearch: (text: string) => void;
  onChoose: (suggestion: Suggestion) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useSuggestions(query, sources);
  const showList = open && suggestions.length > 0;

  const finish = () => {
    setQuery('');
    setOpen(false);
    setActive(-1);
  };

  const choose = (s: Suggestion) => {
    finish();
    onChoose(s);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const count = suggestions.length;
    switch (e.key) {
      case 'ArrowDown':
        if (count === 0) return;
        e.preventDefault();
        setOpen(true);
        setActive((a) => (a + 1) % count);
        break;
      case 'ArrowUp':
        if (count === 0) return;
        e.preventDefault();
        setOpen(true);
        setActive((a) => (a <= 0 ? count - 1 : a - 1));
        break;
      case 'Enter': {
        e.preventDefault();
        const picked = showList ? suggestions[active] : undefined;
        if (picked) choose(picked);
        else if (query.trim() !== '') {
          const text = query.trim();
          finish();
          onSearch(text);
        }
        break;
      }
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
    }
  };

  return (
    <div className="search" role="search">
      <label className="sr-only" htmlFor={`${id}-input`}>
        Search the web or type a URL
      </label>
      <div className="search-field">
        <SearchIcon size={22} className="search-icon" />
        <input
          id={`${id}-input`}
          className="search-input"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search the web or type a URL"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="search-hint" aria-hidden="true">
          Enter
        </kbd>
      </div>

      <ul
        id={listId}
        className="suggestions"
        role="listbox"
        aria-label="Suggestions"
        hidden={!showList}
        // Keep focus in the input while the pointer is used on the list.
        onMouseDown={(e) => e.preventDefault()}
      >
        {suggestions.map((s, i) => (
          <li
            key={s.id}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            className="suggestion"
            data-kind={s.kind}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(s)}
          >
            <span className="suggestion-kind">{KIND_LABEL[s.kind]}</span>
            <span className="suggestion-text">
              <span className="suggestion-label">{s.label}</span>
              {s.detail && <span className="suggestion-detail">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      <p className="sr-only" role="status">
        {showList ? `${suggestions.length} suggestions` : ''}
      </p>
    </div>
  );
}
