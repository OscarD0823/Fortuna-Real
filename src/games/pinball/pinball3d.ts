import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  canConfirmPinballFinish,
  createPinballPhysicsFrame,
  createPinballRandom,
  createPinballPhysicsBall,
  getPinballFlipperCollider,
  getPinballFinishCrossing,
  getPinballTargetColliders,
  launchPinballPhysicsBall,
  PINBALL_FLIPPERS,
  PINBALL_SLING_COLLIDERS,
  PINBALL_TARGET_BANKS,
  stepPinballPhysics,
  type PreparedPinballRound,
  type PinballFlipperState,
  type PinballPhysicsBall,
  type PinballSegmentCollider,
} from "./pinballEngine";

export interface PinballSceneStats {
  launched: number;
  active: number;
  collisions: number;
  fps: number;
  renderCalls: number;
  triangles: number;
}

export interface PinballSceneEvents {
  onStats?: (stats: PinballSceneStats) => void;
  onImpact?: (strength: number) => void;
  onFinish?: (assignment: PreparedPinballRound["balls"][number], label: string) => void;
}

export interface PinballSceneController {
  start: () => void;
  launchBurst: () => number;
  setFollowBall: (ballId: string | null) => void;
  setFlippers: (left: boolean, right: boolean) => void;
  dispose: () => void;
}

interface RuntimeBall {
  physics: PinballPhysicsBall;
  respawns: number;
}

const PINBALL_CAMERA_INTRO_MS = 1500;

const smoothstep = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

const disposeObject = (object: THREE.Object3D) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    if (
      !(child instanceof THREE.Mesh) &&
      !(child instanceof THREE.Line) &&
      !(child instanceof THREE.Points) &&
      !(child instanceof THREE.Sprite)
    ) return;
    if ("geometry" in child && child.geometry instanceof THREE.BufferGeometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
};

const staticPaletteBucket = (material: THREE.Material) => {
  if (
    !(material instanceof THREE.MeshStandardMaterial)
    || material instanceof THREE.MeshPhysicalMaterial
    || material.transparent
    || material.blending !== THREE.NormalBlending
    || material.vertexColors
    || material.map
    || material.normalMap
    || material.bumpMap
    || material.roughnessMap
    || material.metalnessMap
    || material.alphaMap
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

const batchStaticMeshes = (scene: THREE.Scene, preservedRoots: readonly THREE.Object3D[]) => {
  scene.updateMatrixWorld(true);
  const preserved = new Set<THREE.Object3D>();
  preservedRoots.forEach((root) => root.traverse((object) => preserved.add(object)));
  const groups = new Map<string, THREE.Mesh[]>();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || preserved.has(object)) return;
    const material = Array.isArray(object.material) ? null : object.material;
    if (!material) return;
    const attributes = Object.keys(object.geometry.attributes).sort().join(",");
    const key = `${materialBatchKey(material)}:${object.geometry.index ? "indexed" : "plain"}:${attributes}:${object.castShadow ? 1 : 0}:${object.receiveShadow ? 1 : 0}`;
    const group = groups.get(key) ?? [];
    group.push(object);
    groups.set(key, group);
  });

  groups.forEach((meshes) => {
    if (meshes.length < 2) return;
    const palette = staticPaletteBucket(meshes[0].material as THREE.Material);
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (palette) {
        const sourceMaterial = mesh.material as THREE.MeshStandardMaterial;
        const colors = new Float32Array(geometry.getAttribute("position").count * 3);
        for (let index = 0; index < colors.length; index += 3) {
          colors[index] = sourceMaterial.color.r;
          colors[index + 1] = sourceMaterial.color.g;
          colors[index + 2] = sourceMaterial.color.b;
        }
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      return geometry;
    });
    const mergedGeometry = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!mergedGeometry) return;
    const firstMaterial = meshes[0].material as THREE.Material;
    const mergedMaterial = palette?.kind === "emissive"
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: firstMaterial.side, depthWrite: firstMaterial.depthWrite })
      : palette
        ? new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: palette.metalness, roughness: palette.roughness, side: firstMaterial.side, depthWrite: firstMaterial.depthWrite })
        : firstMaterial;
    const merged = new THREE.Mesh(mergedGeometry, mergedMaterial);
    merged.castShadow = meshes[0].castShadow;
    merged.receiveShadow = meshes[0].receiveShadow;
    scene.add(merged);
    const discardedMaterials = new Set<THREE.Material>();
    meshes.forEach((mesh) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      const material = mesh.material as THREE.Material;
      if (material !== mergedMaterial) discardedMaterials.add(material);
    });
    discardedMaterials.forEach((material) => material.dispose());
  });
};

const createLabelTexture = (text: string, color = "#eefcff", accent = "#0de4e1") => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(1, 12, 18, .88)";
  context.strokeStyle = accent;
  context.lineWidth = 8;
  context.beginPath();
  context.roundRect(8, 8, 1008, 176, 38);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.font = "800 70px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 512, 100, 940);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const createBallGlowTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.22, "rgba(255,255,255,.8)");
    gradient.addColorStop(0.55, "rgba(255,255,255,.24)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const addLabel = (
  scene: THREE.Scene,
  text: string,
  position: THREE.Vector3,
  width: number,
  accent?: string,
) => {
  const material = new THREE.SpriteMaterial({
    map: createLabelTexture(text, "#f3feff", accent),
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(width, width * 0.1875, 1);
  scene.add(sprite);
  return sprite;
};

const createDebugSegment = (collider: PinballSegmentCollider, color = 0xff3af2) => {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(collider.start.x, 1.05, collider.start.z),
    new THREE.Vector3(collider.end.x, 1.05, collider.end.z),
  ]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
  line.name = `DBG_${collider.id}`;
  line.renderOrder = 100;
  return line;
};

const updateDebugSegment = (line: THREE.Line, collider: PinballSegmentCollider) => {
  const positions = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  positions.setXYZ(0, collider.start.x, 1.05, collider.start.z);
  positions.setXYZ(1, collider.end.x, 1.05, collider.end.z);
  positions.needsUpdate = true;
};

const createDebugCircle = (id: string, x: number, z: number, radius: number, color = 0xff3af2) => {
  const points = Array.from({ length: 33 }, (_, index) => {
    const angle = index / 32 * Math.PI * 2;
    return new THREE.Vector3(x + Math.cos(angle) * radius, 1.05, z + Math.sin(angle) * radius);
  });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, depthTest: false }));
  line.name = `DBG_${id}`;
  line.renderOrder = 100;
  return line;
};

const createPlayfieldTexture = (name: string, signature: string, seed: string) => {
  const random = createPinballRandom(`art-${seed}`);
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  const accent = random() > 0.5 ? "#11d9d6" : "#ffad25";
  const secondary = random() > 0.5 ? "#e85038" : "#8e64ff";
  const background = context.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "#06151b");
  background.addColorStop(0.52, "#0a2027");
  background.addColorStop(1, "#03090d");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.globalAlpha = 0.22;
  for (let index = 0; index < 14; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 70 + random() * 210;
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, index % 2 ? accent : secondary);
    glow.addColorStop(1, "transparent");
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.restore();

  context.strokeStyle = "rgba(66, 235, 231, .24)";
  context.lineWidth = 4;
  for (let index = 0; index < 7; index += 1) {
    context.beginPath();
    context.moveTo(110 + index * 26, 1420);
    context.bezierCurveTo(80 + random() * 280, 1080, 210 + random() * 620, 520, 180 + random() * 690, 80);
    context.stroke();
  }

  context.translate(canvas.width / 2, canvas.height * 0.56);
  for (let ring = 0; ring < 5; ring += 1) {
    context.beginPath();
    context.strokeStyle = ring % 2 ? "rgba(255,177,46,.28)" : "rgba(16,224,221,.22)";
    context.lineWidth = 7 - ring;
    context.arc(0, 0, 110 + ring * 54, 0, Math.PI * 2);
    context.stroke();
  }
  context.setTransform(1, 0, 0, 1, 0, 0);

  context.fillStyle = "rgba(0,0,0,.48)";
  context.fillRect(100, 57, 824, 132);
  context.strokeStyle = accent;
  context.lineWidth = 5;
  context.strokeRect(100, 57, 824, 132);
  context.textAlign = "center";
  context.fillStyle = "#f7ffff";
  context.font = "900 58px Arial";
  context.fillText(name.toUpperCase(), 512, 120, 770);
  context.fillStyle = accent;
  context.font = "700 25px Arial";
  context.fillText(signature, 512, 160, 760);

  const labels = ["ORBIT", "ROYAL", "MULTI", "FORTUNA", "BONUS", "JACKPOT"];
  labels.forEach((label, index) => {
    const x = 150 + (index % 3) * 360 + (random() - 0.5) * 60;
    const y = 400 + Math.floor(index / 3) * 520 + random() * 170;
    context.save();
    context.translate(x, y);
    context.rotate((random() - 0.5) * 0.32);
    context.fillStyle = index % 2 ? "rgba(255,180,42,.72)" : "rgba(16,225,222,.74)";
    context.font = "900 32px Arial";
    context.fillText(label, 0, 0);
    context.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

const createWireRamp = (
  points: THREE.Vector3[],
  width: number,
  accent: number,
) => {
  const group = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0xd8e1e3,
    metalness: 1,
    roughness: 0.14,
    clearcoat: 0.5,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.7,
    metalness: 0.48,
    roughness: 0.2,
  });
  [-width / 2, width / 2].forEach((offset) => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point.x + offset, point.y, point.z)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 54, 0.075, 7, false), metal));
  });
  const centerCurve = new THREE.CatmullRomCurve3(points);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(centerCurve, 54, 0.035, 6, false), glow));
  for (let index = 2; index < 17; index += 3) {
    const progress = index / 18;
    const point = centerCurve.getPoint(progress);
    const tangent = centerCurve.getTangent(progress);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, width, 6), metal);
    tie.position.copy(point);
    tie.rotation.z = Math.PI / 2;
    tie.rotation.y = -Math.atan2(tangent.z, tangent.x);
    group.add(tie);
    if (index % 6 === 2) {
      const supportHeight = Math.max(0.4, point.y - 0.28);
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, supportHeight, 7), metal);
      support.position.set(point.x, supportHeight / 2 + 0.25, point.z);
      group.add(support);
    }
  }
  return group;
};

const createSlingshot = (side: -1 | 1, accent: number) => {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(side * 2.35, -0.3);
  shape.lineTo(side * 0.7, -2.2);
  shape.closePath();
  const plastic = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.06, bevelSegments: 2 }),
    new THREE.MeshPhysicalMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.45, transparent: true, opacity: 0.68, roughness: 0.16, clearcoat: 1 }),
  );
  plastic.rotation.x = Math.PI / 2;
  group.add(plastic);
  const rubberMaterial = new THREE.MeshStandardMaterial({ color: 0xf2e5bd, roughness: 0.54 });
  const rubber = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 2.15, 4, 8), rubberMaterial);
  rubber.rotation.z = Math.PI / 2;
  rubber.position.set(side * 1.12, 0.27, -0.16);
  group.add(rubber);
  return group;
};

const createTargetBank = (count: number, color: number) => {
  const group = new THREE.Group();
  for (let index = 0; index < count; index += 1) {
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.78, 0.16),
      new THREE.MeshPhysicalMaterial({ color: 0xf1f5ed, metalness: 0.25, roughness: 0.26, clearcoat: 0.8 }),
    );
    target.position.x = (index - (count - 1) / 2) * 0.78;
    const insert = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.3, 0.025),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.1 }),
    );
    insert.position.set(target.position.x, 0.08, 0.095);
    group.add(target, insert);
  }
  return group;
};

const createArrowInsert = (color: number) => {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.55);
  shape.lineTo(-0.46, 0.05);
  shape.lineTo(-0.18, 0.05);
  shape.lineTo(-0.18, 0.55);
  shape.lineTo(0.18, 0.55);
  shape.lineTo(0.18, 0.05);
  shape.lineTo(0.46, 0.05);
  shape.closePath();
  const insert = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.5, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
  );
  insert.rotation.x = -Math.PI / 2;
  return insert;
};

const createRoundedRail = (
  width: number,
  depth: number,
  color: number,
  emissive = 0x1a0900,
) => {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.86,
    roughness: 0.2,
    emissive,
    emissiveIntensity: 0.16,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.38, 0.28), material);
  top.position.z = -depth / 2;
  const bottom = top.clone();
  bottom.position.z = depth / 2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, depth), material);
  left.position.x = -width / 2;
  const right = left.clone();
  right.position.x = width / 2;
  group.add(top, bottom, left, right);
  return group;
};

export const createPinballScene = (
  canvas: HTMLCanvasElement,
  round: PreparedPinballRound,
  events: PinballSceneEvents = {},
): PinballSceneController => {
  const count = round.balls.length;
  const animateDecorations = count <= 96;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const cameraIntroMs = reducedMotion ? 0 : PINBALL_CAMERA_INTRO_MS;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: count <= 90,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = count <= 60;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const maximumPixelRatio = Math.min(
    window.devicePixelRatio || 1,
    count > 150 ? 0.9 : count > 100 ? 1.05 : count > 50 ? 1.2 : 1.4,
  );
  renderer.setPixelRatio(maximumPixelRatio);
  canvas.dataset.renderQuality = "high";

  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTexture = environmentGenerator.fromScene(new RoomEnvironment(), 0.03).texture;

  const scene = new THREE.Scene();
  scene.name = "SC_Pinball";
  scene.background = new THREE.Color(0x01070b);
  scene.fog = new THREE.FogExp2(0x01070b, 0.018);
  scene.environment = environmentTexture;

  const camera = new THREE.PerspectiveCamera(37, 1, 0.025, 90);
  const overviewCameraPosition = new THREE.Vector3(0, 27.8, 29.5);
  const overviewCameraTarget = new THREE.Vector3(0, 1.05, -1.7);
  const presentationCameraPosition = count > 120
    ? new THREE.Vector3(0, 20.5, 21)
    : count > 60
      ? new THREE.Vector3(0, 18.5, 18.5)
      : new THREE.Vector3(0, 15.8, 15.2);
  const presentationCameraTarget = new THREE.Vector3(0, 0.76, 5.8);
  const cameraTarget = new THREE.Vector3();
  const followCameraPosition = new THREE.Vector3();
  const followCameraLookTarget = new THREE.Vector3();
  const followDirection = new THREE.Vector3();
  const followCameraUp = new THREE.Vector3(0, 1, 0);
  camera.position.copy(presentationCameraPosition);
  camera.lookAt(presentationCameraTarget);

  scene.add(new THREE.HemisphereLight(0x80eaff, 0x120805, 1.38));
  const keyLight = new THREE.DirectionalLight(0xffd37b, 2.45);
  keyLight.position.set(-8, 18, 6);
  keyLight.castShadow = renderer.shadowMap.enabled;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  const cyanLight = new THREE.PointLight(0x00e4e0, 21, 30, 2);
  cyanLight.position.set(5, 5, -4);
  scene.add(cyanLight);
  const goldLight = new THREE.PointLight(0xffa91f, 18, 26, 2);
  goldLight.position.set(-5, 4, 5);
  scene.add(goldLight);

  const cabinet = new THREE.Group();
  cabinet.name = "GRP_PinballCabinet";
  cabinet.rotation.x = -0.025;
  scene.add(cabinet);

  const artTexture = createPlayfieldTexture(round.layout.name, round.layout.signature, round.layout.seed);
  const random = createPinballRandom(`visual-${round.layout.seed}`);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(18.8, 1.15, 27),
    new THREE.MeshStandardMaterial({ color: 0x07131a, metalness: 0.82, roughness: 0.23 }),
  );
  base.position.y = -0.62;
  base.receiveShadow = true;
  cabinet.add(base);

  const playfield = new THREE.Mesh(
    new THREE.BoxGeometry(16.2, 0.28, 24.2),
    new THREE.MeshPhysicalMaterial({
      color: 0x071b23,
      metalness: 0.42,
      roughness: 0.28,
      clearcoat: 0.88,
      clearcoatRoughness: 0.18,
    }),
  );
  playfield.position.y = 0.08;
  playfield.receiveShadow = true;
  cabinet.add(playfield);

  const artwork = new THREE.Mesh(
    new THREE.PlaneGeometry(15.72, 23.72),
    new THREE.MeshPhysicalMaterial({ map: artTexture, metalness: 0.12, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.22 }),
  );
  artwork.rotation.x = -Math.PI / 2;
  artwork.position.y = 0.235;
  artwork.receiveShadow = true;
  cabinet.add(artwork);

  const grid = new THREE.GridHelper(23, 24, 0x086f79, 0x113039);
  grid.scale.x = 0.7;
  grid.position.y = 0.245;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.2;
  cabinet.add(grid);

  const outerRail = createRoundedRail(16.8, 24.8, 0x8b4715, 0xff6500);
  outerRail.position.y = 0.66;
  cabinet.add(outerRail);
  const innerRail = createRoundedRail(15.95, 23.95, 0x211a17, 0x00d7d5);
  innerRail.position.y = 0.61;
  cabinet.add(innerRail);

  const launchDivider = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.62, 20.4),
    new THREE.MeshStandardMaterial({ color: 0xc07024, metalness: 0.9, roughness: 0.18 }),
  );
  launchDivider.position.set(5.88, 0.68, 0.3);
  cabinet.add(launchDivider);

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.72, 3.05),
    new THREE.MeshPhysicalMaterial({ color: 0x11181b, metalness: 0.86, roughness: 0.2, clearcoat: 0.72 }),
  );
  apron.position.set(-0.72, 0.54, 10.55);
  apron.rotation.x = -0.04;
  cabinet.add(apron);
  const apronPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 1.24),
    new THREE.MeshStandardMaterial({ color: 0x092830, emissive: 0x053f43, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.32 }),
  );
  apronPanel.rotation.x = -Math.PI / 2;
  apronPanel.position.set(-0.7, 0.92, 10.2);
  cabinet.add(apronPanel);

  const backbox = new THREE.Group();
  const backboxFrame = new THREE.Mesh(
    new THREE.BoxGeometry(11.8, 7.3, 0.82),
    new THREE.MeshPhysicalMaterial({ color: 0x11161a, metalness: 0.78, roughness: 0.2, clearcoat: 0.9 }),
  );
  backboxFrame.position.set(0, 4.15, -13.25);
  backbox.add(backboxFrame);
  const backglassMaterial = new THREE.MeshStandardMaterial({
    map: createLabelTexture("FORTUNA REAL", "#fff7da", "#ffb52c"),
    emissive: 0x164c50,
    emissiveIntensity: 0.72,
    metalness: 0.12,
    roughness: 0.22,
  });
  const backglass = new THREE.Mesh(new THREE.PlaneGeometry(10.7, 4.1), backglassMaterial);
  backglass.position.set(0, 4.78, -12.82);
  backbox.add(backglass);
  const scorePanel = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 1.15),
    new THREE.MeshStandardMaterial({ color: 0x001014, emissive: 0x00a9a6, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.18 }),
  );
  scorePanel.position.set(0, 2.18, -12.8);
  backbox.add(scorePanel);
  for (let index = 0; index < 8; index += 1) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({ color: index % 2 ? 0xffb42d : 0x10dfdc, emissive: index % 2 ? 0xff7600 : 0x00a9a7, emissiveIntensity: 3 }),
    );
    lamp.position.set(-4.2 + index * 1.2, 1.38, -12.72);
    backbox.add(lamp);
  }
  scene.add(backbox);

  const shooterHousing = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.95, 4.8),
    new THREE.MeshPhysicalMaterial({ color: 0x3c1d09, metalness: 0.78, roughness: 0.22, clearcoat: 0.75 }),
  );
  shooterHousing.position.set(6.68, 0.32, 9.3);
  cabinet.add(shooterHousing);

  const bumperGroups: THREE.Group[] = [];
  round.layout.bumpers.forEach((bumper) => {
    const group = new THREE.Group();
    group.position.set(bumper.x, 0.42, bumper.z);
    const glow = new THREE.Color(bumper.color);
    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(bumper.radius * 1.16, bumper.radius * 1.25, 0.42, 22),
      new THREE.MeshStandardMaterial({ color: 0x191b1d, metalness: 0.92, roughness: 0.18 }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(bumper.radius, 0.17, 10, 26),
      new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.4, metalness: 0.4 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.38;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(bumper.radius * 0.72, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: glow, emissive: glow, emissiveIntensity: 0.62, metalness: 0.1, roughness: 0.12, clearcoat: 1 }),
    );
    cap.position.y = 0.2;
    group.add(lower, ring, cap);
    group.userData.pulse = 0;
    bumperGroups.push(group);
    cabinet.add(group);
  });

  const pegGeometry = new THREE.CylinderGeometry(0.17, 0.2, 0.68, 10);
  const pegMaterial = new THREE.MeshStandardMaterial({ color: 0xffd17a, emissive: 0x6b2a00, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.15 });
  const pegs = new THREE.InstancedMesh(pegGeometry, pegMaterial, round.layout.pegs.length);
  const pegMatrix = new THREE.Matrix4();
  round.layout.pegs.forEach((peg, index) => {
    pegMatrix.makeTranslation(peg.x, 0.65, peg.z);
    pegs.setMatrixAt(index, pegMatrix);
  });
  pegs.castShadow = renderer.shadowMap.enabled;
  cabinet.add(pegs);

  const spinnerGroups: THREE.Group[] = [];
  round.layout.spinners.forEach((spinner) => {
    const group = new THREE.Group();
    group.position.set(spinner.x, 0.64, spinner.z);
    group.rotation.y = spinner.rotation;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(spinner.length, 0.22, 0.2),
      new THREE.MeshStandardMaterial({ color: spinner.color, emissive: spinner.color, emissiveIntensity: 1.25, metalness: 0.58 }),
    );
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.35, 14),
      new THREE.MeshStandardMaterial({ color: 0xffc95c, metalness: 0.9, roughness: 0.16 }),
    );
    group.add(bar, hub);
    spinnerGroups.push(group);
    cabinet.add(group);
  });

  const rampAccentA = random() > 0.5 ? 0x0ce0dc : 0xffb52c;
  const rampAccentB = rampAccentA === 0x0ce0dc ? 0xffb52c : 0xa869ff;
  const leftRamp = createWireRamp([
    new THREE.Vector3(-4.9, 0.58, 4.6),
    new THREE.Vector3(-6.2, 1.2, 0.7),
    new THREE.Vector3(-5.6, 2.2, -5.5),
    new THREE.Vector3(-2.4, 2.75, -8.8),
    new THREE.Vector3(0.55, 2.25, -6.2),
    new THREE.Vector3(-1.65, 1.15, 5.7),
  ], 0.78, rampAccentA);
  cabinet.add(leftRamp);
  const rightRamp = createWireRamp([
    new THREE.Vector3(3.9, 0.58, 4.3),
    new THREE.Vector3(5.25, 1.25, 0.2),
    new THREE.Vector3(4.5, 2.55, -7.8),
    new THREE.Vector3(1.7, 3.2, -9.2),
    new THREE.Vector3(1.1, 2.1, -2.4),
    new THREE.Vector3(2.2, 1.1, 6.05),
  ], 0.74, rampAccentB);
  cabinet.add(rightRamp);

  const createOrbit = (side: -1 | 1) => {
    const outer = createWireRamp([
      new THREE.Vector3(side * 5.45, 0.5, 6.2),
      new THREE.Vector3(side * 6.55, 0.68, 2.2),
      new THREE.Vector3(side * 6.65, 0.82, -5.7),
      new THREE.Vector3(side * 4.95, 0.68, -9.7),
    ], 0.42, side < 0 ? 0x0ce0dc : 0xff812c);
    cabinet.add(outer);
  };
  createOrbit(-1);
  createOrbit(1);

  const leftSling = createSlingshot(-1, rampAccentA);
  leftSling.position.set(-0.55, 0.42, 7.55);
  leftSling.rotation.x = -Math.PI / 2;
  cabinet.add(leftSling);
  const rightSling = createSlingshot(1, rampAccentB);
  rightSling.position.set(0.55, 0.42, 7.55);
  rightSling.rotation.x = -Math.PI / 2;
  cabinet.add(rightSling);

  PINBALL_TARGET_BANKS.forEach((definition, index) => {
    const targetBank = createTargetBank(definition.count, index === 0 ? rampAccentA : rampAccentB);
    targetBank.name = `GRP_${definition.id}`;
    targetBank.position.set(definition.x, 0.82, definition.z);
    targetBank.rotation.x = -0.16;
    targetBank.rotation.y = definition.rotation;
    cabinet.add(targetBank);
  });

  const tower = new THREE.Group();
  tower.position.set((random() - 0.5) * 1.4, 0.35, -5.8);
  const towerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.55, 0.5, 10),
    new THREE.MeshPhysicalMaterial({ color: 0x1a2023, metalness: 0.9, roughness: 0.2, clearcoat: 0.55 }),
  );
  const towerCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 1.05, 2.65, 10),
    new THREE.MeshPhysicalMaterial({ color: 0x273439, metalness: 0.82, roughness: 0.18, clearcoat: 0.7 }),
  );
  towerCore.position.y = 1.55;
  const towerCrown = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.14, 9, 26),
    new THREE.MeshStandardMaterial({ color: rampAccentB, emissive: rampAccentB, emissiveIntensity: 2.1, metalness: 0.55 }),
  );
  towerCrown.rotation.x = Math.PI / 2;
  towerCrown.position.y = 2.88;
  tower.add(towerBase, towerCore, towerCrown);
  cabinet.add(tower);

  const shieldMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x69e9f0,
    emissive: 0x055f65,
    emissiveIntensity: 0.32,
    transmission: 0.42,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0.12,
    clearcoat: 1,
    side: THREE.DoubleSide,
  });
  [-1, 1].forEach((side) => {
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-1.8, -0.5);
    shieldShape.quadraticCurveTo(0, 0.8, 1.8, -0.5);
    shieldShape.lineTo(1.45, 0.45);
    shieldShape.quadraticCurveTo(0, 1.25, -1.45, 0.45);
    shieldShape.closePath();
    const shield = new THREE.Mesh(new THREE.ExtrudeGeometry(shieldShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 }), shieldMaterial.clone());
    shield.rotation.x = Math.PI / 2;
    shield.rotation.z = side * 0.2;
    shield.position.set(side * 4.2, 1.1, -5.9 + side * 0.75);
    cabinet.add(shield);
  });

  const insertColors = [0x09e0df, 0xffbd35, 0xe9503b, 0x9b68ff];
  for (let index = 0; index < 14; index += 1) {
    const arrow = createArrowInsert(insertColors[index % insertColors.length]);
    arrow.position.set(-4.8 + (index % 5) * 2.35 + (random() - 0.5) * 0.45, 0.266, -7.2 + Math.floor(index / 5) * 5.45 + random() * 0.55);
    arrow.scale.setScalar(0.55 + random() * 0.24);
    arrow.rotation.z = (random() - 0.5) * 0.35;
    cabinet.add(arrow);
  }

  round.layout.lanes.forEach((lane) => {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(lane.width, 0.09, 2.2),
      new THREE.MeshStandardMaterial({ color: lane.color, emissive: lane.color, emissiveIntensity: 1.4, metalness: 0.35, transparent: true, opacity: 0.72 }),
    );
    plate.position.set(lane.x, 0.31, lane.z);
    cabinet.add(plate);
  });

  const jackpotGroup = new THREE.Group();
  jackpotGroup.position.set(round.layout.jackpot.x, 0.38, round.layout.jackpot.z);
  const jackpotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.88, 0.18, 12, 32),
    new THREE.MeshStandardMaterial({ color: 0xffbe2e, emissive: 0xff9000, emissiveIntensity: 2.7, metalness: 0.64 }),
  );
  jackpotRing.rotation.x = Math.PI / 2;
  jackpotGroup.add(jackpotRing);
  cabinet.add(jackpotGroup);

  const finishGate = new THREE.Group();
  finishGate.position.set(round.layout.finishGate.x, 0, round.layout.finishGate.z);
  const finishPostMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf3c65a,
    emissive: 0xff7c00,
    emissiveIntensity: 1.15,
    metalness: 0.82,
    roughness: 0.17,
    clearcoat: 0.85,
  });
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.05, 14), finishPostMaterial);
    post.position.set(side * (round.layout.finishGate.width / 2 + 0.18), 0.76, 0);
    post.castShadow = renderer.shadowMap.enabled;
    finishGate.add(post);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 9), finishPostMaterial);
    crown.position.set(post.position.x, 1.34, 0);
    finishGate.add(crown);
  });
  const finishBeam = new THREE.Mesh(
    new THREE.BoxGeometry(round.layout.finishGate.width, 0.035, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x53ffff, transparent: true, opacity: 0.88 }),
  );
  finishBeam.position.set(0, 0.43, 0);
  finishGate.add(finishBeam);
  const finishHeader = new THREE.Mesh(
    new THREE.BoxGeometry(round.layout.finishGate.width + 0.62, 0.16, 0.2),
    finishPostMaterial,
  );
  finishHeader.position.set(0, 1.42, 0);
  finishGate.add(finishHeader);
  const finishLight = new THREE.PointLight(0xffbd35, 9, 5.5, 2);
  finishLight.position.set(0, 1.1, 0.4);
  finishGate.add(finishLight);
  const finishInsert = new THREE.Mesh(
    new THREE.PlaneGeometry(round.layout.finishGate.width + 0.55, 1.15),
    new THREE.MeshBasicMaterial({ color: 0x09e0df, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  finishInsert.rotation.x = -Math.PI / 2;
  finishInsert.position.set(0, 0.29, 0.48);
  finishGate.add(finishInsert);
  cabinet.add(finishGate);

  const chuteRailMaterial = new THREE.MeshPhysicalMaterial({ color: 0x9beeed, metalness: 0.9, roughness: 0.16, clearcoat: 0.6 });
  [-1, 1].forEach((side) => {
    const chuteCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 1.32, 0.52, round.layout.finishGate.z - 0.35),
      new THREE.Vector3(side * 1.43, 0.48, 10.65),
      new THREE.Vector3(side * 1.34, 0.42, 11.55),
    ]);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(chuteCurve, 12, 0.075, 7, false), chuteRailMaterial);
    cabinet.add(rail);
  });
  for (let index = 0; index < 6; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.045, 0.42),
      new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0x09e0df : 0xffbd35, transparent: true, opacity: 0.62 }),
    );
    marker.position.set((index % 2 === 0 ? -1 : 1) * 0.24, 0.32, 10.05 + index * 0.25);
    cabinet.add(marker);
  }

  const drain = new THREE.Mesh(
    new THREE.BoxGeometry(2.75, 0.28, 1.35),
    new THREE.MeshPhysicalMaterial({ color: 0x030708, emissive: 0xe53627, emissiveIntensity: 0.38, metalness: 0.72, roughness: 0.2 }),
  );
  drain.position.set(round.layout.drain.x, 0.18, round.layout.drain.z);
  cabinet.add(drain);

  const finishHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.075, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0 }),
  );
  finishHalo.rotation.x = Math.PI / 2;
  finishHalo.visible = false;
  cabinet.add(finishHalo);

  const createFlipper = (side: -1 | 1) => {
    const definition = PINBALL_FLIPPERS[side < 0 ? "left" : "right"];
    const coreRadius = 0.28;
    const pivot = new THREE.Group();
    pivot.name = `GRP_Flipper_${definition.side}`;
    pivot.position.set(definition.x, 0.64, definition.z);
    const pivotCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, 0.24, 18),
      new THREE.MeshPhysicalMaterial({ color: 0xd9e1dc, metalness: 0.75, roughness: 0.18, clearcoat: 0.6 }),
    );
    pivotCap.position.y = -0.1;
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(coreRadius, definition.length - coreRadius * 2, 6, 14),
      new THREE.MeshStandardMaterial({ color: side < 0 ? 0x09dedb : 0xf4ac24, emissive: side < 0 ? 0x036c70 : 0x6d3100, emissiveIntensity: 1.1, metalness: 0.67, roughness: 0.2 }),
    );
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = definition.direction * definition.length / 2;
    const rubber = new THREE.Mesh(
      new THREE.CapsuleGeometry(definition.radius, definition.length - definition.radius * 2, 5, 14),
      new THREE.MeshStandardMaterial({ color: side < 0 ? 0x89ffff : 0xffe096, emissive: side < 0 ? 0x0a5558 : 0x5d3906, emissiveIntensity: 0.25, roughness: 0.48 }),
    );
    rubber.rotation.z = Math.PI / 2;
    rubber.position.set(definition.direction * definition.length / 2, -0.08, 0);
    rubber.scale.set(1.03, 1.03, 0.78);
    pivot.rotation.y = definition.restAngle;
    pivot.add(pivotCap, rubber, mesh);
    cabinet.add(pivot);
    return pivot;
  };
  const leftFlipper = createFlipper(-1);
  const rightFlipper = createFlipper(1);

  const debugCollidersEnabled = new URLSearchParams(window.location.search).get("pinballDebug") === "1";
  const debugGroup = new THREE.Group();
  debugGroup.name = "DBG_PinballColliders";
  debugGroup.visible = debugCollidersEnabled;
  round.layout.bumpers.forEach((bumper) => debugGroup.add(createDebugCircle(bumper.id, bumper.x, bumper.z, bumper.radius)));
  round.layout.pegs.forEach((peg) => debugGroup.add(createDebugCircle(peg.id, peg.x, peg.z, peg.radius, 0x5dff8c)));
  getPinballTargetColliders().forEach((collider) => debugGroup.add(createDebugCircle(
    collider.id,
    collider.start.x,
    collider.start.z,
    collider.radius,
    0xffa83a,
  )));
  PINBALL_SLING_COLLIDERS.forEach((collider) => debugGroup.add(createDebugSegment(collider, 0x46e7ff)));
  const spinnerDebugLines = round.layout.spinners.map((spinner) => {
    const halfLength = spinner.length / 2;
    const axisX = Math.cos(spinner.rotation) * halfLength;
    const axisZ = -Math.sin(spinner.rotation) * halfLength;
    const line = createDebugSegment({
      id: spinner.id,
      start: { x: spinner.x - axisX, z: spinner.z - axisZ },
      end: { x: spinner.x + axisX, z: spinner.z + axisZ },
      radius: 0.14,
    }, 0xb96dff);
    debugGroup.add(line);
    return line;
  });
  const leftFlipperDebug = createDebugSegment(getPinballFlipperCollider("left"), 0x00ffff);
  const rightFlipperDebug = createDebugSegment(getPinballFlipperCollider("right"), 0xffd23a);
  debugGroup.add(leftFlipperDebug, rightFlipperDebug);
  cabinet.add(debugGroup);

  const guideMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd9e4e5, metalness: 0.92, roughness: 0.16, clearcoat: 0.45 });
  [-1, 1].forEach((side) => {
    const guideCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 6.45, 0.73, 6.1),
      new THREE.Vector3(side * 5.8, 0.78, 7.65),
      new THREE.Vector3(side * 4.65, 0.75, 9.2),
    ]);
    const guide = new THREE.Mesh(new THREE.TubeGeometry(guideCurve, 22, 0.09, 8, false), guideMaterial);
    cabinet.add(guide);
    for (let index = 0; index < 3; index += 1) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.76, 10), guideMaterial);
      post.position.set(side * (6.05 - index * 0.63), 0.61, 6.8 + index * 0.86);
      cabinet.add(post);
    }
  });

  const plunger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 2.4, 18),
    new THREE.MeshStandardMaterial({ color: 0xdd7b1f, emissive: 0x4a1400, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.14 }),
  );
  plunger.rotation.x = Math.PI / 2;
  plunger.position.set(round.layout.launch.x, 0.65, 10.55);
  cabinet.add(plunger);

  const springPoints = Array.from({ length: 48 }, (_, index) => {
    const progress = index / 47;
    const angle = progress * Math.PI * 14;
    return new THREE.Vector3(
      round.layout.launch.x + Math.cos(angle) * 0.24,
      0.65 + Math.sin(angle) * 0.24,
      9.55 + progress * 2.1,
    );
  });
  const spring = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 70, 0.045, 6, false),
    new THREE.MeshPhysicalMaterial({ color: 0xe2e8e7, metalness: 1, roughness: 0.12 }),
  );
  cabinet.add(spring);
  const shooterKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 18, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xffad25, emissive: 0x5c2500, emissiveIntensity: 0.32, metalness: 0.58, roughness: 0.16, clearcoat: 1 }),
  );
  shooterKnob.position.set(round.layout.launch.x, 0.65, 12.05);
  cabinet.add(shooterKnob);

  addLabel(scene, round.layout.name.toUpperCase(), new THREE.Vector3(0, 7.05, -12.25), 8.6, "#0de4e1");

  const ballGeometry = new THREE.SphereGeometry(count > 120 ? 0.2 : 0.23, count > 100 ? 8 : 12, count > 100 ? 6 : 9);
  const ballMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.08,
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    vertexColors: true,
  });
  const ballsMesh = new THREE.InstancedMesh(ballGeometry, ballMaterial, count);
  ballsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ballsMesh.castShadow = renderer.shadowMap.enabled;
  round.balls.forEach((assignment, index) => ballsMesh.setColorAt(index, new THREE.Color(assignment.accent)));
  if (ballsMesh.instanceColor) ballsMesh.instanceColor.needsUpdate = true;
  cabinet.add(ballsMesh);

  const ballGlowPositions = new Float32Array(count * 3);
  const ballGlowColors = new Float32Array(count * 3);
  round.balls.forEach((assignment, index) => {
    const color = new THREE.Color(assignment.accent);
    ballGlowColors[index * 3] = color.r;
    ballGlowColors[index * 3 + 1] = color.g;
    ballGlowColors[index * 3 + 2] = color.b;
  });
  const ballGlowGeometry = new THREE.BufferGeometry();
  ballGlowGeometry.setAttribute("position", new THREE.BufferAttribute(ballGlowPositions, 3));
  ballGlowGeometry.setAttribute("color", new THREE.BufferAttribute(ballGlowColors, 3));
  const ballGlows = new THREE.Points(
    ballGlowGeometry,
    new THREE.PointsMaterial({
      size: count > 100 ? 0.54 : 0.76,
      sizeAttenuation: true,
      map: createBallGlowTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  ballGlows.renderOrder = 8;
  cabinet.add(ballGlows);

  const followTrailPointCount = 20;
  const followTrailPositions = new Float32Array(followTrailPointCount * 3);
  const followTrailGeometry = new THREE.BufferGeometry();
  followTrailGeometry.setAttribute("position", new THREE.BufferAttribute(followTrailPositions, 3));
  const followTrail = new THREE.Line(
    followTrailGeometry,
    new THREE.LineBasicMaterial({ color: 0x69fff8, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  followTrail.visible = false;
  followTrail.renderOrder = 9;
  cabinet.add(followTrail);

  const winnerCrowns = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.25, 0.24, 5, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffc52f, emissive: 0x8f4e00, emissiveIntensity: 1.35, metalness: 0.72, roughness: 0.2 }),
    count,
  );
  winnerCrowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  winnerCrowns.frustumCulled = false;
  cabinet.add(winnerCrowns);

  batchStaticMeshes(scene, [
    ...(animateDecorations ? [backbox, ...bumperGroups, tower, jackpotGroup, finishGate] : []),
    ...spinnerGroups,
    finishHalo,
    leftFlipper,
    rightFlipper,
    debugGroup,
    plunger,
    ballsMesh,
    winnerCrowns,
  ]);

  const runtime = round.balls.map((assignment) => ({
    physics: createPinballPhysicsBall(assignment, round.layout),
    respawns: 0,
  } satisfies RuntimeBall));
  const matrix = new THREE.Matrix4();
  const matrixPosition = new THREE.Vector3();
  const matrixQuaternion = new THREE.Quaternion();
  const matrixEuler = new THREE.Euler();
  const matrixScale = new THREE.Vector3(1, 1, 1);
  const crownMatrix = new THREE.Matrix4();
  const crownPosition = new THREE.Vector3();
  const crownQuaternion = new THREE.Quaternion();
  const crownScale = new THREE.Vector3(0.72, 0.72, 0.72);
  const flippers: PinballFlipperState = { left: false, right: false };
  const automaticFlippers: PinballFlipperState = { left: false, right: false };
  const openFlippers: PinballFlipperState = { left: false, right: false };
  const manualLaunchOrder = round.balls.map((_, index) => index);
  const presentationColumns = Math.max(2, Math.ceil(Math.sqrt(count * 1.18)));
  const presentationRows = Math.ceil(count / presentationColumns);
  const presentationSpacing = count > 150 ? 0.4 : count > 90 ? 0.45 : count > 48 ? 0.52 : 0.62;
  const spinnerAngles = new Array<number>(spinnerGroups.length).fill(0);
  const physicsFlippers: PinballFlipperState = { left: false, right: false, leftAngle: 0, rightAngle: 0 };
  let running = false;
  let disposed = false;
  let finished = false;
  let startedAt = 0;
  let previousFrame = performance.now();
  let frameRequest = 0;
  let nextManualIndex = 0;
  let totalCollisions = 0;
  let finishStartedAt = 0;
  let finishIndex = -1;
  let lastStatsAt = 0;
  let fpsFrames = 0;
  let fpsWindowAt = performance.now();
  let fps = 60;
  let qualityScale = 1;
  let lowFpsWindows = 0;
  let highFpsWindows = 0;
  let lastRenderedAt = 0;
  let shadowReady = false;
  let followedBallIndex = -1;
  let followCameraPrimed = false;

  const launchAt = (index: number) => {
    const item = runtime[index];
    if (!item || item.physics.launched) return false;
    launchPinballPhysicsBall(item.physics, round.balls[index], round.layout);
    plunger.position.z = 10.15;
    return true;
  };

  const launchAllRemaining = () => {
    let launched = 0;
    while (nextManualIndex < count) {
      if (launchAt(manualLaunchOrder[nextManualIndex])) launched += 1;
      nextManualIndex += 1;
    }
    return launched;
  };

  const launchBurst = () => {
    if (!running || round.controlMode !== "manual" || performance.now() - startedAt < cameraIntroMs) return 0;
    return launchAllRemaining();
  };

  const renderFrame = (now: number) => {
    if (disposed) return;
    const idleFrameInterval = !running || finished ? 50 : 0;
    if (document.hidden) {
      previousFrame = now;
      fpsWindowAt = now;
      fpsFrames = 0;
      frameRequest = requestAnimationFrame(renderFrame);
      return;
    }
    if (idleFrameInterval > 0 && lastRenderedAt > 0 && now - lastRenderedAt < idleFrameInterval) {
      frameRequest = requestAnimationFrame(renderFrame);
      return;
    }
    lastRenderedAt = now;
    const delta = Math.min(0.034, Math.max(0, (now - previousFrame) / 1000));
    previousFrame = now;
    fpsFrames += 1;
    if (now - fpsWindowAt >= 700) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsWindowAt));
      fpsFrames = 0;
      fpsWindowAt = now;
      if (running && !finished && now - startedAt > 1_200) {
        lowFpsWindows = fps < 48 ? lowFpsWindows + 1 : 0;
        highFpsWindows = fps > 57 ? highFpsWindows + 1 : 0;
      }
      if (lowFpsWindows >= 2 && qualityScale > 0.68) {
        qualityScale = qualityScale > 0.9 ? 0.82 : 0.68;
        renderer.setPixelRatio(Math.max(0.65, maximumPixelRatio * qualityScale));
        canvas.dataset.renderQuality = qualityScale < 0.75 ? "performance" : "balanced";
        resize();
        lowFpsWindows = 0;
        highFpsWindows = 0;
      } else if (highFpsWindows >= 7 && qualityScale < 1) {
        qualityScale = qualityScale < 0.8 ? 0.82 : 1;
        renderer.setPixelRatio(maximumPixelRatio * qualityScale);
        canvas.dataset.renderQuality = qualityScale === 1 ? "high" : "balanced";
        resize();
        lowFpsWindows = 0;
        highFpsWindows = 0;
      }
    }

    const elapsed = running ? now - startedAt : 0;
    const gameplayElapsed = Math.max(0, elapsed - cameraIntroMs);
    if (running && elapsed >= cameraIntroMs && round.controlMode === "automatic" && nextManualIndex < count) {
      launchAllRemaining();
    }
    if (running && round.controlMode === "manual" && gameplayElapsed >= 4200 && nextManualIndex < count) {
      launchAllRemaining();
    }

    if (running && round.controlMode === "automatic") {
      let approachingLeft = false;
      let approachingRight = false;
      for (let index = 0; index < runtime.length; index += 1) {
        const physics = runtime[index].physics;
        if (!physics.launched || physics.drained || physics.z <= 6.2 || physics.z >= 9.45 || physics.vz <= 0) continue;
        if (physics.x <= -0.62) approachingLeft = true;
        if (physics.x >= 0.62) approachingRight = true;
      }
      const pulseOpen = Math.floor(gameplayElapsed / 145) % 4 === 0;
      automaticFlippers.left = approachingLeft && !pulseOpen;
      automaticFlippers.right = approachingRight && !pulseOpen;
    }
    const overtimeActive = running && gameplayElapsed >= round.overtimeAfterMs;
    const effectiveFlippers = overtimeActive
      ? openFlippers
      : round.controlMode === "automatic" ? automaticFlippers : flippers;
    const leftTarget = effectiveFlippers.left ? PINBALL_FLIPPERS.left.activeAngle : PINBALL_FLIPPERS.left.restAngle;
    const rightTarget = effectiveFlippers.right ? PINBALL_FLIPPERS.right.activeAngle : PINBALL_FLIPPERS.right.restAngle;
    const flipperBlend = reducedMotion ? 1 : 0.32;
    leftFlipper.rotation.y += (leftTarget - leftFlipper.rotation.y) * flipperBlend;
    rightFlipper.rotation.y += (rightTarget - rightFlipper.rotation.y) * flipperBlend;
    physicsFlippers.left = effectiveFlippers.left;
    physicsFlippers.right = effectiveFlippers.right;
    physicsFlippers.leftAngle = leftFlipper.rotation.y;
    physicsFlippers.rightAngle = rightFlipper.rotation.y;
    if (!reducedMotion) {
      spinnerGroups.forEach((spinner, index) => {
        spinner.rotation.y += delta * (1.2 + index * 0.35);
      });
    }
    spinnerGroups.forEach((spinner, index) => { spinnerAngles[index] = spinner.rotation.y; });
    const physicsFrame = running && !finishStartedAt
      ? createPinballPhysicsFrame(round.layout, delta, physicsFlippers, spinnerAngles)
      : null;

    let launchedCount = 0;
    let activeCount = 0;
    let crossingIndex = -1;
    let earliestCrossing = Number.POSITIVE_INFINITY;
    runtime.forEach((item, index) => {
      const physics = item.physics;
      if (physics.launched) launchedCount += 1;
      if (running && !finishStartedAt && physics.launched && !physics.drained) {
        activeCount += 1;
        const previousX = physics.x;
        const previousZ = physics.z;
        if (overtimeActive) {
          physics.vx += (round.layout.finishGate.x - physics.x) * delta * 10;
          physics.vz += 12 * delta;
        }
        const impacts = stepPinballPhysics(physics, round.layout, delta, physicsFlippers, spinnerAngles, physicsFrame ?? undefined);
        const crossing = getPinballFinishCrossing(previousX, previousZ, physics.x, physics.z, round.layout.finishGate);
        if (crossing !== null) {
          const launchedAfterStep = nextManualIndex >= count ? count : launchedCount;
          if (!canConfirmPinballFinish(launchedAfterStep, count)) {
            launchAllRemaining();
          } else if (
            index === round.selectedIndex
            && (crossing < earliestCrossing || (crossing === earliestCrossing && index < crossingIndex))
          ) {
            earliestCrossing = crossing;
            crossingIndex = index;
          }
        }
        if (impacts > 0) {
          totalCollisions += impacts;
          bumperGroups.forEach((bumper, bumperIndex) => {
            const target = round.layout.bumpers[bumperIndex];
            if (Math.hypot(physics.x - target.x, physics.z - target.z) < target.radius + 0.55) bumper.userData.pulse = 1;
          });
          if (totalCollisions % 3 === 0) events.onImpact?.(Math.min(1, Math.hypot(physics.vx, physics.vz) / 16));
        }
      }
      if (running && physics.drained && !finishStartedAt) {
        if (!physics.respawnAtMs) physics.respawnAtMs = now + 420 + (index % 7) * 35;
        if (now >= physics.respawnAtMs) {
          item.respawns += 1;
          launchPinballPhysicsBall(physics, round.balls[index], round.layout);
        }
      }
    });

    if (
      crossingIndex < 0
      && !finishStartedAt
      && canConfirmPinballFinish(launchedCount, count)
      && gameplayElapsed >= round.overtimeAfterMs + 4_000
    ) {
      crossingIndex = round.selectedIndex;
    }

    if (crossingIndex >= 0 && !finishStartedAt) {
      finishIndex = crossingIndex;
      finishStartedAt = now;
      const finalist = runtime[finishIndex].physics;
      finalist.x = round.layout.finishGate.x;
      finalist.z = round.layout.finishGate.z + 0.18;
      finalist.vx = 0;
      finalist.vz = 1.7;
      finishHalo.visible = true;
      finishBeam.material.opacity = 1;
    }
    if (finishStartedAt && !finished) {
      const progress = Math.min(1, (now - finishStartedAt) / (reducedMotion ? 360 : 1150));
      const finalist = runtime[finishIndex].physics;
      const ease = 1 - Math.pow(1 - progress, 3);
      finalist.x += (round.layout.drain.x - finalist.x) * (0.04 + ease * 0.12);
      finalist.z += (round.layout.drain.z - finalist.z) * (0.035 + ease * 0.1);
      finishHalo.position.set(finalist.x, 0.76, finalist.z);
      finishHalo.scale.setScalar(reducedMotion ? 1.25 : 1 + Math.sin(now * 0.018) * 0.2 + ease * 0.35);
      finishHalo.material.opacity = reducedMotion ? 0.72 : 0.45 + Math.sin(now * 0.02) * 0.2;
      jackpotGroup.scale.setScalar(reducedMotion ? 1.08 : 1 + Math.sin(now * 0.014) * 0.08);
      if (progress >= 1) {
        finished = true;
        events.onFinish?.(
          round.balls[finishIndex],
          round.drawMode === "direct" ? "PRIMERO EN LA META" : "PRIMERO EN CAER",
        );
      }
    }

    const presentationActive = !running || elapsed < cameraIntroMs;
    runtime.forEach(({ physics }, index) => {
      const hidden = !presentationActive && (!physics.launched || (physics.drained && index !== finishIndex));
      if (presentationActive) {
        const column = index % presentationColumns;
        const row = Math.floor(index / presentationColumns);
        matrixPosition.set(
          (column - (presentationColumns - 1) / 2) * presentationSpacing,
          0.76,
          5.9 + (row - (presentationRows - 1) / 2) * presentationSpacing,
        );
      } else {
        matrixPosition.set(physics.x, hidden ? -4 : 0.72, physics.z);
      }
      matrixEuler.set(physics.z * 0.25, physics.x * 0.4, now * 0.0005);
      matrixQuaternion.setFromEuler(matrixEuler);
      matrix.compose(
        matrixPosition,
        matrixQuaternion,
        matrixScale,
      );
      ballsMesh.setMatrixAt(index, matrix);
      ballGlowPositions[index * 3] = matrixPosition.x;
      ballGlowPositions[index * 3 + 1] = hidden ? -20 : matrixPosition.y;
      ballGlowPositions[index * 3 + 2] = matrixPosition.z;
      if (round.balls[index].previousWinner && !hidden) {
        crownPosition.copy(matrixPosition).setY(matrixPosition.y + 0.48);
        crownMatrix.compose(crownPosition, crownQuaternion, crownScale);
      } else {
        crownMatrix.compose(crownPosition.set(0, -20, 0), crownQuaternion, crownScale.setScalar(0.001));
        crownScale.setScalar(0.72);
      }
      winnerCrowns.setMatrixAt(index, crownMatrix);
    });
    ballsMesh.instanceMatrix.needsUpdate = true;
    (ballGlowGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    winnerCrowns.instanceMatrix.needsUpdate = true;

    plunger.position.z += (10.55 - plunger.position.z) * 0.2;
    if (animateDecorations) {
      bumperGroups.forEach((bumper, index) => {
        bumper.userData.pulse *= 0.86;
        const scale = 1 + bumper.userData.pulse * 0.22 + (reducedMotion ? 0 : Math.sin(now * 0.0025 + index) * 0.018);
        bumper.scale.setScalar(scale);
      });
      if (!reducedMotion) {
        tower.rotation.y = Math.sin(now * 0.00055) * 0.16;
        towerCrown.rotation.z += delta * 1.4;
        backbox.rotation.y = Math.sin(now * 0.00022) * 0.006;
        jackpotGroup.rotation.y += delta * 0.55;
      }
      finishGate.scale.setScalar(finishStartedAt && !reducedMotion ? 1 + Math.sin(now * 0.021) * 0.055 : 1);
      finishBeam.material.opacity = finishStartedAt
        ? reducedMotion ? 0.88 : 0.72 + Math.sin(now * 0.025) * 0.25
        : reducedMotion ? 0.62 : 0.5 + Math.sin(now * 0.006) * 0.22;
    }

    if (debugCollidersEnabled) {
      updateDebugSegment(leftFlipperDebug, getPinballFlipperCollider("left", leftFlipper.rotation.y));
      updateDebugSegment(rightFlipperDebug, getPinballFlipperCollider("right", rightFlipper.rotation.y));
      spinnerDebugLines.forEach((line, index) => {
        const spinner = round.layout.spinners[index];
        const angle = spinnerGroups[index].rotation.y;
        const halfLength = spinner.length / 2;
        const axisX = Math.cos(angle) * halfLength;
        const axisZ = -Math.sin(angle) * halfLength;
        updateDebugSegment(line, {
          id: spinner.id,
          start: { x: spinner.x - axisX, z: spinner.z - axisZ },
          end: { x: spinner.x + axisX, z: spinner.z + axisZ },
          radius: 0.14,
        });
      });
    }

    if (running && now - lastStatsAt > (count > 100 ? 400 : 280)) {
      events.onStats?.({
        launched: launchedCount,
        active: activeCount,
        collisions: totalCollisions,
        fps,
        renderCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      });
      lastStatsAt = now;
    }
    const followIndex = followedBallIndex;
    const followedPhysics = followIndex >= 0 ? runtime[followIndex].physics : null;
    const followActive = Boolean(
      running
      && elapsed >= cameraIntroMs
      && followedPhysics?.launched
      && (!followedPhysics.drained || followIndex === finishIndex),
    );
    if (followActive && followedPhysics) {
      followDirection.set(followedPhysics.vx, 0, followedPhysics.vz);
      if (followDirection.lengthSq() < 0.04) followDirection.set(0, 0, -1);
      else followDirection.normalize();
      const followedSpeed = Math.hypot(followedPhysics.vx, followedPhysics.vz);
      const speedBlend = THREE.MathUtils.clamp(followedSpeed / 9, 0, 1);
      if (!followCameraPrimed) {
        for (let trailIndex = 0; trailIndex < followTrailPointCount; trailIndex += 1) {
          followTrailPositions[trailIndex * 3] = followedPhysics.x;
          followTrailPositions[trailIndex * 3 + 1] = 0.73;
          followTrailPositions[trailIndex * 3 + 2] = followedPhysics.z;
        }
      } else {
        followTrailPositions.copyWithin(0, 3);
        const trailOffset = (followTrailPointCount - 1) * 3;
        followTrailPositions[trailOffset] = followedPhysics.x;
        followTrailPositions[trailOffset + 1] = 0.73;
        followTrailPositions[trailOffset + 2] = followedPhysics.z;
      }
      (followTrailGeometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      followTrail.visible = true;
      followCameraPosition.set(followedPhysics.x, 2.75 + speedBlend * 0.72, followedPhysics.z)
        .addScaledVector(followDirection, -(2.25 + speedBlend * 0.95));
      followCameraLookTarget.set(followedPhysics.x, 0.76, followedPhysics.z)
        .addScaledVector(followDirection, 1.3 + speedBlend * 1.35);
      followCameraUp.set(THREE.MathUtils.clamp(-followedPhysics.vx * 0.014, -0.13, 0.13), 1, 0).normalize();
      if (!followCameraPrimed) {
        camera.position.copy(followCameraPosition);
        cameraTarget.copy(followCameraLookTarget);
        camera.up.copy(followCameraUp);
      } else {
        const cameraResponse = reducedMotion ? 1 : 1 - Math.exp(-delta * 7.4);
        camera.position.lerp(followCameraPosition, cameraResponse);
        cameraTarget.lerp(followCameraLookTarget, Math.min(1, cameraResponse * 1.2));
        camera.up.lerp(followCameraUp, cameraResponse * 0.7).normalize();
      }
      const desiredFollowFov = 57 + speedBlend * 9;
      if (Math.abs(camera.fov - desiredFollowFov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFollowFov, reducedMotion ? 1 : 0.16);
        camera.updateProjectionMatrix();
      }
      followCameraPrimed = true;
      const cameraMode = `ball-${round.balls[followIndex].participant.id}`;
      if (canvas.dataset.cameraMode !== cameraMode) canvas.dataset.cameraMode = cameraMode;
      canvas.dataset.cameraStyle = "predictive-ball-follow";
    } else {
      followTrail.visible = false;
      const cameraBlend = running ? reducedMotion ? 1 : smoothstep(elapsed / cameraIntroMs) : 0;
      camera.position.lerpVectors(presentationCameraPosition, overviewCameraPosition, cameraBlend);
      cameraTarget.lerpVectors(presentationCameraTarget, overviewCameraTarget, cameraBlend);
      const overviewFov = THREE.MathUtils.lerp(37, 32, cameraBlend);
      if (Math.abs(camera.fov - overviewFov) > 0.001) {
        camera.fov = overviewFov;
        camera.updateProjectionMatrix();
      }
      camera.up.copy(THREE.Object3D.DEFAULT_UP);
      followCameraPrimed = false;
      if (canvas.dataset.cameraMode !== "overview") canvas.dataset.cameraMode = "overview";
      canvas.dataset.cameraStyle = "overview";
    }
    camera.lookAt(cameraTarget);
    if (renderer.shadowMap.enabled && !shadowReady) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    if (renderer.shadowMap.enabled && !shadowReady) {
      renderer.shadowMap.autoUpdate = false;
      shadowReady = true;
    }
    frameRequest = requestAnimationFrame(renderFrame);
  };

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  frameRequest = requestAnimationFrame(renderFrame);

  return {
    start: () => {
      if (running) return;
      running = true;
      startedAt = performance.now();
      previousFrame = startedAt;
    },
    launchBurst,
    setFollowBall: (ballId) => {
      followedBallIndex = ballId ? round.balls.findIndex((assignment) => assignment.id === ballId) : -1;
      followCameraPrimed = false;
    },
    setFlippers: (left, right) => {
      flippers.left = left;
      flippers.right = right;
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameRequest);
      resizeObserver.disconnect();
      disposeObject(scene);
      environmentTexture.dispose();
      environmentGenerator.dispose();
      renderer.dispose();
    },
  };
};
