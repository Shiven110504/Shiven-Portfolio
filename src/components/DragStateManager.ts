import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class DragStateManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private mousePos: THREE.Vector2;
  private raycaster: THREE.Raycaster;
  private grabDistance: number;
  private controls: OrbitControls;
  private arrow!: THREE.ArrowHelper;
  private localHit: THREE.Vector3;
  public worldHit: THREE.Vector3;
  public currentWorld: THREE.Vector3;
  private mouseDown: boolean;

  public active: boolean;
  public physicsObject: THREE.Object3D | null;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    container: HTMLElement,
    controls: OrbitControls
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.controls = controls;
    
    this.mousePos = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.1;
    this.raycaster.params.Points.threshold = 0.1;
    
    this.grabDistance = 0.0;
    this.active = false;
    this.physicsObject = null;
    this.mouseDown = false;

    this.localHit = new THREE.Vector3();
    this.worldHit = new THREE.Vector3();
    this.currentWorld = new THREE.Vector3();

    this.setupArrow();
    this.setupEventListeners();
  }

  private setupArrow(): void {
    this.arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      15,
      0x666666
    );
    this.arrow.setLength(15, 3, 1);
    this.scene.add(this.arrow);
    
    const lineMaterial = this.arrow.line.material as THREE.Material;
    const coneMaterial = this.arrow.cone.material as THREE.Material;
    lineMaterial.transparent = true;
    coneMaterial.transparent = true;
    lineMaterial.opacity = 0.5;
    coneMaterial.opacity = 0.5;
    this.arrow.visible = false;
  }

  private setupEventListeners(): void {
    this.renderer.domElement.addEventListener('pointerdown', this.onPointer.bind(this), true);
    document.addEventListener('pointermove', this.onPointer.bind(this), true);
    document.addEventListener('pointerup', this.onPointer.bind(this), true);
    document.addEventListener('pointerout', this.onPointer.bind(this), true);
  }

  private updateRaycaster(x: number, y: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mousePos.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.mousePos.y = -((y - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePos, this.camera);
  }

  private start(x: number, y: number): void {
    this.physicsObject = null;
    this.updateRaycaster(x, y);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const intersect of intersects) {
      const obj = intersect.object;
      const bodyID = (obj as THREE.Object3D & { bodyID?: number }).bodyID;

      if (bodyID !== undefined && bodyID > 0) {
        this.physicsObject = obj;
        this.grabDistance = intersect.distance;
        const hit = this.raycaster.ray.origin.clone();
        hit.addScaledVector(this.raycaster.ray.direction, this.grabDistance);

        this.arrow.position.copy(hit);
        this.active = true;
        this.controls.enabled = false;

        this.localHit = obj.worldToLocal(hit.clone());
        this.worldHit.copy(hit);
        this.currentWorld.copy(hit);
        this.arrow.visible = true;
        break;
      }
    }
  }

  private move(x: number, y: number): void {
    if (this.active) {
      this.updateRaycaster(x, y);
      const hit = this.raycaster.ray.origin.clone();
      hit.addScaledVector(this.raycaster.ray.direction, this.grabDistance);
      this.currentWorld.copy(hit);
      this.update();
    }
  }

  public update(): void {
    if (this.worldHit && this.localHit && this.currentWorld && this.arrow && this.physicsObject) {
      // Update worldHit based on current object position (reactive force)
      this.worldHit.copy(this.localHit);
      this.physicsObject.localToWorld(this.worldHit);
      this.arrow.position.copy(this.worldHit);
      this.arrow.setDirection(this.currentWorld.clone().sub(this.worldHit).normalize());
      this.arrow.setLength(this.currentWorld.clone().sub(this.worldHit).length());
    }
  }

  private end(): void {
    this.physicsObject = null;
    this.active = false;
    this.controls.enabled = true;
    this.arrow.visible = false;
    this.mouseDown = false;
  }

  private onPointer(evt: PointerEvent): void {
    if (evt.type === 'pointerdown') {
      evt.preventDefault();
      this.start(evt.clientX, evt.clientY);
      this.mouseDown = true;
    } else if (evt.type === 'pointermove' && this.mouseDown) {
      evt.preventDefault();
      if (this.active) {
        this.move(evt.clientX, evt.clientY);
      }
    } else if (evt.type === 'pointerup' || evt.type === 'pointerout') {
      evt.preventDefault();
      this.end();
    }
  }
}
