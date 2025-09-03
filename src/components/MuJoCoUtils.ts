import * as THREE from 'three';

// Coordinate conversion utilities for MuJoCo <-> Three.js
export function getPosition(
  buffer: Float32Array | Float64Array,
  index: number,
  target: THREE.Vector3,
  swizzle = true
) {
  if (swizzle) {
    // Convert from MuJoCo Z-up to Three.js Y-up
    return target.set(
      buffer[(index * 3) + 0],
      buffer[(index * 3) + 2],
      -buffer[(index * 3) + 1]
    );
  } else {
    return target.set(
      buffer[(index * 3) + 0],
      buffer[(index * 3) + 1],
      buffer[(index * 3) + 2]
    );
  }
}

export function getQuaternion(
  buffer: Float32Array | Float64Array,
  index: number,
  target: THREE.Quaternion,
  swizzle = true
) {
  if (swizzle) {
    // Convert from MuJoCo to Three.js quaternion
    return target.set(
      -buffer[(index * 4) + 1],
      -buffer[(index * 4) + 3],
      buffer[(index * 4) + 2],
      -buffer[(index * 4) + 0]
    );
  } else {
    return target.set(
      buffer[(index * 4) + 0],
      buffer[(index * 4) + 1],
      buffer[(index * 4) + 2],
      buffer[(index * 4) + 3]
    );
  }
}

// Convert Three.js Y-up coordinates to MuJoCo Z-up coordinates
export function toMujocoPos(target: THREE.Vector3) {
  return target.set(target.x, -target.z, target.y);
}
