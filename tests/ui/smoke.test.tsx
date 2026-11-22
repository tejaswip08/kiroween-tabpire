// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

it('renders JSX in jsdom', () => {
  render(<div>hello crypt</div>);
  expect(screen.getByText('hello crypt')).toBeTruthy();
});
