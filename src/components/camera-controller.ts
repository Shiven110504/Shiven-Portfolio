import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private targetPosition: THREE.Vector3;
  private orbitAngle: number = 0;
  private orbitRadius: number = 3.5;
  private orbitHeight: number = 1.5;
  private orbitSpeed: number = 0.3;
  private smoothing: number = 0.05;
  private isFollowing: boolean = false;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
    this.targetPosition = new THREE.Vector3();
  }

  startFollowing(): void {
    this.isFollowing = true;
    this.orbitAngle = 0;
    console.log('Camera following started');
  }

  stopFollowing(): void {
    this.isFollowing = false;
    console.log('Camera following stopped');
  }

  update(robotPosition: THREE.Vector3, deltaTime: number): void {
    if (!this.isFollowing) {
      return;
    }

    this.targetPosition.lerp(robotPosition, this.smoothing);
    this.orbitAngle += this.orbitSpeed * deltaTime;

    const offsetX = Math.cos(this.orbitAngle) * this.orbitRadius;
    const offsetZ = Math.sin(this.orbitAngle) * this.orbitRadius;

    const desiredCameraPos = new THREE.Vector3(
      this.targetPosition.x + offsetX,
      this.targetPosition.y + this.orbitHeight,
      this.targetPosition.z + offsetZ
    );

    this.camera.position.lerp(desiredCameraPos, this.smoothing);
    this.controls.target.lerp(this.targetPosition, this.smoothing);
    this.controls.update();
  }

  resetToDefault(): void {
    this.isFollowing = false;
    this.camera.position.set(2.0, 1.7, 2.0);
    this.controls.target.set(0, 0.8, 0);
    this.controls.update();
  }

  isActive(): boolean {
    return this.isFollowing;
  }
}
