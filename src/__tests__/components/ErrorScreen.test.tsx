import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorScreen } from '../../components/ui/error-screen';

describe('ErrorScreen', () => {
  it('displays error message from Error object', () => {
    render(<ErrorScreen error={new Error('WASM load failed')} />);
    expect(screen.getByText('WASM load failed')).toBeInTheDocument();
  });

  it('displays error message from string', () => {
    render(<ErrorScreen error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders the error heading', () => {
    render(<ErrorScreen error="test" />);
    expect(screen.getByText(/Error Loading MuJoCo Demo/i)).toBeInTheDocument();
  });

  it('renders console hint', () => {
    render(<ErrorScreen error="test" />);
    expect(screen.getByText(/browser console/i)).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    expect(() => render(<ErrorScreen error={new Error('test')} />)).not.toThrow();
  });
});
