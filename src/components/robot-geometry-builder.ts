import * as THREE from 'three';
import { MuJoCoModel, MuJoCoModule } from './types/mujoco';
import { getQuaternion } from './mujoco-loader';

export interface RobotGeometry {
  bodies: { [key: number]: THREE.Group };
  groundPlane: THREE.Mesh | null;
  mujocoRoot: THREE.Group;
}

export function buildRobotGeometry(
  mujoco: MuJoCoModule,
  model: MuJoCoModel,
  scene: THREE.Scene
): RobotGeometry {
  const bodies: { [key: number]: THREE.Group } = {};
  const meshes: { [key: number]: THREE.BufferGeometry } = {};
  const mujocoRoot = new THREE.Group();
  mujocoRoot.name = "MuJoCo Root";
  scene.add(mujocoRoot);

  let groundPlane: THREE.Mesh | null = null;

  try {
    // Validate model before accessing properties
    if (!isValidMuJoCoModel(model)) {
      throw new Error('Invalid MuJoCo model object');
    }

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
    let hasCustomMesh = false;

    // Handle different geometry types
    if (type === 7) { // mjGEOM_MESH
      const meshID = model.geom_dataid[g];

      if (!(meshID in meshes)) {
        geometry = new THREE.BufferGeometry();

        // Get mesh data from MuJoCo model
        const vertex_buffer = model.mesh_vert.subarray(
          model.mesh_vertadr[meshID] * 3,
          (model.mesh_vertadr[meshID] + model.mesh_vertnum[meshID]) * 3
        );

        // Convert coordinate system (MuJoCo Z-up to Three.js Y-up)
        for (let v = 0; v < vertex_buffer.length; v += 3) {
          const temp = vertex_buffer[v + 1];
          vertex_buffer[v + 1] = vertex_buffer[v + 2];
          vertex_buffer[v + 2] = -temp;
        }

        const normal_buffer = model.mesh_normal.subarray(
          model.mesh_vertadr[meshID] * 3,
          (model.mesh_vertadr[meshID] + model.mesh_vertnum[meshID]) * 3
        );

        // Convert normal coordinate system
        for (let v = 0; v < normal_buffer.length; v += 3) {
          const temp = normal_buffer[v + 1];
          normal_buffer[v + 1] = normal_buffer[v + 2];
          normal_buffer[v + 2] = -temp;
        }

        const uv_buffer = model.mesh_texcoord.subarray(
          model.mesh_texcoordadr[meshID] * 2,
          (model.mesh_texcoordadr[meshID] + model.mesh_vertnum[meshID]) * 2
        );

        const triangle_buffer = model.mesh_face.subarray(
          model.mesh_faceadr[meshID] * 3,
          (model.mesh_faceadr[meshID] + model.mesh_facenum[meshID]) * 3
        );

        geometry.setAttribute("position", new THREE.BufferAttribute(vertex_buffer, 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(normal_buffer, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv_buffer, 2));
        geometry.setIndex(Array.from(triangle_buffer));

        meshes[meshID] = geometry;
        hasCustomMesh = true;
      } else {
        geometry = meshes[meshID];
        hasCustomMesh = true;
      }
    } else {
      geometry = createGeometry(type, size);
    }

    const material = createMaterial(type, model, g);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.castShadow = true;
    mesh.receiveShadow = type === 0;

    // Set bodyID on the mesh for raycaster detection
    (mesh as THREE.Mesh & { bodyID?: number }).bodyID = b;
    if (bodies[b]) {
      bodies[b].bodyID = b;
      bodies[b].has_custom_mesh = hasCustomMesh;
    }

    // Position and orient the mesh
    positionMesh(mesh, model, g, type);

    if (type === 0) {
      groundPlane = mesh;
    }

    bodies[b].add(mesh);
  }

  return { bodies, groundPlane, mujocoRoot };
  } catch (error) {
    console.error('Error building robot geometry:', error);
    // Return empty geometry on error
    return { bodies: {}, groundPlane: null, mujocoRoot };
  }
}

function isValidMuJoCoModel(model: MuJoCoModel): boolean {
  try {
    // Try to access basic model properties to check if it's valid
    if (model && typeof model === 'object' && model !== null) {
      const ngeom = (model as { ngeom?: number }).ngeom;
      const nbody = (model as { nbody?: number }).nbody;
      return typeof ngeom === 'number' && typeof nbody === 'number';
    }
    return false;
  } catch {
    return false;
  }
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

function createMaterial(type: number, model: MuJoCoModel, g: number): THREE.MeshPhysicalMaterial {
  // Get color and material properties
  let color = [
    model.geom_rgba[(g * 4) + 0],
    model.geom_rgba[(g * 4) + 1],
    model.geom_rgba[(g * 4) + 2],
    model.geom_rgba[(g * 4) + 3]
  ];

  let texture: THREE.DataTexture | undefined;

  // Check if geometry has a material
  if (model.geom_matid[g] !== -1) {
    const matId = model.geom_matid[g];
    color = [
      model.mat_rgba[(matId * 4) + 0],
      model.mat_rgba[(matId * 4) + 1],
      model.mat_rgba[(matId * 4) + 2],
      model.mat_rgba[(matId * 4) + 3]
    ];

    // Handle textures if present
    const texId = model.mat_texid[matId];
    if (texId !== -1) {
      const width = model.tex_width[texId];
      const height = model.tex_height[texId];
      const offset = model.tex_adr[texId];
      const rgbArray = model.tex_rgb;
      const rgbaArray = new Uint8Array(width * height * 4);

      for (let p = 0; p < width * height; p++) {
        rgbaArray[(p * 4) + 0] = rgbArray[offset + ((p * 3) + 0)];
        rgbaArray[(p * 4) + 1] = rgbArray[offset + ((p * 3) + 1)];
        rgbaArray[(p * 4) + 2] = rgbArray[offset + ((p * 3) + 2)];
        rgbaArray[(p * 4) + 3] = 255;
      }

      texture = new THREE.DataTexture(rgbaArray, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);

      // Set texture wrapping and repeat
      texture.repeat = new THREE.Vector2(1, 1);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
    }
  }

  // Create material with enhanced properties for better lighting
  const materialProps: THREE.MeshPhysicalMaterialParameters = {
    color: new THREE.Color(color[0], color[1], color[2]),
    transparent: color[3] < 1.0,
    opacity: color[3],
    // Enhanced material properties for better lighting
    metalness: model.geom_matid[g] !== -1 ? Math.min(model.mat_reflectance[model.geom_matid[g]] * 0.3, 0.2) : 0.1,
    roughness: model.geom_matid[g] !== -1 ? Math.max(1.0 - model.mat_shininess[model.geom_matid[g]], 0.3) : 0.7,
    clearcoat: 0.1,
    clearcoatRoughness: 0.1,
    // Add some emissive glow for better visibility
    emissive: new THREE.Color(color[0] * 0.02, color[1] * 0.02, color[2] * 0.02),
    emissiveIntensity: 0.1
  };

  // Only add texture if it exists
  if (texture) {
    materialProps.map = texture;
  }

  const material = new THREE.MeshPhysicalMaterial(materialProps);

  // Special handling for ground plane
  if (type === 0) {
    material.color.setHex(0x4a5568);
    material.metalness = 0.0;
    material.roughness = 0.8;
    material.emissive.setHex(0x000000);
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
