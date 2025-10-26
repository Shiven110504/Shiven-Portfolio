'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './DragStateManager';
import { buildRobotGeometry } from './robot-geometry-builder';
import { loadMuJoCo, setupMuJoCoFileSystem, loadRobotModel, getPosition, getQuaternion, toMujocoPos } from './mujoco-loader';
import { ROBOT_MODELS } from './robot-models';
import { MuJoCoModule, MuJoCoModel, MuJoCoState, MuJoCoSimulation } from './types/mujoco';
import { LoadingScreen } from './ui/loading-screen';
import { ControlPanel } from './ui/control-panel';
import { ErrorScreen } from './ui/error-screen';
import { ZMPController } from './zmp-controller';
import { CameraController } from './camera-controller';

class MuJoCoDemo {
  mujoco: MuJoCoModule;
  model: MuJoCoModel | null = null;
  state: MuJoCoState | null = null;
  simulation: MuJoCoSimulation | null = null;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  bodies: { [key: number]: THREE.Group } = {};
  lights: THREE.Light[] = [];
  dragStateManager: DragStateManager;
  mujocoTime: number = 0.0;
  tmpVec: THREE.Vector3 = new THREE.Vector3();
  params: { scene: string; paused: boolean; help: boolean; ctrlnoiserate: number; ctrlnoisestd: number; keyframeNumber: number };
  currentModel: string;
  currentAction: string;
  actionController: ZMPController | null = null;
  cameraController: CameraController;
  private _debugStepCount: number = 0;

  constructor(mujoco: MuJoCoModule, container: HTMLElement) {
    this.mujoco = mujoco;
    this.currentModel = 'humanoid';
    this.currentAction = 'idle';

    // Initialize scene
    const sceneSetup = createScene(container);
    this.scene = sceneSetup.scene;
    this.camera = sceneSetup.camera;
    this.renderer = sceneSetup.renderer;
    this.controls = sceneSetup.controls;

    // Initialize drag state manager
    this.dragStateManager = new DragStateManager(this.scene, this.renderer, this.camera, container, this.controls);

    // Initialize camera controller
    this.cameraController = new CameraController(this.camera, this.controls);

    // Initialize params
    this.params = {
      scene: 'humanoid/humanoid_scene.xml', // Note: not actively used, robot loaded via loadModel()
      paused: false,
      help: false,
      ctrlnoiserate: 0.0,
      ctrlnoisestd: 0.0,
      keyframeNumber: 0
    };
  }

  async loadModel(modelPath: string, modelName: string): Promise<void> {
    console.log(`Loading model: ${modelPath} (${modelName})`);

    // Free old simulation
    if (this.simulation) {
      this.simulation.free();
      this.simulation = null;
      this.model = null;
      this.state = null;
    }

    // Clean up old geometry
    const mujocoRoot = this.scene.getObjectByName("MuJoCo Root");
    if (mujocoRoot) {
      this.scene.remove(mujocoRoot);
    }
    this.bodies = {};

    // Load new model - returns the VFS path
    const vfsPath = await loadRobotModel(this.mujoco, modelPath);
    if (!vfsPath) {
      throw new Error(`Failed to load model from ${modelPath}`);
    }

    // Create MuJoCo objects using the VFS path
    const fullVFSPath = `/working/${vfsPath}`;
    console.log(`Loading MuJoCo model from VFS path: ${fullVFSPath}`);
    this.model = this.mujoco.Model.load_from_xml(fullVFSPath);
    this.state = new this.mujoco.State(this.model);
    this.simulation = new this.mujoco.Simulation(this.model, this.state);

    // Build geometry
    const { bodies, lights } = buildRobotGeometry(this.mujoco, this.model, this.scene);
    this.bodies = bodies;
    this.lights = lights;

    // Initialize simulation - use keyframe if available
    if (this.model.nkey > 0) {
      // Copy keyframe data to qpos
      const keyframeId = 0; // Use first keyframe
      const qposStart = keyframeId * this.model.nq;
      for (let i = 0; i < this.model.nq; i++) {
        this.simulation.qpos[i] = this.model.key_qpos[qposStart + i];
      }
      console.log(`Initialized with keyframe 0, nq=${this.model.nq}`);
    } else {
      console.log(`No keyframes available, using default initialization`);
    }

    // Always call forward to compute derived quantities
    this.simulation.forward();

    // Update current model name BEFORE creating controller
    this.currentModel = modelName;

    // Create action controller for this model using the correct model name
    this.actionController = new ZMPController(this.model, this.simulation, modelName);

    console.log(`Successfully loaded model: ${modelPath} (${modelName})`);
  }

  setAction(action: string): void {
    this.currentAction = action;

    if (!this.actionController) return;

    if (action === 'idle') {
      this.actionController.stopAction();
      this.cameraController.stopFollowing();
      this.cameraController.resetToDefault();
    } else if (action === 'walk') {
      // Reset to standing pose before walking
      this.resetToStandingPose();
      // Reset debug counter
      this._debugStepCount = 0;
      this.actionController.startAction('walk');
      this.cameraController.startFollowing();
    }
  }

  resetToStandingPose(): void {
    if (!this.simulation || !this.model) return;

    // Reset to keyframe if available (standing pose)
    if (this.model.nkey > 0) {
      const keyframeId = 0;
      const qposStart = keyframeId * this.model.nq;
      for (let i = 0; i < this.model.nq; i++) {
        this.simulation.qpos[i] = this.model.key_qpos[qposStart + i];
      }
      // Reset velocities to zero
      for (let i = 0; i < this.simulation.qvel.length; i++) {
        this.simulation.qvel[i] = 0;
      }
      this.simulation.forward();
      console.log('✓ Reset to standing pose');
    }
  }

  resetSimulation(): void {
    if (this.simulation && typeof this.simulation.resetData === 'function') {
      this.simulation.resetData();
      this.simulation.forward();
    }
  }

  render(timeMS: number): void {
    this.controls.update();

    if (!this.params.paused && this.simulation && this.model) {
      const timestep = this.model.getOptions().timestep;

      if (timeMS - this.mujocoTime > 35.0) {
        this.mujocoTime = timeMS;
      }

      while (this.mujocoTime < timeMS) {
        // Debug: Log simulation stepping (only first 3 steps)
        if (this.actionController?.isActionActive()) {
          const debugSteps = this._debugStepCount || 0;
          if (debugSteps < 3) {
            console.log(`🔄 Simulation step ${debugSteps + 1}`);
            console.log(`  Time: ${this.mujocoTime.toFixed(3)}ms, Timestep: ${timestep}s`);
            if (this.simulation.ctrl) {
              console.log(`  Ctrl[0-3]: [${this.simulation.ctrl[0]?.toFixed(3)}, ${this.simulation.ctrl[1]?.toFixed(3)}, ${this.simulation.ctrl[2]?.toFixed(3)}, ${this.simulation.ctrl[3]?.toFixed(3)}]`);
            }
            this._debugStepCount = debugSteps + 1;
          }
        }

        // Update action controller
        if (this.actionController) {
          this.actionController.update(timestep, this.currentAction);
        }

        // Clear old perturbations, apply new ones
        if (this.simulation.qfrc_applied) {
          for (let i = 0; i < this.simulation.qfrc_applied.length; i++) {
            this.simulation.qfrc_applied[i] = 0.0;
          }
        }

        // Handle dragging (disabled during actions)
        if (!this.actionController || !this.actionController.isActionActive()) {
          const dragged = this.dragStateManager.physicsObject;
          const bodyID = (dragged as unknown as { bodyID?: number })?.bodyID;
          if (dragged && bodyID && this.model.body_mass) {
            for (let b = 0; b < this.model.nbody; b++) {
              if (this.bodies[b]) {
                getPosition(this.simulation.xpos, b, this.bodies[b].position);
                getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
                this.bodies[b].updateWorldMatrix(false, false);
              }
            }

            // Update lights during dragging
            for (let l = 0; l < this.model.nlight; l++) {
              if (this.lights[l]) {
                getPosition(this.simulation.light_xpos, l, this.lights[l].position);
                getPosition(this.simulation.light_xdir, l, this.tmpVec);
                this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
              }
            }

            this.dragStateManager.update();
            const dragForce = this.dragStateManager.currentWorld.clone().sub(this.dragStateManager.worldHit);
            const force = toMujocoPos(dragForce.multiplyScalar(this.model.body_mass[bodyID] * 250));
            const point = toMujocoPos(this.dragStateManager.worldHit.clone());

            this.simulation.applyForce(force.x, force.y, force.z, 0, 0, 0, point.x, point.y, point.z, bodyID);
          }
        }

        this.simulation.step();

        // Debug: Log after simulation step
        if (this.actionController?.isActionActive()) {
          const debugSteps = this._debugStepCount || 0;
          if (debugSteps <= 3 && debugSteps > 0) {
            console.log(`  After step - Ctrl[0-3]: [${this.simulation.ctrl[0]?.toFixed(3)}, ${this.simulation.ctrl[1]?.toFixed(3)}, ${this.simulation.ctrl[2]?.toFixed(3)}, ${this.simulation.ctrl[3]?.toFixed(3)}]`);
            // Check if joint positions changed
            if (this.simulation.qpos && this.simulation.qpos.length > 10) {
              console.log(`  Joint qpos[7-10]: [${this.simulation.qpos[7]?.toFixed(3)}, ${this.simulation.qpos[8]?.toFixed(3)}, ${this.simulation.qpos[9]?.toFixed(3)}, ${this.simulation.qpos[10]?.toFixed(3)}]`);
            }
          }
        }

        this.mujocoTime += timestep * 1000.0;
      }
    }

    // Update body positions
    if (this.simulation && this.model && this.bodies) {
      for (let b = 0; b < this.model.nbody; b++) {
        if (this.bodies[b]) {
          getPosition(this.simulation.xpos, b, this.bodies[b].position);
          getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
          this.bodies[b].updateWorldMatrix(false, false);
        }
      }

      // Update light transforms - matching mujoco_wasm
      for (let l = 0; l < this.model.nlight; l++) {
        if (this.lights[l]) {
          getPosition(this.simulation.light_xpos, l, this.lights[l].position);
          getPosition(this.simulation.light_xdir, l, this.tmpVec);
          this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
        }
      }

      // Update camera to follow robot base
      if (this.bodies[1]) { // Body 1 is usually the torso/base
        const robotPosition = this.bodies[1].position.clone();
        this.cameraController.update(robotPosition, 0.016); // Assume ~60fps
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

export default function MuJoCoSimulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<MuJoCoDemo | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('humanoid');
  const [currentAction, setCurrentAction] = useState<string>('idle');
  const [physicsPaused, setPhysicsPaused] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);

  const switchModelLocal = async (demo: MuJoCoDemo, modelKey: string): Promise<void> => {
    if (!(modelKey in ROBOT_MODELS)) {
      throw new Error(`Invalid model key: ${modelKey}`);
    }

    console.log(`Switching to model: ${modelKey}`);

    // Pause physics during transition
    demo.params.paused = true;
    setPhysicsPaused(true);
    setIsLoadingModel(true);

    // Small delay to ensure loading state is visible
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Load new model using the demo's loadModel method with correct model name
      await demo.loadModel(ROBOT_MODELS[modelKey].path, modelKey);
      setCurrentModel(modelKey);

      // Resume physics after a brief moment
      await new Promise(resolve => setTimeout(resolve, 100));
      demo.params.paused = false;
      setPhysicsPaused(false);

      console.log(`Successfully switched to ${modelKey}`);
    } catch (error) {
      console.error('Error switching model:', error);
      throw error;
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleModelChange = async (model: string) => {
    if (demoRef.current && model !== currentModel) {
      try {
        await switchModelLocal(demoRef.current, model);
      } catch (error) {
        console.error('Failed to switch model:', error);
        setError(error as Error);
      }
    }
  };

  const handleActionChange = (action: string) => {
    if (demoRef.current) {
      demoRef.current.setAction(action);
      setCurrentAction(action);
    }
  };

  const handleReset = () => {
    demoRef.current?.resetSimulation();
  };

  const handleTogglePhysics = () => {
    if (demoRef.current) {
      demoRef.current.params.paused = !demoRef.current.params.paused;
      setPhysicsPaused(demoRef.current.params.paused);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && containerRef.current && !isInitialized) {
      setIsInitialized(true);
      initDemo(containerRef.current, demoRef).catch(setError);
    }
  }, [isMounted, isInitialized]);

  if (!isMounted) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} />;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gray-900"
    >
      <ControlPanel
        currentModel={currentModel}
        currentAction={currentAction}
        physicsPaused={physicsPaused}
        isLoadingModel={isLoadingModel}
        onModelChange={handleModelChange}
        onActionChange={handleActionChange}
        onReset={handleReset}
        onTogglePhysics={handleTogglePhysics}
      />
    </div>
  );
}

async function initDemo(container: HTMLDivElement, demoRef: React.MutableRefObject<MuJoCoDemo | null>) {
  try {
    // Load MuJoCo WASM module
    const mujoco = await loadMuJoCo();
    setupMuJoCoFileSystem(mujoco);

    // Create demo instance
    const demo = new MuJoCoDemo(mujoco, container);
    demoRef.current = demo;

    // Load default model with correct model name
    await demo.loadModel(ROBOT_MODELS.humanoid.path, 'humanoid');

    // Setup keyboard controls
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyR') {
        demo.resetSimulation();
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Start animation loop
    startAnimationLoop(demo);

    } catch (error) {
    console.error('Failed to initialize MuJoCo demo:', error);
    throw error;
  }
}


function startAnimationLoop(demo: MuJoCoDemo): void {
    function animate(timeMS: number) {
      requestAnimationFrame(animate);
      demo.render(timeMS);
    }

  animate(performance.now());
}



interface SceneSetup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
}

function createScene(container: HTMLElement): SceneSetup {
  // Scene setup - MuJoCo WASM style
  const scene = new THREE.Scene();

  // Set background color matching mujoco_wasm
  scene.background = new THREE.Color(0.15, 0.25, 0.35);

  // Add fog matching mujoco_wasm
  scene.fog = new THREE.Fog(scene.background as THREE.Color, 15, 25.5);

  // Camera setup
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100);
  camera.position.set(2.0, 1.7, 1.7);
  scene.add(camera);

  // Low ambient light - matching mujoco_wasm
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  // Renderer setup with improved settings
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // Classic MuJoCo shadow style
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Controls setup
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.7, 0);
  controls.panSpeed = 2;
  controls.zoomSpeed = 1;
  controls.enableDamping = true;
  controls.dampingFactor = 0.10;
  controls.screenSpacePanning = true;
  controls.update();

  return { scene, camera, renderer, controls };
}