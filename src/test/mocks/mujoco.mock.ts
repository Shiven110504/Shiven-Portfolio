import { vi } from 'vitest';

/**
 * Lightweight mock for MuJoCo WASM types — avoids loading the 1.6MB binary in unit tests.
 */

export function createMockCtrl(length: number): Float64Array {
  return new Float64Array(length);
}

export function createMockQpos(values: number[]): Float64Array {
  return new Float64Array(values);
}

export function createMockQvel(values: number[]): Float64Array {
  return new Float64Array(values);
}

export function createMockModel(overrides: Partial<MockModel> = {}): MockModel {
  return {
    nu: 4,
    nq: 10,
    nbody: 3,
    nlight: 0,
    nkey: 0,
    names: new Uint8Array([]),
    name_actuatoradr: new Int32Array([]),
    body_mass: new Float64Array([1, 1, 1]),
    key_qpos: new Float64Array([]),
    actuator_trnid: new Int32Array([]),
    getOptions: () => ({ timestep: 0.002 }),
    ...overrides,
  };
}

export function createMockSimulation(nu = 4, nq = 10, nvel = 9): MockSimulation {
  return {
    ctrl: new Float64Array(nu),
    qpos: new Float64Array(nq),
    qvel: new Float64Array(nvel),
    xpos: new Float64Array(30),
    xquat: new Float64Array(40),
    light_xpos: new Float64Array(10),
    light_xdir: new Float64Array(10),
    qfrc_applied: new Float64Array(nvel),
    step: vi.fn(),
    forward: vi.fn(),
    resetData: vi.fn(),
    applyForce: vi.fn(),
    free: vi.fn(),
  };
}

// Type definitions matching real MuJoCo interface
export interface MockModel {
  nu: number;
  nq: number;
  nbody: number;
  nlight: number;
  nkey: number;
  names: Uint8Array;
  name_actuatoradr: Int32Array;
  body_mass: Float64Array;
  key_qpos: Float64Array;
  actuator_trnid: Int32Array;
  getOptions: () => { timestep: number };
}

export interface MockSimulation {
  ctrl: Float64Array;
  qpos: Float64Array;
  qvel: Float64Array;
  xpos: Float64Array;
  xquat: Float64Array;
  light_xpos: Float64Array;
  light_xdir: Float64Array;
  qfrc_applied: Float64Array;
  step: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  resetData: ReturnType<typeof vi.fn>;
  applyForce: ReturnType<typeof vi.fn>;
  free: ReturnType<typeof vi.fn>;
}
