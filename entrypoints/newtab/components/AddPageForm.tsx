import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { addHaunt, hauntProblemText } from '../../../lib/haunts';

/** Small form under the "Add page" button. Escape or Cancel closes it. */
export function AddPageForm({ onClose }: { onClose: () => void }) {
  const id = useId();
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => first.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (working) return;
    setWorking(true);
    try {
      const result = await addHaunt(address, name);
      if (result.ok) onClose();
      else setError(hauntProblemText(result.reason));
    } catch {
      setError('Could not save that page. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <form
      className="add-form"
      role="dialog"
      aria-label="Add a page"
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
    >
      <label className="add-field" htmlFor={`${id}-address`}>
        <span>Web address</span>
        <input
          ref={first}
          id={`${id}-address`}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="example.com"
          value={address}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setAddress(e.target.value);
            setError('');
          }}
        />
      </label>
      <label className="add-field" htmlFor={`${id}-name`}>
        <span>Name (optional)</span>
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="off"
          placeholder="Shown in the list"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <p id={`${id}-error`} className="form-error" role="alert">
        {error}
      </p>
      <div className="add-actions">
        <button type="submit" className="add-submit" disabled={working}>
          Add
        </button>
        <button type="button" className="add-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
