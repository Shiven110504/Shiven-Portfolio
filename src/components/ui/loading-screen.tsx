import React from 'react';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

export function LoadingScreen({ 
  message = "🔄 Loading MuJoCo Simulator...", 
  submessage = "Initializing physics simulation and 3D environment..." 
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center text-white font-mono text-base">
      <div className="text-center">
        <div className="mb-5 text-lg">{message}</div>
        <div className="text-2xl mb-5">🤖</div>
        <div className="mt-5 opacity-70 max-w-md mx-auto">
          {submessage}
          <br />
          <small>This may take a moment on first load.</small>
        </div>
      </div>
    </div>
  );
}
