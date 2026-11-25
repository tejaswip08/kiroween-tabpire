// Every text of the rich tips (lib/tips.ts), exactly as in the prototype, with each tab's own ~MB and host.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DAY_MS, type VampireState } from '../lib/hunger';
import {
  ACTION_LABEL, BLOOD_BANK_TIP, actionTip, cardActions, cardQuote, chipSays, chipTip, dawnHeaderTip, dawnLabel, memoryRow, tipText, type TipTab,
} from '../lib/tips';

const H = 3600_000;
const tab = (over: Partial<TipTab> = {}): TipTab => ({
  site: 'chatgpt.com',
  mb: 520,
  state: 'starving',
  info: { active: false, audible: false, lastAccessed: 1 },
  hungerMs: 3 * DAY_MS,
  ...over,
});

describe('which buttons a card has', () => {
  it('four for awake and starving, one for protected, two for asleep', () => {
    expect(cardActions('awake')).toEqual(['stake', 'coffin', 'crypt', 'garlic']);
    expect(cardActions('starving')).toEqual(['stake', 'coffin', 'crypt', 'garlic']);
    expect(cardActions('protected')).toEqual(['ungarlic']);
    expect(cardActions('asleep')).toEqual(['wake', 'stake']);
    expect(ACTION_LABEL.ungarlic).toBe('Remove garlic');
  });
});

describe('action tips', () => {
  it('Stake', () => {
    expect(actionTip('stake', tab())).toEqual({
      title: 'STAKE · CLOSE FOR GOOD',
      says: 'A stake? Through my heart?! …Fine. Take your blood back.',
      points: ['Closes this tab now and gives you back ~520 MB.'],
      note: 'Not saved anywhere. Want to read it later? Use Crypt instead.',
    });
  });
  it('Coffin, and the active tab that cannot sleep', () => {
    expect(actionTip('coffin', tab({ mb: 450 }))).toEqual({
      title: 'COFFIN · PUT TO SLEEP',
      says: 'Into my coffin… I’ll sleep right here in your tab bar.',
      points: ['Frees ~450 MB while it sleeps.', 'The tab stays in your tab bar. Click it to wake it exactly where you left off.'],
    });
    expect(actionTip('coffin', tab({ state: 'awake', info: { active: true, audible: false, lastAccessed: 1 } }))).toEqual({
      title: 'COFFIN · PUT TO SLEEP',
      says: 'You’re looking at me right now. I can’t sleep while you watch.',
      points: ['Switch to another tab first, then come back here to coffin this one.'],
    });
  });
  it('Crypt', () => {
    expect(actionTip('crypt', tab())).toEqual({
      title: 'CRYPT · SAVE FOR LATER',
      says: 'Seal me in the crypt? I’ll rest there until you call me back.',
      points: [
        'Closes this tab and gives you back ~520 MB.',
        'Keeps its link and title safe in the Blood Bank → The crypt.',
        'Click Resurrect there any time to reopen the page.',
      ],
      note: 'Saves the link only, not your scroll position or anything you typed. In the middle of something? Use Coffin.',
    });
  });
  it('Garlic uses the host', () => {
    expect(actionTip('garlic', tab({ site: 'mail.google.com' }))).toEqual({
      title: 'GARLIC · PROTECT THIS SITE',
      says: 'Garlic?! Ugh… fine, I’ll leave mail.google.com alone. But I’m still drinking.',
      points: [
        'Protects every mail.google.com tab, now and in the future.',
        'They never starve, and Dawn never burns them.',
        'Use it for sites you always keep open, like mail or chat.',
      ],
      note: 'Garlic doesn’t free memory: the tab stays open. Undo it here or in the Blood Bank.',
    });
  });
  it('Remove garlic on a protected tab', () => {
    expect(actionTip('ungarlic', tab({ state: 'protected', site: 'claude.ai' }))).toEqual({
      title: 'REMOVE GARLIC',
      says: 'Finally, fresh air! I can feel my hunger coming back…',
      points: ['Tabpire watches every claude.ai tab again.', 'They can starve and be burned by Dawn like any other tab.'],
    });
  });
  it('Wake and Stake on an asleep tab', () => {
    const asleep = tab({ state: 'asleep', mb: 0 });
    expect(actionTip('wake', asleep)).toEqual({
      title: 'WAKE',
      says: 'You called? I’m awake… and thirsty.',
      points: ['Switches to this tab and loads the page again.', 'It starts using memory again once it’s awake.'],
    });
    expect(actionTip('stake', asleep)).toEqual({
      title: 'STAKE',
      says: 'Even in my sleep? You’re ruthless.',
      points: ['Closes this tab for good.'],
      note: 'Not saved anywhere. Want it later? Wake it and use Crypt instead.',
    });
  });
  it('a busy card keeps the title and says to wait', () => {
    expect(actionTip('stake', tab(), true)).toEqual({ title: 'STAKE · CLOSE FOR GOOD', points: ['Please wait: another action is running.'] });
  });
  it('always uses the tab’s own memory, with one "~"', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), (mb) => {
        for (const a of ['stake', 'crypt'] as const) {
          const text = tipText(actionTip(a, tab({ mb })));
          expect(text).toContain(`~${mb} MB`);
          expect(text.match(/~/g)).toHaveLength(1);
        }
      }),
    );
  });
});

describe('state chip tips', () => {
  it('Awake for many, one and none', () => {
    expect(chipSays('awake', 3)).toBe('We’re awake and well fed. You keep coming back for us.');
    expect(chipSays('awake', 1)).toBe('I’m awake and well fed. You keep coming back for me.');
    expect(chipSays('awake', 0)).toBe('Nobody’s awake… did you forget about all of us?');
    expect(chipTip('awake', 2).points).toEqual([
      'Tabs you’ve used in the last day, or that are open or playing sound right now. Dawn never touches them. Their hunger bar fills as the day goes by.',
    ]);
  });
  it('Starving counts the vampires', () => {
    expect(chipSays('starving', 4)).toBe('We’re STARVING! 4 of us, forgotten for days… and we’re still drinking your memory.');
    expect(chipSays('starving', 0)).toBe('None of us are starving… yet. Leave a tab alone for a day and see.');
    expect(chipTip('starving', 4).points[0]).toBe(
      'Tabs you haven’t used for over a day that are still eating memory. The safest ones to slay. Dawn burns them all at once (each is saved to the crypt first).',
    );
  });
  it('Asleep and Protected', () => {
    expect(chipSays('asleep', 2)).toBe('Zzz… we’re sleeping in our coffins. Not a drop of your memory.');
    expect(chipSays('asleep', 0)).toBe('No one is sleeping. Coffin a tab to stop it drinking.');
    expect(chipSays('protected', 1)).toBe('Garlic everywhere… we can’t be hunted. We’re still sipping, though.');
    expect(chipSays('protected', 0)).toBe('No garlic hung yet. Protect sites you always keep open.');
    expect(chipTip('asleep', 1).points[0]).toBe('Tabs you put in a coffin. They stay in your tab bar but use no memory until you click them.');
    expect(chipTip('protected', 1).points[0]).toBe(
      'Sites you hung garlic on. They’re never marked starving and Dawn never burns them, but they still use memory.',
    );
  });
  it('the title is the state name', () => {
    for (const s of ['awake', 'starving', 'asleep', 'protected'] as VampireState[]) expect(chipTip(s, 1).title).toBe(s.toUpperCase());
  });
});

describe('header tips', () => {
  it('Dawn with starving tabs', () => {
    expect(dawnLabel(3)).toBe('Dawn · burn 3');
    expect(dawnLabel(0)).toBe('Dawn');
    expect(dawnHeaderTip(3, 1250)).toEqual({
      title: 'DAWN · BURNS 3 STARVING',
      says: 'When the sun rises, the starving ones burn. Even I can’t save them.',
      points: ['Closes every starving tab at once and frees ~1.3 GB. Each one is saved to the crypt first, so you can bring it back.'],
      note: 'Never touches the tab you’re on, tabs playing sound, pinned tabs or garlic sites.',
    });
  });
  it('Dawn with none, and with a starving tab kept safe', () => {
    expect(dawnHeaderTip(0, 0)).toEqual({
      title: 'DAWN',
      says: 'No one is starving. The sun can wait.',
      points: ['Nothing is starving right now. Dawn closes tabs that have been idle for over a day.'],
      note: 'Never touches the tab you’re on, tabs playing sound, pinned tabs or garlic sites.',
    });
    expect(dawnHeaderTip(0, 0, ['pinned']).points).toContain('1 starving tab is kept safe (pinned).');
    expect(dawnHeaderTip(2, 300, ['pinned', 'not a web page']).points).toContain('2 starving tabs are kept safe (pinned, not a web page).');
  });
  it('Blood Bank', () => {
    expect(BLOOD_BANK_TIP.points).toEqual([
      'Your history: memory reclaimed, every action you’ve taken, and the tabs saved in the crypt, which you can reopen any time.',
    ]);
  });
});

describe('card hover quote', () => {
  it('starving', () => {
    expect(cardQuote(tab())).toBe('3 days without a visit… I’m STARVING. And I’m still drinking ~520 MB of your memory while I wait.');
    expect(cardQuote(tab({ hungerMs: DAY_MS + H }))).toMatch(/^A day without a visit…/);
  });
  it('active, playing sound and awake', () => {
    expect(cardQuote(tab({ state: 'awake', hungerMs: 0, info: { active: true, audible: false, lastAccessed: 1 } }))).toBe(
      'Mmm, you’re using me right now. Every drop of ~520 MB is worth it.',
    );
    expect(cardQuote(tab({ state: 'awake', hungerMs: 0, info: { active: false, audible: true, lastAccessed: 1 } }))).toBe(
      'I’m playing for you right now. Don’t you dare stake me mid-song.',
    );
    expect(cardQuote(tab({ state: 'awake', hungerMs: 20_000 }))).toBe('You visited me just now. I’m well fed and behaving.');
    expect(cardQuote(tab({ state: 'awake', hungerMs: 2 * H }))).toBe('You visited me 2 hours ago. I’m still well fed.');
    expect(cardQuote(tab({ state: 'awake', hungerMs: 7 * H }))).toBe('You visited me 7 hours ago. I’m getting a little grey… visit me before tomorrow.');
  });
  it('asleep and protected, and the memory row', () => {
    expect(cardQuote(tab({ state: 'asleep' }))).toBe('Zzz… I’m asleep in my coffin. Not drinking a single drop. Wake me when you need me.');
    expect(cardQuote(tab({ state: 'protected', mb: 300 }))).toBe('Garlic?! Keep it away from me. You can’t hunt me now… but I’m still sipping ~300 MB.');
    expect(memoryRow({ state: 'asleep', mb: 0 })).toBe('0 MB (asleep)');
    expect(memoryRow({ state: 'awake', mb: 120 })).toBe('~120 MB');
  });
});
