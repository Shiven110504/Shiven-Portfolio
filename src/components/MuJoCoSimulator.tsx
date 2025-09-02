/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Extend THREE.Group to include bodyID property
declare module 'three' {
  interface Group {
    bodyID?: number;
  }
}

// TypeScript declarations for MuJoCo WASM
interface MuJoCoModule {
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

interface MuJoCoModel {
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

interface MuJoCoState {
  // MuJoCo state properties - using object type to allow any structure
  [key: string]: unknown;
}

interface MuJoCoSimulation {
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
      controls: OrbitControls;
      bodies: { [key: number]: THREE.Group };
      resetSimulation?: () => void;
      ground?: THREE.Mesh | null;
      cleanup?: () => void;
    };
  }
}

export default function MuJoCoSimulator() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      initDemo(containerRef.current);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        background: '#1a1a1a'
      }}
    >
      {/* Control Panel (like original demo) */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '15px',
        borderRadius: '8px',
        zIndex: 1000
      }}>
        <div style={{ marginBottom: '10px' }}>
          <strong>MuJoCo Humanoid</strong>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => window.mujocoDemo?.resetSimulation?.()}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Reset (R)
          </button>
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          <div>Mouse: Rotate camera</div>
          <div>Scroll: Zoom</div>
          <div>R: Reset simulation</div>
        </div>
      </div>

      {/* Status Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '12px',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '10px',
        borderRadius: '8px',
        zIndex: 1000
      }}>
        <div>MuJoCo v231</div>
        <div>17 bodies, 20 geometries</div>
        <div>Physics: Active</div>
      </div>
    </div>
  );
}

async function initDemo(container: HTMLDivElement) {
  try {
    // Load MuJoCo WASM module
    const wasmResponse = await fetch('/mujoco_wasm.js');
    const scriptText = await wasmResponse.text();

    const modifiedScript = scriptText
      .replace(/import\.meta\.url/g, `'${window.location.origin}/mujoco_wasm.wasm'`)
      .replace(/export default load_mujoco;/g, 'window.load_mujoco = load_mujoco;');

    const script = document.createElement('script');
    script.textContent = modifiedScript;
    document.head.appendChild(script);

    // Wait for load_mujoco to be available
    let attempts = 0;
    while (typeof window.load_mujoco !== 'function' && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (typeof window.load_mujoco !== 'function') {
      throw new Error('load_mujoco function not available after loading');
    }

    const mujoco = await window.load_mujoco();

    // Set up Emscripten's Virtual File System
    mujoco.FS.mkdir('/working');
    mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');

    // Load the humanoid XML file
    const response = await fetch('/humanoid.xml');
    const xmlContent = await response.text();
    mujoco.FS.writeFile("/working/humanoid.xml", xmlContent);

    // Create MuJoCo objects
    const model = new mujoco.Model("/working/humanoid.xml");
    const state = new mujoco.State(model);
    const simulation = new mujoco.Simulation(model, state);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0.15, 0.25, 0.35);
    scene.fog = new THREE.Fog(scene.background, 15, 25.5);

    // Camera setup (adjusted for Y-up coordinate system)
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100);
    camera.position.set(3.0, 2.0, 3.0); // Position to see humanoid above ground
    camera.lookAt(0, 1.3, 0); // Look at humanoid center (was at Y=1.282 in MuJoCo)
    scene.add(camera);

    // Lighting (matching original demo)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Add directional light for better visibility
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add renderer to container
    container.appendChild(renderer.domElement);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.3, 0); // Target humanoid center in Y-up coordinates
    controls.panSpeed = 2;
    controls.zoomSpeed = 1;
    controls.enableDamping = true;
    controls.dampingFactor = 0.10;
    controls.screenSpacePanning = true;
    controls.update();

    // Initialize simulation state
    simulation.resetData();
    simulation.forward();

    // Create bodies map for tracking Three.js objects
    const bodies: { [key: number]: THREE.Group } = {};
    const mujocoRoot = new THREE.Group();
    mujocoRoot.name = "MuJoCo Root";
    scene.add(mujocoRoot);

    // Track ground plane reference
    let groundPlane: THREE.Mesh | null = null;

    // Decode names from MuJoCo model
    const textDecoder = new TextDecoder("utf-8");
    const names = textDecoder.decode(model.names).split('\x00');

    // Create geometries for each MuJoCo geometry
    for (let g = 0; g < model.ngeom; g++) {
      if (!(model.geom_group[g] < 3)) continue;

      const b = model.geom_bodyid[g];
      const type = model.geom_type[g];
      const size = [
        model.geom_size[(g * 3) + 0],
        model.geom_size[(g * 3) + 1],
        model.geom_size[(g * 3) + 2]
      ];

      if (!(b in bodies)) {
        bodies[b] = new THREE.Group();
        bodies[b].bodyID = b;
        mujocoRoot.add(bodies[b]);
      }

      let geometry: THREE.BufferGeometry;
      const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: false
      });

      // Create geometry based on MuJoCo geom type
      if (type === 0) {
        geometry = new THREE.PlaneGeometry(20, 20);
        material.color.setHex(0x666666);
      } else if (type === 2) {
        geometry = new THREE.SphereGeometry(size[0]);
      } else if (type === 3) {
        geometry = new THREE.CapsuleGeometry(size[0], size[1] * 2.0, 20, 20);
      } else if (type === 5) {
        geometry = new THREE.BoxGeometry(size[0] * 2.0, size[2] * 2.0, size[1] * 2.0);
      } else if (type === 4) {
        geometry = new THREE.CylinderGeometry(size[0], size[0], size[1] * 2.0);
      } else {
        geometry = new THREE.SphereGeometry(size[0] * 0.5);
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = type === 0;

      // Convert MuJoCo Z-up to Three.js Y-up coordinates
      if (type === 0) {
        mesh.position.set(
          model.geom_pos[(g * 3) + 0],
          0,
          -model.geom_pos[(g * 3) + 1]
        );
        mesh.rotation.x = -Math.PI / 2;
        groundPlane = mesh;
      } else {
        mesh.position.set(
          model.geom_pos[(g * 3) + 0],
          model.geom_pos[(g * 3) + 2],
          -model.geom_pos[(g * 3) + 1]
        );
        const quat = model.geom_quat.subarray(g * 4, g * 4 + 4);
        mesh.quaternion.set(quat[1], quat[3], -quat[2], quat[0]);
      }

      bodies[b].add(mesh);
    }

    // Animation loop with MuJoCo physics
    let mujoco_time = 0.0;

    function animate(timeMS: number) {
      requestAnimationFrame(animate);
      controls.update();

      const timestep = model.getOptions().timestep;

      if (timeMS - mujoco_time > 35.0) {
        mujoco_time = timeMS;
      }

      while (mujoco_time < timeMS) {
        simulation.step();
        mujoco_time += timestep * 1000.0;
      }

      // Update body positions from simulation
      for (let b = 0; b < model.nbody; b++) {
        if (bodies[b]) {
          bodies[b].position.set(
            simulation.xpos[(b * 3) + 0],
            simulation.xpos[(b * 3) + 2],
            -simulation.xpos[(b * 3) + 1]
          );

          const quat = simulation.xquat.subarray(b * 4, b * 4 + 4);
          bodies[b].quaternion.set(quat[1], quat[3], -quat[2], quat[0]);
          bodies[b].updateWorldMatrix(true, false);
        }
      }

      renderer.render(scene, camera);
    }

    animate(performance.now());

    // Reset functionality
    const resetSimulation = () => {
      simulation.resetData();
      simulation.forward();
    };

    // Keyboard controls
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyR') {
        resetSimulation();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    const cleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (renderer) renderer.dispose();
      if (simulation) simulation.free();
    };

    // Store demo instance globally
    window.mujocoDemo = {
      mujoco,
      model,
      state,
      simulation,
      scene,
      camera,
      renderer,
      controls,
      bodies,
      resetSimulation,
      ground: groundPlane,
      cleanup
    };

  } catch (error) {
    console.error('Failed to initialize MuJoCo demo:', error);
    container.innerHTML = `
      <div style="color: white; padding: 20px; font-family: monospace;">
        <h2>Error Loading MuJoCo Demo</h2>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        <p>Check browser console for details</p>
      </div>
    `;
  }
}