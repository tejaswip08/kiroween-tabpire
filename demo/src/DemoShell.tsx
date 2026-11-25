import { Component, useCallback, useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { App } from '../../entrypoints/newtab/App';
import { BloodBank } from '../../entrypoints/bloodbank/BloodBank';
import { DemoPopup } from './DemoPopup';
import { notify, subscribe } from './notice';
import { resetDemo } from './seed';
import { useRoute } from './route';
import type { Route } from './route';
import './demo.css';

export const BANNER_TEXT =
  'Demo: sample tabs, nothing leaves your browser. Install the extension for real tabs.';
export const ERROR_TEXT = 'This demo page failed. Reset the demo.';
const NOTICE_MS = 4000;

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <p className="demo-error" role="alert">{ERROR_TEXT}</p> : this.props.children;
  }
}

/** Shows the latest notice for 4 seconds. */
function DemoNotice() {
  const [text, setText] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribe((n) => {
      setText(n.text);
      clearTimeout(timer);
      timer = setTimeout(() => setText(''), NOTICE_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);
  return <div className="demo-notice" aria-live="polite">{text}</div>;
}

/** A plain link to a web page (a haunt tile) must not take the visitor away from the demo. */
function blockOutsideLink(e: MouseEvent<HTMLElement>) {
  const link = (e.target as Element).closest?.('a[href]');
  const href = link?.getAttribute('href') ?? '';
  if (!/^https?:/i.test(href)) return;
  e.preventDefault();
  let host = href;
  try {
    host = new URL(href).host || href;
  } catch {
    // keep the raw address
  }
  notify(`In the extension this opens ${host}.`);
}

const LINKS: { route: Route; label: string }[] = [
  { route: 'crypt', label: 'Crypt' },
  { route: 'bloodbank', label: 'Blood Bank' },
  { route: 'popup', label: 'Popup' },
];

/** Renders the page for a route. Exported for tests that need a throwing page. */
export function DemoShell({ pageFor }: { pageFor?: (route: Route) => ReactNode } = {}) {
  const route = useRoute();
  const [epoch, setEpoch] = useState(0);

  const reset = useCallback(() => {
    // Date.now() is read here, when the button is pressed.
    void resetDemo(Date.now()).then(() => setEpoch((e) => e + 1));
  }, []);

  const page =
    pageFor?.(route) ??
    (route === 'crypt' ? <App /> : route === 'bloodbank' ? <BloodBank /> : <DemoPopup />);

  return (
    <>
      <div className="demo-strip">
        <p className="demo-banner">{BANNER_TEXT}</p>
        <button type="button" className="demo-reset" onClick={reset}>Reset demo</button>
        <nav className="demo-nav" aria-label="Demo pages">
          {LINKS.map((l) => (
            <a key={l.route} href={`#/${l.route}`} aria-current={l.route === route ? 'page' : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <DemoNotice />
      </div>
      <div className="demo-frame" key={`${route}-${epoch}`} onClickCapture={blockOutsideLink}>
        <PageBoundary>{page}</PageBoundary>
      </div>
    </>
  );
}
