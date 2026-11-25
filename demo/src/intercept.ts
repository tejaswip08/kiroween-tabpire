// Turns navigation and search at the fake `browser` boundary into notices.
import { fake } from '../../lib/fakeBrowser';
import { notify } from './notice';

export type DemoRoute = 'crypt' | 'bloodbank';

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/**
 * Installs `fake.intercept` and `fake.onSearch`.
 * `navigate` changes the hash only, for the extension's own pages.
 */
export function installInterceptors(navigate: (route: DemoRoute) => void): void {
  fake.intercept = ({ kind, tabId, props }) => {
    const url = props.url;
    // Opening one of Tabpire's own pages (in a new tab or this one) switches the route.
    if (url !== undefined && url.startsWith(fake.extensionBase + 'newtab.html')) {
      navigate('crypt');
      return true;
    }
    if (url !== undefined && url.startsWith(fake.extensionBase + 'bloodbank.html')) {
      navigate('bloodbank');
      return true;
    }
    if (kind === 'create') {
      // A web URL needs a real new fake tab (Resurrect). Anything else is an outside link.
      if (url !== undefined && /^https?:/i.test(url)) return false;
      if (url !== undefined) notify(`In the extension this opens ${hostOf(url)}.`);
      return url !== undefined;
    }
    if (url !== undefined) {
      notify(`In the extension this opens ${hostOf(url)}.`);
      return true;
    }
    if (props.active === true) {
      const tab = tabId === undefined ? undefined : fake.tabs.get(tabId);
      if (tab?.discarded) {
        // Wake: the demo cannot switch tabs, so the sleeping tab wakes in place.
        fake.wakeTab(tab.id);
        notify(`In the extension this switches to ${tab.title || (tab.url ? hostOf(tab.url) : 'that tab')} and wakes it.`);
        return true;
      }
      notify(`In the extension this switches to ${tab?.title || (tab?.url ? hostOf(tab.url) : 'that tab')}.`);
      return true;
    }
    return false;
  };

  fake.onSearch = ({ text }) => {
    notify(`Searched for "${text}" (the extension uses your default search engine).`);
  };
}
