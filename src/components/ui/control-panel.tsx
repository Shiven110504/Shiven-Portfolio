import React from 'react';

interface ControlPanelProps {
  currentModel: string;
  currentAction: string;
  physicsPaused: boolean;
  isLoadingModel: boolean;
  onModelChange: (model: string) => void;
  onActionChange: (action: string) => void;
  onReset: () => void;
  onTogglePhysics: () => void;
}

export function ControlPanel({
  currentModel,
  currentAction,
  physicsPaused,
  isLoadingModel,
  onModelChange,
  onActionChange,
  onReset,
  onTogglePhysics
}: ControlPanelProps) {
  return (
    <div className="absolute bottom-5 right-5 text-white font-mono text-xs bg-black/80 p-4 rounded-xl z-[1000] flex flex-col gap-3 items-end backdrop-blur-md border border-white/10 shadow-2xl">
      {/* Loading Overlay */}
      {isLoadingModel && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-xl flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-3 border-blue-500/30 rounded-full" />
              <div className="w-10 h-10 border-3 border-transparent border-t-blue-500 rounded-full animate-spin absolute top-0 left-0" />
            </div>
            <span className="text-xs text-white font-medium">Loading model...</span>
          </div>
        </div>
      )}

      {/* Model Selection */}
      <div className="flex flex-col gap-1 items-end">
        <label className="text-[10px] opacity-70">Robot Model</label>
        <select
          value={currentModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={isLoadingModel}
          className="bg-white/10 text-white border border-white/20 rounded-md px-2 py-1 text-[11px] font-mono min-w-[120px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Select different robot models"
        >
          <option value="humanoid">Humanoid</option>
          <option value="unitree_go2">Unitree Go2</option>
          <option value="unitree_h1">Unitree H1</option>
        </select>
      </div>

      {/* Action Selection */}
      <div className="flex flex-col gap-1 items-end">
        <label className="text-[10px] opacity-70">Action</label>
        <select
          value={currentAction}
          onChange={(e) => onActionChange(e.target.value)}
          disabled={isLoadingModel}
          className="bg-white/10 text-white border border-white/20 rounded-md px-2 py-1 text-[11px] font-mono min-w-[120px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Select robot actions (coming soon)"
        >
          <option value="idle">Idle</option>
          <option value="walk">Walk</option>
          <option value="run">Run</option>
          <option value="squat">Squat</option>
          <option value="dance">Dance</option>
        </select>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onReset}
          disabled={isLoadingModel}
          className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none px-3 py-1.5 rounded-md cursor-pointer text-[11px] font-mono shadow-lg shadow-green-500/30 hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reset simulation (R)"
        >
          Reset
        </button>
        <button
          onClick={onTogglePhysics}
          disabled={isLoadingModel}
          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none px-3 py-1.5 rounded-md cursor-pointer text-[11px] font-mono shadow-lg shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Toggle physics (Space)"
        >
          {physicsPaused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Status Indicator */}
      <div className="opacity-80 text-right text-[10px]">
        <div className={`font-bold transition-colors ${physicsPaused ? 'text-red-400' : 'text-green-400'}`}>
          {physicsPaused ? '⏸ PAUSED' : '▶ RUNNING'}
        </div>
        <div className="mt-1 opacity-60">Click & drag to interact</div>
        <div className="opacity-60">Press R to reset</div>
      </div>
    </div>
  );
}
