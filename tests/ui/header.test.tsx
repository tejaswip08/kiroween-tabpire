// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../../entrypoints/newtab/components/Header';

afterEach(cleanup);

const setup = (over: Partial<Parameters<typeof Header>[0]> = {}) => {
  const onDawn = vi.fn();
  render(
    <Header openTabs={12} estimatedMb={1460} reclaimedMb={245} dawnCount={3} dawnBusy={false} onDawn={onDawn} {...over} />,
  );
  return { onDawn };
};

describe('header stats panel', () => {
  it('shows the three figures with an "est." tag on each', () => {
    setup();
    const panel = screen.getByRole('region', { name: 'Browser stats' });
    expect(within(panel).getByText('Open tabs').closest('div')?.textContent).toContain('12');
    expect(within(panel).getByText('Memory in use').closest('div')?.textContent).toContain('~1.5 GB');
    expect(within(panel).getByText('Memory reclaimed').closest('div')?.textContent).toContain('~245 MB');
    const tags = within(panel).getAllByText('est.');
    expect(tags).toHaveLength(3);
    expect(tags[0]?.getAttribute('title')).toBe('Estimated');
  });

  it('shows memory with "~" even at zero', () => {
    setup({ estimatedMb: 0, reclaimedMb: 0, openTabs: 0 });
    expect(screen.getAllByText('~0 MB')).toHaveLength(2);
  });

  it('has the brand', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Tabpire' })).toBeTruthy();
  });
});

describe('header buttons', () => {
  it('disables Themes and Blood Bank with "Coming soon"', async () => {
    setup();
    for (const name of ['Themes', 'Blood Bank']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.getAttribute('aria-disabled')).toBe('true');
      const tip = document.getElementById(btn.getAttribute('aria-describedby')!)!;
      expect(tip.textContent).toBe('Coming soon');
      await userEvent.click(btn); // does nothing, and does not throw
    }
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
