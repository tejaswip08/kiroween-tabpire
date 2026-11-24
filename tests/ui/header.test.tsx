// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/tabs', () => ({ openBloodBank: vi.fn(async () => {}) }));
import { openBloodBank } from '../../lib/tabs';
import { Header } from '../../entrypoints/newtab/components/Header';

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof Header>[0]> = {}) => {
  const onDawn = vi.fn();
  render(
    <Header vampires={12} starving={0} staked={1} coffined={2} estimatedMb={1460} reclaimedMb={245} dawnCount={3} dawnBusy={false} onDawn={onDawn} themeId="crypt" onTheme={vi.fn()} {...over} />,
  );
  return { onDawn };
};

describe('header stats panel', () => {
  it('shows three columns, with an "est." tag on the two memory figures', () => {
    setup();
    const panel = screen.getByRole('region', { name: 'Browser stats' });
    expect(within(panel).getByText('Vampires').closest('div')?.textContent).toContain('12');
    expect(within(panel).getByText('Draining now').closest('div')?.textContent).toContain('~1.5 GB');
    expect(within(panel).getByText('Blood reclaimed').closest('div')?.textContent).toContain('~245 MB');
    const tags = within(panel).getAllByText('est.');
    expect(tags).toHaveLength(2);
    expect(tags[0]?.getAttribute('title')).toBe('Estimated');
    expect(within(panel).getByText('none starving')).toBeTruthy();
    expect(within(panel).getByText('by your open tabs')).toBeTruthy();
    expect(within(panel).getByText('1 slain · 2 coffined')).toBeTruthy();
  });
  it('says how many are starving, and fills the bar against 4 GB', () => {
    setup({ starving: 3, estimatedMb: 1000 });
    const panel = screen.getByRole('region', { name: 'Browser stats' });
    expect(within(panel).getByText('3 starving')).toBeTruthy();
    expect((panel.querySelector('.stat-bar-fill') as HTMLElement).style.transform).toBe('scaleX(0.25)');
    cleanup();
    setup({ estimatedMb: 9000 });
    expect((document.querySelector('.stat-bar-fill') as HTMLElement).style.transform).toBe('scaleX(1)');
  });

  it('shows memory with "~" even at zero', () => {
    setup({ estimatedMb: 0, reclaimedMb: 0, vampires: 0 });
    expect(screen.getAllByText('~0 MB')).toHaveLength(2);
  });

  it('has the brand', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Tabpire' })).toBeTruthy();
  });
});

describe('header buttons', () => {
  it('enables Themes, with a tooltip, and a click opens the themes dialog', async () => {
    setup();
    const btn = screen.getByRole('button', { name: 'Themes' });
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const tip = document.getElementById(btn.getAttribute('aria-describedby')!)!;
    expect(tip.textContent).toBe('Change how Tabpire looks: six themes.');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Themes' })).toBeTruthy();
  });
  it('opens the Blood Bank page in a new tab', async () => {
    setup();
    const btn = screen.getByRole('button', { name: 'Blood Bank' });
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    await userEvent.click(btn);
    expect(openBloodBank).toHaveBeenCalledTimes(1);
  });

  it('shows the Dawn count and runs Dawn when clicked', async () => {
    const { onDawn } = setup({ dawnCount: 3 });
    const btn = screen.getByRole('button', { name: /Dawn/ });
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    expect(within(btn).getByLabelText('3 ready').textContent).toBe('3');
    const tip = document.getElementById(btn.getAttribute('aria-describedby')!)!;
    expect(tip.textContent).toBe('Dawn: close 3 starving tabs and save them to the Crypt.');
    await userEvent.click(btn);
    expect(onDawn).toHaveBeenCalledTimes(1);
  });

  it('uses singular text for one tab', () => {
    setup({ dawnCount: 1 });
    const btn = screen.getByRole('button', { name: /Dawn/ });
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Dawn: close 1 starving tab and save it to the Crypt.',
    );
  });

  it('disables Dawn at zero, with the reason, and ignores clicks', async () => {
    const { onDawn } = setup({ dawnCount: 0 });
    const btn = screen.getByRole('button', { name: 'Dawn' });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Dawn: no starving tabs to close right now.',
    );
    await userEvent.click(btn);
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onDawn).not.toHaveBeenCalled();
    expect(within(btn).queryByLabelText(/ready/)).toBeNull();
  });

  it('disables Dawn while it runs', async () => {
    const { onDawn } = setup({ dawnCount: 5, dawnBusy: true });
    const btn = screen.getByRole('button', { name: /Dawn/ });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Dawn is running. Please wait.',
    );
    await userEvent.click(btn);
    expect(onDawn).not.toHaveBeenCalled();
  });
});
