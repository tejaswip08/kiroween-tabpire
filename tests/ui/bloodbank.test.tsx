// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/tabs', () => ({ openCrypt: vi.fn(async () => {}) }));
vi.mock('../../lib/store', () => ({
  store: {
    getStats: vi.fn(async () => ({ staked: 0, coffined: 0, crypted: 0, dawns: 0, mbFreed: 0 })),
    getLog: vi.fn(async () => []),
    getCrypt: vi.fn(async () => []),
    getTheme: vi.fn(async () => 'crypt'),
    setTheme: vi.fn(async () => {}),
  },
  KEYS: { theme: 'tabpire:theme' },
  onStoreChange: vi.fn(() => () => {}),
}));
import { openCrypt } from '../../lib/tabs';
import { BloodBank } from '../../entrypoints/bloodbank/BloodBank';

afterEach(cleanup);

describe('Blood Bank page', () => {
  it('renders the scroll wrapper and the same headings as before', async () => {
    const { container } = render(<BloodBank />);
    expect(container.querySelector('.bb-scroll > main.bb')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Blood Bank' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Recent deeds' })).toBeTruthy();
    expect(await screen.findByText(/Nothing yet/)).toBeTruthy();
  });

  it('"Back to The Crypt" opens the Crypt in the same tab', async () => {
    render(<BloodBank />);
    await userEvent.click(screen.getByRole('button', { name: 'Back to The Crypt' }));
    expect(openCrypt).toHaveBeenCalledWith({ sameTab: true });
  });

  it('main.tsx imports BloodBank', () => {
    const src = readFileSync('entrypoints/bloodbank/main.tsx', 'utf8');
    expect(src).toMatch(/import\s*\{\s*BloodBank\s*\}\s*from\s*'\.\/BloodBank'/);
  });
});
