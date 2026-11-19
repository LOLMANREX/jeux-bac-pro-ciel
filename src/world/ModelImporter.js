import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MODEL_MAIN_FORMATS, MODEL_RESOURCE_FORMATS } from './mapSchema.js';

export const MODEL_ACCEPT = [...MODEL_MAIN_FORMATS, ...MODEL_RESOURCE_FORMATS].map((e) => `.${e}`).join(',');
export const MAX_MODEL_FILE_BYTES = 24 * 1024 * 1024;

const prototypeCache = new Map();

function extOf(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

function baseName(url) {
  const clean = String(url || '').split('?')[0].split('#')[0];
  let tail = clean.split('/').pop().split('\\').pop();
  try {
    tail = decodeURIComponent(tail);
  } catch {
    tail = String(tail);
  }
  return tail;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Lecture impossible : ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToBuffer(dataUrl) {
  const res = await fetch(dataUrl);
  return res.arrayBuffer();
}

async function dataUrlToText(dataUrl) {
  const res = await fetch(dataUrl);
  return res.text();
}

function createManager(files) {
  const manager = new THREE.LoadingManager();
  const byLower = new Map(Object.entries(files).map(([k, v]) => [k.toLowerCase(), v]));
  manager.setURLModifier((url) => {
    if (String(url).startsWith('data:') || String(url).startsWith('blob:')) return url;
    const hit = byLower.get(baseName(url).toLowerCase());
    return hit || url;
  });
  return manager;
}

function parseWith(loader, data, path = '') {
  return new Promise((resolve, reject) => {
    loader.parse(data, path, resolve, reject);
  });
}

async function parseEntry(entry) {
  const files = entry.files || {};
  const mainData = files[entry.main];
  const manager = createManager(files);
  const fmt = String(entry.format || extOf(entry.main)).toLowerCase();

  if (fmt === 'glb' || fmt === 'gltf') {
    const loader = new GLTFLoader(manager);
    const data = fmt === 'glb' ? await dataUrlToBuffer(mainData) : await dataUrlToText(mainData);
    const gltf = await parseWith(loader, data, '');
    return gltf.scene;
  }

  if (fmt === 'obj') {
    const loader = new OBJLoader(manager);
    const mtlName = Object.keys(files).find((k) => extOf(k) === 'mtl');
    if (mtlName) {
      const mtlLoader = new MTLLoader(manager);
      mtlLoader.setResourcePath('');
      const materials = mtlLoader.parse(await dataUrlToText(files[mtlName]), '');
      materials.preload();
      loader.setMaterials(materials);
    }
    const group = loader.parse(await dataUrlToText(mainData));
    if (!mtlName) {
      group.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.65, metalness: 0.1 });
        }
      });
    }
    return group;
  }

  if (fmt === 'fbx') {
    const loader = new FBXLoader(manager);
    return loader.parse(await dataUrlToBuffer(mainData), '');
  }

  if (fmt === 'json') {
    const json = JSON.parse(await dataUrlToText(mainData));
    const type = json?.metadata?.type;
    if (type === 'BufferGeometry') {
      const geometry = new THREE.BufferGeometryLoader().parse(json);
      return new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.65, metalness: 0.1 })
      );
    }
    const loader = new THREE.ObjectLoader(manager);
    return loader.parseAsync(json);
  }

  throw new Error(`Format non pris en charge : ${fmt}`);
}

function normalizePrototype(root) {
  const holder = new THREE.Group();
  holder.add(root);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  if (box.isEmpty()) {
    throw new Error('Modèle vide ou illisible');
  }
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  holder.updateMatrixWorld(true);
  const size = box.getSize(new THREE.Vector3());
  holder.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = true;
    }
  });
  holder.userData.naturalSize = [size.x, size.y, size.z];
  return holder;
}

function cloneInstance(proto) {
  const clone = proto.clone(true);
  clone.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry = child.geometry.clone();
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m) => m.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
    }
  });
  return clone;
}

function cacheKey(entry) {
  const main = entry.files?.[entry.main] || '';
  return `${entry.id}:${main.length}:${Object.keys(entry.files || {}).length}`;
}

export function loadModelPrototype(entry) {
  const key = cacheKey(entry);
  if (!prototypeCache.has(key)) {
    const promise = parseEntry(entry).then(normalizePrototype);
    promise.catch(() => prototypeCache.delete(key));
    prototypeCache.set(key, promise);
  }
  return prototypeCache.get(key);
}

export function clearModelCache() {
  prototypeCache.clear();
}

export async function attachImportedModel(group, models, obj) {
  const entry = (models || []).find((m) => m.id === obj.modelId);
  if (!entry) return false;
  try {
    const proto = await loadModelPrototype(entry);
    const inst = cloneInstance(proto);
    const nat = proto.userData.naturalSize || entry.size || [1, 1, 1];
    const sx = (obj.w || nat[0]) / Math.max(0.001, nat[0]);
    const sz = (obj.d || nat[2]) / Math.max(0.001, nat[2]);
    const sy = Number(obj.scaleY) > 0 ? Number(obj.scaleY) : (sx + sz) / 2;
    inst.scale.set(sx, sy, sz);
    group.add(inst);
    return true;
  } catch (err) {
    console.warn('Modèle importé illisible', entry.name, err);
    return false;
  }
}

export async function buildModelEntryFromFiles(fileList) {
  const files = Array.from(fileList || []);
  const mainFile = files.find((f) => MODEL_MAIN_FORMATS.includes(extOf(f.name)));
  if (!mainFile) {
    throw new Error('Aucun modèle .glb, .gltf, .obj, .fbx ou .json dans la sélection');
  }
  const store = {};
  for (const f of files) {
    const ext = extOf(f.name);
    if (!MODEL_MAIN_FORMATS.includes(ext) && !MODEL_RESOURCE_FORMATS.includes(ext)) continue;
    if (f !== mainFile && MODEL_MAIN_FORMATS.includes(ext)) continue;
    if (f.size > MAX_MODEL_FILE_BYTES) {
      throw new Error(`${f.name} dépasse ${Math.round(MAX_MODEL_FILE_BYTES / 1048576)} Mo`);
    }
    store[f.name] = await readAsDataUrl(f);
  }
  const entry = {
    id: `model-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    name: mainFile.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Modèle',
    format: extOf(mainFile.name),
    main: mainFile.name,
    files: store,
    size: [1, 1, 1]
  };
  const proto = await loadModelPrototype(entry);
  entry.size = proto.userData.naturalSize.map((v) => Math.max(0.001, Number(v.toFixed(4))));
  return entry;
}
