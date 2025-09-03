import React from 'react';

interface ErrorScreenProps {
  error: Error | string;
}

export function ErrorScreen({ error }: ErrorScreenProps) {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center text-white font-mono">
      <div className="text-center p-5">
        <h2 className="text-xl mb-4">Error Loading MuJoCo Demo</h2>
        <p className="mb-2">{errorMessage}</p>
        <p className="text-sm opacity-70">Check browser console for details</p>
      </div>
    </div>
  );
}
