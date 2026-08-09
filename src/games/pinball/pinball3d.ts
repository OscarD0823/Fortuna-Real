import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  createPinballRandom,
  createPinballPhysicsBall,
  launchPinballPhysicsBall,
  stepPinballPhysics,
  type PreparedPinballRound,
  type PinballFlipperState,
  type PinballPhysicsBall,
} from "./pinballEngine";

export interface PinballSceneStats {
  launched: number;
  active: number;
  collisions: number;
  fps: number;
}

export interface PinballSceneEvents {
  onStats?: (stats: PinballSceneStats) => void;
  onImpact?: (strength: number) => void;
  onFinish?: (label: string) => void;
}

export interface PinballSceneController {
  start: () => void;
  launchBurst: () => number;
  setFlippers: (left: boolean, right: boolean) => void;
  dispose: () => void;
}

interface RuntimeBall {
  physics: PinballPhysicsBall;
  respawns: number;
}

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if ("map" in material && material.map instanceof THREE.Texture) material.map.dispose();
      material.dispose();
    });
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
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: count <= 90,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = count <= 80;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, count > 120 ? 1 : 1.35));

  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTexture = environmentGenerator.fromScene(new RoomEnvironment(), 0.03).texture;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01070b);
  scene.fog = new THREE.FogExp2(0x01070b, 0.018);
  scene.environment = environmentTexture;

  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 90);
  camera.position.set(0, 27.8, 29.5);
  camera.lookAt(0, 1.05, -1.7);

  scene.add(new THREE.HemisphereLight(0x80eaff, 0x120805, 1.8));
  const keyLight = new THREE.DirectionalLight(0xffd37b, 3.3);
  keyLight.position.set(-8, 18, 6);
  keyLight.castShadow = renderer.shadowMap.enabled;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  const cyanLight = new THREE.PointLight(0x00e4e0, 26, 30, 2);
  cyanLight.position.set(5, 5, -4);
  scene.add(cyanLight);
  const goldLight = new THREE.PointLight(0xffa91f, 22, 26, 2);
  goldLight.position.set(-5, 4, 5);
  scene.add(goldLight);

  const cabinet = new THREE.Group();
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

  const targetBankA = createTargetBank(4, rampAccentA);
  targetBankA.position.set(-3.25, 0.82, 1.65);
  targetBankA.rotation.x = -0.16;
  targetBankA.rotation.y = 0.3;
  cabinet.add(targetBankA);
  const targetBankB = createTargetBank(3, rampAccentB);
  targetBankB.position.set(3.3, 0.82, -2.5);
  targetBankB.rotation.x = -0.16;
  targetBankB.rotation.y = -0.38;
  cabinet.add(targetBankB);

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

  const drain = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.15, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xe53627, emissiveIntensity: 0.8 }),
  );
  drain.position.set(round.layout.drain.x, 0.3, round.layout.drain.z);
  cabinet.add(drain);

  const createFlipper = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 2.55, 0.64, 8.55);
    const pivotCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, 0.24, 18),
      new THREE.MeshPhysicalMaterial({ color: 0xd9e1dc, metalness: 0.75, roughness: 0.18, clearcoat: 0.6 }),
    );
    pivotCap.position.y = -0.1;
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 2.15, 6, 14),
      new THREE.MeshStandardMaterial({ color: side < 0 ? 0x09dedb : 0xf4ac24, emissive: side < 0 ? 0x036c70 : 0x6d3100, emissiveIntensity: 1.1, metalness: 0.67, roughness: 0.2 }),
    );
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = side < 0 ? 1.05 : -1.05;
    const rubber = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 2.08, 5, 14),
      new THREE.MeshStandardMaterial({ color: side < 0 ? 0x89ffff : 0xffe096, emissive: side < 0 ? 0x0a5558 : 0x5d3906, emissiveIntensity: 0.25, roughness: 0.48 }),
    );
    rubber.rotation.z = Math.PI / 2;
    rubber.position.set(side < 0 ? 1.05 : -1.05, -0.08, 0);
    rubber.scale.set(1.03, 1.03, 0.78);
    pivot.rotation.y = side < 0 ? -0.28 : 0.28;
    pivot.add(pivotCap, rubber, mesh);
    cabinet.add(pivot);
    return pivot;
  };
  const leftFlipper = createFlipper(-1);
  const rightFlipper = createFlipper(1);

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

  const runtime = round.balls.map((assignment) => ({
    physics: createPinballPhysicsBall(assignment, round.layout),
    respawns: 0,
  } satisfies RuntimeBall));
  const selectedIndex = round.balls.findIndex((ball) => ball.id === round.selected.id);
  const matrix = new THREE.Matrix4();
  const flippers: PinballFlipperState = { left: false, right: false };
  let running = false;
  let disposed = false;
  let finished = false;
  let startedAt = 0;
  let previousFrame = performance.now();
  let frameRequest = 0;
  let nextManualIndex = 0;
  let totalCollisions = 0;
  let resolutionStartedAt = 0;
  let lastStatsAt = 0;
  let fpsFrames = 0;
  let fpsWindowAt = performance.now();
  let fps = 60;
  let automaticLeft = false;
  let automaticRight = false;

  const launchAt = (index: number) => {
    const item = runtime[index];
    if (!item || item.physics.launched) return false;
    launchPinballPhysicsBall(item.physics, round.balls[index], round.layout);
    plunger.position.z = 10.15;
    return true;
  };

  const launchBurst = () => {
    if (!running || round.controlMode !== "manual") return 0;
    const burst = Math.min(20, Math.max(1, Math.ceil(count / 10)));
    let launched = 0;
    while (nextManualIndex < count && launched < burst) {
      if (launchAt(nextManualIndex)) launched += 1;
      nextManualIndex += 1;
    }
    return launched;
  };

  const renderFrame = (now: number) => {
    if (disposed) return;
    const delta = Math.min(0.034, Math.max(0, (now - previousFrame) / 1000));
    previousFrame = now;
    fpsFrames += 1;
    if (now - fpsWindowAt >= 700) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsWindowAt));
      fpsFrames = 0;
      fpsWindowAt = now;
    }

    const elapsed = running ? now - startedAt : 0;
    if (running && round.controlMode === "automatic") {
      round.balls.forEach((assignment, index) => {
        if (elapsed >= assignment.launchDelayMs) launchAt(index);
      });
    }

    if (running && round.controlMode === "automatic") {
      const approaching = runtime.filter(({ physics }) => physics.launched && !physics.drained && physics.z > 6.2);
      automaticLeft = approaching.some(({ physics }) => physics.x <= 0);
      automaticRight = approaching.some(({ physics }) => physics.x > 0);
    }
    const effectiveFlippers = round.controlMode === "automatic"
      ? { left: automaticLeft, right: automaticRight }
      : flippers;

    let launchedCount = 0;
    let activeCount = 0;
    runtime.forEach((item, index) => {
      const physics = item.physics;
      if (physics.launched) launchedCount += 1;
      if (running && physics.launched && !physics.drained) {
        activeCount += 1;
        const impacts = stepPinballPhysics(physics, round.layout, delta, effectiveFlippers);
        if (impacts > 0) {
          totalCollisions += impacts;
          bumperGroups.forEach((bumper, bumperIndex) => {
            const target = round.layout.bumpers[bumperIndex];
            if (Math.hypot(physics.x - target.x, physics.z - target.z) < target.radius + 0.55) bumper.userData.pulse = 1;
          });
          if (totalCollisions % 3 === 0) events.onImpact?.(Math.min(1, Math.hypot(physics.vx, physics.vz) / 16));
        }
      }
      if (running && physics.drained && index !== selectedIndex && !resolutionStartedAt) {
        if (!physics.respawnAtMs) physics.respawnAtMs = now + 420 + (index % 7) * 35;
        if (now >= physics.respawnAtMs) {
          item.respawns += 1;
          launchPinballPhysicsBall(physics, round.balls[index], round.layout);
        }
      }
    });

    const allLaunched = launchedCount === count;
    if (running && !resolutionStartedAt) {
      const automaticReady = round.controlMode === "automatic" && allLaunched && elapsed >= round.revealAfterMs - 1450;
      const manualReady = round.controlMode === "manual" && allLaunched && elapsed >= Math.min(4200, round.revealAfterMs - 1450);
      if (automaticReady || manualReady) resolutionStartedAt = now;
    }
    if (resolutionStartedAt && !finished) {
      const progress = Math.min(1, (now - resolutionStartedAt) / 1450);
      const selected = runtime[selectedIndex].physics;
      if (!selected.launched || selected.drained) launchPinballPhysicsBall(selected, round.selected, round.layout);
      const destination = round.drawMode === "direct" ? round.layout.jackpot : round.layout.drain;
      const ease = 1 - Math.pow(1 - progress, 3);
      selected.x += (destination.x - selected.x) * Math.min(1, 0.035 + ease * 0.14);
      selected.z += (destination.z - selected.z) * Math.min(1, 0.035 + ease * 0.14);
      selected.vx *= 0.82;
      selected.vz *= 0.82;
      jackpotGroup.scale.setScalar(round.drawMode === "direct" ? 1 + Math.sin(now * 0.014) * 0.12 : 1);
      if (progress >= 1) {
        finished = true;
        events.onFinish?.(round.drawMode === "direct" ? "JACKPOT REAL" : "POZO DE ELIMINACIÓN");
      }
    }

    runtime.forEach(({ physics }, index) => {
      const hidden = !physics.launched || (physics.drained && index !== selectedIndex);
      matrix.compose(
        new THREE.Vector3(physics.x, hidden ? -4 : 0.72, physics.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(physics.z * 0.25, physics.x * 0.4, now * 0.0005)),
        new THREE.Vector3(1, 1, 1),
      );
      ballsMesh.setMatrixAt(index, matrix);
    });
    ballsMesh.instanceMatrix.needsUpdate = true;

    const leftTarget = effectiveFlippers.left ? 0.48 : -0.28;
    const rightTarget = effectiveFlippers.right ? -0.48 : 0.28;
    leftFlipper.rotation.y += (leftTarget - leftFlipper.rotation.y) * 0.32;
    rightFlipper.rotation.y += (rightTarget - rightFlipper.rotation.y) * 0.32;
    plunger.position.z += (10.55 - plunger.position.z) * 0.2;
    bumperGroups.forEach((bumper, index) => {
      bumper.userData.pulse *= 0.86;
      const scale = 1 + bumper.userData.pulse * 0.22 + Math.sin(now * 0.0025 + index) * 0.018;
      bumper.scale.setScalar(scale);
    });
    spinnerGroups.forEach((spinner, index) => {
      spinner.rotation.y += delta * (1.2 + index * 0.35);
    });
    tower.rotation.y = Math.sin(now * 0.00055) * 0.16;
    towerCrown.rotation.z += delta * 1.4;
    backbox.rotation.y = Math.sin(now * 0.00022) * 0.006;
    jackpotGroup.rotation.y += delta * 0.55;

    if (now - lastStatsAt > 260) {
      events.onStats?.({ launched: launchedCount, active: activeCount, collisions: totalCollisions, fps });
      lastStatsAt = now;
    }
    renderer.render(scene, camera);
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
