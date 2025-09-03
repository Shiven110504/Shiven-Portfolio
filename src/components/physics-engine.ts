import * as THREE from 'three';
import { MuJoCoModel, MuJoCoSimulation } from './types/mujoco';
import { DragStateManager } from './DragStateManager';
import { getPosition, getQuaternion, toMujocoPos } from './MuJoCoUtils';

export class PhysicsEngine {
  private model: MuJoCoModel;
  private simulation: MuJoCoSimulation;
  private bodies: { [key: number]: THREE.Group };
  private dragStateManager: DragStateManager;
  private physicsPaused: boolean = false;
  private mujocoTime: number = 0.0;

  constructor(
    model: MuJoCoModel,
    simulation: MuJoCoSimulation,
    bodies: { [key: number]: THREE.Group },
    dragStateManager: DragStateManager
  ) {
    this.model = model;
    this.simulation = simulation;
    this.bodies = bodies;
    this.dragStateManager = dragStateManager;
  }

  public setPaused(paused: boolean): void {
    this.physicsPaused = paused;
  }

  public isPaused(): boolean {
    return this.physicsPaused;
  }

  public step(timeMS: number): void {
    if (this.physicsPaused) return;

    try {
      const timestep = this.model.getOptions().timestep;

      if (timeMS - this.mujocoTime > 35.0) {
        this.mujocoTime = timeMS;
      }

      while (this.mujocoTime < timeMS) {
        this.clearForces();
        this.applyDragForces();
        this.simulation.step();
        this.mujocoTime += timestep * 1000.0;
      }
    } catch (error) {
      console.error('Physics simulation error:', error);
      this.mujocoTime = timeMS;
    }
  }

  public updateBodyPositions(): void {
    for (let b = 0; b < this.model.nbody; b++) {
      if (this.bodies[b]) {
        getPosition(this.simulation.xpos, b, this.bodies[b].position);
        getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
        this.bodies[b].updateWorldMatrix(true, false);
      }
    }
  }

  private clearForces(): void {
    const qfrc_applied = this.simulation.qfrc_applied;
    if (qfrc_applied) {
      for (let i = 0; i < qfrc_applied.length; i++) {
        qfrc_applied[i] = 0.0;
      }
    }
  }

  private applyDragForces(): void {
    if (!this.dragStateManager.active || !this.dragStateManager.physicsObject) return;

    const dragged = this.dragStateManager.physicsObject;
    const bodyID = (dragged as any).bodyID;
    
    if (bodyID !== undefined && bodyID >= 0 && bodyID < this.model.nbody && this.model.body_mass) {
      this.dragStateManager.update();

      const dragForce = this.dragStateManager.currentWorld.clone().sub(this.dragStateManager.worldHit);
      const force = toMujocoPos(dragForce.multiplyScalar(this.model.body_mass[bodyID] * 250));
      const point = toMujocoPos(this.dragStateManager.worldHit.clone());

      this.simulation.applyForce(force.x, force.y, force.z, 0, 0, 0, point.x, point.y, point.z, bodyID);
    }
  }
}
