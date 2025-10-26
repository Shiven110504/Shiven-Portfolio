import { MuJoCoModule } from './types/mujoco';
import * as THREE from 'three';

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
  // Create directories, ignoring "file exists" errors
  try {
    mujoco.FS.mkdir('/working');
    console.log('Created /working directory');
  } catch (error: unknown) {
    if (error instanceof Error && error.message && error.message.includes('File exists')) {
      console.log('Directory /working already exists');
    } else {
      console.warn('Error creating /working directory:', error);
    }
  }

  try {
    mujoco.FS.mkdir('/working/assets');
    console.log('Created /working/assets directory');
  } catch (error: unknown) {
    if (error instanceof Error && error.message && error.message.includes('File exists')) {
      console.log('Directory /working/assets already exists');
    } else {
      console.warn('Error creating /working/assets directory:', error);
    }
  }

  // Mount MEMFS, ignoring "already mounted" errors
  try {
    mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');
    console.log('Mounted MEMFS at /working');
  } catch (error: unknown) {
    if (error instanceof Error && error.message && (error.message.includes('File exists') || error.message.includes('already'))) {
      console.log('MEMFS already mounted at /working');
    } else {
      console.warn('Error mounting MEMFS at /working:', error);
    }
  }
}

export async function loadRobotModel(mujoco: MuJoCoModule, modelPath: string): Promise<string> {
  console.log(`Loading robot model from: ${modelPath}`);

  const response = await fetch(modelPath);
  if (!response.ok) {
    throw new Error(`Failed to load model from ${modelPath}: ${response.statusText}`);
  }

  const xmlContent = await response.text();
  if (!xmlContent || xmlContent.trim().length === 0) {
    throw new Error(`Model file ${modelPath} is empty or invalid`);
  }

  // Get the base directory and model subdirectory
  // For /unitree_go2/scene.xml -> modelDir=/unitree_go2, modelSubDir=unitree_go2
  // For /humanoid.xml -> modelDir=/, modelSubDir=''
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/'));
  const modelSubDir = modelDir.length > 1 ? modelDir.substring(1) : ''; // Remove leading slash

  // Create model subdirectory in /working/ if needed
  if (modelSubDir) {
    ensureDirectory(mujoco, `/working/${modelSubDir}`);
  }

  // Handle XML includes (e.g., <include file="go2.xml"/>)
  const includeFiles = extractIncludeFiles(xmlContent);
  console.log('Found include files:', includeFiles);

  for (const includeFile of includeFiles) {
    // Normalize the path to handle relative paths like ../common/file.xml
    const includePath = normalizePath(`${modelDir}/${includeFile}`);
    console.log(`Loading include file: ${includeFile} -> ${includePath}`);

    const includeResponse = await fetch(includePath);
    if (includeResponse.ok) {
      const includeContent = await includeResponse.text();

      // Determine where to write the file in VFS
      // For "../common/file.xml" from /humanoid, we want /working/common/file.xml
      const normalizedIncludePath = normalizePath(`${modelSubDir}/${includeFile}`);
      const includeVFSPath = `/working/${normalizedIncludePath}`;

      // Ensure parent directories exist
      const includeDir = includeVFSPath.substring(0, includeVFSPath.lastIndexOf('/'));
      ensureDirectory(mujoco, includeDir);

      mujoco.FS.writeFile(includeVFSPath, includeContent);
      console.log(`Wrote include file to: ${includeVFSPath}`);

      // Extract and load assets from the included file
      // Use the normalized include path's directory for asset loading
      const includeDir2 = includePath.substring(0, includePath.lastIndexOf('/'));
      const includeSubDir = includeDir2.length > 1 ? includeDir2.substring(1) : '';
      const includeAssetFiles = extractAssetFiles(includeContent);
      await loadAssets(mujoco, includeAssetFiles, includeDir2, includeSubDir);
    } else {
      console.warn(`Failed to load include file ${includePath}: ${includeResponse.statusText}`);
    }
  }

  // Extract and load assets from main file
  const assetFiles = extractAssetFiles(xmlContent);
  await loadAssets(mujoco, assetFiles, modelDir, modelSubDir);

  // Write main model file - use the subdirectory structure
  // Extract filename from modelPath (e.g., scene.xml or humanoid.xml)
  const filename = modelPath.substring(modelPath.lastIndexOf('/') + 1);
  const modelVFSPath = modelSubDir ? `/working/${modelSubDir}/${filename}` : `/working/${filename}`;
  mujoco.FS.writeFile(modelVFSPath, xmlContent);
  console.log(`Wrote model file to: ${modelVFSPath}`);

  // Return the path within the VFS (relative to /working/)
  return modelSubDir ? `${modelSubDir}/${filename}` : filename;
}

/**
 * Normalize a path to resolve relative segments like .. and .
 * Example: /humanoid/../common/file.xml -> /common/file.xml
 */
function normalizePath(path: string): string {
  const parts = path.split('/');
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      // Go up one directory
      normalized.pop();
    } else if (part !== '.' && part !== '') {
      // Add the part (skip . and empty strings)
      normalized.push(part);
    }
  }

  // Join with / and add leading / if original path had one
  return (path.startsWith('/') ? '/' : '') + normalized.join('/');
}

function ensureDirectory(mujoco: MuJoCoModule, dirPath: string): void {
  const parts = dirPath.split('/').filter(p => p.length > 0);
  let currentPath = '';

  for (const part of parts) {
    currentPath += '/' + part;
    try {
      // Try to stat the path - if it throws, directory doesn't exist
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mujoco.FS as any).stat(currentPath);
      } catch {
        // Directory doesn't exist, create it
        mujoco.FS.mkdir(currentPath);
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && error.message?.includes('File exists'))) {
        console.warn(`Error creating directory ${currentPath}:`, error);
      }
    }
  }
}

function extractIncludeFiles(xmlContent: string): string[] {
  const includeFiles: string[] = [];
  const includeRegex = /<include\s+file="([^"]+)"/g;
  let match;
  while ((match = includeRegex.exec(xmlContent)) !== null) {
    includeFiles.push(match[1]);
  }
  return includeFiles;
}

function extractAssetFiles(xmlContent: string): string[] {
  const assetFiles: string[] = [];

  // Extract mesh file references (matches both file="..." and file = "...")
  const meshRegex = /<mesh[^>]+file\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = meshRegex.exec(xmlContent)) !== null) {
    assetFiles.push(match[1]);
  }

  // Extract texture file references
  const textureRegex = /<texture[^>]*file\s*=\s*"([^"]+)"/g;
  while ((match = textureRegex.exec(xmlContent)) !== null) {
    assetFiles.push(match[1]);
  }

  // Extract hfield file references
  const hfieldRegex = /<hfield[^>]+file\s*=\s*"([^"]+)"/g;
  while ((match = hfieldRegex.exec(xmlContent)) !== null) {
    assetFiles.push(match[1]);
  }

  console.log('Extracted asset files:', assetFiles);
  return [...new Set(assetFiles)]; // Remove duplicates
}

async function loadAssets(mujoco: MuJoCoModule, assetFiles: string[], modelDir: string, modelSubDir?: string): Promise<void> {
  console.log(`Loading assets from modelDir: ${modelDir}, modelSubDir: ${modelSubDir}`);

  // Ensure assets directory exists in the model subdirectory
  const assetsDir = modelSubDir ? `/working/${modelSubDir}/assets` : '/working/assets';
  ensureDirectory(mujoco, assetsDir);

  const loadPromises = assetFiles.map(async (assetFile) => {
    const assetPath = `${modelDir}/assets/${assetFile}`;
    const fsPath = modelSubDir ? `/working/${modelSubDir}/assets/${assetFile}` : `/working/assets/${assetFile}`;

    console.log(`Loading asset: ${assetFile} from ${assetPath} to ${fsPath}`);

    try {
      const response = await fetch(assetPath);
      if (!response.ok) {
        console.warn(`Failed to fetch asset ${assetPath}: ${response.statusText}`);
        return;
      }

      // Determine file type and handle accordingly
      const fileExtension = assetFile.split('.').pop()?.toLowerCase();

      // Ensure parent directory exists
      try {
        const parentDir = fsPath.substring(0, fsPath.lastIndexOf('/'));
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (mujoco.FS as any).stat(parentDir);
        } catch {
          mujoco.FS.mkdir(parentDir);
        }
      } catch (dirError) {
        console.warn(`Error ensuring directory exists for ${fsPath}:`, dirError);
      }

      try {
        if (fileExtension === 'png' || fileExtension === 'jpg' || fileExtension === 'jpeg') {
          // Binary file (image textures)
          const buffer = await response.arrayBuffer();
          mujoco.FS.writeFile(fsPath, new Uint8Array(buffer));
          console.log(`Successfully wrote binary asset ${assetFile} to ${fsPath}`);
        } else if (fileExtension === 'stl') {
          // STL files are binary
          const buffer = await response.arrayBuffer();
          mujoco.FS.writeFile(fsPath, new Uint8Array(buffer));
          console.log(`Successfully wrote binary STL asset ${assetFile} to ${fsPath}`);
        } else {
          // Text file (OBJ mesh files, XML files)
          const content = await response.text();
          mujoco.FS.writeFile(fsPath, content);
          console.log(`Successfully wrote text asset ${assetFile} to ${fsPath}`);
        }
      } catch (fsError: unknown) {
        console.error(`Failed to write asset ${assetFile} to filesystem at ${fsPath}:`, fsError);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorDetails = fsError as any;
        console.error('FS Error details:', {
          errno: errorDetails.errno,
          message: errorDetails.message,
          path: fsPath
        });
      }
    } catch (error) {
      console.warn(`Error loading asset ${assetFile}:`, error);
    }
  });

  await Promise.all(loadPromises);
  console.log('Finished loading all assets');
}

export function validateModelFile(xmlContent: string): boolean {
  try {
    // Basic content validation
    if (!xmlContent || typeof xmlContent !== 'string' || xmlContent.trim().length === 0) {
      console.warn('Model validation failed: empty or invalid content');
      return false;
    }

    // Check for basic MuJoCo XML structure
    const hasMujocoTag = xmlContent.includes('<mujoco') || xmlContent.includes('<mujocoModel');
    const hasWorldbody = xmlContent.includes('<worldbody') || xmlContent.includes('<worldBody');

    if (!hasMujocoTag) {
      console.warn('Model validation failed: missing mujoco root tag');
      return false;
    }

    if (!hasWorldbody) {
      console.warn('Model validation failed: missing worldbody tag');
      return false;
    }

    // Check for XML well-formedness (basic)
    const openTags = xmlContent.match(/<\w+/g) || [];
    const closeTags = xmlContent.match(/<\/\w+/g) || [];
    if (openTags.length < closeTags.length) {
      console.warn('Model validation failed: malformed XML structure');
      return false;
    }

    // Check for required elements for a functional robot model
    const hasAtLeastOneBody = xmlContent.includes('<body') || xmlContent.includes('<body ');

    if (!hasAtLeastOneBody) {
      console.warn('Model validation warning: no body elements found');
      // Not a hard failure - some models might be valid without bodies
    }

    console.log('Model validation passed');
    return true;

  } catch (error) {
    console.error('Error during model validation:', error);
    return false;
  }
}

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

// Standard normal random number generator using Box-Muller transform
export function standardNormal() {
  return Math.sqrt(-2.0 * Math.log(Math.random())) *
         Math.cos(2.0 * Math.PI * Math.random());
}
