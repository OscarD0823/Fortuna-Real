import * as THREE from "three";
import {
  duckSabotageDefinitions,
  getDuckCoverAmount,
  getDuckCoverKind,
  getDuckHitRadius,
  getDuckResetDuration,
  getDuckVisualScale,
} from "./duckHuntEngine";
import type { DuckContestant } from "./duckHuntEngine";

export interface DuckHuntStats {
  fps: number;
  visible: number;
  renderCalls: number;
  triangles: number;
}

export interface DuckHuntController {
  updateContestants: (contestants: readonly DuckContestant[]) => void;
  setRunning: (running: boolean) => void;
  beginWave: (duckIds: readonly string[]) => void;
  escapeWave: () => void;
  shoot: (clientX: number, clientY: number) => DuckShotTarget;
  castPower: (casterId: string) => void;
  resetFlock: (targetId: string, labelOverride?: string) => void;
  regenerateFormation: () => void;
  dispose: () => void;
}

export interface DuckShotTarget {
  hitId: string | null;
  grazedId: string | null;
  threatX: number;
  threatY: number;
}

interface ResetState {
  startedAt: number;
  targetId: string;
  nonce: number;
  duration: number;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const tempWingColor = new THREE.Color();
const tempPowerColor = new THREE.Color();
const duckHeadColor = new THREE.Color("#197c55");
const duckHitBodyColor = new THREE.Color("#ff9f28");
const duckHitHeadColor = new THREE.Color("#ffcc4d");
const duckWhite = new THREE.Color("#e8f4dc");
const hiddenPosition = new THREE.Vector3(0, -100, 0);
const hiddenRotation = new THREE.Euler();
const hiddenScale = new THREE.Vector3(0.001, 0.001, 0.001);

const smoothstep = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

const makeLabelTexture = (text: string, accent: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(2,10,15,.92)";
  context.strokeStyle = accent;
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(6, 6, 500, 116, 28);
  context.fill();
  context.stroke();
  context.font = "900 34px Montserrat, Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f4ffff";
  context.fillText(text, 256, 64, 470);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
};

const createRadialTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(48, 48, 2, 48, 48, 46);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.23, "rgba(255,214,82,.92)");
  gradient.addColorStop(0.58, "rgba(255,128,32,.34)");
  gradient.addColorStop(1, "rgba(255,80,10,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const setInstanceTransform = (
  mesh: THREE.InstancedMesh,
  index: number,
  position: THREE.Vector3,
  rotation: THREE.Euler,
  scale: THREE.Vector3,
) => {
  tempObject.position.copy(position);
  tempObject.rotation.copy(rotation);
  tempObject.scale.copy(scale);
  tempObject.updateMatrix();
  mesh.setMatrixAt(index, tempObject.matrix);
};

export const createDuckHunt3D = (
  canvas: HTMLCanvasElement,
  initialContestants: readonly DuckContestant[],
  onStats?: (stats: DuckHuntStats) => void,
): DuckHuntController => {
  const maxCount = Math.max(2, initialContestants.length);
  const denseFlock = maxCount > 96;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let contestants = [...initialContestants];
  let running = false;
  let hasStarted = false;
  let runStartedAt = 0;
  let coverCycleStartedAt = 0;
  let disposed = false;
  let formationNonce = 0;
  let resetState: ResetState | null = null;
  let statsStartedAt = performance.now();
  let frames = 0;
  let labelSprite: THREE.Sprite | null = null;
  let labelTexture: THREE.Texture | null = null;
  let shotFlashUntil = 0;
  let powerPulseUntil = 0;
  let powerCasterId: string | null = null;
  let activeWaveIds = new Set<string>();
  let escapeStartedAt = 0;
  let escapeUntil = 0;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: initialContestants.length <= 90,
    powerPreference: "high-performance",
  });
  const maximumPixelRatio = Math.min(
    window.devicePixelRatio || 1,
    initialContestants.length > 150 ? 0.95 : initialContestants.length > 100 ? 1.1 : initialContestants.length > 50 ? 1.35 : 1.5,
  );
  renderer.setPixelRatio(maximumPixelRatio);
  canvas.dataset.renderQuality = "high";
  canvas.dataset.environment = "classic-duck-field-3d";
  canvas.dataset.cameraMode = "classic-fixed";
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = initialContestants.length <= 48;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.name = "SC_DuckHunt";
  scene.background = new THREE.Color("#63b9e9");
  scene.fog = new THREE.Fog("#8dd1ee", 28, 58);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 90);
  const classicCameraPosition = new THREE.Vector3(0, 5.3, 20.8);
  const classicCameraTarget = new THREE.Vector3(0, 4.25, 0.2);
  camera.position.copy(classicCameraPosition);
  camera.lookAt(classicCameraTarget);

  scene.add(new THREE.HemisphereLight("#e8f8ff", "#396519", 2.8));
  const sun = new THREE.DirectionalLight("#fff0c2", 3.8);
  sun.position.set(-8, 13, 8);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -8;
  scene.add(sun);
  const skyRim = new THREE.PointLight("#fff1b5", 18, 30, 1.8);
  skyRim.position.set(-8.8, 9.5, -5.8);
  scene.add(skyRim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 28),
    new THREE.MeshStandardMaterial({ color: "#527c24", roughness: 0.96, metalness: 0.02 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -2);
  ground.receiveShadow = true;
  scene.add(ground);

  const moundCount = 18;
  const mounds = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshStandardMaterial({ color: "#173b22", roughness: 1, metalness: 0 }),
    moundCount,
  );
  for (let index = 0; index < moundCount; index += 1) {
    const back = index < 10;
    const side = index % 2 === 0 ? -1 : 1;
    const x = back ? -12.8 + index * 2.82 : side * (9.1 + (index % 4) * 0.72);
    const z = back ? -7.8 - (index % 3) * 0.62 : -4.8 + (index % 7) * 1.6;
    const scale = 0.82 + (index % 5) * 0.09;
    setInstanceTransform(
      mounds,
      index,
      new THREE.Vector3(x, -0.22, z),
      new THREE.Euler(0, index * 0.77, 0),
      new THREE.Vector3(2.7 * scale, 0.58 * scale, 1.5 * scale),
    );
  }
  mounds.instanceMatrix.needsUpdate = true;
  mounds.receiveShadow = true;
  scene.add(mounds);

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(6.8, 64),
    new THREE.MeshPhysicalMaterial({
      color: "#064d65",
      emissive: "#06313d",
      emissiveIntensity: 0.5,
      metalness: 0.25,
      roughness: 0.24,
      transparent: true,
      opacity: 0.88,
    }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.scale.set(1.55, 0.72, 1);
  pond.position.set(0, 0.012, 0.8);
  scene.add(pond);

  const pondRing = new THREE.Mesh(
    new THREE.RingGeometry(6.6, 7.35, 64),
    new THREE.MeshStandardMaterial({ color: "#6a5530", roughness: 0.94 }),
  );
  pondRing.rotation.x = -Math.PI / 2;
  pondRing.scale.set(1.55, 0.72, 1);
  pondRing.position.copy(pond.position).setY(0.006);
  scene.add(pondRing);

  const rippleCount = 7;
  const ripples = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.72, 0.77, 28),
    new THREE.MeshBasicMaterial({ color: "#72dff2", transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    rippleCount,
  );
  for (let index = 0; index < rippleCount; index += 1) {
    const angle = index * 2.37;
    const radius = 1.1 + (index % 4) * 0.92;
    setInstanceTransform(
      ripples,
      index,
      new THREE.Vector3(Math.cos(angle) * radius, 0.035, 0.8 + Math.sin(angle) * radius * 0.46),
      new THREE.Euler(-Math.PI / 2, 0, angle),
      new THREE.Vector3(0.7 + (index % 3) * 0.32, 0.7 + (index % 3) * 0.32, 1),
    );
  }
  ripples.instanceMatrix.needsUpdate = true;
  scene.add(ripples);

  const lilyPadCount = 18;
  const lilyPadPositions: THREE.Vector3[] = [];
  const lilyPads = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.42, 14),
    new THREE.MeshStandardMaterial({ color: "#3f8d45", roughness: 0.84, metalness: 0.03, side: THREE.DoubleSide }),
    lilyPadCount,
  );
  for (let index = 0; index < lilyPadCount; index += 1) {
    const angle = index * 2.19 + (index % 3) * 0.31;
    const radius = 1.1 + (index % 6) * 0.72;
    const position = new THREE.Vector3(Math.cos(angle) * radius * 1.42, 0.055, 0.8 + Math.sin(angle) * radius * 0.62);
    lilyPadPositions.push(position);
    const scale = 0.58 + (index % 5) * 0.09;
    setInstanceTransform(lilyPads, index, position, new THREE.Euler(-Math.PI / 2, 0, angle), new THREE.Vector3(scale * 1.28, scale, 1));
  }
  lilyPads.instanceMatrix.needsUpdate = true;
  scene.add(lilyPads);

  const lilyFlowerCount = 6;
  const lilyFlowers = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.13, 7, 5),
    new THREE.MeshStandardMaterial({ color: "#f8c7de", emissive: "#6d183f", emissiveIntensity: 0.24, roughness: 0.66 }),
    lilyFlowerCount,
  );
  for (let index = 0; index < lilyFlowerCount; index += 1) {
    const padPosition = lilyPadPositions[index * 3];
    setInstanceTransform(
      lilyFlowers,
      index,
      new THREE.Vector3(padPosition.x + 0.08, 0.14, padPosition.z - 0.05),
      new THREE.Euler(0, index * 1.4, 0),
      new THREE.Vector3(1, 0.62, 1),
    );
  }
  lilyFlowers.instanceMatrix.needsUpdate = true;
  scene.add(lilyFlowers);

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(45, 15),
    new THREE.MeshBasicMaterial({ color: "#77c7e9", fog: true }),
  );
  horizon.position.set(0, 6.5, -10.5);
  scene.add(horizon);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 40),
    new THREE.MeshBasicMaterial({ color: "#fff2a8", transparent: true, opacity: 0.94, fog: false }),
  );
  sunDisc.position.set(-8.8, 8.2, -9.9);
  scene.add(sunDisc);

  const cloudCount = 18;
  const clouds = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.72, 9, 6),
    new THREE.MeshBasicMaterial({ color: "#f4fbff", transparent: true, opacity: 0.46, fog: true }),
    cloudCount,
  );
  for (let index = 0; index < cloudCount; index += 1) {
    const cluster = Math.floor(index / 3);
    const within = index % 3;
    setInstanceTransform(
      clouds,
      index,
      new THREE.Vector3(-9.5 + cluster * 3.8 + within * 0.62, 7.1 + Math.sin(cluster * 2.1) * 0.55 + within * 0.16, -8.9 - cluster * 0.25),
      new THREE.Euler(),
      new THREE.Vector3(1.5 - within * 0.2, 0.52 + within * 0.08, 0.72),
    );
  }
  clouds.instanceMatrix.needsUpdate = true;
  scene.add(clouds);

  const treeCount = 54;
  const treePositions: THREE.Vector3[] = [];
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.15, 0.3, 3.2, 7),
    new THREE.MeshStandardMaterial({ color: "#70401e", roughness: 1 }),
    treeCount,
  );
  const lowerCrowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.2, 2),
    new THREE.MeshStandardMaterial({ color: "#176b2b", roughness: 0.96 }),
    treeCount,
  );
  const upperCrowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.88, 2),
    new THREE.MeshStandardMaterial({ color: "#2c8d38", roughness: 0.93 }),
    treeCount,
  );
  for (let index = 0; index < treeCount; index += 1) {
    const isBackRow = index < 26;
    const side = index % 2 === 0 ? -1 : 1;
    const sideRow = Math.floor((index - 26) / 2);
    const x = isBackRow
      ? -12.4 + (index % 13) * 2.05 + (index > 12 ? 0.7 : 0)
      : side * (8.1 + (sideRow % 4) * 1.05) + Math.sin(index * 2.7) * 0.35;
    const z = isBackRow
      ? -7.5 - Math.floor(index / 13) * 1.15 + Math.sin(index * 1.9) * 0.22
      : -6.2 + (sideRow % 11) * 0.92;
    const height = 0.76 + (index % 6) * 0.07;
    const position = new THREE.Vector3(x, 0, z);
    treePositions.push(position);
    setInstanceTransform(trunks, index, new THREE.Vector3(x, 1.52 * height, z), new THREE.Euler(0, index * 0.73, 0), new THREE.Vector3(1, height, 1));
    setInstanceTransform(lowerCrowns, index, new THREE.Vector3(x, 3.22 * height, z), new THREE.Euler(0, index * 0.41, 0), new THREE.Vector3(1, height, 1));
    setInstanceTransform(upperCrowns, index, new THREE.Vector3(x, 4.35 * height, z), new THREE.Euler(0, index * 0.57, 0), new THREE.Vector3(0.86, height, 0.86));
  }
  trunks.instanceMatrix.needsUpdate = true;
  lowerCrowns.instanceMatrix.needsUpdate = true;
  upperCrowns.instanceMatrix.needsUpdate = true;
  trunks.castShadow = renderer.shadowMap.enabled;
  lowerCrowns.castShadow = renderer.shadowMap.enabled;
  upperCrowns.castShadow = renderer.shadowMap.enabled;
  scene.add(trunks, lowerCrowns, upperCrowns);

  const grassCount = 240;
  const grass = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.12, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: "#68a72a", roughness: 0.96 }),
    grassCount,
  );
  for (let index = 0; index < grassCount; index += 1) {
    const front = index < 178;
    const unitX = ((index * 73) % 239) / 238;
    const unitZ = ((index * 131) % 241) / 240;
    const x = front ? -11.8 + unitX * 23.6 : (index % 2 === 0 ? -1 : 1) * (6.8 + unitX * 4.8);
    const z = front ? 3.25 + unitZ * 5.2 : -5.7 + unitZ * 9.4;
    const height = 0.58 + ((index * 29) % 11) * 0.045;
    setInstanceTransform(
      grass,
      index,
      new THREE.Vector3(x, height * 0.45, z),
      new THREE.Euler(0, index * 1.71, Math.sin(index) * 0.08),
      new THREE.Vector3(0.72 + (index % 4) * 0.12, height, 0.72),
    );
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.receiveShadow = true;
  scene.add(grass);

  const shrubCount = 52;
  const shrubs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.72, 1),
    new THREE.MeshStandardMaterial({ color: "#3f8e2b", roughness: 1 }),
    shrubCount,
  );
  for (let index = 0; index < shrubCount; index += 1) {
    const x = -11.4 + (((index * 43) % 53) / 52) * 22.8;
    const z = index < 34 ? 4.15 + (index % 4) * 0.72 : -7 + (index % 6) * 0.62;
    const scale = 0.62 + (index % 5) * 0.095;
    setInstanceTransform(
      shrubs,
      index,
      new THREE.Vector3(x, 0.48 * scale, z),
      new THREE.Euler(0, index * 0.91, 0),
      new THREE.Vector3(scale * 1.4, scale, scale),
    );
  }
  shrubs.instanceMatrix.needsUpdate = true;
  shrubs.castShadow = renderer.shadowMap.enabled;
  scene.add(shrubs);

  const reedCount = 84;
  const reeds = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.018, 0.03, 0.82, 5),
    new THREE.MeshStandardMaterial({ color: "#789b37", roughness: 0.92 }),
    reedCount,
  );
  for (let index = 0; index < reedCount; index += 1) {
    const angle = (index / reedCount) * Math.PI * 2;
    const radius = 6.65 + (index % 5) * 0.16;
    const x = Math.cos(angle) * radius * 1.54;
    const z = 0.8 + Math.sin(angle) * radius * 0.71;
    const height = 0.72 + (index % 7) * 0.07;
    setInstanceTransform(
      reeds,
      index,
      new THREE.Vector3(x, height * 0.46, z),
      new THREE.Euler(Math.sin(index * 0.8) * 0.08, angle, Math.cos(index * 0.61) * 0.08),
      new THREE.Vector3(1, height, 1),
    );
  }
  reeds.instanceMatrix.needsUpdate = true;
  reeds.castShadow = renderer.shadowMap.enabled;
  scene.add(reeds);

  const cattailCount = 30;
  const cattails = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.28, 7),
    new THREE.MeshStandardMaterial({ color: "#6b3b1d", roughness: 0.9 }),
    cattailCount,
  );
  for (let index = 0; index < cattailCount; index += 1) {
    const angle = (index / cattailCount) * Math.PI * 2 + 0.13;
    const radius = 6.75 + (index % 4) * 0.13;
    const x = Math.cos(angle) * radius * 1.54;
    const z = 0.8 + Math.sin(angle) * radius * 0.71;
    setInstanceTransform(cattails, index, new THREE.Vector3(x, 0.93 + (index % 5) * 0.04, z), new THREE.Euler(), new THREE.Vector3(1, 1 + (index % 3) * 0.08, 1));
  }
  cattails.instanceMatrix.needsUpdate = true;
  scene.add(cattails);

  const rockCount = 28;
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.34, 0),
    new THREE.MeshStandardMaterial({ color: "#58635e", roughness: 0.88, metalness: 0.08 }),
    rockCount,
  );
  for (let index = 0; index < rockCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (7.4 + ((index * 19) % 31) / 10);
    const z = -5.5 + ((index * 23) % 97) / 8.5;
    const scale = 0.58 + (index % 6) * 0.1;
    setInstanceTransform(
      rocks,
      index,
      new THREE.Vector3(x, 0.2 * scale, z),
      new THREE.Euler(index * 0.29, index * 0.83, index * 0.17),
      new THREE.Vector3(scale * 1.25, scale * 0.72, scale),
    );
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = renderer.shadowMap.enabled;
  rocks.receiveShadow = true;
  scene.add(rocks);

  const fireflyCount = 72;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  for (let index = 0; index < fireflyCount; index += 1) {
    fireflyPositions[index * 3] = -11 + (((index * 47) % 73) / 72) * 22;
    fireflyPositions[index * 3 + 1] = 0.8 + ((index * 31) % 41) / 12;
    fireflyPositions[index * 3 + 2] = -7.8 + ((index * 59) % 83) / 9;
  }
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute("position", new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflies = new THREE.Points(
    fireflyGeometry,
    new THREE.PointsMaterial({ color: "#d8ff72", size: 0.075, transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  scene.add(fireflies);

  const body = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.55, denseFlock ? 8 : 12, denseFlock ? 5 : 8),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04 }),
    maxCount,
  );
  const head = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.35, denseFlock ? 7 : 10, denseFlock ? 5 : 8),
    new THREE.MeshStandardMaterial({ roughness: 0.48 }),
    maxCount,
  );
  const wingGeometry = new THREE.SphereGeometry(0.46, denseFlock ? 6 : 9, denseFlock ? 4 : 6);
  const wingMaterial = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const leftWing = new THREE.InstancedMesh(wingGeometry, wingMaterial, maxCount);
  const rightWing = new THREE.InstancedMesh(wingGeometry, wingMaterial, maxCount);
  const beak = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.16, 0.52, denseFlock ? 5 : 7),
    new THREE.MeshStandardMaterial({ color: "#ffac2f", roughness: 0.55 }),
    maxCount,
  );
  const eye = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.055, denseFlock ? 4 : 7, denseFlock ? 3 : 5),
    new THREE.MeshBasicMaterial({ color: "#eaffff" }),
    maxCount,
  );
  const farEye = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.052, denseFlock ? 4 : 7, denseFlock ? 3 : 5),
    new THREE.MeshBasicMaterial({ color: "#dff9ff" }),
    maxCount,
  );
  const chest = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.42, denseFlock ? 7 : 10, denseFlock ? 5 : 7),
    new THREE.MeshStandardMaterial({ color: "#e7eee0", roughness: 0.68 }),
    maxCount,
  );
  const tail = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.24, 0.58, denseFlock ? 5 : 7),
    new THREE.MeshStandardMaterial({ roughness: 0.62 }),
    maxCount,
  );
  const neckRing = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.25, 0.055, denseFlock ? 3 : 5, denseFlock ? 7 : 10),
    new THREE.MeshBasicMaterial({ color: "#eaf8e4" }),
    maxCount,
  );
  const winnerCrown = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.31, 0.28, 5, 1, true),
    new THREE.MeshStandardMaterial({ color: "#ffc52f", emissive: "#9b5600", emissiveIntensity: 1.3, metalness: 0.7, roughness: 0.22 }),
    maxCount,
  );
  const shields = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.78, denseFlock ? 7 : 10, denseFlock ? 5 : 7),
    new THREE.MeshBasicMaterial({ color: "#5df4ff", transparent: true, opacity: 0.24, wireframe: true, depthWrite: false }),
    maxCount,
  );
  const powerSigils = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.65, 0.06, denseFlock ? 4 : 6, denseFlock ? 10 : 18),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, depthWrite: false }),
    maxCount,
  );
  const coreDuckMeshes = [body, chest, head, leftWing, rightWing, beak, eye, farEye, tail, ...(!denseFlock ? [neckRing] : []), powerSigils];
  const duckMeshes = [...coreDuckMeshes, winnerCrown, shields];
  duckMeshes.forEach((mesh, index) => {
    mesh.name = `SM_DuckPart_${index}`;
    mesh.frustumCulled = false;
    mesh.castShadow = renderer.shadowMap.enabled;
    scene.add(mesh);
  });

  const flashTexture = createRadialTexture();
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flashTexture,
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  flash.scale.set(1.6, 1.6, 1);
  scene.add(flash);

  const currentPositions = new Map<string, THREE.Vector3>();
  const coverAmounts = new Map<string, number>();
  const projected = new THREE.Vector3();
  const flightPosition = new THREE.Vector3();
  const groundPosition = new THREE.Vector3();
  const partPosition = new THREE.Vector3();
  const bodyScale = new THREE.Vector3();
  const headScale = new THREE.Vector3();
  const wingScale = new THREE.Vector3();
  const beakScale = new THREE.Vector3();
  const unitScale = new THREE.Vector3();
  const tailScale = new THREE.Vector3();
  const shieldScale = new THREE.Vector3();
  const baseRotation = new THREE.Euler();
  const leftWingRotation = new THREE.Euler();
  const rightWingRotation = new THREE.Euler();
  const beakRotation = new THREE.Euler();
  const tailRotation = new THREE.Euler();
  const neckRotation = new THREE.Euler();
  const crownRotation = new THREE.Euler();
  const shieldRotation = new THREE.Euler();
  const powerRotation = new THREE.Euler();
  const powerScale = new THREE.Vector3();
  const labelOffset = new THREE.Vector3(0, 1.1, 0);
  const hiddenContestantIds = new Set<string>();
  const colorSignatures: string[] = [];

  const hideInstance = (mesh: THREE.InstancedMesh, index: number) => {
    setInstanceTransform(mesh, index, hiddenPosition, hiddenRotation, hiddenScale);
  };

  const getFlightPosition = (contestant: DuckContestant, elapsedSeconds: number, target: THREE.Vector3) => {
    const { profile } = contestant;
    const speed = contestant.speed;
    const routePhase = contestant.routeSeed * Math.PI * 2;
    const phase = profile.phase + formationNonce * 0.000013 + routePhase;
    const evasiveFrequency = 0.76 + contestant.routeSeed * 1.42 + contestant.threatLevel * 0.5;
    const x = Math.sin(elapsedSeconds * (0.38 + contestant.routeSeed * 0.12) * speed * profile.drift + phase) * 7.7
      + Math.sin(elapsedSeconds * evasiveFrequency * speed + phase * 1.7) * (1.15 + contestant.threatLevel * 0.8)
      + profile.lane * 1.15
      + contestant.dodgeX;
    const y = profile.altitude
      + Math.sin(elapsedSeconds * (1.12 + contestant.routeSeed * 0.72) * speed + phase) * (0.5 + contestant.threatLevel * 0.34)
      + Math.cos(elapsedSeconds * 0.52 + phase) * 0.25
      + contestant.dodgeY;
    const z = profile.depth
      + Math.cos(elapsedSeconds * (0.31 + contestant.routeSeed * 0.18) * speed + phase) * 2.15
      + Math.sin(elapsedSeconds * 0.67 * speed + routePhase) * contestant.threatLevel * 0.7;
    return target.set(x, y, z);
  };

  const getCoverPosition = (contestant: DuckContestant, target: THREE.Vector3) => {
    if (getDuckCoverKind(contestant) === "grass") {
      const x = -7.8 + ((contestant.routeSeed * 13.73 + contestant.number * 0.37) % 1) * 15.6;
      const z = 4.3 + ((contestant.routeSeed * 7.19 + contestant.number * 0.21) % 1) * 2.6;
      return target.set(x, 0.26, z);
    }
    const treeIndex = (contestant.number * 17 + Math.floor(contestant.routeSeed * 101)) % treePositions.length;
    const tree = treePositions[treeIndex];
    const centerPull = tree.x === 0 ? 0 : -Math.sign(tree.x) * 0.38;
    return target.set(tree.x + centerPull, 0.5, tree.z + 0.22);
  };

  const removeLabel = () => {
    if (labelSprite) {
      scene.remove(labelSprite);
      labelSprite.material.dispose();
    }
    labelTexture?.dispose();
    labelSprite = null;
    labelTexture = null;
  };

  const showLabel = (contestant: DuckContestant) => {
    removeLabel();
    labelTexture = makeLabelTexture(
      `${contestant.participant.name} · ${contestant.lives === 1 ? "1 VIDA" : `${contestant.lives} VIDAS`}`,
      contestant.lives === 0 ? "#ff574b" : "#ffbf35",
    );
    if (!labelTexture) return;
    labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
    labelSprite.scale.set(4.4, 1.1, 1);
    labelSprite.renderOrder = 20;
    scene.add(labelSprite);
  };

  let renderWidth = 0;
  let renderHeight = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === renderWidth && height === renderHeight) return;
    renderWidth = width;
    renderHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = height < 560 ? 47 : 42;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const updateDucks = (now: number) => {
    const elapsedSeconds = now / 1000;
    const flightElapsedSeconds = hasStarted ? Math.max(0, (now - coverCycleStartedAt) / 1000) : 0;
    const resetDuration = resetState?.duration ?? getDuckResetDuration(contestants.length);
    const resetElapsed = resetState ? now - resetState.startedAt : resetDuration + 1;
    const coverReachedAt = resetDuration * 0.34;
    const emergenceStartsAt = resetDuration * 0.54;
    const scaleBase = getDuckVisualScale(contestants.length);
    let visible = 0;
    let visibleCrowns = 0;
    let visibleShields = 0;
    let matricesChanged = false;
    let colorsChanged = false;

    contestants.forEach((contestant, index) => {
      const shouldHide = contestant.knockedOut && (!resetState || resetElapsed > emergenceStartsAt);
      if (shouldHide) {
        coverAmounts.set(contestant.id, 1);
        if (!hiddenContestantIds.has(contestant.id)) {
          coreDuckMeshes.forEach((mesh) => hideInstance(mesh, index));
          hiddenContestantIds.add(contestant.id);
          matricesChanged = true;
        }
        return;
      }
      const collectiveTakeoff = Boolean(resetState) || escapeUntil > now;
      if (running && activeWaveIds.size > 0 && !activeWaveIds.has(contestant.id) && !collectiveTakeoff) {
        coverAmounts.set(contestant.id, 1);
        if (!hiddenContestantIds.has(contestant.id)) {
          coreDuckMeshes.forEach((mesh) => hideInstance(mesh, index));
          hiddenContestantIds.add(contestant.id);
          matricesChanged = true;
        }
        return;
      }
      getFlightPosition(contestant, elapsedSeconds, flightPosition);
      if (escapeUntil > now && activeWaveIds.has(contestant.id)) {
        const escapeProgress = smoothstep((now - escapeStartedAt) / Math.max(1, escapeUntil - escapeStartedAt));
        flightPosition.y += escapeProgress * 8.4;
        flightPosition.x += Math.sign(flightPosition.x || (contestant.number % 2 ? 1 : -1)) * escapeProgress * 2.8;
      }
      getCoverPosition(contestant, groundPosition);
      let position = currentPositions.get(contestant.id);
      if (!position) {
        position = new THREE.Vector3();
        currentPositions.set(contestant.id, position);
      }
      if (!running) {
        position.copy(groundPosition);
        coverAmounts.set(contestant.id, 1);
      } else if (resetState) {
        if (resetElapsed < coverReachedAt) {
          const coverAmount = smoothstep(resetElapsed / coverReachedAt);
          position.lerpVectors(flightPosition, groundPosition, coverAmount);
          coverAmounts.set(contestant.id, coverAmount);
        } else if (resetElapsed < emergenceStartsAt) {
          position.copy(groundPosition);
          coverAmounts.set(contestant.id, 1);
        } else if (resetElapsed < resetDuration) {
          const emergence = smoothstep((resetElapsed - emergenceStartsAt) / (resetDuration - emergenceStartsAt));
          position.lerpVectors(groundPosition, flightPosition, emergence);
          position.y += Math.sin(emergence * Math.PI) * (0.7 + contestant.routeSeed * 0.55);
          coverAmounts.set(contestant.id, 1 - emergence);
        } else {
          position.copy(flightPosition);
          coverAmounts.set(contestant.id, 0);
        }
      } else {
        const coverAmount = getDuckCoverAmount(contestant, flightElapsedSeconds);
        position.lerpVectors(flightPosition, groundPosition, coverAmount);
        if (coverAmount > 0 && coverAmount < 1) position.y += Math.sin(coverAmount * Math.PI) * 0.3;
        coverAmounts.set(contestant.id, coverAmount);
      }
      const isFullyCovered = (coverAmounts.get(contestant.id) ?? 0) >= 0.88;
      if (isFullyCovered) {
        if (!hiddenContestantIds.has(contestant.id)) {
          coreDuckMeshes.forEach((mesh) => hideInstance(mesh, index));
          hiddenContestantIds.add(contestant.id);
          matricesChanged = true;
        }
        return;
      }
      hiddenContestantIds.delete(contestant.id);
      visible += 1;
      matricesChanged = true;

      const scale = scaleBase * contestant.profile.scale * (contestant.lives === 1 ? 0.91 : 1);
      const flapAmount = resetState && resetElapsed > 640 && resetElapsed < 1160
        ? 0.12
        : reducedMotion ? 0.12 : Math.sin(elapsedSeconds * (10.5 + contestant.speed * 2.3) + contestant.profile.phase) * 0.74;
      const yaw = Math.sin(elapsedSeconds * 0.42 * contestant.speed + contestant.profile.phase) * 0.38;
      baseRotation.set(0, yaw, 0);
      const isHitTarget = contestant.id === resetState?.targetId;
      const colorSignature = `${contestant.accent}|${isHitTarget ? 1 : 0}|${contestant.power}`;
      if (colorSignatures[index] !== colorSignature) {
        const participantColor = tempColor.set(contestant.accent);
        const bodyColor = isHitTarget ? duckHitBodyColor : participantColor;
        const wingColor = tempWingColor.copy(bodyColor).lerp(duckWhite, 0.22);
        body.setColorAt(index, bodyColor);
        leftWing.setColorAt(index, wingColor);
        rightWing.setColorAt(index, wingColor);
        tail.setColorAt(index, wingColor);
        head.setColorAt(index, isHitTarget ? duckHitHeadColor : duckHeadColor);
        powerSigils.setColorAt(index, tempPowerColor.set(duckSabotageDefinitions[contestant.power].color));
        colorSignatures[index] = colorSignature;
        colorsChanged = true;
      }

      bodyScale.set(1.35, 0.82, 0.78).multiplyScalar(scale);
      setInstanceTransform(body, index, position, baseRotation, bodyScale);
      partPosition.copy(position).set(position.x + 0.2 * scale, position.y - 0.12 * scale, position.z + 0.31 * scale);
      headScale.set(0.92, 0.72, 0.62).multiplyScalar(scale);
      setInstanceTransform(chest, index, partPosition, baseRotation, headScale);
      const headPosition = partPosition.copy(position);
      headPosition.x += 0.66 * scale;
      headPosition.y += 0.25 * scale;
      headScale.setScalar(0.95 * scale);
      setInstanceTransform(head, index, headPosition, baseRotation, headScale);
      wingScale.set(1.22, 0.24, 0.72).multiplyScalar(scale);
      leftWingRotation.set(flapAmount, yaw, 0.08);
      partPosition.copy(position).addScaledVector(THREE.Object3D.DEFAULT_UP, 0.18 * scale);
      partPosition.z += 0.42 * scale;
      setInstanceTransform(leftWing, index, partPosition, leftWingRotation, wingScale);
      rightWingRotation.set(-flapAmount, yaw, -0.08);
      partPosition.copy(position).addScaledVector(THREE.Object3D.DEFAULT_UP, 0.18 * scale);
      partPosition.z -= 0.42 * scale;
      setInstanceTransform(rightWing, index, partPosition, rightWingRotation, wingScale);
      beakRotation.set(0, 0, -Math.PI / 2);
      beakScale.set(0.8, 1, 0.8).multiplyScalar(scale);
      partPosition.copy(position).setX(position.x + 1.04 * scale).setY(position.y + 0.22 * scale);
      setInstanceTransform(beak, index, partPosition, beakRotation, beakScale);
      unitScale.setScalar(scale);
      partPosition.copy(position).set(position.x + 0.88 * scale, position.y + 0.37 * scale, position.z + 0.27 * scale);
      setInstanceTransform(eye, index, partPosition, baseRotation, unitScale);
      partPosition.copy(position).set(position.x + 0.88 * scale, position.y + 0.37 * scale, position.z - 0.27 * scale);
      setInstanceTransform(farEye, index, partPosition, baseRotation, unitScale);
      tailRotation.set(0, 0, Math.PI / 2);
      tailScale.set(0.82, 1.05, 0.82).multiplyScalar(scale);
      partPosition.copy(position).set(position.x - 0.72 * scale, position.y + 0.04 * scale, position.z);
      setInstanceTransform(tail, index, partPosition, tailRotation, tailScale);
      neckRotation.set(0, Math.PI / 2 + yaw, 0);
      partPosition.copy(position).set(position.x + 0.43 * scale, position.y + 0.2 * scale, position.z);
      if (!denseFlock) setInstanceTransform(neckRing, index, partPosition, neckRotation, unitScale);
      if (contestant.previousWinner) {
        crownRotation.set(0, -yaw, 0);
        partPosition.copy(position).set(position.x + 0.66 * scale, position.y + 0.83 * scale, position.z);
        setInstanceTransform(winnerCrown, visibleCrowns, partPosition, crownRotation, unitScale);
        visibleCrowns += 1;
      }
      if (contestant.shielded) {
        shieldRotation.set(0, reducedMotion ? 0 : elapsedSeconds * 0.8, 0);
        shieldScale.set(1.15, 0.92, 0.92).multiplyScalar(scale);
        setInstanceTransform(shields, visibleShields, position, shieldRotation, shieldScale);
        visibleShields += 1;
      }
      const isCasting = contestant.id === powerCasterId && powerPulseUntil > now;
      const pulse = isCasting ? 1.4 + Math.sin((powerPulseUntil - now) * 0.022) * 0.24 : 1;
      powerRotation.set(Math.PI / 2, 0, reducedMotion ? 0 : -elapsedSeconds * (0.65 + contestant.routeSeed));
      powerScale.set(0.78, 0.78, 0.78).multiplyScalar(scale * pulse);
      partPosition.copy(position).setY(position.y - 0.2 * scale);
      setInstanceTransform(powerSigils, index, partPosition, powerRotation, powerScale);
    });

    coreDuckMeshes.forEach((mesh) => {
      mesh.count = contestants.length;
      if (matricesChanged) mesh.instanceMatrix.needsUpdate = true;
      if (colorsChanged && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    neckRing.count = denseFlock ? 0 : contestants.length;
    winnerCrown.count = visibleCrowns;
    shields.count = visibleShields;
    if (matricesChanged) {
      winnerCrown.instanceMatrix.needsUpdate = true;
      shields.instanceMatrix.needsUpdate = true;
    }

    if (labelSprite && resetState) {
      const targetPosition = currentPositions.get(resetState.targetId);
      if (targetPosition) labelSprite.position.copy(targetPosition).add(labelOffset);
      labelSprite.visible = resetElapsed < 1780 && !hiddenContestantIds.has(resetState.targetId);
    }
    if (powerPulseUntil <= now) powerCasterId = null;
    if (resetState && resetElapsed >= resetDuration) {
      resetState = null;
      coverCycleStartedAt = now;
      removeLabel();
    }
    return visible;
  };

  let animationFrame = 0;
  let qualityScale = 1;
  let lowFpsWindows = 0;
  let highFpsWindows = 0;
  let lastRenderedAt = 0;
  let lastDuckUpdateAt = Number.NEGATIVE_INFINITY;
  let visibleCount = 0;
  const render = (now: number) => {
    if (disposed) return;
    const idleFrameInterval = running || resetState || shotFlashUntil > now || powerPulseUntil > now ? 0 : 50;
    if (document.hidden) {
      statsStartedAt = now;
      frames = 0;
      animationFrame = window.requestAnimationFrame(render);
      return;
    }
    if (idleFrameInterval > 0 && lastRenderedAt > 0 && now - lastRenderedAt < idleFrameInterval) {
      animationFrame = window.requestAnimationFrame(render);
      return;
    }
    lastRenderedAt = now;
    const duckUpdateInterval = maxCount > 150 ? 30 : maxCount > 96 ? 22 : 0;
    if (now < lastDuckUpdateAt || duckUpdateInterval === 0 || now - lastDuckUpdateAt >= duckUpdateInterval) {
      visibleCount = updateDucks(now);
      lastDuckUpdateAt = now;
    }
    const visible = visibleCount;
    // Cámara fija tipo galería de tiro: el apuntado y el tamaño de los patos
    // no cambian por una animación de cámara.
    camera.position.copy(classicCameraPosition);
    canvas.dataset.cameraFocus = running ? "classic-field" : "classic-preview";
    const desiredFov = renderHeight < 560 ? 43 : 38;
    if (Math.abs(camera.fov - desiredFov) > 0.04) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFov, reducedMotion ? 1 : 0.09);
      camera.updateProjectionMatrix();
    }
    camera.lookAt(classicCameraTarget);
    pond.rotation.z = reducedMotion ? 0 : Math.sin(now / 2200) * 0.012;
    if (!reducedMotion) {
      clouds.position.x = Math.sin(now / 6_600) * 0.42;
      ripples.rotation.y = Math.sin(now / 3_100) * 0.025;
      lilyPads.rotation.y = Math.sin(now / 4_200) * 0.018;
      lilyFlowers.rotation.y = lilyPads.rotation.y;
      fireflies.rotation.y = Math.sin(now / 4_800) * 0.08;
      (fireflies.material as THREE.PointsMaterial).opacity = 0.66 + Math.sin(now / 540) * 0.14;
    }
    const flashMaterial = flash.material as THREE.SpriteMaterial;
    flashMaterial.opacity = shotFlashUntil > now ? Math.max(0, (shotFlashUntil - now) / 120) : 0;
    renderer.render(scene, camera);
    frames += 1;
    if (now - statsStartedAt >= 1000) {
      const measuredFps = Math.round((frames * 1000) / (now - statsStartedAt));
      canvas.dataset.renderCalls = String(renderer.info.render.calls);
      canvas.dataset.renderTriangles = String(renderer.info.render.triangles);
      onStats?.({
        fps: running ? measuredFps : 60,
        visible,
        renderCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      });
      if (running && now - runStartedAt > 1_200) {
        lowFpsWindows = measuredFps < 48 ? lowFpsWindows + 1 : 0;
        highFpsWindows = measuredFps > 57 ? highFpsWindows + 1 : 0;
      }
      if (lowFpsWindows >= 2 && qualityScale > 0.68) {
        qualityScale = qualityScale > 0.9 ? 0.82 : 0.68;
        renderer.setPixelRatio(Math.max(0.65, maximumPixelRatio * qualityScale));
        canvas.dataset.renderQuality = qualityScale < 0.75 ? "performance" : "balanced";
        renderWidth = 0;
        resize();
        lowFpsWindows = 0;
        highFpsWindows = 0;
      } else if (highFpsWindows >= 6 && qualityScale < 1) {
        qualityScale = qualityScale < 0.8 ? 0.82 : 1;
        renderer.setPixelRatio(maximumPixelRatio * qualityScale);
        canvas.dataset.renderQuality = qualityScale === 1 ? "high" : "balanced";
        renderWidth = 0;
        resize();
        lowFpsWindows = 0;
        highFpsWindows = 0;
      }
      statsStartedAt = now;
      frames = 0;
    }
    animationFrame = window.requestAnimationFrame(render);
  };
  animationFrame = window.requestAnimationFrame(render);

  return {
    updateContestants(nextContestants) {
      contestants = [...nextContestants];
      hiddenContestantIds.clear();
      colorSignatures.length = 0;
      const activeIds = new Set(nextContestants.map((contestant) => contestant.id));
      currentPositions.forEach((_, id) => {
        if (!activeIds.has(id)) {
          currentPositions.delete(id);
          coverAmounts.delete(id);
        }
      });
    },
    setRunning(nextRunning) {
      running = nextRunning;
      if (nextRunning && !hasStarted) {
        hasStarted = true;
        runStartedAt = performance.now();
        coverCycleStartedAt = runStartedAt;
      }
    },
    beginWave(duckIds) {
      activeWaveIds = new Set(duckIds);
      resetState = null;
      escapeStartedAt = 0;
      escapeUntil = 0;
      coverCycleStartedAt = performance.now();
      hiddenContestantIds.clear();
      removeLabel();
    },
    escapeWave() {
      escapeStartedAt = performance.now();
      escapeUntil = escapeStartedAt + 1_050;
      powerCasterId = null;
      powerPulseUntil = 0;
    },
    shoot(clientX, clientY) {
      const emptyShot: DuckShotTarget = { hitId: null, grazedId: null, threatX: 0, threatY: 0 };
      if (!running || resetState) return emptyShot;
      const rect = canvas.getBoundingClientRect();
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;
      let selectedId: string | null = null;
      let grazedId: string | null = null;
      let selectedDistance = Number.POSITIVE_INFINITY;
      let grazeDistance = Number.POSITIVE_INFINITY;
      const radius = getDuckHitRadius(contestants.length);
      contestants.forEach((contestant) => {
        if (contestant.knockedOut) return;
        if (activeWaveIds.size > 0 && !activeWaveIds.has(contestant.id)) return;
        if (escapeUntil > performance.now()) return;
        if ((coverAmounts.get(contestant.id) ?? 0) >= 0.58) return;
        const position = currentPositions.get(contestant.id);
        if (!position) return;
        projected.copy(position).project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * rect.width;
        const screenY = (-projected.y * 0.5 + 0.5) * rect.height;
        const distance = Math.hypot(screenX - pointerX, screenY - pointerY);
        if (distance <= radius && distance < selectedDistance) {
          selectedDistance = distance;
          selectedId = contestant.id;
        } else if (distance <= radius * 1.62 && distance < grazeDistance) {
          grazeDistance = distance;
          grazedId = contestant.id;
        }
      });
      projected.set((pointerX / rect.width) * 2 - 1, -(pointerY / rect.height) * 2 + 1, 0.12).unproject(camera);
      flash.position.copy(projected);
      shotFlashUntil = performance.now() + 120;
      return {
        hitId: selectedId,
        grazedId: selectedId ? null : grazedId,
        threatX: (pointerX / rect.width) * 2 - 1,
        threatY: 1 - (pointerY / rect.height) * 2,
      };
    },
    castPower(casterId) {
      powerCasterId = casterId;
      powerPulseUntil = performance.now() + 1_250;
    },
    resetFlock(targetId, labelOverride) {
      const entropy = new Uint32Array(1);
      crypto.getRandomValues(entropy);
      formationNonce = entropy[0];
      powerCasterId = null;
      powerPulseUntil = 0;
      resetState = {
        startedAt: performance.now(),
        targetId,
        nonce: formationNonce,
        duration: getDuckResetDuration(contestants.length),
      };
      const target = contestants.find((contestant) => contestant.id === targetId);
      if (target) {
        if (labelOverride) {
          removeLabel();
          labelTexture = makeLabelTexture(labelOverride, "#5df4ff");
          if (labelTexture) {
            labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
            labelSprite.scale.set(4.4, 1.1, 1);
            labelSprite.renderOrder = 20;
            scene.add(labelSprite);
          }
        } else {
          showLabel(target);
        }
      }
    },
    regenerateFormation() {
      const entropy = new Uint32Array(1);
      crypto.getRandomValues(entropy);
      formationNonce = entropy[0];
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      removeLabel();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (
          !(object instanceof THREE.Mesh) &&
          !(object instanceof THREE.Line) &&
          !(object instanceof THREE.Points) &&
          !(object instanceof THREE.Sprite)
        ) return;
        if ("geometry" in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        });
      });
      if (flashTexture) textures.add(flashTexture);
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
    },
  };
};
