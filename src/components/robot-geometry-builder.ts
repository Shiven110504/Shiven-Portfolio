import * as THREE from 'three';
import { MuJoCoModel, MuJoCoSimulation } from './types/mujoco';
import { getQuaternion } from './MuJoCoUtils';

export interface RobotGeometry {
  bodies: { [key: number]: THREE.Group };
  groundPlane: THREE.Mesh | null;
  mujocoRoot: THREE.Group;
}

export function buildRobotGeometry(
  model: MuJoCoModel,
  scene: THREE.Scene
): RobotGeometry {
  const bodies: { [key: number]: THREE.Group } = {};
  const mujocoRoot = new THREE.Group();
  mujocoRoot.name = "MuJoCo Root";
  scene.add(mujocoRoot);

  let groundPlane: THREE.Mesh | null = null;

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

    const geometry = createGeometry(type, size);
    const material = createMaterial(type);
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.castShadow = true;
    mesh.receiveShadow = type === 0;

    // Set bodyID on the mesh for raycaster detection
    (mesh as THREE.Mesh & { bodyID?: number }).bodyID = b;
    if (bodies[b]) {
      bodies[b].bodyID = b;
    }

    // Position and orient the mesh
    positionMesh(mesh, model, g, type);
    
    if (type === 0) {
      groundPlane = mesh;
    }

    bodies[b].add(mesh);
  }

  return { bodies, groundPlane, mujocoRoot };
}

function createGeometry(type: number, size: number[]): THREE.BufferGeometry {
  switch (type) {
    case 0: // Plane
      return new THREE.PlaneGeometry(20, 20);
    case 2: // Sphere
      return new THREE.SphereGeometry(size[0]);
    case 3: // Capsule
      return new THREE.CapsuleGeometry(size[0], size[1] * 2.0, 20, 20);
    case 4: // Cylinder
      return new THREE.CylinderGeometry(size[0], size[0], size[1] * 2.0);
    case 5: // Box
      return new THREE.BoxGeometry(size[0] * 2.0, size[2] * 2.0, size[1] * 2.0);
    default:
      return new THREE.SphereGeometry(size[0] * 0.5);
  }
}

function createMaterial(type: number): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: false
  });

  if (type === 0) {
    material.color.setHex(0x666666);
  }

  return material;
}

function positionMesh(
  mesh: THREE.Mesh,
  model: MuJoCoModel,
  g: number,
  type: number
): void {
  if (type === 0) {
    // Ground plane
    mesh.position.set(
      model.geom_pos[(g * 3) + 0],
      0,
      -model.geom_pos[(g * 3) + 1]
    );
    mesh.rotation.x = -Math.PI / 2;
  } else {
    // Other geometries
    mesh.position.set(
      model.geom_pos[(g * 3) + 0],
      model.geom_pos[(g * 3) + 2],
      -model.geom_pos[(g * 3) + 1]
    );
    getQuaternion(model.geom_quat, g, mesh.quaternion);
  }
}
