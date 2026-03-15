import { describe, it, expect } from 'vitest';
import { ROBOT_MODELS, ROBOT_ACTIONS } from '../../components/robot-models';

describe('ROBOT_MODELS', () => {
  it('contains the three expected robots', () => {
    expect(Object.keys(ROBOT_MODELS)).toEqual(['humanoid', 'unitree_go2', 'unitree_h1']);
  });

  it('each model has a non-empty name', () => {
    for (const key of Object.keys(ROBOT_MODELS)) {
      expect(ROBOT_MODELS[key].name.length).toBeGreaterThan(0);
    }
  });

  it('each model path starts with / and ends with .xml', () => {
    for (const key of Object.keys(ROBOT_MODELS)) {
      const path = ROBOT_MODELS[key].path;
      expect(path.startsWith('/')).toBe(true);
      expect(path.endsWith('.xml')).toBe(true);
    }
  });

  it('humanoid model has correct path', () => {
    expect(ROBOT_MODELS.humanoid.path).toBe('/humanoid/humanoid_scene.xml');
  });

  it('unitree_go2 model has correct path', () => {
    expect(ROBOT_MODELS.unitree_go2.path).toBe('/unitree_go2/scene.xml');
  });

  it('unitree_h1 model has correct path', () => {
    expect(ROBOT_MODELS.unitree_h1.path).toBe('/unitree_h1/scene.xml');
  });

  it('each model has a description', () => {
    for (const key of Object.keys(ROBOT_MODELS)) {
      expect(typeof ROBOT_MODELS[key].description).toBe('string');
    }
  });
});

describe('ROBOT_ACTIONS', () => {
  it('contains idle and walk actions', () => {
    const values = ROBOT_ACTIONS.map(a => a.value);
    expect(values).toContain('idle');
    expect(values).toContain('walk');
  });

  it('each action has a value and label', () => {
    for (const action of ROBOT_ACTIONS) {
      expect(action.value.length).toBeGreaterThan(0);
      expect(action.label.length).toBeGreaterThan(0);
    }
  });
});
