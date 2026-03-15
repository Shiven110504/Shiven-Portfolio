import { describe, it, expect, beforeEach } from 'vitest';
import { GaitController } from '../../components/gait-controller';
import {
  createMockModel,
  createMockSimulation,
  type MockModel,
  type MockSimulation,
} from '../../test/mocks/mujoco.mock';

/**
 * Build a name buffer for the mock model so GaitController can read actuator names.
 * Each name is null-terminated in the buffer.
 */
function buildActuatorNames(names: string[]): { namesBuffer: Uint8Array; addrArray: Int32Array } {
  const encoded: number[] = [];
  const addrs: number[] = [];

  for (const name of names) {
    addrs.push(encoded.length);
    for (const c of name) encoded.push(c.charCodeAt(0));
    encoded.push(0); // null terminator
  }

  return {
    namesBuffer: new Uint8Array(encoded),
    addrArray: new Int32Array(addrs),
  };
}

describe('GaitController — humanoid', () => {
  let model: MockModel;
  let sim: MockSimulation;
  let controller: GaitController;

  beforeEach(() => {
    const actuatorNames = ['right_hip_y', 'left_hip_y', 'right_hip_x', 'left_hip_x', 'right_knee', 'left_knee', 'right_ankle_y', 'left_ankle_y'];
    const { namesBuffer, addrArray } = buildActuatorNames(actuatorNames);

    model = createMockModel({
      nu: actuatorNames.length,
      nq: 30,
      names: namesBuffer,
      name_actuatoradr: addrArray,
    });
    sim = createMockSimulation(actuatorNames.length, 30, 29);
    controller = new GaitController(model as never, sim as never, 'humanoid');
  });

  it('starts inactive', () => {
    expect(controller.isActionActive()).toBe(false);
  });

  it('becomes active after startAction("walk")', () => {
    controller.startAction('walk');
    expect(controller.isActionActive()).toBe(true);
  });

  it('becomes inactive after stopAction', () => {
    controller.startAction('walk');
    controller.stopAction();
    expect(controller.isActionActive()).toBe(false);
  });

  it('resets all ctrl to zero on stopAction', () => {
    controller.startAction('walk');
    controller.update(0.1, 'walk');
    controller.stopAction();

    for (let i = 0; i < sim.ctrl.length; i++) {
      expect(sim.ctrl[i]).toBe(0);
    }
  });

  it('does nothing if action is not "walk"', () => {
    controller.startAction('walk');
    const ctrlBefore = new Float64Array(sim.ctrl);
    controller.update(0.1, 'idle');
    // ctrl should not have changed
    for (let i = 0; i < sim.ctrl.length; i++) {
      expect(sim.ctrl[i]).toBe(ctrlBefore[i]);
    }
  });

  it('writes non-zero ctrl values during walk update', () => {
    controller.startAction('walk');
    controller.update(0.5, 'walk'); // half second into gait
    const anyNonZero = Array.from(sim.ctrl).some(v => Math.abs(v) > 1e-6);
    expect(anyNonZero).toBe(true);
  });

  it('ignores unknown action string in startAction', () => {
    controller.startAction('dance'); // not implemented
    expect(controller.isActionActive()).toBe(false);
  });
});

describe('GaitController — unitree_go2', () => {
  let model: MockModel;
  let sim: MockSimulation;
  let controller: GaitController;

  beforeEach(() => {
    const actuatorNames = ['FL_hip', 'FR_hip', 'RL_hip', 'RR_hip', 'FL_thigh', 'FR_thigh', 'RL_thigh', 'RR_thigh', 'FL_calf', 'FR_calf', 'RL_calf', 'RR_calf'];
    const { namesBuffer, addrArray } = buildActuatorNames(actuatorNames);

    model = createMockModel({
      nu: actuatorNames.length,
      nq: 20,
      names: namesBuffer,
      name_actuatoradr: addrArray,
      actuator_trnid: new Int32Array(actuatorNames.length * 2).fill(8), // trnId=8 for all
    });
    sim = createMockSimulation(actuatorNames.length, 20, 18);
    controller = new GaitController(model as never, sim as never, 'unitree_go2');
  });

  it('activates on startAction("walk")', () => {
    controller.startAction('walk');
    expect(controller.isActionActive()).toBe(true);
  });

  it('writes ctrl values for all 12 joints during walk', () => {
    controller.startAction('walk');
    controller.update(0.1, 'walk');
    // At least some ctrl values should be non-zero
    const anyNonZero = Array.from(sim.ctrl).some(v => Math.abs(v) > 1e-6);
    expect(anyNonZero).toBe(true);
  });

  it('thigh joints receive direct position control (non-zero offset)', () => {
    controller.startAction('walk');
    controller.update(0.1, 'walk');
    // FL_thigh is index 4 — should have +0.05 (outward angle)
    expect(sim.ctrl[4]).toBeCloseTo(0.05, 3);
  });
});

describe('GaitController — unitree_h1', () => {
  let model: MockModel;
  let sim: MockSimulation;
  let controller: GaitController;

  beforeEach(() => {
    const actuatorNames = ['left_hip_pitch', 'right_hip_pitch', 'left_hip_roll', 'right_hip_roll', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
    const { namesBuffer, addrArray } = buildActuatorNames(actuatorNames);

    model = createMockModel({
      nu: actuatorNames.length,
      nq: 20,
      names: namesBuffer,
      name_actuatoradr: addrArray,
    });
    sim = createMockSimulation(actuatorNames.length, 20, 18);
    controller = new GaitController(model as never, sim as never, 'unitree_h1');
  });

  it('activates correctly', () => {
    controller.startAction('walk');
    expect(controller.isActionActive()).toBe(true);
  });

  it('produces non-zero ctrl values', () => {
    controller.startAction('walk');
    controller.update(0.3, 'walk');
    const anyNonZero = Array.from(sim.ctrl).some(v => Math.abs(v) > 1e-6);
    expect(anyNonZero).toBe(true);
  });
});

describe('GaitController — unknown model', () => {
  it('handles unknown model gracefully without throwing', () => {
    const { namesBuffer, addrArray } = buildActuatorNames([]);
    const model = createMockModel({ nu: 0, names: namesBuffer, name_actuatoradr: addrArray });
    const sim = createMockSimulation(0, 7, 6);

    expect(() => new GaitController(model as never, sim as never, 'unknown_robot')).not.toThrow();
  });
});
