// Mock @vercel/analytics before importing App
jest.mock('@vercel/analytics/react', () => ({
  Analytics: () => null
}), { virtual: true });

import { render, screen } from '@testing-library/react';
import App from './App';

test('renders TalentAI application', () => {
  render(<App />);
  const titleElement = screen.getByText(/TalentAI/i);
  expect(titleElement).toBeInTheDocument();
});
