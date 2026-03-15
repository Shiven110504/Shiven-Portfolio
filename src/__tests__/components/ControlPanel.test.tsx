import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlPanel } from '../../components/ui/control-panel';

const defaultProps = {
  currentModel: 'humanoid',
  currentAction: 'idle',
  physicsPaused: false,
  isLoadingModel: false,
  onModelChange: vi.fn(),
  onActionChange: vi.fn(),
  onReset: vi.fn(),
  onTogglePhysics: vi.fn(),
};

describe('ControlPanel', () => {
  it('renders without crashing', () => {
    expect(() => render(<ControlPanel {...defaultProps} />)).not.toThrow();
  });

  it('renders all three robot model options', () => {
    render(<ControlPanel {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'Humanoid' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unitree Go2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unitree H1' })).toBeInTheDocument();
  });

  it('renders all action options', () => {
    render(<ControlPanel {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'Idle' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Walk' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Run' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Squat' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dance' })).toBeInTheDocument();
  });

  it('calls onModelChange when model select changes', () => {
    const onModelChange = vi.fn();
    render(<ControlPanel {...defaultProps} onModelChange={onModelChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'unitree_go2' } });

    expect(onModelChange).toHaveBeenCalledWith('unitree_go2');
  });

  it('calls onActionChange when action select changes', () => {
    const onActionChange = vi.fn();
    render(<ControlPanel {...defaultProps} onActionChange={onActionChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'walk' } });

    expect(onActionChange).toHaveBeenCalledWith('walk');
  });

  it('calls onReset when Reset button is clicked', () => {
    const onReset = vi.fn();
    render(<ControlPanel {...defaultProps} onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('calls onTogglePhysics when Pause button is clicked', () => {
    const onTogglePhysics = vi.fn();
    render(<ControlPanel {...defaultProps} onTogglePhysics={onTogglePhysics} />);

    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onTogglePhysics).toHaveBeenCalledTimes(1);
  });

  it('shows "Resume" button when physics is paused', () => {
    render(<ControlPanel {...defaultProps} physicsPaused={true} />);
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('shows "Pause" button when physics is running', () => {
    render(<ControlPanel {...defaultProps} physicsPaused={false} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('shows loading overlay when isLoadingModel is true', () => {
    render(<ControlPanel {...defaultProps} isLoadingModel={true} />);
    expect(screen.getByText('Loading model...')).toBeInTheDocument();
  });

  it('does not show loading overlay when isLoadingModel is false', () => {
    render(<ControlPanel {...defaultProps} isLoadingModel={false} />);
    expect(screen.queryByText('Loading model...')).not.toBeInTheDocument();
  });

  it('disables all controls when loading', () => {
    render(<ControlPanel {...defaultProps} isLoadingModel={true} />);
    const selects = screen.getAllByRole('combobox');
    selects.forEach(s => expect(s).toBeDisabled());

    const buttons = screen.getAllByRole('button');
    buttons.forEach(b => expect(b).toBeDisabled());
  });

  it('shows RUNNING status when not paused', () => {
    render(<ControlPanel {...defaultProps} physicsPaused={false} />);
    expect(screen.getByText(/RUNNING/)).toBeInTheDocument();
  });

  it('shows PAUSED status when paused', () => {
    render(<ControlPanel {...defaultProps} physicsPaused={true} />);
    expect(screen.getByText(/PAUSED/)).toBeInTheDocument();
  });
});
