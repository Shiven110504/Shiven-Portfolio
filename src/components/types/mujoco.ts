import * as THREE from 'three';
import { Model, State, Simulation, mujoco } from '../../../public/mujoco_wasm.d';

// Re-export the proper MuJoCo types
export type MuJoCoModule = mujoco;
export type MuJoCoModel = Model;
export type MuJoCoState = State;
export type MuJoCoSimulation = Simulation;

// Extend THREE.Group to include bodyID and custom mesh properties
declare module 'three' {
  interface Group {
    bodyID?: number;
    has_custom_mesh?: boolean;
  }
}

declare global {
  function load_mujoco(): Promise<MuJoCoModule>;
  interface Window {
    load_mujoco?: () => Promise<MuJoCoModule>;
    mujocoDemo?: {
      mujoco: MuJoCoModule;
      model: MuJoCoModel | undefined;
      state: MuJoCoState | undefined;
      simulation: MuJoCoSimulation | undefined;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      controls: unknown;
      bodies: { [key: number]: THREE.Group };
      resetSimulation?: () => void;
      switchModel?: (modelKey: string) => Promise<void>;
      setAction?: (action: string) => void;
      togglePhysics?: () => void;
      currentModel?: string;
      currentAction?: string;
      physicsPaused?: boolean;
      ground?: THREE.Mesh | null;
      cleanup?: () => void;
    };
  }
}