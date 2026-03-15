import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingScreen } from '../../components/ui/loading-screen';

describe('LoadingScreen', () => {
  it('renders default message', () => {
    render(<LoadingScreen />);
    expect(screen.getByText(/Loading MuJoCo Simulator/i)).toBeInTheDocument();
  });

  it('renders default submessage', () => {
    render(<LoadingScreen />);
    expect(screen.getByText(/Initializing physics simulation/i)).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<LoadingScreen message="Custom loading..." />);
    expect(screen.getByText('Custom loading...')).toBeInTheDocument();
  });

  it('renders custom submessage', () => {
    render(<LoadingScreen submessage="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders without crashing when no props provided', () => {
    expect(() => render(<LoadingScreen />)).not.toThrow();
  });
});
