import * as THREE from 'three';
import { MuJoCoModel, MuJoCoModule } from './types/mujoco';
import { getQuaternion } from './mujoco-loader';
import { Reflector } from './Reflector';

export interface RobotGeometry {
  bodies: { [key: number]: THREE.Group };
  groundPlane: THREE.Mesh | Reflector | null;
  mujocoRoot: THREE.Group;
  lights: THREE.Light[];
}

export function buildRobotGeometry(
  mujoco: MuJoCoModule,
  model: MuJoCoModel,
  scene: THREE.Scene
): RobotGeometry {
  const bodies: { [key: number]: THREE.Group } = {};
  const meshes: { [key: number]: THREE.BufferGeometry } = {};
  const lights: THREE.Light[] = [];
  const mujocoRoot = new THREE.Group();
  mujocoRoot.name = "MuJoCo Root";
  scene.add(mujocoRoot);

  let groundPlane: THREE.Mesh | Reflector | null = null;

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

    let mesh: THREE.Mesh | Reflector;

    if (type === 0) {
      // Create reflective ground plane using Reflector
      // Extract texture from model if available
      const texture = extractTextureFromModel(model, g);
      const planeGeometry = new THREE.PlaneGeometry(100, 100);
      mesh = new Reflector(planeGeometry, {
        texture: texture,
        clipBias: 0.003
      });
      mesh.rotateX(-Math.PI / 2);
      groundPlane = mesh;
    } else {
      // Create regular mesh for other geometries
      const material = createMaterial(type, model, g);
      mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    // Set bodyID on the mesh for raycaster detection
    (mesh as THREE.Mesh & { bodyID?: number }).bodyID = b;
    if (bodies[b]) {
      bodies[b].bodyID = b;
      bodies[b].has_custom_mesh = hasCustomMesh;
    }

    // Position and orient the mesh
    if (type !== 0) {
      positionMesh(mesh as THREE.Mesh, model, g, type);
    } else {
      // Position the ground plane
      mesh.position.set(
        model.geom_pos[(g * 3) + 0],
        0,
        -model.geom_pos[(g * 3) + 1]
      );
    }

    bodies[b].add(mesh);
  }

  // Parse lights from the model
  for (let l = 0; l < model.nlight; l++) {
    let light: THREE.SpotLight | THREE.DirectionalLight;

    if (model.light_directional[l]) {
      light = new THREE.DirectionalLight();
    } else {
      const spotLight = new THREE.SpotLight();
      spotLight.penumbra = 0.5;
      spotLight.decay = model.light_attenuation[l] * 100;
      light = spotLight;
    }

    light.castShadow = true;

    // Shadow configuration
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 10;

    // Add light to world body (body 0) or mujocoRoot
    if (bodies[0]) {
      bodies[0].add(light);
    } else {
      mujocoRoot.add(light);
    }

    lights.push(light);
  }

  // Add a default directional light if no lights in model
  if (model.nlight === 0) {
    const light = new THREE.DirectionalLight();
    mujocoRoot.add(light);
    lights.push(light);
  }

  // Add all bodies to scene hierarchy
  for (let b = 0; b < model.nbody; b++) {
    if (b === 0 || !bodies[0]) {
      mujocoRoot.add(bodies[b]);
    } else if (bodies[b]) {
      bodies[0].add(bodies[b]);
    }
  }

  return { bodies, groundPlane, mujocoRoot, lights };
  } catch (error) {
    console.error('Error building robot geometry:', error);
    // Return empty geometry on error
    return { bodies: {}, groundPlane: null, mujocoRoot, lights: [] };
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
      return new THREE.PlaneGeometry(100, 100); // Large plane for reflections
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

/**
 * Extract texture from MuJoCo model for a specific geometry
 * Matches mujoco_wasm texture extraction logic
 */
function extractTextureFromModel(model: MuJoCoModel, g: number): THREE.DataTexture | undefined {
  // Check if geometry has a material
  if (model.geom_matid[g] === -1) {
    return undefined;
  }

  const matId = model.geom_matid[g];
  const texId = model.mat_texid[matId];

  if (texId === -1) {
    return undefined;
  }

  // Extract texture data from model
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

  const texture = new THREE.DataTexture(rgbaArray, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);

  // For plane geometries (type 0), apply special texture settings matching mujoco_wasm
  texture.repeat = new THREE.Vector2(100, 100);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  return texture;
}

function createMaterial(type: number, model: MuJoCoModel, g: number): THREE.MeshPhysicalMaterial {
  // Get color and material properties
  let color = [
    model.geom_rgba[(g * 4) + 0],
    model.geom_rgba[(g * 4) + 1],
    model.geom_rgba[(g * 4) + 2],
    model.geom_rgba[(g * 4) + 3]
  ];

  let texture: THREE.DataTexture | THREE.Texture | undefined;

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

  // Note: Ground plane (type === 0) is now handled by Reflector, not regular material

  // Create material with enhanced properties for robot parts (Classic MuJoCo style)
  const materialProps: THREE.MeshPhysicalMaterialParameters = {
    color: new THREE.Color(color[0], color[1], color[2]),
    transparent: color[3] < 1.0,
    opacity: color[3],
    // Classic MuJoCo material properties - slightly shiny
    metalness: model.geom_matid[g] !== -1 ? Math.min(model.mat_reflectance[model.geom_matid[g]] * 0.4, 0.3) : 0.15,
    roughness: model.geom_matid[g] !== -1 ? Math.max(1.0 - model.mat_shininess[model.geom_matid[g]], 0.4) : 0.6,
    clearcoat: 0.15,
    clearcoatRoughness: 0.3,
    reflectivity: 0.5,
  };

  // Only add texture if it exists
  if (texture) {
    materialProps.map = texture;
  }

  return new THREE.MeshPhysicalMaterial(materialProps);
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
