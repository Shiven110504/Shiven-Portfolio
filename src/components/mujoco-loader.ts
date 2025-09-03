import { MuJoCoModule } from './types/mujoco';

export async function loadMuJoCo(): Promise<MuJoCoModule> {
  // Load MuJoCo WASM module
  const wasmResponse = await fetch('/mujoco_wasm.js');
  const scriptText = await wasmResponse.text();

  const modifiedScript = scriptText
    .replace(/import\.meta\.url/g, `'${window.location.origin}/mujoco_wasm.wasm'`)
    .replace(/export default load_mujoco;/g, 'window.load_mujoco = load_mujoco;');

  const script = document.createElement('script');
  script.textContent = modifiedScript;
  document.head.appendChild(script);

  // Wait for load_mujoco to be available
  let attempts = 0;
  while (typeof window.load_mujoco !== 'function' && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (typeof window.load_mujoco !== 'function') {
    throw new Error('load_mujoco function not available after loading');
  }

  return await window.load_mujoco();
}

export function setupMuJoCoFileSystem(mujoco: MuJoCoModule): void {
  mujoco.FS.mkdir('/working');
  mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');
}

export async function loadRobotModel(mujoco: MuJoCoModule, modelPath: string): Promise<string> {
  const response = await fetch(modelPath);
  const xmlContent = await response.text();
  mujoco.FS.writeFile("/working/model.xml", xmlContent);
  return xmlContent;
}
