'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './DragStateManager';
import { buildRobotGeometry } from './robot-geometry-builder';
import { loadMuJoCo, setupMuJoCoFileSystem, loadRobotModel, validateModelFile, getPosition, getQuaternion, toMujocoPos } from './mujoco-loader';
import { ROBOT_MODELS } from './robot-models';
import { MuJoCoModule, MuJoCoModel, MuJoCoState, MuJoCoSimulation } from './types/mujoco';
import { LoadingScreen } from './ui/loading-screen';
import { ControlPanel } from './ui/control-panel';
import { ErrorScreen } from './ui/error-screen';

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
  dragStateManager: DragStateManager;
  mujocoTime: number = 0.0;
  params: { scene: string; paused: boolean; help: boolean; ctrlnoiserate: number; ctrlnoisestd: number; keyframeNumber: number };
  currentModel: string;
  currentAction: string;

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

    // Initialize params
    this.params = {
      scene: 'humanoid.xml',
      paused: false,
      help: false,
      ctrlnoiserate: 0.0,
      ctrlnoisestd: 0.0,
      keyframeNumber: 0
    };
  }

  async loadModel(modelPath: string): Promise<void> {
    console.log(`Loading model: ${modelPath}`);

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
    const { bodies, groundPlane } = buildRobotGeometry(this.mujoco, this.model, this.scene);
    this.bodies = bodies;

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

    console.log(`Successfully loaded model: ${modelPath}`);
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
        // Clear old perturbations, apply new ones
        if (this.simulation.qfrc_applied) {
          for (let i = 0; i < this.simulation.qfrc_applied.length; i++) {
            this.simulation.qfrc_applied[i] = 0.0;
          }
        }

        // Handle dragging
        const dragged = this.dragStateManager.physicsObject;
        if (dragged && dragged.bodyID && this.model.body_mass) {
          for (let b = 0; b < this.model.nbody; b++) {
            if (this.bodies[b]) {
              getPosition(this.simulation.xpos, b, this.bodies[b].position);
              getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
              this.bodies[b].updateWorldMatrix();
            }
          }

          const bodyID = dragged.bodyID;
          this.dragStateManager.update();
          const dragForce = this.dragStateManager.currentWorld.clone().sub(this.dragStateManager.worldHit);
          const force = toMujocoPos(dragForce.multiplyScalar(this.model.body_mass[bodyID] * 250));
          const point = toMujocoPos(this.dragStateManager.worldHit.clone());

          this.simulation.applyForce(force.x, force.y, force.z, 0, 0, 0, point.x, point.y, point.z, bodyID);
        }

        this.simulation.step();
        this.mujocoTime += timestep * 1000.0;
      }
    }

    // Update body positions
    if (this.simulation && this.model && this.bodies) {
      for (let b = 0; b < this.model.nbody; b++) {
        if (this.bodies[b]) {
          getPosition(this.simulation.xpos, b, this.bodies[b].position);
          getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
          this.bodies[b].updateWorldMatrix();
        }
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
      // Load new model using the demo's loadModel method
      await demo.loadModel(ROBOT_MODELS[modelKey].path);
      demo.currentModel = modelKey;
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
      demoRef.current.currentAction = action;
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

    // Load default model
    await demo.loadModel(ROBOT_MODELS.humanoid.path);
    demo.currentModel = 'humanoid';

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
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.1, 0.15, 0.25);
  scene.fog = new THREE.Fog(scene.background, 12, 25);

  // Camera setup
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100);
  camera.position.set(2.0, 1.7, 2.0);
  scene.add(camera);

  // Lighting setup - Beautiful and realistic lighting
  setupSceneLighting(scene);

  // Renderer setup with improved settings
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Controls setup
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.panSpeed = 2;
  controls.zoomSpeed = 1;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = true;
  controls.minDistance = 1;
  controls.maxDistance = 20;
  controls.update();

  return { scene, camera, renderer, controls };
}

function setupSceneLighting(scene: THREE.Scene): void {
  // Ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  // Main directional light (sun-like)
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
  mainLight.position.set(5, 8, 5);
  mainLight.castShadow = true;

  // Configure shadow properties
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.camera.left = -10;
  mainLight.shadow.camera.right = 10;
  mainLight.shadow.camera.top = 10;
  mainLight.shadow.camera.bottom = -10;
  mainLight.shadow.bias = -0.0001;

  scene.add(mainLight);

  // Fill light (softer, opposite side)
  const fillLight = new THREE.DirectionalLight(0xb8d4f0, 0.3);
  fillLight.position.set(-3, 4, -3);
  scene.add(fillLight);

  // Rim light for depth and separation
  const rimLight = new THREE.DirectionalLight(0xffe4b5, 0.4);
  rimLight.position.set(0, 6, -8);
  scene.add(rimLight);

  // Subtle blue accent light
  const accentLight = new THREE.DirectionalLight(0x87ceeb, 0.2);
  accentLight.position.set(-5, 2, 5);
  scene.add(accentLight);
}