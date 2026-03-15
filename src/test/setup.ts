import '@testing-library/jest-dom';
import { beforeAll, afterAll } from 'vitest';

// Suppress console.error for expected React warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = String(args[0]);
    if (
      message.includes('Warning: ReactDOM.render') ||
      message.includes('Warning: An update to')
    ) {
      return;
    }
    originalError(...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

