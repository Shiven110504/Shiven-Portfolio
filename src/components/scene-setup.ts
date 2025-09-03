import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SceneSetup {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
}

export function createScene(container: HTMLElement): SceneSetup {
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.05, 0.08, 0.15);
  scene.fog = new THREE.Fog(0x1a1a2e, 8, 30);

  // Add atmospheric elements
  addAtmosphericElements(scene);

  // Camera setup
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 100);
  camera.position.set(3.0, 2.0, 3.0);
  camera.lookAt(0, 1.3, 0);
  scene.add(camera);

  // Lighting setup
  setupLighting(scene);

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Controls setup
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.3, 0);
  controls.panSpeed = 2;
  controls.zoomSpeed = 1;
  controls.enableDamping = true;
  controls.dampingFactor = 0.10;
  controls.screenSpacePanning = true;
  controls.enableZoom = false;
  controls.update();

  return { scene, camera, renderer, controls };
}

function addAtmosphericElements(scene: THREE.Scene) {
  // Fog plane
  const fogGeometry = new THREE.PlaneGeometry(100, 100);
  const fogMaterial = new THREE.MeshBasicMaterial({
    color: 0x2a2a4e,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const fogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
  fogPlane.rotation.x = -Math.PI / 2;
  fogPlane.position.y = -0.5;
  scene.add(fogPlane);

  // Starfield
  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true,
    opacity: 0.8
  });

  const starVertices = [];
  for (let i = 0; i < 500; i++) {
    const x = (Math.random() - 0.5) * 200;
    const y = Math.random() * 50 + 10;
    const z = (Math.random() - 0.5) * 200;
    starVertices.push(x, y, z);
  }

  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // Particles
  const particleGeometry = new THREE.BufferGeometry();
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x87ceeb,
    size: 0.05,
    transparent: true,
    opacity: 0.3
  });

  const particleVertices = [];
  for (let i = 0; i < 200; i++) {
    const x = (Math.random() - 0.5) * 60;
    const y = Math.random() * 20 + 2;
    const z = (Math.random() - 0.5) * 60;
    particleVertices.push(x, y, z);
  }

  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particleVertices, 3));
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
}

function setupLighting(scene: THREE.Scene) {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x4a5568, 0.4);
  scene.add(ambientLight);

  // Key light
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(5, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
  scene.add(keyLight);

  // Fill light
  const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
  fillLight.position.set(-3, 4, -3);
  scene.add(fillLight);

  // Rim light
  const rimLight = new THREE.DirectionalLight(0xffd700, 0.4);
  rimLight.position.set(0, 6, -8);
  scene.add(rimLight);
}
