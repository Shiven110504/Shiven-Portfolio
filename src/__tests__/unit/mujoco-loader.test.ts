import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getPosition, getQuaternion, toMujocoPos, standardNormal } from '../../components/mujoco-loader';

describe('getPosition', () => {
  it('converts MuJoCo Z-up to Three.js Y-up (swizzle=true)', () => {
    // MuJoCo: x=1, y=2, z=3 at index 0
    const buffer = new Float64Array([1, 2, 3]);
    const target = new THREE.Vector3();
    getPosition(buffer, 0, target, true);

    // Three.js: x=mj.x, y=mj.z, z=-mj.y
    expect(target.x).toBeCloseTo(1);
    expect(target.y).toBeCloseTo(3);
    expect(target.z).toBeCloseTo(-2);
  });

  it('passes through without swizzle (swizzle=false)', () => {
    const buffer = new Float64Array([4, 5, 6]);
    const target = new THREE.Vector3();
    getPosition(buffer, 0, target, false);

    expect(target.x).toBeCloseTo(4);
    expect(target.y).toBeCloseTo(5);
    expect(target.z).toBeCloseTo(6);
  });

  it('reads from correct offset for index > 0', () => {
    // index=1 means elements at positions 3,4,5
    const buffer = new Float64Array([0, 0, 0, 7, 8, 9]);
    const target = new THREE.Vector3();
    getPosition(buffer, 1, target, false);

    expect(target.x).toBeCloseTo(7);
    expect(target.y).toBeCloseTo(8);
    expect(target.z).toBeCloseTo(9);
  });
});

describe('getQuaternion', () => {
  it('converts MuJoCo quaternion to Three.js (swizzle=true)', () => {
    // MuJoCo quaternion: w,x,y,z at index 0
    const buffer = new Float64Array([1, 0, 0, 0]); // identity
    const target = new THREE.Quaternion();
    getQuaternion(buffer, 0, target, true);

    // Three.js: x=-mj.x, y=-mj.z, z=mj.y, w=-mj.w
    expect(target.x).toBeCloseTo(0);   // -mj.x = 0
    expect(target.y).toBeCloseTo(0);   // -mj.z = 0
    expect(target.z).toBeCloseTo(0);   // mj.y = 0
    expect(target.w).toBeCloseTo(-1);  // -mj.w = -1
  });

  it('passes through without swizzle (swizzle=false)', () => {
    const buffer = new Float64Array([0.1, 0.2, 0.3, 0.9]);
    const target = new THREE.Quaternion();
    getQuaternion(buffer, 0, target, false);

    expect(target.x).toBeCloseTo(0.1);
    expect(target.y).toBeCloseTo(0.2);
    expect(target.z).toBeCloseTo(0.3);
    expect(target.w).toBeCloseTo(0.9);
  });
});

describe('toMujocoPos', () => {
  it('converts Three.js Y-up to MuJoCo Z-up in-place', () => {
    const v = new THREE.Vector3(1, 2, 3);
    toMujocoPos(v);

    // MuJoCo: x=three.x, y=-three.z, z=three.y
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(-3);
    expect(v.z).toBeCloseTo(2);
  });

  it('is the inverse of getPosition swizzle (round-trip)', () => {
    const original = new THREE.Vector3(1, 2, 3);
    const buffer = new Float64Array([original.x, -original.z, original.y]); // MuJoCo encoding
    const decoded = new THREE.Vector3();
    getPosition(buffer, 0, decoded, true);

    // decoded should equal original
    expect(decoded.x).toBeCloseTo(original.x);
    expect(decoded.y).toBeCloseTo(original.y);
    expect(decoded.z).toBeCloseTo(original.z);
  });
});

describe('standardNormal', () => {
  it('returns a number', () => {
    expect(typeof standardNormal()).toBe('number');
  });

  it('produces values with approximately zero mean over many samples', () => {
    const samples = Array.from({ length: 1000 }, standardNormal);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(mean)).toBeLessThan(0.2); // within 3 sigma at N=1000
  });
});
