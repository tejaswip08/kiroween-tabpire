import { useState } from 'react';
import { fnv1a32 } from '../../../lib/hunger';

const SAFE_ICON_URL = /^(https?:|data:image\/)/i;

/** First letter or digit of the name, upper case. */
export function siteLetter(name: string): string {
  const m = name.match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}

/**
 * Site icon for a card. Shows the tab's own icon at its natural 16 px.
 * Falls back to a letter badge when the icon is missing, unsafe, or fails to load.
 */
export function SiteIcon({ faviconUrl, site }: { faviconUrl?: string; site: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const usable = faviconUrl !== undefined && SAFE_ICON_URL.test(faviconUrl) && failedUrl !== faviconUrl;
  const name = site ?? '';
  const colour = (fnv1a32(name) % 6) + 1;

  return (
    <span className="site-icon" data-kind={usable ? 'image' : 'letter'}>
      {usable ? (
        <img
          src={faviconUrl}
          width={16}
          height={16}
          alt=""
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(faviconUrl)}
        />
      ) : (
        <span className="site-letter" style={{ ['--badge' as string]: `var(--badge-${colour})` }}>
          {siteLetter(name)}
        </span>
      )}
    </span>
  );
}
