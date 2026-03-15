import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { CameraController } from '../../components/camera-controller';

// Minimal mock for OrbitControls
function createMockControls() {
  return {
    target: new THREE.Vector3(),
    update: vi.fn(),
  };
}

describe('CameraController', () => {
  let camera: THREE.PerspectiveCamera;
  let controls: ReturnType<typeof createMockControls>;
  let controller: CameraController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100);
    camera.position.set(0, 0, 0);
    controls = createMockControls();
    controller = new CameraController(camera, controls as never);
  });

  it('starts inactive', () => {
    expect(controller.isActive()).toBe(false);
  });

  it('becomes active after startFollowing', () => {
    controller.startFollowing();
    expect(controller.isActive()).toBe(true);
  });

  it('becomes inactive after stopFollowing', () => {
    controller.startFollowing();
    controller.stopFollowing();
    expect(controller.isActive()).toBe(false);
  });

  it('does not move camera if not following', () => {
    const initialPos = camera.position.clone();
    controller.update(new THREE.Vector3(10, 10, 10), 0.016);
    expect(camera.position.distanceTo(initialPos)).toBeLessThan(0.001);
  });

  it('moves camera toward robot when following', () => {
    controller.startFollowing();
    const robotPos = new THREE.Vector3(5, 0, 0);
    const initialCameraPos = camera.position.clone();

    controller.update(robotPos, 0.016);

    // Camera should have moved from initial position
    expect(camera.position.distanceTo(initialCameraPos)).toBeGreaterThan(0);
  });

  it('calls controls.update during follow', () => {
    controller.startFollowing();
    controller.update(new THREE.Vector3(1, 0, 0), 0.016);
    expect(controls.update).toHaveBeenCalled();
  });

  it('resets camera to default position on resetToDefault', () => {
    controller.startFollowing();
    controller.resetToDefault();

    expect(controller.isActive()).toBe(false);
    expect(camera.position.x).toBeCloseTo(2.0);
    expect(camera.position.y).toBeCloseTo(1.7);
    expect(camera.position.z).toBeCloseTo(2.0);
  });

  it('resets controls target on resetToDefault', () => {
    controller.resetToDefault();
    expect(controls.target.x).toBeCloseTo(0);
    expect(controls.target.y).toBeCloseTo(0.8);
    expect(controls.target.z).toBeCloseTo(0);
  });
});
