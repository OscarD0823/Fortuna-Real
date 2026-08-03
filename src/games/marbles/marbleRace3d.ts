import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  getMarbleProgress,
  getTrackPosition,
  powerLabels,
  type MarbleTrack,
  type PreparedMarbleRace,
  type TrackObstacleType,
  type TrackZone,
} from "./marbleRaceEngine";

export type MarbleRaceVisualPhase = "ready" | "racing" | "finished";

interface TrackWorldPoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
}

interface AnimatedPart {
  object: THREE.Object3D;
  update: (object: THREE.Object3D, elapsedSeconds: number) => void;
}

interface MarbleSceneState {
  key: string;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  racers: THREE.InstancedMesh;
  racerLabels: THREE.Sprite[];
  selectedRing: THREE.Mesh;
  animatedParts: AnimatedPart[];
  glowMaterials: THREE.MeshStandardMaterial[];
  participantCount: number;
  shadowReady: boolean;
  width: number;
  height: number;
}

const sceneStates = new WeakMap<HTMLCanvasElement, MarbleSceneState>();
const WORLD_WIDTH = 26;
const WORLD_DEPTH = 19;
const GOLD = 0xd49a38;
const FLOOR = 0x02070a;

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const trackWidthToWorld = (track: MarbleTrack) => track.trackWidth / 35.5;

const trackElevation = (track: MarbleTrack, progress: number) => {
  const phase = (hashText(track.signature) % 628) / 100;
  const strength = track.difficulty === "easy" ? 0.12 : track.difficulty === "medium" ? 0.2 : 0.28;
  return 0.58
    + Math.sin(progress * Math.PI * 5 + phase) * strength
    + Math.sin(progress * Math.PI * 2 - phase * 0.4) * 0.08;
};

const worldPointAt = (track: MarbleTrack, progress: number): TrackWorldPoint => {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  const before = getTrackPosition(track.points, Math.max(0, clamped - 0.002));
  const after = getTrackPosition(track.points, Math.min(1, clamped + 0.002));
  const source = getTrackPosition(track.points, clamped);
  const position = new THREE.Vector3(
    (source.x - 0.5) * WORLD_WIDTH,
    trackElevation(track, clamped),
    (source.y - 0.5) * WORLD_DEPTH,
  );
  const tangent = new THREE.Vector3(
    (after.x - before.x) * WORLD_WIDTH,
    trackElevation(track, Math.min(1, clamped + 0.002)) - trackElevation(track, Math.max(0, clamped - 0.002)),
    (after.y - before.y) * WORLD_DEPTH,
  ).normalize();
  const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
  const normal = new THREE.Vector3(-flatTangent.z, 0, flatTangent.x);
  return { position, tangent: flatTangent, normal };
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
  mesh.castShadow = true;
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

const createLabelSprite = (text: string, color: string, compact = false) => {
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.renderOrder = 20;
  sprite.scale.set(compact ? 2.35 : 3.15, compact ? 0.59 : 0.78, 1);
  return sprite;
};

const createTrackSamples = (track: MarbleTrack) => {
  const count = Math.max(180, track.sections.length * 7);
  return Array.from({ length: count }, (_, index) => worldPointAt(track, index / (count - 1)));
};

const createBrushedMetalTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = "#657075";
  context.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = 72 + ((y * 37) % 42);
    context.strokeStyle = `rgba(${shade},${shade + 7},${shade + 9},${0.12 + (y % 7) * 0.012})`;
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
    const left = sample.position.clone().addScaledVector(sample.normal, width / 2);
    const right = sample.position.clone().addScaledVector(sample.normal, -width / 2);
    left.y += topOffset;
    right.y += topOffset;
    positions.push(
      left.x, left.y, left.z,
      right.x, right.y, right.z,
      left.x, left.y - depth, left.z,
      right.x, right.y - depth, right.z,
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

const addTrackBody = (scene: THREE.Scene, track: MarbleTrack, samples: readonly TrackWorldPoint[]) => {
  const trackGroup = new THREE.Group();
  const width = trackWidthToWorld(track);
  scene.add(trackGroup);

  const deckTexture = createBrushedMetalTexture();
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x778184,
    map: deckTexture,
    bumpMap: deckTexture,
    bumpScale: 0.045,
    metalness: 0.9,
    roughness: 0.24,
  });
  const deck = addMesh(trackGroup, createRibbonGeometry(samples, width + 0.58, 0, 0.64), deckMaterial);
  deck.receiveShadow = true;
  addMesh(trackGroup, createRibbonGeometry(samples, width, 0.07, 0.1), metalMaterial(0x192b30, 0.28));

  const centerCurve = new THREE.CatmullRomCurve3(samples.map((sample) => sample.position.clone().add(new THREE.Vector3(0, 0.105, 0))));
  addMesh(trackGroup, new THREE.TubeGeometry(centerCurve, samples.length, 0.026, 5, false), glowMaterial(0x00cfd5, 0.85));

  [-1, 1].forEach((side) => {
    const railPoints = samples.map((sample) => sample.position.clone()
      .addScaledVector(sample.normal, side * (width / 2 + 0.18))
      .add(new THREE.Vector3(0, 0.25, 0)));
    const railCurve = new THREE.CatmullRomCurve3(railPoints);
    addMesh(trackGroup, new THREE.TubeGeometry(railCurve, samples.length, 0.13, 7, false), metalMaterial(0x090c0d, 0.2));
    addMesh(trackGroup, new THREE.TubeGeometry(railCurve, samples.length, 0.075, 7, false), metalMaterial(0xe2a63e, 0.18));
  });

  const tieSamples = samples.filter((_, index) => index % 5 === 0);
  const tieGeometry = new THREE.BoxGeometry(width + 0.72, 0.12, 0.2);
  const ties = new THREE.InstancedMesh(tieGeometry, metalMaterial(0x342c22, 0.34), tieSamples.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  tieSamples.forEach((sample, index) => {
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);
    quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    matrix.compose(sample.position.clone().add(new THREE.Vector3(0, 0.095, 0)), quaternion, new THREE.Vector3(1, 1, 1));
    ties.setMatrixAt(index, matrix);
  });
  ties.castShadow = true;
  ties.receiveShadow = true;
  trackGroup.add(ties);

  const boltGeometry = new THREE.CylinderGeometry(0.065, 0.065, 0.08, 7);
  const bolts = new THREE.InstancedMesh(boltGeometry, metalMaterial(0xe3ad47, 0.16), tieSamples.length * 2);
  tieSamples.forEach((sample, index) => {
    [-1, 1].forEach((side, sideIndex) => {
      const position = sample.position.clone()
        .addScaledVector(sample.normal, side * (width / 2 + 0.18))
        .add(new THREE.Vector3(0, 0.31, 0));
      matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      bolts.setMatrixAt(index * 2 + sideIndex, matrix);
    });
  });
  bolts.castShadow = true;
  trackGroup.add(bolts);

  const wallSamples = samples.filter((_, index) => index % 7 === 0);
  const wallGeometry = new THREE.BoxGeometry(0.34, 0.34, 0.42);
  const walls = new THREE.InstancedMesh(wallGeometry, metalMaterial(0x252b2d, 0.22), wallSamples.length * 2);
  wallSamples.forEach((sample, index) => {
    const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);
    quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    [-1, 1].forEach((side, sideIndex) => {
      const position = sample.position.clone()
        .addScaledVector(sample.normal, side * (width / 2 + 0.17))
        .add(new THREE.Vector3(0, -0.04, 0));
      matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
      walls.setMatrixAt(index * 2 + sideIndex, matrix);
    });
  });
  walls.castShadow = true;
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
  group.rotation.y = Math.atan2(point.tangent.x, point.tangent.z);
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

const addZoneFeature = (
  scene: THREE.Scene,
  track: MarbleTrack,
  zone: TrackZone,
  animatedParts: AnimatedPart[],
  glowMaterials: THREE.MeshStandardMaterial[],
  localLights: boolean,
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

  const label = createLabelSprite(zone.label, zone.color);
  label.position.set(width * 0.7, 2.35 * scale, 0);
  group.add(label);
};

const addSectionArchitecture = (scene: THREE.Scene, track: MarbleTrack) => {
  const width = trackWidthToWorld(track);
  track.sections.forEach((section, index) => {
    const progress = (section.startProgress + section.endProgress) / 2;
    const group = new THREE.Group();
    orientGroupOnTrack(group, track, progress);
    scene.add(group);
    addMesh(
      group,
      new THREE.BoxGeometry(width * 0.86, 0.055, index % 4 === 0 ? 0.2 : 0.11),
      index % 4 === 0 ? metalMaterial(GOLD, 0.18) : metalMaterial(0x718086, 0.24),
      [0, 0.13, 0],
    );
    if (section.type === "tunnel") {
      [-0.42, 0, 0.42].forEach((z) => addMesh(group, new THREE.TorusGeometry(width * 0.56, 0.07, 6, 16, Math.PI), metalMaterial(GOLD, 0.2), [0, 0.08, z], [0, 0, Math.PI]));
    } else if (section.type === "split") {
      addMesh(group, new THREE.CylinderGeometry(width * 0.68, width * 0.8, 0.26, 8), metalMaterial(0x273033, 0.25), [0, -0.12, 0]);
      [-1, 1].forEach((side) => addMesh(group, new THREE.BoxGeometry(0.16, 0.13, 1.2), glowMaterial(side > 0 ? 0x09e0df : 0xf6bd35, 0.8), [side * width * 0.25, 0.14, 0]));
    } else if (section.type === "funnel") {
      addMesh(group, new THREE.CylinderGeometry(width * 0.54, width * 0.27, 0.38, 20, 1, true), metalMaterial(0x4b3055, 0.24), [0, 0.08, 0]);
    } else if (section.type === "speed-zone") {
      [-0.35, 0, 0.35].forEach((z) => addArrow(group, "#09e0df", z, 0.62));
    } else if (index % 2 === 0) {
      [-0.45, 0.45].forEach((x) => addMesh(group, new THREE.ConeGeometry(0.12, 0.52, 5), glassMaterial("#8fe9ff"), [x, 0.28, 0]));
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
  const label = createLabelSprite(labelText, color, true);
  label.position.set(0.5, 1.22, 0);
  label.scale.multiplyScalar(0.72);
  group.add(label);
  animatedParts.push({ object: orb, update: (object, time) => { object.position.y = 0.72 + Math.sin(time * 2.8 + progress * 10) * 0.16; } });
  animatedParts.push({ object: halo, update: (object, time) => { object.rotation.z = time * 1.5; object.rotation.y = time * 0.7; } });
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
  addMesh(bay, new THREE.BoxGeometry(bayWidth, 0.35, bayDepth), metalMaterial(0x11191b, 0.25), [0, -0.28, -bayDepth * 0.55]);
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
  finishLabel.position.set(0, 2.05, 0);
  finishGroup.add(finishLabel);
};

const addEnvironment = (scene: THREE.Scene, difficulty: MarbleTrack["difficulty"]) => {
  scene.background = new THREE.Color(0x02080b);
  scene.fog = new THREE.FogExp2(0x02080b, 0.016);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.74, metalness: 0.38 });
  const floor = addMesh(scene, new THREE.PlaneGeometry(42, 34), floorMaterial, [0, -0.86, 0], [-Math.PI / 2, 0, 0]);
  floor.receiveShadow = true;
  floor.castShadow = false;

  const grid = new THREE.GridHelper(42, 44, 0x17434b, 0x0b2025);
  grid.position.y = -0.84;
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
  materials.forEach((material) => { material.transparent = true; material.opacity = 0.24; });
  scene.add(grid);

  scene.add(new THREE.AmbientLight(0x8ac3ca, difficulty === "hard" ? 1.05 : 1.2));
  scene.add(new THREE.HemisphereLight(0xb8f8ff, 0x1c0c04, difficulty === "hard" ? 2.3 : 2.6));
  const key = new THREE.DirectionalLight(0xffdca0, 5.2);
  key.position.set(-8, 18, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6feeff, 2.2);
  fill.position.set(10, 10, -12);
  scene.add(fill);
  const cyan = new THREE.PointLight(0x00e8f0, 115, 30, 1.7);
  cyan.position.set(8, 7, -5);
  scene.add(cyan);
  const gold = new THREE.PointLight(0xffa928, 105, 28, 1.7);
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

const materialBatchKey = (material: THREE.Material) => {
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
  animatedParts.forEach(({ object }) => object.traverse((child) => dynamicObjects.add(child)));
  const dynamicMaterials = new Set(animatedMaterials);
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
    const geometries = meshes.map((mesh) => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const mergedGeometry = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!mergedGeometry) return;
    const material = meshes[0].material as THREE.Material;
    const merged = new THREE.Mesh(mergedGeometry, material);
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = meshes[0].receiveShadow;
    scene.add(merged);
    meshes.forEach((mesh, index) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      if (index > 0 && !Array.isArray(mesh.material)) orphanMaterials.add(mesh.material);
    });
  });
  scene.userData.orphanMaterials = orphanMaterials;
};

const buildScene = (renderer: THREE.WebGLRenderer, race: PreparedMarbleRace, key: string): MarbleSceneState => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-16, 16, 11, -11, 0.1, 90);
  camera.position.set(0, 24, 20);
  camera.lookAt(0, 0.2, 0.4);
  addEnvironment(scene, race.track.difficulty);
  const animatedParts: AnimatedPart[] = [];
  const glowMaterials: THREE.MeshStandardMaterial[] = [];
  addAtmosphere(scene, race.track, animatedParts);
  const samples = createTrackSamples(race.track);
  addTrackBody(scene, race.track, samples);
  race.track.zones.forEach((zone) => addZoneFeature(scene, race.track, zone, animatedParts, glowMaterials, race.racers.length <= 96));
  addSectionArchitecture(scene, race.track);
  race.track.obstacles.forEach((obstacle) => addObstacle(scene, race.track, obstacle.type, obstacle.progress, obstacle.scale, animatedParts));
  race.track.powerZones.forEach((zone) => addPowerZone(scene, race.track, zone.progress, zone.color, powerLabels[zone.power], zone.scale, animatedParts, glowMaterials));
  addStartFinishAndBay(scene, race);

  const count = race.racers.length;
  const sphereDetail = count > 150 ? [9, 6] : count > 100 ? [11, 7] : count > 40 ? [16, 10] : [22, 14];
  const marbleMaterial = count > 48
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.18, roughness: 0.14 })
    : new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      metalness: 0.08,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
  const racers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, sphereDetail[0], sphereDetail[1]), marbleMaterial, count);
  racers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  racers.castShadow = count <= 72;
  racers.receiveShadow = true;
  race.racers.forEach((racer, index) => racers.setColorAt(index, new THREE.Color(racer.accent)));
  if (racers.instanceColor) racers.instanceColor.needsUpdate = true;
  scene.add(racers);

  const racerLabels = count <= 18
    ? race.racers.map((racer) => {
      const label = createLabelSprite(`${racer.number}  ${racer.participant.name}`, racer.accent, true);
      label.scale.multiplyScalar(0.62);
      scene.add(label);
      return label;
    })
    : [];

  const selectedRing = addMesh(scene, new THREE.TorusGeometry(0.36, 0.055, 7, 28), glowMaterial(0xffec9b, 2), [0, -20, 0], [Math.PI / 2, 0, 0]);
  selectedRing.visible = false;
  batchStaticMeshes(scene, animatedParts, glowMaterials, [racers, selectedRing]);
  renderer.shadowMap.enabled = count <= 96;
  renderer.shadowMap.autoUpdate = count <= 96;
  return {
    key,
    renderer,
    scene,
    camera,
    racers,
    racerLabels,
    selectedRing,
    animatedParts,
    glowMaterials,
    participantCount: count,
    shadowReady: false,
    width: 0,
    height: 0,
  };
};

const disposeMaterial = (material: THREE.Material) => {
  const withMaps = material as THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null };
  withMaps.map?.dispose();
  withMaps.emissiveMap?.dispose();
  material.dispose();
};

const disposeScene = (scene: THREE.Scene) => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite || object instanceof THREE.Points) {
      object.geometry?.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    }
  });
  const orphanMaterials = scene.userData.orphanMaterials as Set<THREE.Material> | undefined;
  orphanMaterials?.forEach(disposeMaterial);
};

const createRenderer = (canvas: HTMLCanvasElement) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.52;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
};

const sceneKey = (race: PreparedMarbleRace) => `${race.track.signature}:${race.racers.map((racer) => `${racer.id}-${racer.participant.name}`).join("|")}`;

const ensureState = (canvas: HTMLCanvasElement, race: PreparedMarbleRace) => {
  const key = sceneKey(race);
  const current = sceneStates.get(canvas);
  if (current?.key === key) return current;
  const renderer = current?.renderer ?? createRenderer(canvas);
  if (current) disposeScene(current.scene);
  const next = buildScene(renderer, race, key);
  sceneStates.set(canvas, next);
  return next;
};

const resizeRenderer = (state: MarbleSceneState, canvas: HTMLCanvasElement) => {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(520, Math.round(bounds.width));
  const height = Math.max(480, Math.round(bounds.height));
  if (state.width === width && state.height === height) return;
  state.width = width;
  state.height = height;
  const pixelRatioLimit = state.participantCount > 150 ? 1.15 : state.participantCount > 96 ? 1.35 : 1.65;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioLimit));
  state.renderer.setSize(width, height, false);
  const aspect = width / height;
  const viewHeight = Math.max(19.5, 30 / aspect);
  state.camera.left = -(viewHeight * aspect) / 2;
  state.camera.right = (viewHeight * aspect) / 2;
  state.camera.top = viewHeight / 2;
  state.camera.bottom = -viewHeight / 2;
  state.camera.updateProjectionMatrix();
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
  const start = worldPointAt(race.track, 0);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const launchBlend = phase === "ready" ? 0 : Math.min(1, elapsedMs / 900);
  const smoothLaunch = launchBlend * launchBlend * (3 - 2 * launchBlend);
  const selectedIndex = race.racers.findIndex((racer) => racer.id === race.selected.id);

  race.racers.forEach((racer, index) => {
    const marbleState = getMarbleProgress(racer, phase === "ready" ? 0 : elapsedMs);
    const trackPoint = worldPointAt(race.track, marbleState.progress);
    const nearbyObstacle = race.track.obstacles.find((obstacle) => Math.abs(obstacle.progress - marbleState.progress) < 0.018);
    const collisionWobble = nearbyObstacle
      ? Math.sin(elapsedMs / 43 + racer.number * 1.71) * 0.24 * nearbyObstacle.scale * (1 - Math.abs(nearbyObstacle.progress - marbleState.progress) / 0.018)
      : 0;
    const laneOffset = racer.lane * trackWidthToWorld(race.track) * 0.29 + collisionWobble;
    const racingPosition = trackPoint.position.clone().addScaledVector(trackPoint.normal, laneOffset);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const stagingPosition = start.position.clone()
      .addScaledVector(start.normal, (column - (columns - 1) / 2) * spacing)
      .addScaledVector(start.tangent, -(row + 0.75) * spacing);
    const radius = baseRadius * marbleState.radiusScale;
    const position = stagingPosition.lerp(racingPosition, smoothLaunch);
    position.y += radius + 0.17;
    quaternion.setFromEuler(new THREE.Euler(elapsedMs * 0.0018 + racer.number, 0, elapsedMs * 0.0024));
    scale.setScalar(radius);
    matrix.compose(position, quaternion, scale);
    state.racers.setMatrixAt(index, matrix);
    if (state.racerLabels[index]) {
      state.racerLabels[index].position.copy(position).add(new THREE.Vector3(0, radius + 0.42, 0));
      state.racerLabels[index].visible = phase !== "finished" || index === selectedIndex;
    }
    if (phase === "finished" && index === selectedIndex) {
      state.selectedRing.visible = true;
      state.selectedRing.position.copy(position);
      state.selectedRing.position.y -= radius + 0.11;
      state.selectedRing.scale.setScalar(1 + Math.sin(elapsedMs / 180) * 0.12);
    }
  });
  if (phase !== "finished") state.selectedRing.visible = false;
  state.racers.instanceMatrix.needsUpdate = true;
};

export const drawMarbleRace3D = (
  canvas: HTMLCanvasElement,
  race: PreparedMarbleRace,
  elapsedMs: number,
  phase: MarbleRaceVisualPhase,
) => {
  const state = ensureState(canvas, race);
  resizeRenderer(state, canvas);
  const elapsedSeconds = elapsedMs / 1000;
  state.animatedParts.forEach(({ object, update }) => update(object, elapsedSeconds));
  state.glowMaterials.forEach((material, index) => {
    material.emissiveIntensity = 1.05 + Math.sin(elapsedSeconds * 2.25 + index * 0.7) * 0.3;
  });
  updateRacers(state, race, elapsedMs, phase);
  if (state.renderer.shadowMap.enabled && !state.shadowReady) state.renderer.shadowMap.needsUpdate = true;
  state.renderer.render(state.scene, state.camera);
  canvas.dataset.renderCalls = String(state.renderer.info.render.calls);
  canvas.dataset.renderTriangles = String(state.renderer.info.render.triangles);
  if (state.renderer.shadowMap.enabled && !state.shadowReady) {
    state.renderer.shadowMap.autoUpdate = false;
    state.shadowReady = true;
  }
};

export const disposeMarbleRace3D = (canvas: HTMLCanvasElement) => {
  const state = sceneStates.get(canvas);
  if (!state) return;
  disposeScene(state.scene);
  state.renderer.dispose();
  sceneStates.delete(canvas);
};
