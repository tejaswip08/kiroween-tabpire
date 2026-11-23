// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionButton } from '../../entrypoints/newtab/components/ActionButton';
import { StakeIcon } from '../../entrypoints/newtab/components/icons';
import { SiteIcon, siteLetter } from '../../entrypoints/newtab/components/SiteIcon';
import { HungerBar } from '../../entrypoints/newtab/components/HungerBar';

afterEach(cleanup);

describe('ActionButton and Tooltip', () => {
  const setup = (over: Partial<Parameters<typeof ActionButton>[0]> = {}) => {
    const onClick = vi.fn();
    render(<ActionButton label="Stake" tip="Stake: close this tab" icon={<StakeIcon />} onClick={onClick} {...over} />);
    return { onClick, button: screen.getByRole('button', { name: 'Stake' }) };
  };

  it('has an accessible name and the tooltip as its description', () => {
    const { button } = setup();
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Stake: close this tab');
    expect(button.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('runs onClick when enabled', async () => {
    const { onClick, button } = setup();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks when disabled but stays focusable, with the reason as its tooltip', async () => {
    const { onClick, button } = setup({ disabled: true, tip: 'Stake: this tab is gone' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('tooltip').textContent).toBe('Stake: this tab is gone');
  });

  it('hides the tooltip on Escape and shows it again after the pointer leaves', async () => {
    const { button } = setup();
    const wrap = button.closest('.tip-wrap')!;
    button.focus();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(wrap.hasAttribute('data-dismissed')).toBe(true);
    fireEvent.mouseLeave(wrap);
    expect(wrap.hasAttribute('data-dismissed')).toBe(false);
  });

  it('shows an optional note under the tooltip text', () => {
    setup({ note: 'The full page title' });
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('.tip-text')?.textContent).toBe('Stake: close this tab');
    expect(tip.querySelector('.tip-note')?.textContent).toBe('The full page title');
  });

  it('has no note line by default', () => {
    setup();
    expect(screen.getByRole('tooltip').querySelector('.tip-note')).toBeNull();
  });

  it('hides icons from screen readers', () => {
    setup();
    expect(document.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('tooltip styles', () => {
  const css = readFileSync(join(process.cwd(), 'entrypoints/newtab/styles/controls.css'), 'utf8');
  it('shows on hover and on keyboard focus only', () => {
    expect(css).toContain('.tip-wrap:hover:not([data-dismissed]) .tip');
    expect(css).toContain(':has(:focus-visible)');
  });
});

describe('SiteIcon', () => {
  it('shows the tab icon at 16 px with no referrer', () => {
    render(<SiteIcon faviconUrl="https://example.com/favicon.ico" site="example.com" />);
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.com/favicon.ico');
    expect(img.getAttribute('width')).toBe('16');
    expect(img.getAttribute('height')).toBe('16');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(document.querySelector('.site-letter')).toBeNull();
  });

  it('accepts embedded image data', () => {
    render(<SiteIcon faviconUrl="data:image/png;base64,AAAA" site="example.com" />);
    expect(document.querySelector('img')).not.toBeNull();
  });

  it('shows a letter badge when there is no icon', () => {
    render(<SiteIcon site="github.com" />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('G')).toBeTruthy();
  });

  it.each(['javascript:alert(1)', 'chrome://favicon/x', 'file:///x.png', ''])(
    'does not use %s as an image address',
    (url) => {
      render(<SiteIcon faviconUrl={url} site="a.com" />);
      expect(document.querySelector('img')).toBeNull();
      expect(screen.getByText('A')).toBeTruthy();
      cleanup();
    },
  );

  it('switches to the letter badge when the image fails, with no broken image left', () => {
    render(<SiteIcon faviconUrl="https://example.com/x.ico" site="example.com" />);
    fireEvent.error(document.querySelector('img')!);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('E')).toBeTruthy();
  });

  it('tries a new icon address after a failure', () => {
    const { rerender } = render(<SiteIcon faviconUrl="https://example.com/a.ico" site="example.com" />);
    fireEvent.error(document.querySelector('img')!);
    rerender(<SiteIcon faviconUrl="https://example.com/b.ico" site="example.com" />);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://example.com/b.ico');
  });

  it('shows ? for a tab without a site', () => {
    render(<SiteIcon site={null} />);
    expect(screen.getByText('?')).toBeTruthy();
    expect(siteLetter('')).toBe('?');
    expect(siteLetter('9lives.com')).toBe('9');
  });

  it('gives the same site the same badge colour', () => {
    const colour = () => (document.querySelector('.site-letter') as HTMLElement).style.getPropertyValue('--badge');
    render(<SiteIcon site="same.com" />);
    const first = colour();
    cleanup();
    render(<SiteIcon site="same.com" />);
    expect(colour()).toBe(first);
    expect(first).toMatch(/^var\(--badge-[1-6]\)$/);
  });
});

describe('HungerBar', () => {
  it('has a text alternative', () => {
    render(<HungerBar fill={0.5} label="Hunger meter: 3 days idle" />);
    expect(screen.getByRole('img', { name: 'Hunger meter: 3 days idle' })).toBeTruthy();
  });
  it('scales the fill with a transform', () => {
    render(<HungerBar fill={0.4} label="x" />);
    expect((document.querySelector('.hunger-fill') as HTMLElement).style.transform).toBe('scaleX(0.4)');
  });
  it('keeps the fill between 0 and 1', () => {
    const { rerender } = render(<HungerBar fill={5} label="x" />);
    expect((document.querySelector('.hunger-fill') as HTMLElement).style.transform).toBe('scaleX(1)');
    rerender(<HungerBar fill={-2} label="x" />);
    expect((document.querySelector('.hunger-fill') as HTMLElement).style.transform).toBe('scaleX(0)');
  });
});
