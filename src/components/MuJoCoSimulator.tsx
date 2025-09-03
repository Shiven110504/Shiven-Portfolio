'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './DragStateManager';
import { PhysicsEngine } from './physics-engine';
import { buildRobotGeometry } from './robot-geometry-builder';
import { createScene } from './scene-setup';
import { loadMuJoCo, setupMuJoCoFileSystem, loadRobotModel } from './mujoco-loader';
import { ROBOT_MODELS } from './robot-models';
import { MuJoCoModule, MuJoCoSimulation } from './types/mujoco';
import { LoadingScreen } from './ui/loading-screen';
import { ControlPanel } from './ui/control-panel';
import { ErrorScreen } from './ui/error-screen';

export default function MuJoCoSimulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && containerRef.current && !isInitialized) {
      setIsInitialized(true);
      initDemo(containerRef.current).catch(setError);
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
        currentModel={window.mujocoDemo?.currentModel || 'humanoid'}
        currentAction={window.mujocoDemo?.currentAction || 'idle'}
        physicsPaused={window.mujocoDemo?.physicsPaused || false}
        onModelChange={(model) => window.mujocoDemo?.switchModel?.(model)}
        onActionChange={(action) => window.mujocoDemo?.setAction?.(action)}
        onReset={() => window.mujocoDemo?.resetSimulation?.()}
        onTogglePhysics={() => window.mujocoDemo?.togglePhysics?.()}
      />
    </div>
  );
}

async function initDemo(container: HTMLDivElement) {
  try {
    // Load MuJoCo WASM module
    const mujoco = await loadMuJoCo();
    setupMuJoCoFileSystem(mujoco);

    // Load default model
    const currentModel = 'humanoid';
    await loadRobotModel(mujoco, ROBOT_MODELS[currentModel].path);

    // Create MuJoCo objects
    const model = new mujoco.Model("/working/model.xml");
    const state = new mujoco.State(model);
    const simulation = new mujoco.Simulation(model, state);

    // Initialize simulation
    simulation.resetData();
    simulation.forward();

    // Create Three.js scene
    const { scene, camera, renderer, controls } = createScene(container);

    // Build robot geometry
    const { bodies, groundPlane } = buildRobotGeometry(model, scene);

    // Initialize drag state manager
    const dragStateManager = new DragStateManager(scene, renderer, camera, container, controls);

    // Initialize physics engine
    const physicsEngine = new PhysicsEngine(model, simulation, bodies, dragStateManager);

    // Setup custom scroll handling
    setupCustomScrollHandling(container, camera);

    // Start animation loop
    startAnimationLoop(physicsEngine, controls, renderer, scene, camera);

    // Setup keyboard controls
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyR') {
        window.mujocoDemo?.resetSimulation?.();
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Create demo instance
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
      resetSimulation: () => resetSimulation(simulation),
      switchModel: (modelKey: string) => switchModel(mujoco, modelKey),
      setAction: (action: string) => setAction(action),
      togglePhysics: () => togglePhysics(physicsEngine),
      currentModel,
      currentAction: 'idle',
      physicsPaused: false,
      ground: groundPlane,
      cleanup: () => cleanup(renderer, simulation, handleKeyDown, container)
    };

    } catch (error) {
    console.error('Failed to initialize MuJoCo demo:', error);
    throw error;
  }
}

function setupCustomScrollHandling(container: HTMLElement, camera: THREE.PerspectiveCamera): void {
    const handleWheel = (event: WheelEvent) => {
      if (event.metaKey || event.altKey) {
        event.preventDefault();
        const zoomSpeed = 0.01;
        const delta = event.deltaY * zoomSpeed;
        const zoom = camera.zoom * (1 - delta);
        camera.zoom = Math.max(0.1, Math.min(10, zoom));
        camera.updateProjectionMatrix();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
}

function startAnimationLoop(
  physicsEngine: PhysicsEngine,
  controls: OrbitControls,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): void {
    function animate(timeMS: number) {
      requestAnimationFrame(animate);
      controls.update();

    physicsEngine.step(timeMS);
    physicsEngine.updateBodyPositions();

      renderer.render(scene, camera);
    }

  animate(performance.now());
}

function resetSimulation(simulation: MuJoCoSimulation): void {
  try {
    simulation.resetData();
    simulation.forward();
      } catch (error) {
        console.error('Failed to reset simulation:', error);
  }
}

async function switchModel(mujoco: MuJoCoModule, modelKey: string): Promise<void> {
  if (!(modelKey in ROBOT_MODELS) || !window.mujocoDemo) return;

      try {
        // Load new model
    await loadRobotModel(mujoco, ROBOT_MODELS[modelKey as keyof typeof ROBOT_MODELS].path);

    // Clean up old simulation
        if (window.mujocoDemo.simulation) {
          try {
            window.mujocoDemo.simulation.free();
          } catch (e) {
            console.warn('Error freeing old simulation:', e);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));

    // Create new simulation
    const newModel = new mujoco.Model("/working/model.xml");
    const newState = new mujoco.State(newModel);
    const newSimulation = new mujoco.Simulation(newModel, newState);

        // Update global references
        window.mujocoDemo.model = newModel;
        window.mujocoDemo.state = newState;
        window.mujocoDemo.simulation = newSimulation;
        window.mujocoDemo.currentModel = modelKey;

    // Reset simulation
            newSimulation.resetData();
            newSimulation.forward();

      } catch (error) {
        console.error('Failed to switch model:', error);
    // TODO: Implement fallback to previous model when switch fails
  }
}

function setAction(action: string): void {
      if (window.mujocoDemo) {
        window.mujocoDemo.currentAction = action;
        // TODO: Implement actual action switching when joint movement scripts are available
    // This would involve loading predefined joint trajectories or control sequences
  }
      }

function togglePhysics(physicsEngine: PhysicsEngine): void {
  const newPausedState = !physicsEngine.isPaused();
  physicsEngine.setPaused(newPausedState);

        if (window.mujocoDemo) {
    window.mujocoDemo.physicsPaused = newPausedState;
  }
}

function cleanup(
  renderer: THREE.WebGLRenderer,
  simulation: MuJoCoSimulation,
  handleKeyDown: (event: KeyboardEvent) => void,
  container: HTMLElement
): void {
      window.removeEventListener('keydown', handleKeyDown);
  container.removeEventListener('wheel', () => {});
      if (renderer) renderer.dispose();
      if (simulation) simulation.free();
      if (window.mujocoDemo) {
        window.mujocoDemo = undefined;
  }
}