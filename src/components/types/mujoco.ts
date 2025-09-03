import * as THREE from 'three';

// TypeScript declarations for MuJoCo WASM
export interface MuJoCoModule {
  FS: {
    mkdir: (path: string) => void;
    mount: (fs: any, options: { root: string }, path: string) => void;
    writeFile: (path: string, content: string) => void;
  };
  MEMFS: any;
  Model: new (xmlPath: string) => MuJoCoModel;
  State: new (model: MuJoCoModel) => MuJoCoState;
  Simulation: new (model: MuJoCoModel, state: MuJoCoState) => MuJoCoSimulation;
}

export interface MuJoCoModel {
  ngeom: number;
  nbody: number;
  names: Uint8Array;
  geom_bodyid: any;
  geom_type: any;
  geom_size: any;
  geom_group: any;
  geom_pos: any;
  geom_quat: any;
  geom_matid: any;
  mat_rgba: any;
  mat_texid: any;
  tex_rgb: any;
  tex_width: any;
  tex_height: any;
  tex_adr: any;
  mesh_vert: any;
  mesh_vertadr: any;
  mesh_vertnum: any;
  mesh_normal: any;
  mesh_texcoord: any;
  mesh_texcoordadr: any;
  mesh_face: any;
  mesh_faceadr: any;
  mesh_facenum: any;
  body_mass: any;
  name_bodyadr: number;
  name_actuatoradr: any;
  actuator_ctrlrange: any;
  actuator_ctrllimited: any;
  tendon_width: any;
  light_directional: any;
  light_bodyid: any;
  light_xpos: any;
  light_xdir: any;
  nlight: number;
  ntendon: number;
  nu: number;
  nq: number;
  njnt: number;
  body_rootid: number;
  body_parentid: any;
  body_jntadr: any;
  jnt_qposadr: any;
  tendon_wrapadr: any;
  tendon_wrapnum: any;
  getOptions: () => { timestep: number };
  key_qpos: any;
  nkey: number;
  body_mocapid: any;
}

export interface MuJoCoState {
  [key: string]: unknown;
}

export interface MuJoCoSimulation {
  ctrl: any;
  xpos: any;
  xquat: any;
  light_xpos: any;
  light_xdir: any;
  ten_wrapadr: any;
  ten_wrapnum: any;
  wrap_xpos: any;
  mocap_pos: any;
  qpos: any;
  qfrc_applied: any;
  free: () => void;
  step: () => void;
  forward: () => void;
  resetData: () => void;
  applyForce: (fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, px: number, py: number, pz: number, body: number) => void;
  integratePos: (qpos: any, qfrc: any, timestep: number) => void;
}

// Extend THREE.Group to include bodyID property
declare module 'three' {
  interface Group {
    bodyID?: number;
  }
}

declare global {
  function load_mujoco(): Promise<MuJoCoModule>;
  interface Window {
    load_mujoco?: () => Promise<MuJoCoModule>;
    mujocoDemo?: {
      mujoco: MuJoCoModule;
      model: MuJoCoModel;
      state: MuJoCoState;
      simulation: MuJoCoSimulation;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      controls: any;
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
