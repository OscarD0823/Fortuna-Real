import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  getMarbleMotion,
  getTrackPosition,
  powerLabels,
  type MarbleTrackEvent,
  type MarbleTrack,
  type PreparedMarbleRace,
  type TrackObstacleType,
  type TrackSectionType,
  type TrackZone,
} from "./marbleRaceEngine";
import { createMarbleTrackPiece3D } from "./marbleTrackPieceKit";

export type MarbleRaceVisualPhase = "ready" | "racing" | "finished";
export type MarbleFollowCameraStyle = "chase" | "onboard" | "trackside" | "aerial";

interface TrackWorldPoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  up: THREE.Vector3;
}

interface AnimatedPart {
  object: THREE.Object3D;
  update: (object: THREE.Object3D, elapsedSeconds: number) => void;
}

interface MarbleSceneState {
  key: string;
  raceIdentity: PreparedMarbleRace;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  followCamera: THREE.PerspectiveCamera;
  racers: THREE.InstancedMesh;
  racerCores: THREE.InstancedMesh | null;
  racerRings: THREE.InstancedMesh;
  racerShadows: THREE.InstancedMesh;
  racerGlow: THREE.Points;
  racerLabels: THREE.Sprite[];
  trackLabels: THREE.Sprite[];
  winnerLabel: THREE.Sprite | null;
  winnerCrowns: THREE.InstancedMesh;
  selectedRing: THREE.Mesh;
  followBeacon: THREE.Mesh;
  trackSamples: TrackWorldPoint[];
  startPoint: TrackWorldPoint;
  motionPoint: TrackWorldPoint;
  lookAheadPoint: TrackWorldPoint;
  cameraAnchorPoint: TrackWorldPoint;
  matrix: THREE.Matrix4;
  quaternion: THREE.Quaternion;
  scaleVector: THREE.Vector3;
  positionVector: THREE.Vector3;
  stagingVector: THREE.Vector3;
  labelVector: THREE.Vector3;
  contentCenter: THREE.Vector3;
  overviewCameraPosition: THREE.Vector3;
  overviewCameraTarget: THREE.Vector3;
  stagingCameraPosition: THREE.Vector3;
  stagingCameraTarget: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  followCameraTarget: THREE.Vector3;
  followCameraUp: THREE.Vector3;
  followCameraForward: THREE.Vector3;
  racerPositions: THREE.Vector3[];
  activeFollowRacerId: string | null;
  readyZoom: number;
  contentWidth: number;
  contentDepth: number;
  projectedContentWidth: number;
  projectedContentHeight: number;
  animatedParts: AnimatedPart[];
  glowMaterials: THREE.MeshStandardMaterial[];
  participantCount: number;
  reducedMotion: boolean;
  shadowReady: boolean;
  resolutionScale: number;
  lastRenderAt: number;
  averageFrameMs: number;
  slowFrames: number;
  fastFrames: number;
  lastEffectsAt: number;
  lastMetricsAt: number;
  width: number;
  height: number;
}

const sceneStates = new WeakMap<HTMLCanvasElement, MarbleSceneState>();
const WORLD_WIDTH = 28;
const WORLD_DEPTH = 21;
const BOARD_WIDTH = 30;
const BOARD_DEPTH = 22.5;
const GOLD = 0xd49a38;
const FLOOR = 0x02070a;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const trackWidthToWorld = (track: MarbleTrack) => track.trackWidth / 33;

const trackWorldWidth = (track: MarbleTrack) => WORLD_WIDTH * track.mapScale;
const trackWorldDepth = (track: MarbleTrack) => WORLD_DEPTH * track.mapScale;

const trackElevation = (track: MarbleTrack, progress: number) => {
  const phase = (hashText(track.signature) % 628) / 100;
  const piece = getTrackPosition(track.points, progress);
  return 0.58 + piece.elevation + Math.sin(progress * Math.PI * 7 + phase) * 0.018;
};

const worldPointAt = (track: MarbleTrack, progress: number): TrackWorldPoint => {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  const before = getTrackPosition(track.points, Math.max(0, clamped - 0.002));
  const after = getTrackPosition(track.points, Math.min(1, clamped + 0.002));
  const source = getTrackPosition(track.points, clamped);
  const position = new THREE.Vector3(
    (source.x - 0.5) * trackWorldWidth(track),
    trackElevation(track, clamped),
    (source.y - 0.5) * trackWorldDepth(track),
  );
  const tangent = new THREE.Vector3(
    (after.x - before.x) * trackWorldWidth(track),
    trackElevation(track, Math.min(1, clamped + 0.002)) - trackElevation(track, Math.max(0, clamped - 0.002)),
    (after.y - before.y) * trackWorldDepth(track),
  ).normalize();
  const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
  const normal = new THREE.Vector3(-flatTangent.z, 0, flatTangent.x)
    .applyAxisAngle(tangent, source.bank)
    .normalize();
  const up = normal.clone().cross(tangent).normalize();
  return { position, tangent, normal, up };
};

const createEmptyWorldPoint = (): TrackWorldPoint => ({
  position: new THREE.Vector3(),
  tangent: new THREE.Vector3(0, 0, 1),
  normal: new THREE.Vector3(-1, 0, 0),
  up: new THREE.Vector3(0, 1, 0),
});

const sampleWorldPoint = (
  samples: readonly TrackWorldPoint[],
  progress: number,
  target: TrackWorldPoint,
) => {
  const position = THREE.MathUtils.clamp(progress, 0, 1) * (samples.length - 1);
  const startIndex = Math.floor(position);
  const endIndex = Math.min(samples.length - 1, startIndex + 1);
  const local = position - startIndex;
  target.position.lerpVectors(samples[startIndex].position, samples[endIndex].position, local);
  target.tangent.lerpVectors(samples[startIndex].tangent, samples[endIndex].tangent, local).normalize();
  target.normal.lerpVectors(samples[startIndex].normal, samples[endIndex].normal, local).normalize();
  target.up.lerpVectors(samples[startIndex].up, samples[endIndex].up, local).normalize();
  return target;
};

const findOverheadTrackY = (
  samples: readonly TrackWorldPoint[],
  racerProgress: number,
  referenceY: number,
  x: number,
  z: number,
  radius: number,
) => {
  const radiusSq = radius * radius;
  let ceilingY = Number.POSITIVE_INFINITY;
  samples.forEach((sample, index) => {
    const sampleProgress = index / Math.max(1, samples.length - 1);
    if (Math.abs(sampleProgress - racerProgress) < 0.075) return;
    if (sample.position.y < referenceY + 2.45) return;
    const distanceSq = (sample.position.x - x) ** 2 + (sample.position.z - z) ** 2;
    if (distanceSq <= radiusSq) ceilingY = Math.min(ceilingY, sample.position.y);
  });
  return ceilingY;
};

const metalMaterial = (color: THREE.ColorRepresentation, roughness = 0.3) => new THREE.MeshStandardMaterial({
  color,
  metalness: 0.88,
  roughness,
});

const glowMaterial = (color: THREE.ColorRepresentation, intensity = 1.2) => new THREE.MeshStandardMaterial({
  color,
  emissive: color,
  emissiveIntensity: intensity,
  metalness: 0.45,
  roughness: 0.24,
});

const glassMaterial = (color: THREE.ColorRepresentation) => new THREE.MeshPhysicalMaterial({
  color,
  emissive: color,
  emissiveIntensity: 0.28,
  metalness: 0.05,
  roughness: 0.08,
  transparent: true,
  opacity: 0.72,
  transmission: 0.18,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
});

const createMarbleGlowTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.28, "rgba(255,255,255,.82)");
    gradient.addColorStop(0.62, "rgba(255,255,255,.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const addMesh = <T extends THREE.BufferGeometry, M extends THREE.Material>(
  parent: THREE.Object3D,
  geometry: T,
  material: M,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const createLabelSprite = (text: string, color: string, compact = false, depthTest = false) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();
  context.clearRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 8, 14, 496, 100, 28);
  context.fillStyle = "rgba(2,10,14,.92)";
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = color;
  context.stroke();
  const gradient = context.createLinearGradient(0, 0, 512, 0);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.32, "#ffffff");
  gradient.addColorStop(1, color);
  context.fillStyle = gradient;
  context.font = `900 ${compact ? 38 : 42}px Montserrat, Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), 256, 65, 450);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest }));
  sprite.renderOrder = 20;
  sprite.scale.set(compact ? 2.35 : 3.15, compact ? 0.59 : 0.78, 1);
  return sprite;
};

const createTrackSamples = (track: MarbleTrack, participantCount: number) => {
  const count = participantCount > 150
    ? Math.max(120, track.sections.length * 4)
    : participantCount > 96
      ? Math.max(150, track.sections.length * 5)
      : Math.max(180, track.sections.length * 7);
  return Array.from({ length: count }, (_, index) => worldPointAt(track, index / (count - 1)));
};

const createBrushedMetalTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = "#273236";
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = 28 + ((y * 37) % 34);
    context.strokeStyle = `rgba(${shade},${shade + 8},${shade + 10},${0.16 + (y % 7) * 0.012})`;
    context.beginPath();
    context.moveTo(0, y + ((y * 13) % 3));
    context.lineTo(256, y);
    context.stroke();
  }
  for (let index = 0; index < 38; index += 1) {
    const x = (index * 73) % 256;
    const y = (index * 41) % 256;
    context.strokeStyle = index % 3 === 0 ? "rgba(230,240,240,.18)" : "rgba(3,8,9,.28)";
    context.lineWidth = index % 4 === 0 ? 2 : 1;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.min(256, x + 18 + (index % 5) * 7), y + (index % 3) - 1);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 28);
  texture.anisotropy = 4;
  return texture;
};

const createTrackArrowGeometry = () => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.36, 0.02);
  shape.lineTo(-0.13, 0.02);
  shape.lineTo(-0.13, 0.5);
  shape.lineTo(0.13, 0.5);
  shape.lineTo(0.13, 0.02);
  shape.lineTo(0.36, 0.02);
  shape.lineTo(0, -0.52);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
};

const createRibbonGeometry = (
  samples: readonly TrackWorldPoint[],
  width: number,
  topOffset = 0,
  depth = 0.44,
) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  samples.forEach((sample, index) => {
    const left = sample.position.clone().addScaledVector(sample.normal, width / 2).addScaledVector(sample.up, topOffset);
    const right = sample.position.clone().addScaledVector(sample.normal, -width / 2).addScaledVector(sample.up, topOffset);
    const bottomLeft = left.clone().addScaledVector(sample.up, -depth);
    const bottomRight = right.clone().addScaledVector(sample.up, -depth);
    positions.push(
      left.x, left.y, left.z,
      right.x, right.y, right.z,
      bottomLeft.x, bottomLeft.y, bottomLeft.z,
      bottomRight.x, bottomRight.y, bottomRight.z,
    );
    const v = index / Math.max(1, samples.length - 1);
    uvs.push(0, v, 1, v, 0, v, 1, v);
    if (index === samples.length - 1) return;
    const base = index * 4;
    const next = base + 4;
    indices.push(
      base, next, base + 1, base + 1, next, next + 1,
      base + 2, base + 3, next + 2, base + 3, next + 3, next + 2,
      base, base + 2, next, base + 2, next + 2, next,
      base + 1, next + 1, base + 3, base + 3, next + 1, next + 3,
    );
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const addTrackBody = (
  scene: THREE.Scene,
  track: MarbleTrack,
  samples: readonly TrackWorldPoint[],
  lowDetail: boolean,
) => {
  const trackGroup = new THREE.Group();
  const width = trackWidthToWorld(track);
  scene.add(trackGroup);

  const deckTexture = createBrushedMetalTexture();
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x526064,
    emissive: 0x07191c,
    emissiveIntensity: 0.32,
    map: deckTexture,
    bumpMap: deckTexture,
    bumpScale: 0.07,
    metalness: 0.68,
    roughness: 0.42,
  });
  const deck = addMesh(trackGroup, createRibbonGeometry(samples, width + 0.58, 0, 0.64), deckMaterial);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0x34464b,
    emissive: 0x06262a,
    emissiveIntensity: 0.48,
    metalness: 0.62,
    roughness: 0.36,
  });
  const lane = addMesh(trackGroup, createRibbonGeometry(samples, width, 0.07, 0.1), laneMaterial);
  lane.receiveShadow = true;

  const centerCurve = new THREE.CatmullRomCurve3(samples.map((sample) => sample.position.clone().add(new THREE.Vector3(0, 0.105, 0))));
  const centerLine = addMesh(trackGroup, new THREE.TubeGeometry(centerCurve, samples.length, 0.03, lowDetail ? 3 : 5, false), glowMaterial(0x00cfd5, 1.15));
  centerLine.castShadow = false;

  [-1, 1].forEach((side) => {
    const outerRailPoints = samples.map((sample) => sample.position.clone()
      .addScaledVector(sample.normal, side * (width / 2 + 0.24))
      .addScaledVector(sample.up, 0.37));
    const innerRailPoints = samples.map((sample) => sample.position.clone()
      .addScaledVector(sample.normal, side * (width / 2 + 0.06))
      .addScaledVector(sample.up, 0.19));
    const outerRailCurve = new THREE.CatmullRomCurve3(outerRailPoints);
    const innerRailCurve = new THREE.CatmullRomCurve3(innerRailPoints);
    addMesh(trackGroup, new THREE.TubeGeometry(outerRailCurve, samples.length, 0.135, lowDetail ? 5 : 7, false), metalMaterial(0x080b0c, 0.22));
    const outerAccent = addMesh(
      trackGroup,
      new THREE.TubeGeometry(outerRailCurve, samples.length, 0.055, lowDetail ? 4 : 6, false),
      glowMaterial(0xe5a13a, 1.02),
    );
    addMesh(trackGroup, new THREE.TubeGeometry(innerRailCurve, samples.length, 0.09, lowDetail ? 4 : 6, false), metalMaterial(0x10181a, 0.24));
    const innerAccent = addMesh(
      trackGroup,
      new THREE.TubeGeometry(innerRailCurve, samples.length, 0.034, lowDetail ? 3 : 5, false),
      glowMaterial(side < 0 ? 0x0bdce1 : 0xf0a72e, 1.28),
    );
    outerAccent.castShadow = false;
    innerAccent.castShadow = false;
  });

  const seamSamples = samples.filter((_, index) => index > 3 && index < samples.length - 4 && index % 9 === 4);
  const seamGeometry = new THREE.BoxGeometry(width * 0.94, 0.032, 0.075);
  const seams = new THREE.InstancedMesh(seamGeometry, metalMaterial(0x070c0e, 0.48), seamSamples.length);
  seams.name = "SM_TrackModuleSeams";
  const signalColors = [0x09e0df, 0xf6bd35, 0xe95b45, 0xd97cff] as const;
  const signalSamples = samples.filter((_, index) => index > 9 && index < samples.length - 9 && index % 16 === 8);
  const signalGeometry = createTrackArrowGeometry();
  const signalGroups = signalColors.map((color, colorIndex) => ({
    color,
    samples: signalSamples.filter((_, index) => index % signalColors.length === colorIndex),
  }));
  const matrix = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const signalScale = new THREE.Vector3(width * 0.54, 1, width * 0.54);
  seamSamples.forEach((sample, index) => {
    quaternion.setFromRotationMatrix(basis.makeBasis(sample.normal, sample.up, sample.tangent));
    matrix.compose(
      sample.position.clone().addScaledVector(sample.up, 0.126),
      quaternion,
      new THREE.Vector3(1, 1, 1),
    );
    seams.setMatrixAt(index, matrix);
  });
  seams.receiveShadow = true;
  trackGroup.add(seams);
  signalGroups.forEach(({ color, samples: colorSamples }, groupIndex) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const signals = new THREE.InstancedMesh(signalGeometry, material, colorSamples.length);
    signals.name = `FX_TrackSignals_${groupIndex}`;
    colorSamples.forEach((sample, index) => {
      quaternion.setFromRotationMatrix(basis.makeBasis(sample.normal, sample.up, sample.tangent));
      matrix.compose(sample.position.clone().addScaledVector(sample.up, 0.145), quaternion, signalScale);
      signals.setMatrixAt(index, matrix);
    });
    signals.renderOrder = 4;
    trackGroup.add(signals);
  });

  const tieSamples = samples.filter((_, index) => index % 5 === 0);
  const tieGeometry = new THREE.BoxGeometry(width + 0.72, 0.12, 0.2);
  const ties = new THREE.InstancedMesh(tieGeometry, metalMaterial(0x342c22, 0.34), tieSamples.length);
  tieSamples.forEach((sample, index) => {
    quaternion.setFromRotationMatrix(basis.makeBasis(sample.normal, sample.up, sample.tangent));
    matrix.compose(sample.position.clone().addScaledVector(sample.up, 0.095), quaternion, new THREE.Vector3(1, 1, 1));
    ties.setMatrixAt(index, matrix);
  });
  ties.castShadow = false;
  ties.receiveShadow = true;
  trackGroup.add(ties);

  const boltGeometry = new THREE.CylinderGeometry(0.065, 0.065, 0.08, 7);
  const bolts = new THREE.InstancedMesh(boltGeometry, metalMaterial(0xe3ad47, 0.16), tieSamples.length * 2);
  tieSamples.forEach((sample, index) => {
    [-1, 1].forEach((side, sideIndex) => {
      const position = sample.position.clone()
        .addScaledVector(sample.normal, side * (width / 2 + 0.18))
        .addScaledVector(sample.up, 0.31);
      quaternion.setFromRotationMatrix(basis.makeBasis(sample.normal, sample.up, sample.tangent));
      matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
      bolts.setMatrixAt(index * 2 + sideIndex, matrix);
    });
  });
  bolts.castShadow = false;
  trackGroup.add(bolts);

  const wallSamples = samples.filter((_, index) => index % 7 === 0);
  const wallGeometry = new THREE.BoxGeometry(0.34, 0.34, 0.42);
  const walls = new THREE.InstancedMesh(wallGeometry, metalMaterial(0x252b2d, 0.22), wallSamples.length * 2);
  wallSamples.forEach((sample, index) => {
    quaternion.setFromRotationMatrix(basis.makeBasis(sample.normal, sample.up, sample.tangent));
    [-1, 1].forEach((side, sideIndex) => {
      const position = sample.position.clone()
        .addScaledVector(sample.normal, side * (width / 2 + 0.17))
        .add(new THREE.Vector3(0, -0.04, 0));
      matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
      walls.setMatrixAt(index * 2 + sideIndex, matrix);
    });
  });
  walls.castShadow = false;
  walls.receiveShadow = true;
  trackGroup.add(walls);

  const supportSamples = samples.filter((_, index) => index % 22 === 8);
  const supports = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.23, 1, 8), metalMaterial(0x75501f, 0.28), supportSamples.length * 2);
  supportSamples.forEach((sample, index) => {
    const supportHeight = Math.max(0.5, sample.position.y + 0.78);
    [-1, 1].forEach((side, sideIndex) => {
      const position = sample.position.clone().addScaledVector(sample.normal, side * width * 0.36);
      position.y = -0.84 + supportHeight / 2;
      matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, supportHeight, 1));
      supports.setMatrixAt(index * 2 + sideIndex, matrix);
    });
  });
  supports.castShadow = true;
  supports.receiveShadow = true;
  trackGroup.add(supports);
};

const orientGroupOnTrack = (group: THREE.Group, track: MarbleTrack, progress: number) => {
  const point = worldPointAt(track, progress);
  group.position.copy(point.position);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(point.normal, point.up, point.tangent));
  return point;
};

const addPlatform = (group: THREE.Group, zone: TrackZone, trackWidth: number) => {
  const radius = trackWidth * (zone.type === "turbo" ? 0.86 : 0.92) * zone.scale;
  const base = addMesh(
    group,
    new THREE.CylinderGeometry(radius * 1.28, radius * 1.42, 0.52, 10),
    metalMaterial(0x303a3d, 0.2),
    [0, -0.28, 0],
  );
  if (zone.type === "turbo") base.scale.z = 1.65;
  addMesh(group, new THREE.TorusGeometry(radius, 0.075, 7, 32), glowMaterial(zone.color, 0.62), [0, 0.03, 0], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.TorusGeometry(radius * 1.18, 0.06, 6, 10), metalMaterial(GOLD, 0.18), [0, -0.02, 0], [Math.PI / 2, 0, 0]);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    addMesh(group, new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6), metalMaterial(0xf0bc58, 0.15), [Math.cos(angle) * radius * 1.16, 0.03, Math.sin(angle) * radius * 1.16]);
  }
};

const addArrow = (group: THREE.Object3D, color: string, z: number, scale = 1) => {
  const arrow = addMesh(group, new THREE.ConeGeometry(0.22 * scale, 0.58 * scale, 3), glowMaterial(color, 1.6), [0, 0.18, z], [Math.PI / 2, 0, 0]);
  arrow.castShadow = false;
  return arrow;
};

const addIndustrialModule = (
  group: THREE.Group,
  zone: TrackZone,
  width: number,
  animatedParts: AnimatedPart[],
) => {
  const side = hashText(zone.id) % 2 === 0 ? 1 : -1;
  const module = new THREE.Group();
  module.position.set(side * width * 1.22, -0.1, ((hashText(`${zone.id}-offset`) % 100) / 100 - 0.5) * 0.9);
  group.add(module);
  const steel = metalMaterial(0x343d40, 0.2);
  const brass = metalMaterial(0xb97d24, 0.18);
  addMesh(module, new THREE.CylinderGeometry(0.78, 0.9, 0.35, 10), steel, [0, -0.12, 0]);
  addMesh(module, new THREE.TorusGeometry(0.72, 0.075, 7, 20), brass, [0, 0.08, 0], [Math.PI / 2, 0, 0]);

  if (["launch", "forge", "royal"].includes(zone.type)) {
    const cannon = new THREE.Group();
    cannon.position.y = 0.78;
    addMesh(cannon, new THREE.CylinderGeometry(0.2, 0.31, 1.55, 12), steel, [0, 0, 0], [Math.PI / 2, 0, 0]);
    [-0.47, 0.42].forEach((z) => addMesh(cannon, new THREE.TorusGeometry(0.285, 0.065, 7, 14), brass, [0, 0, z]));
    addMesh(cannon, new THREE.CylinderGeometry(0.12, 0.16, 0.8, 9), brass, [0, -0.5, 0]);
    cannon.rotation.y = side * 0.42;
    module.add(cannon);
    animatedParts.push({ object: cannon, update: (object, time) => { object.rotation.x = Math.sin(time * 0.42 + side) * 0.08; } });
  } else if (["turbine", "gravity"].includes(zone.type)) {
    const gear = new THREE.Group();
    gear.position.y = 0.28;
    addMesh(gear, new THREE.CylinderGeometry(0.58, 0.58, 0.22, 12), steel);
    addMesh(gear, new THREE.TorusGeometry(0.6, 0.12, 6, 12), brass, [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let tooth = 0; tooth < 12; tooth += 1) {
      const angle = tooth * Math.PI / 6;
      addMesh(gear, new THREE.BoxGeometry(0.18, 0.18, 0.32), brass, [Math.cos(angle) * 0.72, 0, Math.sin(angle) * 0.72], [0, -angle, 0]);
    }
    module.add(gear);
    animatedParts.push({ object: gear, update: (object, time) => { object.rotation.y = time * side * 0.45; } });
  } else {
    const tower = new THREE.Group();
    tower.position.y = 0.2;
    addMesh(tower, new THREE.CylinderGeometry(0.17, 0.28, 1.25, 8), steel, [0, 0.55, 0]);
    const energy = addMesh(tower, new THREE.SphereGeometry(0.28, 14, 10), glowMaterial(zone.color, 1.5), [0, 1.25, 0]);
    addMesh(tower, new THREE.TorusGeometry(0.44, 0.045, 6, 20), glowMaterial(zone.color, 1.15), [0, 1.25, 0], [Math.PI / 2, 0, 0]);
    module.add(tower);
    animatedParts.push({ object: energy, update: (object, time) => { object.scale.setScalar(1 + Math.sin(time * 2.1) * 0.12); } });
  }
  return side;
};

const addZoneFeature = (
  scene: THREE.Scene,
  track: MarbleTrack,
  zone: TrackZone,
  animatedParts: AnimatedPart[],
  glowMaterials: THREE.MeshStandardMaterial[],
  localLights: boolean,
  labelIndex: number,
) => {
  const group = new THREE.Group();
  orientGroupOnTrack(group, track, zone.centerProgress);
  scene.add(group);
  const width = trackWidthToWorld(track);
  addPlatform(group, zone, width);
  const localFloorY = -group.position.y - 0.835;
  const floorGlow = addMesh(
    group,
    new THREE.CircleGeometry(width * 1.55 * zone.scale, 32),
    new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.075, depthWrite: false }),
    [0, localFloorY, 0],
    [-Math.PI / 2, 0, 0],
  );
  floorGlow.castShadow = false;
  floorGlow.receiveShadow = false;
  if (localLights) {
    const zoneLight = new THREE.PointLight(zone.color, 26 * zone.scale, 5.5 * zone.scale, 1.9);
    zoneLight.position.set(0, 1.7 * zone.scale, 0);
    group.add(zoneLight);
  }
  const accent = glowMaterial(zone.color, 1.25);
  glowMaterials.push(accent);
  const steel = metalMaterial(0x30383a, 0.2);
  const brass = metalMaterial(GOLD, 0.18);
  const scale = zone.scale;
  const factorySide = addIndustrialModule(group, zone, width, animatedParts);

  if (zone.type === "launch") {
    [-1, 1].forEach((side) => {
      addMesh(group, new THREE.CylinderGeometry(0.18, 0.22, 1.5, 10), steel, [side * width * 0.62, 0.72, 0]);
      addMesh(group, new THREE.TorusGeometry(0.23, 0.07, 6, 12), brass, [side * width * 0.62, 1.42, 0], [Math.PI / 2, 0, 0]);
    });
    addMesh(group, new THREE.BoxGeometry(width * 1.45, 0.22, 0.28), brass, [0, 1.52, 0]);
    const shutter = addMesh(group, new THREE.BoxGeometry(width * 1.05, 0.08, 0.12), accent, [0, 0.28, 0]);
    animatedParts.push({ object: shutter, update: (object, time) => { object.position.y = 0.3 + Math.sin(time * 2.2) * 0.12; } });
  } else if (zone.type === "turbo") {
    [-1.05, -0.35, 0.35, 1.05].forEach((z) => addArrow(group, zone.color, z, 1.1));
    [-1, 1].forEach((side) => addMesh(group, new THREE.BoxGeometry(0.12, 0.22, 3), brass, [side * width * 0.52, 0.14, 0]));
  } else if (zone.type === "turbine") {
    const fan = new THREE.Group();
    fan.position.y = 0.75;
    group.add(fan);
    addMesh(fan, new THREE.CylinderGeometry(0.3, 0.38, 0.46, 12), steel);
    for (let blade = 0; blade < 6; blade += 1) {
      const bladeGroup = new THREE.Group();
      bladeGroup.rotation.y = (blade / 6) * Math.PI * 2;
      addMesh(bladeGroup, new THREE.BoxGeometry(0.26, 0.12, 1.05), accent, [0, 0, 0.55], [0, -0.3, 0]);
      fan.add(bladeGroup);
    }
    animatedParts.push({ object: fan, update: (object, time) => { object.rotation.y = time * 1.85; } });
  } else if (zone.type === "ice") {
    const iceDeck = addMesh(
      group,
      new THREE.CylinderGeometry(width * 0.56 * scale, width * 0.62 * scale, 0.075, 14),
      glassMaterial("#8fe9ff"),
      [0, 0.13, 0],
    );
    iceDeck.castShadow = false;
    [-0.42, 0, 0.42].forEach((offset, index) => {
      const crack = addMesh(
        group,
        new THREE.BoxGeometry(0.025, 0.018, width * (index === 1 ? 0.78 : 0.54)),
        glowMaterial(index === 1 ? 0xc8f7ff : 0x58cce9, 0.72),
        [offset * scale, 0.185, 0],
        [0, (index - 1) * 0.48, 0],
      );
      crack.castShadow = false;
    });
    [[-0.72, 0.8, -0.25], [0, 1.35, 0.05], [0.7, 0.95, 0.3], [-0.35, 0.6, 0.55]].forEach(([x, height, z]) => {
      addMesh(group, new THREE.ConeGeometry(0.25 * scale, height * scale, 5), glassMaterial(zone.color), [x * scale, height * scale * 0.5, z * scale]);
    });
  } else if (zone.type === "portal") {
    const portal = new THREE.Group();
    portal.position.y = 1.15;
    group.add(portal);
    addMesh(portal, new THREE.TorusGeometry(0.9 * scale, 0.16, 9, 36), accent);
    addMesh(portal, new THREE.TorusGeometry(0.62 * scale, 0.045, 7, 28), glassMaterial(zone.color));
    [-1, 1].forEach((side) => addMesh(group, new THREE.BoxGeometry(0.28, 0.75, 0.42), steel, [side * 0.92 * scale, 0.2, 0]));
    animatedParts.push({ object: portal, update: (object, time) => { object.rotation.z = Math.sin(time * 0.8) * 0.12; object.scale.setScalar(1 + Math.sin(time * 2.4) * 0.04); } });
  } else if (zone.type === "forge") {
    [-1, 1].forEach((side) => addMesh(group, new THREE.BoxGeometry(0.3, 1.55, 0.42), steel, [side * width * 0.62, 0.65, 0]));
    addMesh(group, new THREE.BoxGeometry(width * 1.45, 0.28, 0.5), brass, [0, 1.48, 0]);
    const hammer = new THREE.Group();
    hammer.position.set(0, 1.35, 0);
    addMesh(hammer, new THREE.BoxGeometry(0.15, 1.25, 0.15), metalMaterial(0x815127, 0.5), [0, -0.55, 0]);
    addMesh(hammer, new THREE.BoxGeometry(1.05, 0.42, 0.52), steel, [0, -1.15, 0]);
    group.add(hammer);
    animatedParts.push({ object: hammer, update: (object, time) => { object.rotation.z = -0.45 + Math.sin(time * 1.7) * 0.52; } });
    [-0.55, 0.55].forEach((x) => addMesh(group, new THREE.ConeGeometry(0.17, 0.65, 5), glowMaterial(0xef6b45, 1.8), [x, 0.38, 0.55]));
  } else if (zone.type === "gravity") {
    const vortex = new THREE.Group();
    vortex.position.y = 0.95;
    group.add(vortex);
    addMesh(vortex, new THREE.SphereGeometry(0.28, 18, 12), glowMaterial(zone.color, 2));
    [0.65, 0.92, 1.2].forEach((radius, index) => {
      addMesh(vortex, new THREE.TorusGeometry(radius * scale, 0.045, 7, 32), accent, [0, 0, 0], [index * 0.7, index * 0.45, index * 0.2]);
    });
    animatedParts.push({ object: vortex, update: (object, time) => { object.rotation.y = time * 1.1; object.rotation.z = time * 0.24; } });
  } else {
    [-1, 1].forEach((side) => addMesh(group, new THREE.CylinderGeometry(0.16, 0.22, 1.7, 10), brass, [side * width * 0.62, 0.74, 0]));
    addMesh(group, new THREE.BoxGeometry(width * 1.42, 0.22, 0.34), brass, [0, 1.58, 0]);
    [-0.55, 0, 0.55].forEach((x, index) => addMesh(group, new THREE.ConeGeometry(0.18, index === 1 ? 0.72 : 0.52, 4), glowMaterial(0xf6bd35, 1.25), [x, 1.96 + (index === 1 ? 0.1 : 0), 0]));
  }

  if (zone.type === "launch" && labelIndex === 0) {
    const label = createLabelSprite(zone.label, zone.color, true, true);
    label.userData.trackLabel = true;
    label.position.set(
      -factorySide * width * (0.72 + (labelIndex % 2) * 0.18),
      (2.02 + (labelIndex % 3) * 0.22) * scale,
      0,
    );
    label.scale.multiplyScalar(track.difficulty === "hard" ? 0.66 : 0.78);
    group.add(label);
  }
};

const addSectionArchitecture = (scene: THREE.Scene, track: MarbleTrack) => {
  const width = trackWidthToWorld(track);
  const featuredPieceTypes = new Set<TrackSectionType>();
  track.sections.forEach((section, index) => {
    const progress = (section.startProgress + section.endProgress) / 2;
    const connector = new THREE.Group();
    orientGroupOnTrack(connector, track, section.startProgress);
    scene.add(connector);
    addMesh(
      connector,
      new THREE.BoxGeometry(width * 0.98, 0.085, 0.16),
      metalMaterial(index % 4 === 0 ? GOLD : 0x536064, 0.18),
      [0, 0.14, 0],
    );
    [-1, 1].forEach((side) => addMesh(
      connector,
      new THREE.CylinderGeometry(0.055, 0.055, 0.075, 7),
      metalMaterial(0xefbd58, 0.14),
      [side * width * 0.39, 0.2, 0],
    ));
    const group = new THREE.Group();
    orientGroupOnTrack(group, track, progress);
    scene.add(group);
    const surfaceColor = section.surface === "turbo"
      ? 0x09e0df
      : section.surface === "ice"
        ? 0x8fe9ff
        : section.surface === "grip"
          ? 0xd49a38
          : 0x718086;
    addMesh(
      group,
      new THREE.BoxGeometry(width * 0.86, 0.055, index % 4 === 0 ? 0.23 : 0.12),
      section.surface === "turbo" || section.surface === "ice"
        ? glowMaterial(surfaceColor, section.surface === "turbo" ? 1.05 : 0.58)
        : metalMaterial(surfaceColor, 0.2),
      [0, 0.13, 0],
    );
    [-1, 1].forEach((side) => {
      addMesh(
        group,
        new THREE.BoxGeometry(0.075, 0.25, 0.42),
        metalMaterial(index % 3 === 0 ? GOLD : 0x2e383b, 0.2),
        [side * width * 0.48, -0.02, 0],
        [0, 0, side * section.bank * 0.32],
      );
    });
    if (Math.abs(section.elevationDelta) > 0.045 || section.bridgeLift > 0.08) {
      [-1, 1].forEach((side) => addMesh(
        group,
        new THREE.BoxGeometry(0.08, section.bridgeLift > 0.08 ? 0.9 : 0.62, 0.08),
        metalMaterial(0x7b5421, 0.3),
        [side * width * 0.42, section.bridgeLift > 0.08 ? -0.48 : -0.34, 0],
        [0, 0, side * 0.34],
      ));
      if (section.bridgeLift > 0.08) {
        [-1, 1].forEach((side) => addMesh(
          group,
          new THREE.BoxGeometry(width * 0.76, 0.065, 0.08),
          metalMaterial(side > 0 ? GOLD : 0x506064, 0.22),
          [0, -0.34, side * 0.22],
          [0, 0, side * 0.18],
        ));
      }
    }
    const isFirstOfType = !featuredPieceTypes.has(section.type);
    if (isFirstOfType) {
      group.add(createMarbleTrackPiece3D(section, width));
      featuredPieceTypes.add(section.type);
    }
  });
};

const addObstacle = (
  scene: THREE.Scene,
  track: MarbleTrack,
  type: TrackObstacleType,
  progress: number,
  scale: number,
  animatedParts: AnimatedPart[],
) => {
  const group = new THREE.Group();
  orientGroupOnTrack(group, track, progress);
  group.scale.setScalar(scale);
  scene.add(group);
  const steel = metalMaterial(0x343d3f, 0.2);
  const danger = glowMaterial(0xe95b45, 1.35);

  if (type === "spinner") {
    const spinner = new THREE.Group();
    spinner.position.y = 0.52;
    addMesh(spinner, new THREE.CylinderGeometry(0.18, 0.24, 0.42, 10), steel);
    addMesh(spinner, new THREE.BoxGeometry(1.55, 0.13, 0.18), danger);
    addMesh(spinner, new THREE.BoxGeometry(0.18, 0.13, 1.55), danger);
    group.add(spinner);
    animatedParts.push({ object: spinner, update: (object, time) => { object.rotation.y = time * 2.8; } });
  } else if (type === "bumpers") {
    [[-0.52, -0.28], [0, 0.3], [0.52, -0.2]].forEach(([x, z], index) => {
      addMesh(group, new THREE.CylinderGeometry(0.2, 0.25, 0.36, 12), glowMaterial(index % 2 ? 0xf6bd35 : 0x09e0df, 1.4), [x, 0.32, z]);
      addMesh(group, new THREE.TorusGeometry(0.23, 0.045, 6, 14), steel, [x, 0.48, z], [Math.PI / 2, 0, 0]);
    });
  } else if (type === "gate") {
    [-0.78, 0.78].forEach((x) => addMesh(group, new THREE.BoxGeometry(0.18, 1.15, 0.24), steel, [x, 0.5, 0]));
    const gate = addMesh(group, new THREE.BoxGeometry(1.55, 0.17, 0.18), danger, [0, 0.62, 0]);
    animatedParts.push({ object: gate, update: (object, time) => { object.position.y = 0.45 + (Math.sin(time * 2.5) + 1) * 0.36; } });
  } else if (type === "boost") {
    [-0.42, 0, 0.42].forEach((z) => addArrow(group, "#09e0df", z, 0.72));
  } else if (type === "ice") {
    [-0.48, 0, 0.48].forEach((x, index) => addMesh(group, new THREE.ConeGeometry(0.14, 0.52 + index * 0.12, 5), glassMaterial("#8fe9ff"), [x, 0.3, index % 2 ? 0.2 : -0.18]));
  } else if (type === "portal") {
    const portal = addMesh(group, new THREE.TorusGeometry(0.7, 0.11, 8, 28), glowMaterial(0xd97cff, 1.55), [0, 0.85, 0]);
    animatedParts.push({ object: portal, update: (object, time) => { object.rotation.z = time * 0.8; } });
  } else if (type === "hammer") {
    const pivot = new THREE.Group();
    pivot.position.y = 1.28;
    addMesh(pivot, new THREE.BoxGeometry(0.12, 1.2, 0.12), metalMaterial(0x8c5728, 0.42), [0, -0.55, 0]);
    addMesh(pivot, new THREE.BoxGeometry(0.9, 0.36, 0.42), steel, [0, -1.12, 0]);
    group.add(pivot);
    animatedParts.push({ object: pivot, update: (object, time) => { object.rotation.z = Math.sin(time * 2.1) * 0.75; } });
  } else {
    const funnel = addMesh(group, new THREE.CylinderGeometry(0.72, 0.28, 0.46, 20, 1, true), glowMaterial(0xf6bd35, 0.62), [0, 0.14, 0]);
    animatedParts.push({ object: funnel, update: (object, time) => { object.rotation.y = time * 0.65; } });
  }
};

const addPowerZone = (
  scene: THREE.Scene,
  track: MarbleTrack,
  progress: number,
  color: string,
  labelText: string,
  scale: number,
  animatedParts: AnimatedPart[],
  glowMaterials: THREE.MeshStandardMaterial[],
  showLabel: boolean,
) => {
  const group = new THREE.Group();
  orientGroupOnTrack(group, track, progress);
  group.scale.setScalar(scale);
  scene.add(group);
  const material = glowMaterial(color, 1.7);
  glowMaterials.push(material);
  addMesh(group, new THREE.TorusGeometry(0.58, 0.055, 7, 28), material, [0, 0.16, 0], [Math.PI / 2, 0, 0]);
  const orb = addMesh(group, new THREE.SphereGeometry(0.16, 14, 10), material, [0, 0.72, 0]);
  const halo = addMesh(group, new THREE.TorusGeometry(0.28, 0.035, 6, 20), material, [0, 0.72, 0]);
  if (showLabel) {
    const label = createLabelSprite(labelText, color, true, true);
    label.userData.trackLabel = true;
    label.position.set(0.5, 1.22, 0);
    label.scale.multiplyScalar(0.5);
    group.add(label);
  }
  animatedParts.push({ object: orb, update: (object, time) => { object.position.y = 0.72 + Math.sin(time * 2.8 + progress * 10) * 0.16; } });
  animatedParts.push({ object: halo, update: (object, time) => { object.rotation.z = time * 1.5; object.rotation.y = time * 0.7; } });
};

const addTrackEventFeature = (
  scene: THREE.Scene,
  track: MarbleTrack,
  event: MarbleTrackEvent,
  animatedParts: AnimatedPart[],
) => {
  const group = new THREE.Group();
  group.name = `EVT_${event.type}_${event.id}`;
  orientGroupOnTrack(group, track, event.progress);
  scene.add(group);
  const width = trackWidthToWorld(track) * 1.25;
  const eventMaterial = glowMaterial(event.color, 1.2 + event.intensity * 0.35);
  const label = createLabelSprite(event.title.toUpperCase(), event.color, true, true);
  label.userData.trackLabel = true;
  label.position.set(width * 0.66, 1.55, 0);
  label.scale.multiplyScalar(0.55);
  group.add(label);

  if (event.type === "freeze") {
    const ice = addMesh(group, new THREE.BoxGeometry(width * 1.7, 0.045, 1.55), glassMaterial(event.color), [0, 0.1, 0]);
    ice.material.transparent = true;
    [-0.62, 0, 0.62].forEach((offset, index) => {
      const crystal = addMesh(group, new THREE.ConeGeometry(0.12, 0.55 + index * 0.09, 5), glassMaterial(event.color), [offset * width, 0.38, index % 2 ? 0.46 : -0.42]);
      crystal.rotation.z = index % 2 ? 0.12 : -0.12;
    });
  } else if (event.type === "river") {
    const water = addMesh(
      group,
      new THREE.PlaneGeometry(width * 2.25, 2.2, 10, 4),
      new THREE.MeshPhysicalMaterial({ color: event.color, emissive: event.color, emissiveIntensity: 0.42, transparent: true, opacity: 0.58, roughness: 0.12, metalness: 0.08 }),
      [0, 0.13, 0],
      [-Math.PI / 2, 0, 0],
    );
    animatedParts.push({ object: water, update: (object, time) => { object.position.x = Math.sin(time * 1.8 + event.progress * 8) * 0.18; } });
  } else if (event.type === "tornado") {
    const funnel = new THREE.Group();
    funnel.position.y = 0.2;
    group.add(funnel);
    for (let ring = 0; ring < 6; ring += 1) {
      const radius = 0.34 + ring * 0.12;
      addMesh(funnel, new THREE.TorusGeometry(radius, 0.035, 6, 22), eventMaterial, [0, ring * 0.34, 0], [Math.PI / 2, 0, ring * 0.22]);
    }
    animatedParts.push({ object: funnel, update: (object, time) => { object.rotation.y = time * (1.5 + event.intensity); object.position.x = Math.sin(time * 1.1) * 0.24; } });
  } else {
    [-1, 1].forEach((side) => {
      const pylon = addMesh(group, new THREE.ConeGeometry(0.18, 0.75, 5), eventMaterial, [side * width * 0.72, 0.35, 0]);
      pylon.rotation.z = side * 0.16;
    });
    const quakeRing = addMesh(group, new THREE.RingGeometry(width * 0.38, width * 0.46, 28), new THREE.MeshBasicMaterial({ color: event.color, transparent: true, opacity: 0.72, side: THREE.DoubleSide }), [0, 0.12, 0], [-Math.PI / 2, 0, 0]);
    animatedParts.push({ object: quakeRing, update: (object, time) => { const pulse = 1 + Math.sin(time * 7) * 0.16; object.scale.setScalar(pulse); } });
  }
};

const addStartFinishAndBay = (scene: THREE.Scene, race: PreparedMarbleRace) => {
  const track = race.track;
  const width = trackWidthToWorld(track);
  const start = worldPointAt(track, 0);
  const finish = worldPointAt(track, 1);
  const count = race.racers.length;
  const columns = Math.max(2, Math.ceil(Math.sqrt(count * 1.15)));
  const spacing = count > 150 ? 0.17 : count > 90 ? 0.2 : count > 48 ? 0.24 : count > 20 ? 0.3 : 0.42;
  const rows = Math.ceil(count / columns);
  const bay = new THREE.Group();
  bay.position.copy(start.position);
  bay.rotation.y = Math.atan2(start.tangent.x, start.tangent.z);
  scene.add(bay);
  const bayWidth = Math.max(width * 1.45, columns * spacing + 0.65);
  const bayDepth = rows * spacing + 0.75;
  addMesh(bay, new THREE.BoxGeometry(bayWidth, 0.35, bayDepth), metalMaterial(0x202b2e, 0.23), [0, -0.28, -bayDepth * 0.55]);
  addMesh(
    bay,
    new THREE.BoxGeometry(Math.max(0.4, bayWidth - 0.24), 0.055, Math.max(0.4, bayDepth - 0.22)),
    metalMaterial(0x0d181c, 0.3),
    [0, -0.075, -bayDepth * 0.55],
  );
  for (let column = 1; column < columns; column += 1) {
    addMesh(
      bay,
      new THREE.BoxGeometry(0.025, 0.035, bayDepth - 0.28),
      glowMaterial(column % 2 === 0 ? 0x09e0df : 0xd49a38, 0.48),
      [(column - columns / 2) * spacing + spacing / 2, -0.035, -bayDepth * 0.55],
    );
  }
  for (let row = 1; row <= rows; row += 1) {
    addMesh(
      bay,
      new THREE.BoxGeometry(bayWidth - 0.28, 0.035, 0.025),
      glowMaterial(row % 2 === 0 ? 0xd49a38 : 0x09e0df, 0.42),
      [0, -0.03, -0.25 - row * spacing],
    );
  }
  addMesh(bay, new THREE.BoxGeometry(bayWidth + 0.16, 0.13, 0.14), metalMaterial(GOLD, 0.18), [0, -0.02, -bayDepth - 0.12]);
  [-1, 1].forEach((side) => addMesh(bay, new THREE.BoxGeometry(0.12, 0.28, bayDepth), metalMaterial(GOLD, 0.18), [side * bayWidth / 2, -0.04, -bayDepth * 0.55]));

  const finishGroup = new THREE.Group();
  finishGroup.position.copy(finish.position);
  finishGroup.rotation.y = Math.atan2(finish.tangent.x, finish.tangent.z);
  scene.add(finishGroup);
  const squares = 12;
  for (let index = 0; index < squares; index += 1) {
    addMesh(finishGroup, new THREE.BoxGeometry(width / squares, 0.045, 0.34), metalMaterial(index % 2 ? 0x050708 : 0xf2f2df, 0.4), [-width / 2 + width / squares * (index + 0.5), 0.13, 0]);
  }
  [-1, 1].forEach((side) => addMesh(finishGroup, new THREE.CylinderGeometry(0.12, 0.16, 1.65, 8), metalMaterial(GOLD, 0.18), [side * width * 0.62, 0.75, 0]));
  addMesh(finishGroup, new THREE.BoxGeometry(width * 1.4, 0.18, 0.25), glowMaterial(0xf6bd35, 0.9), [0, 1.52, 0]);
  const finishLabel = createLabelSprite("META IMPERIAL", "#f6bd35", true);
  finishLabel.userData.trackLabel = true;
  finishLabel.position.set(0, 2.05, 0);
  finishGroup.add(finishLabel);
};

const addFactoryBoard = (scene: THREE.Scene, mapScale: number) => {
  const board = new THREE.Group();
  board.name = "GRP_FactoryBoard";
  board.scale.set(mapScale, 1, mapScale);
  scene.add(board);
  const structuralSteel = metalMaterial(0x11191c, 0.34);
  const panelSteel = metalMaterial(0x202a2d, 0.42);
  const copper = metalMaterial(0xb66f27, 0.2);

  const outerFloor = addMesh(
    board,
    new THREE.PlaneGeometry(44, 35),
    new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.82, metalness: 0.28 }),
    [0, -1.7, 0],
    [-Math.PI / 2, 0, 0],
  );
  outerFloor.castShadow = false;
  outerFloor.receiveShadow = true;
  addMesh(
    board,
    new THREE.BoxGeometry(BOARD_WIDTH, 0.76, BOARD_DEPTH),
    structuralSteel,
    [0, -1.28, 0],
  );

  const panelColumns = 4;
  const panelRows = 3;
  const panelWidth = BOARD_WIDTH / panelColumns - 0.18;
  const panelDepth = BOARD_DEPTH / panelRows - 0.18;
  const panels = new THREE.InstancedMesh(
    new THREE.BoxGeometry(panelWidth, 0.055, panelDepth),
    panelSteel,
    panelColumns * panelRows,
  );
  panels.name = "SM_FactoryDeckPanels";
  const matrix = new THREE.Matrix4();
  let panelIndex = 0;
  for (let row = 0; row < panelRows; row += 1) {
    for (let column = 0; column < panelColumns; column += 1) {
      matrix.makeTranslation(
        -BOARD_WIDTH / 2 + BOARD_WIDTH / panelColumns * (column + 0.5),
        -0.872,
        -BOARD_DEPTH / 2 + BOARD_DEPTH / panelRows * (row + 0.5),
      );
      panels.setMatrixAt(panelIndex, matrix);
      panelIndex += 1;
    }
  }
  panels.receiveShadow = true;
  board.add(panels);

  const amberEdge = glowMaterial(0xf2a62b, 1.25);
  const cyanEdge = glowMaterial(0x0ad7dd, 1.1);
  [-1, 1].forEach((side) => {
    const amber = addMesh(
      board,
      new THREE.BoxGeometry(BOARD_WIDTH - 0.8, 0.1, 0.12),
      amberEdge,
      [0, -0.78, side * (BOARD_DEPTH / 2 - 0.18)],
    );
    amber.castShadow = false;
    const cyan = addMesh(
      board,
      new THREE.BoxGeometry(0.12, 0.1, BOARD_DEPTH - 0.8),
      cyanEdge,
      [side * (BOARD_WIDTH / 2 - 0.18), -0.78, 0],
    );
    cyan.castShadow = false;
  });

  const rivetPositions: THREE.Vector3[] = [];
  for (let x = -BOARD_WIDTH / 2 + 0.55; x <= BOARD_WIDTH / 2 - 0.5; x += 1.05) {
    rivetPositions.push(new THREE.Vector3(x, -0.765, -BOARD_DEPTH / 2 + 0.28));
    rivetPositions.push(new THREE.Vector3(x, -0.765, BOARD_DEPTH / 2 - 0.28));
  }
  for (let z = -BOARD_DEPTH / 2 + 1.1; z <= BOARD_DEPTH / 2 - 1; z += 1.05) {
    rivetPositions.push(new THREE.Vector3(-BOARD_WIDTH / 2 + 0.28, -0.765, z));
    rivetPositions.push(new THREE.Vector3(BOARD_WIDTH / 2 - 0.28, -0.765, z));
  }
  const rivets = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.055, 0.07, 0.08, 7),
    copper,
    rivetPositions.length,
  );
  rivets.name = "SM_FactoryDeckRivets";
  rivetPositions.forEach((position, index) => {
    matrix.makeTranslation(position.x, position.y, position.z);
    rivets.setMatrixAt(index, matrix);
  });
  board.add(rivets);

  [-1, 1].forEach((side) => {
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 13.9, -0.58, -8.7),
      new THREE.Vector3(side * 13.9, -0.25, -5.1),
      new THREE.Vector3(side * 14.15, -0.25, 4.8),
      new THREE.Vector3(side * 13.55, -0.58, 8.8),
    ]);
    addMesh(board, new THREE.TubeGeometry(pipeCurve, 42, 0.12, 7, false), copper);
    [-7.3, 7.3].forEach((z) => {
      addMesh(board, new THREE.CylinderGeometry(0.48, 0.58, 1.35, 10), structuralSteel, [side * 13.25, -0.18, z]);
      addMesh(board, new THREE.TorusGeometry(0.49, 0.07, 7, 16), copper, [side * 13.25, 0.34, z], [Math.PI / 2, 0, 0]);
      addMesh(board, new THREE.CylinderGeometry(0.12, 0.18, 0.72, 8), copper, [side * 13.25, 0.8, z]);
    });
  });

  const grid = new THREE.GridHelper(BOARD_WIDTH - 0.7, 30, 0x22535b, 0x101f22);
  grid.scale.z = (BOARD_DEPTH - 0.7) / (BOARD_WIDTH - 0.7);
  grid.position.y = -0.838;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.25;
  });
  board.add(grid);
};

const addEnvironment = (scene: THREE.Scene, difficulty: MarbleTrack["difficulty"], mapScale: number) => {
  scene.background = new THREE.Color(0x02080b);
  scene.fog = new THREE.FogExp2(0x02080b, 0.0135);
  addFactoryBoard(scene, mapScale);

  scene.add(new THREE.AmbientLight(0x72a4ab, difficulty === "hard" ? 0.34 : 0.42));
  scene.add(new THREE.HemisphereLight(0x75c9d1, 0x090301, difficulty === "hard" ? 0.86 : 1));
  const key = new THREE.DirectionalLight(0xffd39a, 2.5);
  key.position.set(-8, 18, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -18 * mapScale;
  key.shadow.camera.right = 18 * mapScale;
  key.shadow.camera.top = 14 * mapScale;
  key.shadow.camera.bottom = -14 * mapScale;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6feeff, 0.9);
  fill.position.set(10, 10, -12);
  scene.add(fill);
  const cyan = new THREE.PointLight(0x00e8f0, 45, 30, 1.7);
  cyan.position.set(8, 7, -5);
  scene.add(cyan);
  const gold = new THREE.PointLight(0xffa928, 40, 28, 1.7);
  gold.position.set(-9, 6, 5);
  scene.add(gold);
};

const addAtmosphere = (
  scene: THREE.Scene,
  track: MarbleTrack,
  animatedParts: AnimatedPart[],
) => {
  const seed = hashText(track.signature);
  const positions: number[] = [];
  const colors: number[] = [];
  const cyan = new THREE.Color(0x32f3f0);
  const gold = new THREE.Color(0xf6bd35);
  const count = track.difficulty === "hard" ? 82 : track.difficulty === "medium" ? 68 : 50;
  for (let index = 0; index < count; index += 1) {
    const first = ((seed + index * 1543) % 1000) / 1000;
    const second = ((seed * 3 + index * 859) % 1000) / 1000;
    const third = ((seed * 7 + index * 433) % 1000) / 1000;
    positions.push((first - 0.5) * 29, 0.2 + third * 4.8, (second - 0.5) * 22);
    const color = index % 3 === 0 ? gold : cyan;
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.065,
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  scene.add(particles);
  animatedParts.push({
    object: particles,
    update: (object, time) => {
      object.rotation.y = Math.sin(time * 0.07) * 0.08;
      object.position.y = Math.sin(time * 0.23) * 0.08;
    },
  });
};

const staticPaletteBucket = (material: THREE.Material) => {
  if (
    !(material instanceof THREE.MeshStandardMaterial) ||
    material instanceof THREE.MeshPhysicalMaterial ||
    material.transparent ||
    material.blending !== THREE.NormalBlending ||
    material.vertexColors ||
    material.map ||
    material.normalMap ||
    material.bumpMap ||
    material.roughnessMap ||
    material.metalnessMap ||
    material.alphaMap
  ) return null;
  const emissive = material.emissive.getHex() !== 0;
  const metalness = Math.round(material.metalness * 4) / 4;
  const roughness = Math.round(material.roughness * 4) / 4;
  return {
    kind: emissive ? "emissive" as const : "metal" as const,
    key: `${emissive ? "emissive" : "palette"}:${emissive ? Math.round(material.emissiveIntensity * 4) / 4 : `${metalness}:${roughness}`}:${material.side}:${material.depthWrite ? 1 : 0}`,
    metalness,
    roughness,
  };
};

const materialBatchKey = (material: THREE.Material) => {
  const palette = staticPaletteBucket(material);
  if (palette) return palette.key;
  const value = material as THREE.MeshStandardMaterial;
  return [
    material.type,
    value.color?.getHexString() ?? "none",
    value.emissive?.getHexString() ?? "none",
    value.emissiveIntensity ?? 0,
    value.metalness ?? 0,
    value.roughness ?? 0,
    material.transparent ? 1 : 0,
    material.opacity,
    material.side,
    material.depthWrite ? 1 : 0,
    value.map?.uuid ?? "none",
    value.bumpMap?.uuid ?? "none",
  ].join(":");
};

const batchStaticMeshes = (
  scene: THREE.Scene,
  animatedParts: readonly AnimatedPart[],
  animatedMaterials: readonly THREE.Material[],
  preservedObjects: readonly THREE.Object3D[],
) => {
  scene.updateMatrixWorld(true);
  const dynamicObjects = new Set<THREE.Object3D>(preservedObjects);
  const dynamicMaterials = new Set(animatedMaterials);
  animatedParts.forEach(({ object }) => object.traverse((child) => dynamicObjects.add(child)));
  const groups = new Map<string, THREE.Mesh[]>();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    if (dynamicObjects.has(object)) return;
    const material = Array.isArray(object.material) ? null : object.material;
    if (!material || dynamicMaterials.has(material)) return;
    const attributes = Object.keys(object.geometry.attributes).sort().join(",");
    const key = `${materialBatchKey(material)}:${object.geometry.index ? "indexed" : "plain"}:${attributes}:${object.castShadow ? 1 : 0}:${object.receiveShadow ? 1 : 0}`;
    const list = groups.get(key) ?? [];
    list.push(object);
    groups.set(key, list);
  });

  const orphanMaterials = new Set<THREE.Material>();
  groups.forEach((meshes) => {
    if (meshes.length < 2) return;
    const palette = staticPaletteBucket(meshes[0].material as THREE.Material);
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (palette) {
        const sourceMaterial = mesh.material as THREE.MeshStandardMaterial;
        const vertexCount = geometry.getAttribute("position").count;
        const colors = new Float32Array(vertexCount * 3);
        for (let index = 0; index < vertexCount; index += 1) {
          colors[index * 3] = sourceMaterial.color.r;
          colors[index * 3 + 1] = sourceMaterial.color.g;
          colors[index * 3 + 2] = sourceMaterial.color.b;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      return geometry;
    });
    const mergedGeometry = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!mergedGeometry) return;
    const material = palette?.kind === "emissive"
      ? new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: (meshes[0].material as THREE.Material).side,
        depthWrite: (meshes[0].material as THREE.Material).depthWrite,
      })
      : palette
      ? new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        metalness: palette.metalness,
        roughness: palette.roughness,
        side: (meshes[0].material as THREE.Material).side,
        depthWrite: (meshes[0].material as THREE.Material).depthWrite,
      })
      : meshes[0].material as THREE.Material;
    const merged = new THREE.Mesh(mergedGeometry, material);
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = meshes[0].receiveShadow;
    scene.add(merged);
    meshes.forEach((mesh, index) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      if ((palette || index > 0) && !Array.isArray(mesh.material)) orphanMaterials.add(mesh.material);
    });
  });
  scene.userData.orphanMaterials = orphanMaterials;
};

const buildScene = (renderer: THREE.WebGLRenderer, race: PreparedMarbleRace, key: string): MarbleSceneState => {
  const scene = new THREE.Scene();
  scene.name = "SC_MarbleRace";
  try {
  const camera = new THREE.OrthographicCamera(-16, 16, 11, -11, 0.1, 90);
  camera.name = "CAM_MarbleRace";
  const followCamera = new THREE.PerspectiveCamera(64, 1, 0.12, 110);
  followCamera.name = "CAM_MarblePOV";
  addEnvironment(scene, race.track.difficulty, race.track.mapScale);
  const animatedParts: AnimatedPart[] = [];
  const glowMaterials: THREE.MeshStandardMaterial[] = [];
  const count = race.racers.length;
  const animateDecorations = count <= 96;
  addAtmosphere(scene, race.track, animatedParts);
  const samples = createTrackSamples(race.track, count);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const trackBounds = new THREE.Box3().setFromPoints(samples.map((sample) => sample.position));
  const bayColumns = Math.max(2, Math.ceil(Math.sqrt(count * 1.15)));
  const baySpacing = count > 150 ? 0.17 : count > 90 ? 0.2 : count > 48 ? 0.24 : count > 20 ? 0.3 : 0.42;
  const bayRows = Math.ceil(count / bayColumns);
  const bayWidth = Math.max(trackWidthToWorld(race.track) * 1.45, bayColumns * baySpacing + 0.65);
  const bayDepth = bayRows * baySpacing + 0.75;
  const bayStart = samples[0];
  [-1, 1].forEach((side) => {
    [0, 1].forEach((depthStep) => {
      trackBounds.expandByPoint(
        bayStart.position.clone()
          .addScaledVector(bayStart.normal, side * bayWidth * 0.55)
          .addScaledVector(bayStart.tangent, -bayDepth * (0.05 + depthStep)),
      );
    });
  });
  trackBounds.expandByScalar(1.4);
  const contentCenter = trackBounds.getCenter(new THREE.Vector3());
  const contentSize = trackBounds.getSize(new THREE.Vector3());
  const cameraDepthDirection = bayStart.position.z < contentCenter.z ? -1 : 1;
  const cameraSide = hashText(race.track.signature) % 2 === 0 ? 1 : -1;
  const overviewHeight = 19 + race.track.mapScale * 4.2 + Math.max(0, contentSize.y * 0.82);
  const overviewCameraTarget = new THREE.Vector3(contentCenter.x, Math.max(0.2, contentCenter.y * 0.42), contentCenter.z);
  const overviewCameraPosition = new THREE.Vector3(
    contentCenter.x + 11.5 * race.track.mapScale * cameraSide,
    overviewHeight,
    contentCenter.z + 16.5 * race.track.mapScale * cameraDepthDirection,
  );
  const cameraForward = overviewCameraTarget.clone().sub(overviewCameraPosition).normalize();
  const cameraRight = cameraForward.clone().cross(Y_AXIS).normalize();
  const overlayClearance = Math.min(2.35, contentSize.x * 0.085);
  overviewCameraPosition.addScaledVector(cameraRight, overlayClearance);
  overviewCameraTarget.addScaledVector(cameraRight, overlayClearance);
  const bayCameraPosition = new THREE.Vector3(
    bayStart.position.x + 5.5 * race.track.mapScale * cameraSide,
    overviewHeight - 0.5,
    bayStart.position.z + 8.5 * race.track.mapScale * cameraDepthDirection,
  ).addScaledVector(cameraRight, overlayClearance);
  const bayCameraTarget = bayStart.position.clone()
    .addScaledVector(bayStart.up, 0.35)
    .addScaledVector(cameraRight, overlayClearance);
  const stagingCameraPosition = overviewCameraPosition.clone().lerp(bayCameraPosition, 0.08);
  const stagingCameraTarget = overviewCameraTarget.clone().lerp(bayCameraTarget, 0.08);
  const cameraUp = cameraRight.clone().cross(cameraForward).normalize();
  let projectedMinX = Number.POSITIVE_INFINITY;
  let projectedMaxX = Number.NEGATIVE_INFINITY;
  let projectedMinY = Number.POSITIVE_INFINITY;
  let projectedMaxY = Number.NEGATIVE_INFINITY;
  const projectedCorner = new THREE.Vector3();
  [trackBounds.min.x, trackBounds.max.x].forEach((x) => {
    [trackBounds.min.y, trackBounds.max.y].forEach((y) => {
      [trackBounds.min.z, trackBounds.max.z].forEach((z) => {
        projectedCorner.set(x, y, z).sub(overviewCameraTarget);
        const projectedX = projectedCorner.dot(cameraRight);
        const projectedY = projectedCorner.dot(cameraUp);
        projectedMinX = Math.min(projectedMinX, projectedX);
        projectedMaxX = Math.max(projectedMaxX, projectedX);
        projectedMinY = Math.min(projectedMinY, projectedY);
        projectedMaxY = Math.max(projectedMaxY, projectedY);
      });
    });
  });
  const projectedContentWidth = projectedMaxX - projectedMinX;
  const projectedContentHeight = projectedMaxY - projectedMinY;
  camera.position.copy(stagingCameraPosition);
  camera.lookAt(stagingCameraTarget);
  addTrackBody(scene, race.track, samples, count > 96);
  race.track.zones.forEach((zone, zoneIndex) => addZoneFeature(
    scene,
    race.track,
    zone,
    animatedParts,
    glowMaterials,
    race.racers.length <= 96,
    zoneIndex,
  ));
  addSectionArchitecture(scene, race.track);
  race.track.obstacles.forEach((obstacle) => addObstacle(
    scene,
    race.track,
    obstacle.type,
    obstacle.progress,
    obstacle.scale * (race.track.difficulty === "hard" ? 0.78 : race.track.difficulty === "medium" ? 0.9 : 1),
    animatedParts,
  ));
  race.track.powerZones.forEach((zone) => addPowerZone(
    scene,
    race.track,
    zone.progress,
    zone.color,
    powerLabels[zone.power],
    zone.scale * (race.track.powerZones.length > 6 ? 0.54 : 0.84),
    animatedParts,
    glowMaterials,
    false,
  ));
  race.track.events.forEach((event) => addTrackEventFeature(scene, race.track, event, animatedParts));
  addStartFinishAndBay(scene, race);

  const sphereDetail = count > 150 ? [9, 6] : count > 100 ? [11, 7] : count > 40 ? [16, 10] : [18, 10];
  const marbleMaterial = count > 72
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.42, roughness: 0.16 })
    : new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: 0.2,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.025,
      transmission: 0.14,
      thickness: 0.42,
      ior: 1.38,
      transparent: true,
      opacity: 0.9,
    });
  const racers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, sphereDetail[0], sphereDetail[1]), marbleMaterial, count);
  racers.name = "SM_MarbleRacers";
  racers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  racers.castShadow = false;
  racers.receiveShadow = true;
  race.racers.forEach((racer, index) => racers.setColorAt(index, new THREE.Color(racer.accent)));
  if (racers.instanceColor) racers.instanceColor.needsUpdate = true;
  scene.add(racers);

  const racerCores = count <= 72
    ? new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, count > 40 ? 8 : 10, count > 40 ? 5 : 7),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      count,
    )
    : null;
  if (racerCores) {
    racerCores.name = "FX_MarbleLuminousCores";
    racerCores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    race.racers.forEach((racer, index) => racerCores.setColorAt(index, new THREE.Color(racer.accent)));
    if (racerCores.instanceColor) racerCores.instanceColor.needsUpdate = true;
    racerCores.renderOrder = 6;
    racerCores.frustumCulled = false;
    scene.add(racerCores);
  }

  const racerShadows = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 18),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: count > 100 ? 0.2 : 0.3,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    count,
  );
  racerShadows.name = "FX_MarbleBlobShadows";
  racerShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  racerShadows.frustumCulled = false;
  racerShadows.renderOrder = 3;
  scene.add(racerShadows);

  const racerRings = new THREE.InstancedMesh(
    new THREE.TorusGeometry(1, 0.09, 5, 18),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: count > 100 ? 0.5 : 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    count,
  );
  racerRings.name = "FX_MarbleFloorRings";
  racerRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  race.racers.forEach((racer, index) => racerRings.setColorAt(index, new THREE.Color(racer.accent)));
  if (racerRings.instanceColor) racerRings.instanceColor.needsUpdate = true;
  racerRings.frustumCulled = false;
  racerRings.renderOrder = 4;
  scene.add(racerRings);

  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  glowGeometry.setAttribute("color", new THREE.Float32BufferAttribute(
    race.racers.flatMap((racer) => {
      const color = new THREE.Color(racer.accent);
      return [color.r, color.g, color.b];
    }),
    3,
  ));
  const racerGlow = new THREE.Points(glowGeometry, new THREE.PointsMaterial({
    size: count > 150 ? 0.28 : count > 90 ? 0.31 : count > 48 ? 0.36 : 0.43,
    map: createMarbleGlowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: count > 100 ? 0.82 : 0.64,
    depthWrite: false,
    alphaTest: 0.015,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  }));
  racerGlow.renderOrder = 5;
  scene.add(racerGlow);

  const racerLabels = count <= 18
    ? race.racers.map((racer) => {
      const label = createLabelSprite(`${racer.previousWinner ? "♛  " : ""}${racer.number}  ${racer.participant.name}`, racer.accent, true);
      label.scale.multiplyScalar(0.88);
      scene.add(label);
      return label;
    })
    : [];
  const trackLabels: THREE.Sprite[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Sprite && object.userData.trackLabel === true) trackLabels.push(object);
  });

  const winnerLabel = count > 18
    ? createLabelSprite(`♛  ${race.selected.number}  ${race.selected.participant.name}`, race.selected.accent, false)
    : null;
  if (winnerLabel) {
    winnerLabel.visible = false;
    winnerLabel.scale.multiplyScalar(0.76);
    scene.add(winnerLabel);
  }

  const winnerCrowns = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.19, 0.27, 0.25, 5, 1, true),
    glowMaterial(0xffc52f, 1.7),
    count,
  );
  winnerCrowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  winnerCrowns.frustumCulled = false;
  scene.add(winnerCrowns);

  const selectedRing = addMesh(scene, new THREE.TorusGeometry(0.36, 0.055, 7, 28), glowMaterial(0xffec9b, 2), [0, -20, 0], [Math.PI / 2, 0, 0]);
  selectedRing.visible = false;
  const followBeacon = addMesh(
    scene,
    new THREE.RingGeometry(0.34, 0.47, 32),
    new THREE.MeshBasicMaterial({ color: 0x5ffff7, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide }),
    [0, -20, 0],
  );
  followBeacon.visible = false;
  followBeacon.renderOrder = 24;
  animatedParts.forEach(({ object }) => object.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = false;
  }));
  const activeAnimatedParts = animateDecorations ? animatedParts : [];
  const activeGlowMaterials = animateDecorations ? glowMaterials : [];
  batchStaticMeshes(scene, activeAnimatedParts, activeGlowMaterials, [
    racers,
    ...(racerCores ? [racerCores] : []),
    racerRings,
    racerShadows,
    winnerCrowns,
    selectedRing,
    followBeacon,
  ]);
  renderer.shadowMap.enabled = count <= 48;
  renderer.shadowMap.autoUpdate = count <= 48;
  return {
    key,
    raceIdentity: race,
    renderer,
    scene,
    camera,
    followCamera,
    racers,
    racerCores,
    racerRings,
    racerShadows,
    racerGlow,
    racerLabels,
    trackLabels,
    winnerLabel,
    winnerCrowns,
    selectedRing,
    followBeacon,
    trackSamples: samples,
    startPoint: samples[0],
    motionPoint: createEmptyWorldPoint(),
    lookAheadPoint: createEmptyWorldPoint(),
    cameraAnchorPoint: createEmptyWorldPoint(),
    matrix: new THREE.Matrix4(),
    quaternion: new THREE.Quaternion(),
    scaleVector: new THREE.Vector3(),
    positionVector: new THREE.Vector3(),
    stagingVector: new THREE.Vector3(),
    labelVector: new THREE.Vector3(),
    contentCenter,
    overviewCameraPosition,
    overviewCameraTarget,
    stagingCameraPosition,
    stagingCameraTarget,
    cameraTarget: new THREE.Vector3(),
    followCameraTarget: new THREE.Vector3(),
    followCameraUp: new THREE.Vector3(0, 1, 0),
    followCameraForward: new THREE.Vector3(0, 0, 1),
    racerPositions: race.racers.map(() => new THREE.Vector3()),
    activeFollowRacerId: null,
    readyZoom: 1.16,
    contentWidth: contentSize.x,
    contentDepth: contentSize.z,
    projectedContentWidth,
    projectedContentHeight,
    animatedParts: activeAnimatedParts,
    glowMaterials: activeGlowMaterials,
    participantCount: count,
    reducedMotion,
    shadowReady: false,
    resolutionScale: 1,
    lastRenderAt: 0,
    averageFrameMs: 16.7,
    slowFrames: 0,
    fastFrames: 0,
    lastEffectsAt: Number.NEGATIVE_INFINITY,
    lastMetricsAt: Number.NEGATIVE_INFINITY,
    width: 0,
    height: 0,
  };
  } catch (error) {
    try {
      disposeScene(scene);
    } catch {
      // El error original de construcción debe llegar al componente para activar fallback.
    }
    throw error;
  }
};

const disposeScene = (scene: THREE.Scene) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite || object instanceof THREE.Points) {
      if ("geometry" in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
      const material = object.material;
      const objectMaterials = Array.isArray(material) ? material : [material];
      objectMaterials.forEach((entry) => {
        if (entry) materials.add(entry);
      });
    }
  });
  const orphanMaterials = scene.userData.orphanMaterials as Set<THREE.Material> | undefined;
  orphanMaterials?.forEach((material) => materials.add(material));
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value);
    });
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
};

const releaseSceneState = (canvas: HTMLCanvasElement, state: MarbleSceneState) => {
  if (sceneStates.get(canvas) === state) sceneStates.delete(canvas);
  try {
    disposeScene(state.scene);
  } catch {
    // El contexto también debe liberarse si un recurso de terceros falla al desecharse.
  }
  try {
    state.renderer.dispose();
  } catch {
    // La API pública de dispose es deliberadamente idempotente y segura tras fallo parcial.
  }
};

const createRenderer = (canvas: HTMLCanvasElement, participantCount: number) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: participantCount <= 96, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
};

const sceneKey = (race: PreparedMarbleRace) => `${race.track.signature}:${race.racers.map((racer) => `${racer.id}-${racer.participant.name}-${racer.previousWinner ? "c" : "n"}`).join("|")}`;

const ensureState = (canvas: HTMLCanvasElement, race: PreparedMarbleRace) => {
  const current = sceneStates.get(canvas);
  if (current?.raceIdentity === race) return current;
  const key = sceneKey(race);
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    renderer = current?.renderer ?? createRenderer(canvas, race.racers.length);
    if (current) {
      sceneStates.delete(canvas);
      disposeScene(current.scene);
    }
    const next = buildScene(renderer, race, key);
    canvas.dataset.renderQuality = "high";
    sceneStates.set(canvas, next);
    return next;
  } catch (error) {
    sceneStates.delete(canvas);
    try {
      renderer?.dispose();
    } catch {
      // El error original de construcción conserva prioridad para activar el fallback.
    }
    throw error;
  }
};

const resizeRenderer = (state: MarbleSceneState, canvas: HTMLCanvasElement) => {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  if (state.width === width && state.height === height) return;
  state.width = width;
  state.height = height;
  const pixelRatioLimit = state.participantCount > 150 ? 0.95 : state.participantCount > 96 ? 1.1 : state.participantCount > 48 ? 1.3 : 1.55;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit) * state.resolutionScale);
  state.renderer.setSize(width, height, false);
  const aspect = width / height;
  const paddedWidth = state.projectedContentWidth * 0.96;
  const paddedHeight = state.projectedContentHeight;
  const viewHeight = THREE.MathUtils.clamp(Math.max(paddedHeight, paddedWidth / aspect), 12, 46);
  state.camera.left = -(viewHeight * aspect) / 2;
  state.camera.right = (viewHeight * aspect) / 2;
  state.camera.top = viewHeight / 2;
  state.camera.bottom = -viewHeight / 2;
  state.camera.updateProjectionMatrix();
  state.followCamera.aspect = aspect;
  state.followCamera.updateProjectionMatrix();
};

const updateRacers = (
  state: MarbleSceneState,
  race: PreparedMarbleRace,
  elapsedMs: number,
  phase: MarbleRaceVisualPhase,
) => {
  const count = race.racers.length;
  const baseRadius = count > 150 ? 0.085 : count > 90 ? 0.105 : count > 48 ? 0.13 : count > 22 ? 0.16 : 0.22;
  const columns = Math.max(2, Math.ceil(Math.sqrt(count * 1.15)));
  const spacing = count > 150 ? 0.17 : count > 90 ? 0.2 : count > 48 ? 0.24 : count > 20 ? 0.3 : 0.42;
  const start = state.startPoint;
  const matrix = state.matrix;
  const quaternion = state.quaternion;
  const scale = state.scaleVector;
  const introMs = state.reducedMotion ? 0 : 1400;
  const raceElapsed = phase === "ready" ? 0 : Math.max(0, elapsedMs - introMs);
  const launchBlend = phase === "ready" ? 0 : Math.min(1, raceElapsed / 900);
  const smoothLaunch = launchBlend * launchBlend * (3 - 2 * launchBlend);
  const selectedIndex = race.racers.findIndex((racer) => racer.id === race.selected.id);
  const glowPositions = state.racerGlow.geometry.getAttribute("position") as THREE.BufferAttribute;

  race.racers.forEach((racer, index) => {
    const marbleState = getMarbleMotion(racer, race.track, raceElapsed);
    const trackPoint = sampleWorldPoint(state.trackSamples, marbleState.progress, state.motionPoint);
    const laneOffset = racer.lane * trackWidthToWorld(race.track) * 0.29 + marbleState.lateralImpulse * 0.22;
    const row = Math.floor(index / columns);
    const column = index % columns;
    const radius = baseRadius * marbleState.radiusScale;
    const racingPosition = state.positionVector.copy(trackPoint.position)
      .addScaledVector(trackPoint.normal, laneOffset)
      .addScaledVector(trackPoint.up, radius + 0.17 + marbleState.verticalOffset - marbleState.recoveryDrop);
    const stagingPosition = state.stagingVector.copy(start.position)
      .addScaledVector(start.normal, (column - (columns - 1) / 2) * spacing)
      .addScaledVector(start.tangent, -(row + 0.75) * spacing)
      .addScaledVector(start.up, radius + 0.17)
      .lerp(racingPosition, smoothLaunch);
    state.racerPositions[index].copy(stagingPosition);
    quaternion.setFromAxisAngle(trackPoint.normal, state.reducedMotion ? 0 : marbleState.spinAngle);
    scale.setScalar(radius);
    matrix.compose(stagingPosition, quaternion, scale);
    state.racers.setMatrixAt(index, matrix);
    if (state.racerCores) {
      matrix.compose(stagingPosition, quaternion, scale.setScalar(radius * 0.42));
      state.racerCores.setMatrixAt(index, matrix);
    }
    const shadowScale = radius * 1.38 * THREE.MathUtils.clamp(1 - marbleState.verticalOffset * 1.8, 0.42, 1);
    quaternion.setFromUnitVectors(Z_AXIS, trackPoint.up);
    const contactPosition = state.labelVector.copy(stagingPosition).addScaledVector(
      trackPoint.up,
      -(radius + 0.158 + marbleState.verticalOffset * smoothLaunch),
    );
    matrix.compose(
      contactPosition,
      quaternion,
      scale.set(shadowScale, shadowScale, 1),
    );
    state.racerShadows.setMatrixAt(index, matrix);
    matrix.compose(
      contactPosition.addScaledVector(trackPoint.up, 0.012),
      quaternion,
      scale.setScalar(radius * (count > 100 ? 1.42 : 1.62)),
    );
    state.racerRings.setMatrixAt(index, matrix);
    glowPositions.setXYZ(index, stagingPosition.x, stagingPosition.y, stagingPosition.z);
    if (state.racerLabels[index]) {
      state.racerLabels[index].position.copy(
        state.labelVector.copy(stagingPosition).addScaledVector(trackPoint.up, radius + 0.42),
      );
      state.racerLabels[index].visible = phase !== "finished" || index === selectedIndex;
    }
    if (racer.previousWinner) {
      quaternion.setFromUnitVectors(Y_AXIS, trackPoint.up);
      matrix.compose(
        state.labelVector.copy(stagingPosition).addScaledVector(trackPoint.up, radius + 0.38),
        quaternion,
        scale.setScalar(Math.max(0.52, radius * 2.6)),
      );
      state.winnerCrowns.setMatrixAt(index, matrix);
    } else {
      matrix.compose(state.labelVector.set(0, -30, 0), quaternion.identity(), scale.setScalar(0.001));
      state.winnerCrowns.setMatrixAt(index, matrix);
    }
    if (phase === "finished" && index === selectedIndex) {
      state.selectedRing.visible = true;
      state.selectedRing.position.copy(stagingPosition).addScaledVector(trackPoint.up, -(radius + 0.11));
      state.selectedRing.quaternion.setFromUnitVectors(Z_AXIS, trackPoint.up);
      state.selectedRing.scale.setScalar(state.reducedMotion ? 1.08 : 1 + Math.sin(elapsedMs / 180) * 0.12);
      if (state.winnerLabel) {
        state.winnerLabel.visible = true;
        state.winnerLabel.position.copy(stagingPosition).addScaledVector(trackPoint.up, radius + 0.72);
      }
    }
  });
  if (phase !== "finished") {
    state.selectedRing.visible = false;
    if (state.winnerLabel) state.winnerLabel.visible = false;
  }
  state.racers.instanceMatrix.needsUpdate = true;
  if (state.racerCores) state.racerCores.instanceMatrix.needsUpdate = true;
  state.racerRings.instanceMatrix.needsUpdate = true;
  state.racerShadows.instanceMatrix.needsUpdate = true;
  state.winnerCrowns.instanceMatrix.needsUpdate = true;
  glowPositions.needsUpdate = true;
};

export const drawMarbleRace3D = (
  canvas: HTMLCanvasElement,
  race: PreparedMarbleRace,
  elapsedMs: number,
  phase: MarbleRaceVisualPhase,
  followRacerId: string | null = null,
  followCameraStyle: MarbleFollowCameraStyle = "chase",
) => {
  let state: MarbleSceneState | undefined;
  try {
    state = ensureState(canvas, race);
    const renderAt = performance.now();
    if (phase === "racing" && state.lastRenderAt > 0) {
      const frameInterval = renderAt - state.lastRenderAt;
      state.averageFrameMs = state.averageFrameMs * 0.9 + Math.min(50, frameInterval) * 0.1;
      if (state.averageFrameMs > 19 || frameInterval > 24) {
        state.slowFrames = Math.min(24, state.slowFrames + 2);
        state.fastFrames = 0;
      } else {
        state.slowFrames = Math.max(0, state.slowFrames - 1);
        state.fastFrames = frameInterval < 18.5 ? Math.min(300, state.fastFrames + 1) : 0;
      }
      if (state.slowFrames >= 12 && state.resolutionScale > 0.68) {
        state.resolutionScale = state.resolutionScale > 0.9 ? 0.82 : 0.68;
        state.width = 0;
        canvas.dataset.renderQuality = state.resolutionScale < 0.75 ? "performance" : "balanced";
        state.slowFrames = 0;
        state.fastFrames = 0;
      } else if (state.fastFrames >= 240 && state.resolutionScale < 1) {
        state.resolutionScale = state.resolutionScale < 0.8 ? 0.82 : 1;
        state.width = 0;
        canvas.dataset.renderQuality = state.resolutionScale === 1 ? "high" : "balanced";
        state.slowFrames = 0;
        state.fastFrames = 0;
      }
    }
    state.lastRenderAt = renderAt;
    resizeRenderer(state, canvas);
    const elapsedSeconds = elapsedMs / 1000;
    const reducedMotion = state.reducedMotion;
    const effectsIntervalMs = state.participantCount > 120 ? 33 : state.participantCount > 72 ? 22 : 0;
    if (elapsedMs < state.lastEffectsAt || effectsIntervalMs === 0 || elapsedMs - state.lastEffectsAt >= effectsIntervalMs) {
      if (!reducedMotion) state.animatedParts.forEach(({ object, update }) => update(object, elapsedSeconds));
      state.glowMaterials.forEach((material, index) => {
        material.emissiveIntensity = reducedMotion ? 1.12 : 1.05 + Math.sin(elapsedSeconds * 2.25 + index * 0.7) * 0.3;
      });
      state.lastEffectsAt = elapsedMs;
    }
    updateRacers(state, race, elapsedMs, phase);
    const introMs = state.reducedMotion ? 0 : 1400;
    const followIndex = followRacerId
      ? race.racers.findIndex((racer) => racer.id === followRacerId)
      : -1;
    const followActive = phase === "racing" && elapsedMs >= introMs && followIndex >= 0;
    let renderCamera: THREE.Camera = state.camera;
    if (followActive) {
      const followedRacer = race.racers[followIndex];
      const raceElapsed = Math.max(0, elapsedMs - introMs);
      const motion = getMarbleMotion(followedRacer, race.track, raceElapsed);
      const trackPoint = sampleWorldPoint(state.trackSamples, motion.progress, state.motionPoint);
      const cameraContextScale = race.track.difficulty === "hard" ? 1.65 : race.track.difficulty === "medium" ? 0.7 : 0;
      const lookAheadProgress = THREE.MathUtils.clamp(
        motion.progress + 0.032 + cameraContextScale * 0.012 + THREE.MathUtils.clamp(motion.velocity * 0.18, 0, 0.07),
        0,
        1,
      );
      const lookAheadPoint = sampleWorldPoint(state.trackSamples, lookAheadProgress, state.lookAheadPoint);
      const baseRadius = race.racers.length > 150 ? 0.085 : race.racers.length > 90 ? 0.105 : race.racers.length > 48 ? 0.13 : race.racers.length > 22 ? 0.16 : 0.22;
      const followedRadius = baseRadius * motion.radiusScale;
      const speedBlend = THREE.MathUtils.clamp(motion.velocity * 8, 0, 1);
      const cameraPathLag = 0.027 + cameraContextScale * 0.006 + speedBlend * 0.01;
      const cameraAnchorProgress = Math.max(0, motion.progress - cameraPathLag);
      const cameraAnchorPoint = sampleWorldPoint(state.trackSamples, cameraAnchorProgress, state.cameraAnchorPoint);
      const launchRetreat = followCameraStyle === "chase"
        ? THREE.MathUtils.clamp((cameraPathLag - motion.progress) / cameraPathLag, 0, 1) * (6.4 + cameraContextScale * 0.8)
        : 0;
      const cameraSide = hashText(followedRacer.id) % 2 === 0 ? 1 : -1;
      state.followCameraForward.copy(trackPoint.tangent).lerp(lookAheadPoint.tangent, 0.62).normalize();
      if (followCameraStyle !== "onboard") {
        state.followCameraForward.y = 0;
        if (state.followCameraForward.lengthSq() < 0.01) state.followCameraForward.copy(Z_AXIS);
        state.followCameraForward.normalize();
      }
      const rescueBlend = motion.recovering ? Math.sin(motion.recoveryPhase * Math.PI) : 0;
      const cameraDistance = followCameraStyle === "onboard"
        ? 3.45 + speedBlend * 0.62 + rescueBlend * 2.2
        : followCameraStyle === "trackside"
          ? 2.4 + speedBlend * 0.8 + rescueBlend * 1.25
        : followCameraStyle === "aerial"
          ? 8.6 + speedBlend * 1.6 + rescueBlend * 1.1
          : 0;
      const cameraHeight = followCameraStyle === "onboard"
        ? 2.25 + followedRadius * 1.2 + speedBlend * 0.28 + rescueBlend * 2.15
        : followCameraStyle === "trackside"
          ? 3.9 + followedRadius + speedBlend * 0.42 + rescueBlend * 1.65
        : followCameraStyle === "aerial"
          ? 7.4 + speedBlend * 1.05 + rescueBlend * 1.35
          : 3.75 + cameraContextScale * 0.28 + followedRadius * 1.1 + speedBlend * 0.48 + rescueBlend * 1.5;
      const cameraShoulder = followCameraStyle === "onboard"
        ? 0
        : cameraSide * (
          followCameraStyle === "trackside"
            ? 5.8 + speedBlend * 0.9 + rescueBlend * 0.42
            : followCameraStyle === "aerial" ? 1.8 : 2.35 + speedBlend * 0.34 + rescueBlend * 0.18
        );
      const desiredPosition = state.positionVector.copy(
        followCameraStyle === "chase" ? cameraAnchorPoint.position : state.racerPositions[followIndex],
      )
        .addScaledVector(followCameraStyle === "chase" ? cameraAnchorPoint.up : trackPoint.up, cameraHeight)
        .addScaledVector(state.followCameraForward, -cameraDistance)
        .addScaledVector(cameraAnchorPoint.tangent, -launchRetreat)
        .addScaledVector(followCameraStyle === "chase" ? cameraAnchorPoint.normal : trackPoint.normal, cameraShoulder);
      const turboTurbulence = followedRacer.power === "boost" && motion.powerActive ? 0.16 : 0;
      const eventTurbulence = motion.activeTrackEvent === "quake"
        ? motion.trackEventIntensity * 0.2
        : motion.activeTrackEvent === "tornado"
          ? motion.trackEventIntensity * 0.13
          : 0;
      if (!state.reducedMotion && turboTurbulence + eventTurbulence > 0) {
        const turbulence = turboTurbulence + eventTurbulence;
        desiredPosition
          .addScaledVector(trackPoint.normal, Math.sin(elapsedSeconds * 17 + followedRacer.number) * turbulence)
          .addScaledVector(trackPoint.up, Math.cos(elapsedSeconds * 21 + followedRacer.number) * turbulence * 0.55);
      }
      const minimumCameraHeight = followCameraStyle === "chase"
        ? Math.max(2.15, cameraAnchorPoint.position.y + 2.75)
        : Math.max(
          state.racerPositions[followIndex].y + (followCameraStyle === "onboard" ? 2.05 : 4.45),
          (followCameraStyle === "onboard" ? 2.7 : 4.8) + rescueBlend * 0.8,
        );
      desiredPosition.y = Math.max(desiredPosition.y, minimumCameraHeight);
      let underpassActive = false;
      if (followCameraStyle === "chase" || followCameraStyle === "trackside") {
        const overheadTrackY = findOverheadTrackY(
          state.trackSamples,
          cameraAnchorProgress,
          cameraAnchorPoint.position.y,
          desiredPosition.x,
          desiredPosition.z,
          followCameraStyle === "trackside" ? 4.1 : 3.6,
        );
        if (Number.isFinite(overheadTrackY)) {
          const minimumCameraY = Math.max(1.85, cameraAnchorPoint.position.y + 1.08);
          const underDeckY = overheadTrackY - 1.12;
          if (underDeckY >= minimumCameraY) {
            const nextCameraY = Math.min(desiredPosition.y, underDeckY);
            underpassActive = nextCameraY < desiredPosition.y - 0.08;
            desiredPosition.y = nextCameraY;
          }
        }
      }
      canvas.dataset.cameraOcclusionGuard = underpassActive ? "underpass" : "clear";
      const desiredTarget = state.stagingVector.copy(state.racerPositions[followIndex])
        .lerp(
          lookAheadPoint.position,
          motion.recovering ? 0.18 : followCameraStyle === "onboard" ? 0.76 : followCameraStyle === "trackside" ? 0.56 : followCameraStyle === "aerial" ? 0.34 : 0.72,
        )
        .addScaledVector(trackPoint.up, followedRadius * 0.45 + (followCameraStyle === "onboard" ? 0.58 : 0.24) + rescueBlend * 0.32);
      state.followCameraUp.copy(Y_AXIS).lerp(
        trackPoint.up,
        motion.recovering ? 0.08 : followCameraStyle === "onboard" ? 0.42 : 0.18,
      ).normalize();
      const followIdentity = `${followRacerId}:${followCameraStyle}`;
      if (state.activeFollowRacerId !== followIdentity) {
        state.followCamera.position.copy(desiredPosition);
        state.followCameraTarget.copy(desiredTarget);
        state.followCamera.up.copy(state.followCameraUp);
        state.racerLabels.forEach((label) => { label.visible = false; });
      } else {
        const cameraResponse = state.reducedMotion
          ? 1
          : 1 - Math.exp(-THREE.MathUtils.clamp(state.averageFrameMs, 8, 34) / (motion.recovering ? 95 : 145));
        state.followCamera.position.lerp(desiredPosition, cameraResponse);
        state.followCameraTarget.lerp(desiredTarget, Math.min(1, cameraResponse * 1.28));
        state.followCamera.up.lerp(state.followCameraUp, cameraResponse * 0.7).normalize();
      }
      if (followCameraStyle === "chase" || followCameraStyle === "trackside") {
        const cameraCeilingY = findOverheadTrackY(
          state.trackSamples,
          cameraAnchorProgress,
          cameraAnchorPoint.position.y,
          state.followCamera.position.x,
          state.followCamera.position.z,
          1.9,
        );
        const forcedUnderDeckY = cameraCeilingY - 1.05;
        if (
          Number.isFinite(cameraCeilingY)
          && forcedUnderDeckY > state.followCameraTarget.y + 0.52
          && state.followCamera.position.y > forcedUnderDeckY
        ) {
          state.followCamera.position.y = forcedUnderDeckY;
          canvas.dataset.cameraOcclusionGuard = "underpass";
        }
      }
      const desiredFov = followCameraStyle === "onboard"
        ? 68 + speedBlend * 4 + rescueBlend * 2
        : followCameraStyle === "trackside"
          ? 57 + speedBlend * 3 + rescueBlend * 2
        : followCameraStyle === "aerial"
          ? 52 + speedBlend * 2 + rescueBlend * 2
          : 64 + speedBlend * 4.5 + rescueBlend * 2;
      if (Math.abs(state.followCamera.fov - desiredFov) > 0.05) {
        state.followCamera.fov = desiredFov;
        state.followCamera.updateProjectionMatrix();
      }
      state.followCamera.lookAt(state.followCameraTarget);
      state.followBeacon.quaternion.copy(state.followCamera.quaternion);
      state.racerRings.visible = false;
      state.racerShadows.visible = false;
      state.racerGlow.visible = false;
      if (followCameraStyle === "onboard") {
        state.racerLabels.forEach((label) => { label.visible = false; });
      }
      state.selectedRing.visible = followCameraStyle !== "onboard";
      state.selectedRing.position.copy(state.racerPositions[followIndex]).addScaledVector(trackPoint.up, -(followedRadius + 0.1));
      state.selectedRing.quaternion.setFromUnitVectors(Z_AXIS, trackPoint.up);
      state.selectedRing.scale.setScalar(0.82 + speedBlend * 0.12);
      state.followBeacon.visible = followCameraStyle !== "onboard";
      state.followBeacon.position.copy(state.racerPositions[followIndex]);
      state.followBeacon.position.y += followedRadius * 0.12;
      state.followBeacon.scale.setScalar(Math.max(0.7, followedRadius * 3.1));
      const beaconMaterial = state.followBeacon.material as THREE.MeshBasicMaterial;
      beaconMaterial.color.setHex(motion.recovering ? 0xff7a3d : 0x5ffff7);
      beaconMaterial.opacity = state.reducedMotion ? 0.72 : 0.6 + Math.sin(elapsedSeconds * 4.2) * 0.12;
      state.activeFollowRacerId = followIdentity;
      renderCamera = state.followCamera;
      const cameraStyleLabel = followCameraStyle === "onboard"
        ? "onboard-marble"
        : followCameraStyle === "trackside"
          ? "trackside-rail"
          : followCameraStyle === "aerial" ? "aerial-follow" : "cinematic-chase";
      if (canvas.dataset.cameraStyle !== cameraStyleLabel) canvas.dataset.cameraStyle = cameraStyleLabel;
      canvas.dataset.cameraRecovery = motion.recovering ? "active" : "none";
      canvas.dataset.trackEvent = motion.activeTrackEvent ?? "none";
      const cameraMode = `marble-${followedRacer.participant.id}-${followCameraStyle}`;
      if (canvas.dataset.cameraMode !== cameraMode) canvas.dataset.cameraMode = cameraMode;
    } else {
      const cameraBlendRaw = phase === "ready" ? 0 : state.reducedMotion || phase === "finished" ? 1 : Math.min(1, elapsedMs / 1400);
      const cameraBlend = cameraBlendRaw * cameraBlendRaw * (3 - 2 * cameraBlendRaw);
      state.camera.position.lerpVectors(state.stagingCameraPosition, state.overviewCameraPosition, cameraBlend);
      state.cameraTarget.lerpVectors(state.stagingCameraTarget, state.overviewCameraTarget, cameraBlend);
      state.camera.zoom = THREE.MathUtils.lerp(state.readyZoom, 1, cameraBlend);
      state.camera.lookAt(state.cameraTarget);
      state.camera.updateProjectionMatrix();
      state.racerRings.visible = true;
      state.racerShadows.visible = true;
      state.racerGlow.visible = true;
      state.followBeacon.visible = false;
      if (phase !== "finished") state.selectedRing.visible = false;
      state.activeFollowRacerId = null;
      if (canvas.dataset.cameraStyle !== "overview") canvas.dataset.cameraStyle = "overview";
      if (canvas.dataset.cameraMode !== "overview") canvas.dataset.cameraMode = "overview";
      canvas.dataset.cameraRecovery = "none";
      canvas.dataset.cameraOcclusionGuard = "clear";
      canvas.dataset.trackEvent = "none";
    }
    if (state.renderer.shadowMap.enabled && !state.shadowReady) state.renderer.shadowMap.needsUpdate = true;
    const showTrackLabels = renderCamera === state.camera;
    state.trackLabels.forEach((label) => { label.visible = showTrackLabels; });
    state.renderer.render(state.scene, renderCamera);
    if (renderAt < state.lastMetricsAt || renderAt - state.lastMetricsAt >= 500 || phase !== "racing") {
      canvas.dataset.renderCalls = String(state.renderer.info.render.calls);
      canvas.dataset.renderTriangles = String(state.renderer.info.render.triangles);
      state.lastMetricsAt = renderAt;
    }
    if (state.renderer.shadowMap.enabled && !state.shadowReady) {
      state.renderer.shadowMap.autoUpdate = false;
      state.shadowReady = true;
    }
  } catch (error) {
    if (state) releaseSceneState(canvas, state);
    throw error;
  }
};

export const disposeMarbleRace3D = (canvas: HTMLCanvasElement) => {
  const state = sceneStates.get(canvas);
  if (!state) return;
  releaseSceneState(canvas, state);
};
