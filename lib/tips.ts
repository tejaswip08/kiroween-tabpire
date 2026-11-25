// Every text of the rich hover tips: card action buttons, state chips, header buttons and the card hover quote.
// Pure: no DOM, no browser APIs, no clock. Memory always comes from the tab's own estimate (`formatMb`, with "~").
import { DAY_MS, formatMb, type DawnKeepReason, type TabInfo, type VampireState } from './hunger';

/** A rich tip: an UPPERCASE title, the vampire's line, a bullet list and an optional small note. */
export interface TipContent {
  title: string;
  /** The vampire's own voice, shown in quotes. */
  says?: string;
  points: string[];
  note?: string;
}

/** The one tab facts the tips need. */
export interface TipTab {
  /** Host without "www.", or null when the tab is not a web page. */
  site: string | null;
  mb: number;
  state: VampireState;
  info: Pick<TabInfo, 'active' | 'audible' | 'lastAccessed'>;
  /** Idle time in ms (0 while in use). */
  hungerMs: number;
}

export type TipAction = 'stake' | 'coffin' | 'crypt' | 'garlic' | 'ungarlic' | 'wake';

const WAIT = 'Please wait: another action is running.';
const host = (t: TipTab) => t.site ?? 'this site';

/** Which buttons a card shows, in order, for its state. */
export function cardActions(state: VampireState): TipAction[] {
  if (state === 'protected') return ['ungarlic'];
  if (state === 'asleep') return ['wake', 'stake'];
  return ['stake', 'coffin', 'crypt', 'garlic'];
}

/** The tip of one action button. `busy` replaces the points with a wait line. */
export function actionTip(action: TipAction, tab: TipTab, busy = false): TipContent {
  const tip = baseActionTip(action, tab);
  return busy ? { title: tip.title, points: [WAIT] } : tip;
}

function baseActionTip(action: TipAction, tab: TipTab): TipContent {
  const mb = formatMb(tab.mb);
  const h = host(tab);
  switch (action) {
    case 'stake':
      if (tab.state === 'asleep') {
        return {
          title: 'STAKE',
          says: 'Even in my sleep? You\u2019re ruthless.',
          points: ['Closes this tab for good.'],
          note: 'Not saved anywhere. Want it later? Wake it and use Crypt instead.',
        };
      }
      return {
        title: 'STAKE \u00b7 CLOSE FOR GOOD',
        says: 'A stake? Through my heart?! \u2026Fine. Take your blood back.',
        points: [`Closes this tab now and gives you back ${mb}.`],
        note: 'Not saved anywhere. Want to read it later? Use Crypt instead.',
      };
    case 'coffin':
      if (tab.info.active) {
        return {
          title: 'COFFIN \u00b7 PUT TO SLEEP',
          says: 'You\u2019re looking at me right now. I can\u2019t sleep while you watch.',
          points: ['Switch to another tab first, then come back here to coffin this one.'],
        };
      }
      return {
        title: 'COFFIN \u00b7 PUT TO SLEEP',
        says: 'Into my coffin\u2026 I\u2019ll sleep right here in your tab bar.',
        points: [`Frees ${mb} while it sleeps.`, 'The tab stays in your tab bar. Click it to wake it exactly where you left off.'],
      };
    case 'crypt':
      return {
        title: 'CRYPT \u00b7 SAVE FOR LATER',
        says: 'Seal me in the crypt? I\u2019ll rest there until you call me back.',
        points: tab.site
          ? [
              `Closes this tab and gives you back ${mb}.`,
              'Keeps its link and title safe in the Blood Bank \u2192 The crypt.',
              'Click Resurrect there any time to reopen the page.',
            ]
          : ['Only web pages can be saved to the crypt.'],
        note: 'Saves the link only, not your scroll position or anything you typed. In the middle of something? Use Coffin.',
      };
    case 'garlic':
      return {
        title: 'GARLIC \u00b7 PROTECT THIS SITE',
        says: `Garlic?! Ugh\u2026 fine, I\u2019ll leave ${h} alone. But I\u2019m still drinking.`,
        points: tab.site
          ? [
              `Protects every ${h} tab, now and in the future.`,
              'They never starve, and Dawn never burns them.',
              'Use it for sites you always keep open, like mail or chat.',
            ]
          : ['Only web pages can be protected.'],
        note: 'Garlic doesn\u2019t free memory: the tab stays open. Undo it here or in the Blood Bank.',
      };
    case 'ungarlic':
      return {
        title: 'REMOVE GARLIC',
        says: 'Finally, fresh air! I can feel my hunger coming back\u2026',
        points: [`Tabpire watches every ${h} tab again.`, 'They can starve and be burned by Dawn like any other tab.'],
      };
    case 'wake':
      return {
        title: 'WAKE',
        says: 'You called? I\u2019m awake\u2026 and thirsty.',
        points: ['Switches to this tab and loads the page again.', 'It starts using memory again once it\u2019s awake.'],
      };
  }
}

/** The accessible name of each button. */
export const ACTION_LABEL: Record<TipAction, string> = {
  stake: 'Stake',
  coffin: 'Coffin',
  crypt: 'Crypt',
  garlic: 'Garlic',
  ungarlic: 'Remove garlic',
  wake: 'Wake',
};

// ---------- state chips ----------

const CHIP_TITLE: Record<VampireState, string> = { awake: 'AWAKE', starving: 'STARVING', asleep: 'ASLEEP', protected: 'PROTECTED' };
const CHIP_HINT: Record<VampireState, string> = {
  awake:
    'Tabs you\u2019ve used in the last day, or that are open or playing sound right now. Dawn never touches them. Their hunger bar fills as the day goes by.',
  starving:
    'Tabs you haven\u2019t used for over a day that are still eating memory. The safest ones to slay. Dawn burns them all at once (each is saved to the crypt first).',
  asleep: 'Tabs you put in a coffin. They stay in your tab bar but use no memory until you click them.',
  protected: 'Sites you hung garlic on. They\u2019re never marked starving and Dawn never burns them, but they still use memory.',
};

/** The vampires' line on a state chip, for how many tabs are in that state. */
export function chipSays(state: VampireState, n: number): string {
  switch (state) {
    case 'awake':
      if (n === 0) return 'Nobody\u2019s awake\u2026 did you forget about all of us?';
      if (n === 1) return 'I\u2019m awake and well fed. You keep coming back for me.';
      return 'We\u2019re awake and well fed. You keep coming back for us.';
    case 'starving':
      if (n === 0) return 'None of us are starving\u2026 yet. Leave a tab alone for a day and see.';
      if (n === 1) return 'I\u2019m STARVING! Forgotten for days\u2026 and I\u2019m still drinking your memory.';
      return `We\u2019re STARVING! ${n} of us, forgotten for days\u2026 and we\u2019re still drinking your memory.`;
    case 'asleep':
      return n === 0 ? 'No one is sleeping. Coffin a tab to stop it drinking.' : 'Zzz\u2026 we\u2019re sleeping in our coffins. Not a drop of your memory.';
    case 'protected':
      return n === 0 ? 'No garlic hung yet. Protect sites you always keep open.' : 'Garlic everywhere\u2026 we can\u2019t be hunted. We\u2019re still sipping, though.';
  }
}

export function chipTip(state: VampireState, n: number): TipContent {
  return { title: CHIP_TITLE[state], says: chipSays(state, n), points: [CHIP_HINT[state]] };
}

// ---------- header ----------

/** The Dawn button's label. */
export const dawnLabel = (n: number): string => (n > 0 ? `Dawn \u00b7 burn ${n}` : 'Dawn');

const KEPT_WORDS: Record<DawnKeepReason, string> = {
  active: 'the tab you\u2019re on',
  pinned: 'pinned',
  'playing sound': 'playing sound',
  'garlic site': 'garlic site',
  'not a web page': 'not a web page',
};

export function dawnHeaderTip(n: number, mb: number, kept: readonly DawnKeepReason[] = [], busy = false): TipContent {
  const title = n > 0 ? `DAWN \u00b7 BURNS ${n} STARVING` : 'DAWN';
  if (busy) return { title, points: ['Dawn is running. Please wait.'] };
  const points =
    n > 0
      ? [`Closes every starving tab at once and frees ${formatMb(mb)}. Each one is saved to the crypt first, so you can bring it back.`]
      : ['Nothing is starving right now. Dawn closes tabs that have been idle for over a day.'];
  if (kept.length > 0) {
    const why = [...new Set(kept)].map((k) => KEPT_WORDS[k]).join(', ');
    points.push(kept.length === 1 ? `1 starving tab is kept safe (${why}).` : `${kept.length} starving tabs are kept safe (${why}).`);
  }
  return {
    title,
    says: n > 0 || kept.length > 0 ? 'When the sun rises, the starving ones burn. Even I can\u2019t save them.' : 'No one is starving. The sun can wait.',
    points,
    note: 'Never touches the tab you\u2019re on, tabs playing sound, pinned tabs or garlic sites.',
  };
}

export const BLOOD_BANK_TIP: TipContent = {
  title: 'BLOOD BANK',
  points: ['Your history: memory reclaimed, every action you\u2019ve taken, and the tabs saved in the crypt, which you can reopen any time.'],
};

export const THEMES_TIP: TipContent = {
  title: 'THEMES',
  points: ['Change how Tabpire looks: four themes.'],
};

/** Plain text of a tip, for places that need one string (an aria description, a test). */
export const tipText = (t: TipContent): string => [t.title, t.says && `\u201c${t.says}\u201d`, ...t.points, t.note].filter(Boolean).join(' ');

// ---------- the card hover quote ----------

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
/** An idle time in words: "40 minutes", "15 hours", "a day", "3 days". */
export function spokenIdle(ms: number): string {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (ms < HOUR) return plural(Math.max(1, Math.floor(ms / MINUTE)), 'minute');
  if (ms < DAY_MS) return plural(Math.floor(ms / HOUR), 'hour');
  if (ms < 2 * DAY_MS) return 'a day';
  return plural(Math.floor(ms / DAY_MS), 'day');
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the vampire says in the card's hover box. */
export function cardQuote(tab: TipTab): string {
  const mb = formatMb(tab.mb);
  switch (tab.state) {
    case 'starving':
      return `${capital(spokenIdle(tab.hungerMs))} without a visit\u2026 I\u2019m STARVING. And I\u2019m still drinking ${mb} of your memory while I wait.`;
    case 'asleep':
      return 'Zzz\u2026 I\u2019m asleep in my coffin. Not drinking a single drop. Wake me when you need me.';
    case 'protected':
      return `Garlic?! Keep it away from me. You can\u2019t hunt me now\u2026 but I\u2019m still sipping ${mb}.`;
    case 'awake':
    default:
      if (tab.info.audible) return 'I\u2019m playing for you right now. Don\u2019t you dare stake me mid-song.';
      if (tab.info.active) return `Mmm, you\u2019re using me right now. Every drop of ${mb} is worth it.`;
      if (tab.info.lastAccessed === undefined) return 'I don\u2019t remember when you last came. Come and say hello.';
      if (tab.hungerMs < MINUTE) return 'You visited me just now. I\u2019m well fed and behaving.';
      return `You visited me ${spokenIdle(tab.hungerMs)} ago. ${
        tab.hungerMs >= 6 * HOUR ? 'I\u2019m getting a little grey\u2026 visit me before tomorrow.' : 'I\u2019m still well fed.'
      }`;
  }
}

/** The memory row of the card's hover box. */
export const memoryRow = (tab: Pick<TipTab, 'state' | 'mb'>): string => (tab.state === 'asleep' ? '0 MB (asleep)' : formatMb(tab.mb));
