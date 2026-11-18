import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_URL, UNITS } from './config.js';

// Loads the GLB once. Returns { type: { geo, mat, len, h, d } } for each unit type.
export async function loadUnits() {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const byNode = {};
  gltf.scene.traverse((o) => { if (o.isMesh) byNode[o.name] = o; });
  const units = {};
  for (const [type, u] of Object.entries(UNITS)) {
    const src = byNode[u.node];
    if (!src) throw new Error(`Object "${u.node}" not found in ${MODEL_URL}`);
    src.geometry.computeBoundingBox();
    const b = src.geometry.boundingBox;
    const mat = src.material.clone();
    colorize(mat);
    units[type] = { geo: src.geometry, mat, len: b.max.x - b.min.x, h: b.max.y, d: b.max.z - b.min.z };
  }
  return units;
}

// Lets one material be re-coloured while keeping the texture's light and dark detail.
function colorize(mat) {
  const tint = { value: new THREE.Color(1, 1, 1) }, amount = { value: 0 };
  mat.userData = { tint, amount };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = tint; sh.uniforms.uAmount = amount;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uTint; uniform float uAmount;\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint * (0.35 + 1.3 * lum), uAmount);`);
  };
  mat.customProgramCacheKey = () => 'colorize';
}
export function setColor(mat, hex) {
  mat.userData.amount.value = hex ? 0.88 : 0;
  if (hex) mat.userData.tint.value.set(hex);
}
const FINISH = { matte: [1, 1], satin: [0.7, 1], gloss: [0.35, 1] }; // [roughness, metalness] multipliers
export function setFinish(mat, finish) {
  [mat.roughness, mat.metalness] = FINISH[finish];
}
