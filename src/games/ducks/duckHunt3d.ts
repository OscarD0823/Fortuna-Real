import * as THREE from "three";
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
  shoot: (clientX: number, clientY: number) => DuckShotTarget;
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
}

const RESET_DURATION = 2050;
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const tempWingColor = new THREE.Color();
const duckHeadColor = new THREE.Color("#197c55");
const duckHitBodyColor = new THREE.Color("#ff9f28");
const duckHitHeadColor = new THREE.Color("#ffcc4d");
const duckWhite = new THREE.Color("#e8f4dc");

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
  let contestants = [...initialContestants];
  let running = false;
  let hasStarted = false;
  let runStartedAt = 0;
  let disposed = false;
  let formationNonce = 0;
  let resetState: ResetState | null = null;
  let statsStartedAt = performance.now();
  let frames = 0;
  let labelSprite: THREE.Sprite | null = null;
  let labelTexture: THREE.Texture | null = null;
  let shotFlashUntil = 0;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: initialContestants.length <= 90,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, initialContestants.length > 120 ? 1.25 : 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = initialContestants.length <= 70;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#071927");
  scene.fog = new THREE.FogExp2("#071927", 0.022);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
  const overviewCameraPosition = new THREE.Vector3(0, 7.6, 21.5);
  const overviewCameraTarget = new THREE.Vector3(0, 3.6, 0);
  const readyCameraPosition = initialContestants.length > 120
    ? new THREE.Vector3(0, 6.1, 17.4)
    : initialContestants.length > 60
      ? new THREE.Vector3(0, 5.7, 15.2)
      : new THREE.Vector3(0, 4.6, 11.8);
  const readyCameraTarget = new THREE.Vector3(0, 1.75, 0.5);
  const cameraTarget = new THREE.Vector3();
  camera.position.copy(readyCameraPosition);
  camera.lookAt(readyCameraTarget);

  scene.add(new THREE.HemisphereLight("#bfeeff", "#172509", 2.2));
  const sun = new THREE.DirectionalLight("#fff0c2", 3.8);
  sun.position.set(-8, 13, 8);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 13;
  sun.shadow.camera.bottom = -8;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 28),
    new THREE.MeshStandardMaterial({ color: "#142817", roughness: 0.96, metalness: 0.02 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -2);
  ground.receiveShadow = true;
  scene.add(ground);

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

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(45, 15),
    new THREE.MeshBasicMaterial({ color: "#0d3444", fog: true }),
  );
  horizon.position.set(0, 6.5, -10.5);
  scene.add(horizon);

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 40),
    new THREE.MeshBasicMaterial({ color: "#ffd77a", transparent: true, opacity: 0.88, fog: false }),
  );
  moon.position.set(-8.8, 8.2, -9.9);
  scene.add(moon);

  const cloudCount = 18;
  const clouds = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.72, 9, 6),
    new THREE.MeshBasicMaterial({ color: "#8ab9c1", transparent: true, opacity: 0.14, fog: true }),
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

  const treeCount = 42;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.13, 0.22, 2.6, 6),
    new THREE.MeshStandardMaterial({ color: "#3a2b1b", roughness: 1 }),
    treeCount,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.05, 3.1, 7),
    new THREE.MeshStandardMaterial({ color: "#0a3b27", roughness: 0.93 }),
    treeCount,
  );
  for (let index = 0; index < treeCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const x = side * (7.6 + (row % 6) * 1.5) + Math.sin(index * 3.1) * 0.65;
    const z = -7.4 + (row % 4) * 1.35;
    const height = 0.78 + (index % 5) * 0.09;
    setInstanceTransform(trunks, index, new THREE.Vector3(x, 1.25 * height, z), new THREE.Euler(), new THREE.Vector3(1, height, 1));
    setInstanceTransform(crowns, index, new THREE.Vector3(x, 3.05 * height, z), new THREE.Euler(), new THREE.Vector3(1, height, 1));
  }
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  scene.add(trunks, crowns);

  const body = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.55, 12, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04 }),
    maxCount,
  );
  const head = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.35, 10, 8),
    new THREE.MeshStandardMaterial({ roughness: 0.48 }),
    maxCount,
  );
  const wingGeometry = new THREE.SphereGeometry(0.46, 9, 6);
  const wingMaterial = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const leftWing = new THREE.InstancedMesh(wingGeometry, wingMaterial, maxCount);
  const rightWing = new THREE.InstancedMesh(wingGeometry, wingMaterial, maxCount);
  const beak = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.16, 0.52, 7),
    new THREE.MeshStandardMaterial({ color: "#ffac2f", roughness: 0.55 }),
    maxCount,
  );
  const eye = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.055, 7, 5),
    new THREE.MeshBasicMaterial({ color: "#eaffff" }),
    maxCount,
  );
  const tail = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.24, 0.58, 7),
    new THREE.MeshStandardMaterial({ roughness: 0.62 }),
    maxCount,
  );
  const neckRing = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.25, 0.055, 5, 10),
    new THREE.MeshBasicMaterial({ color: "#eaf8e4" }),
    maxCount,
  );
  const winnerCrown = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.31, 0.28, 5, 1, true),
    new THREE.MeshStandardMaterial({ color: "#ffc52f", emissive: "#9b5600", emissiveIntensity: 1.3, metalness: 0.7, roughness: 0.22 }),
    maxCount,
  );
  const shields = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.78, 10, 7),
    new THREE.MeshBasicMaterial({ color: "#5df4ff", transparent: true, opacity: 0.24, wireframe: true, depthWrite: false }),
    maxCount,
  );
  const duckMeshes = [body, head, leftWing, rightWing, beak, eye, tail, neckRing, winnerCrown, shields];
  duckMeshes.forEach((mesh) => {
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
  const projected = new THREE.Vector3();

  const hideInstance = (mesh: THREE.InstancedMesh, index: number) => {
    setInstanceTransform(mesh, index, new THREE.Vector3(0, -100, 0), new THREE.Euler(), new THREE.Vector3(0.001, 0.001, 0.001));
  };

  const getFlightPosition = (contestant: DuckContestant, elapsedSeconds: number) => {
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
    return new THREE.Vector3(x, y, z);
  };

  const getGroundPosition = (contestant: DuckContestant) => {
    const angle = contestant.number * 2.399963 + formationNonce * 0.72;
    const radius = 1.4 + Math.sqrt(contestant.number) * 0.47;
    return new THREE.Vector3(Math.cos(angle) * Math.min(8.8, radius), 0.42, Math.sin(angle) * Math.min(4.8, radius * 0.55) + 0.6);
  };

  const removeLabel = () => {
    if (labelSprite) scene.remove(labelSprite);
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

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
    }
    camera.aspect = width / height;
    camera.fov = height < 560 ? 47 : 42;
    camera.updateProjectionMatrix();
  };

  const updateDucks = (now: number) => {
    const elapsedSeconds = now / 1000;
    const resetElapsed = resetState ? now - resetState.startedAt : RESET_DURATION + 1;
    const scaleBase = contestants.length > 150 ? 0.52 : contestants.length > 90 ? 0.61 : contestants.length > 45 ? 0.72 : 0.86;
    currentPositions.clear();
    let visible = 0;

    contestants.forEach((contestant, index) => {
      const shouldHide = contestant.knockedOut && (!resetState || resetElapsed > 1040);
      if (shouldHide) {
        duckMeshes.forEach((mesh) => hideInstance(mesh, index));
        return;
      }
      visible += 1;
      const flight = getFlightPosition(contestant, elapsedSeconds);
      const groundPosition = getGroundPosition(contestant);
      let position = flight;
      if (!running) {
        position = groundPosition.clone();
      } else if (resetState) {
        if (resetElapsed < 720) {
          position = flight.clone().lerp(groundPosition, smoothstep(resetElapsed / 720));
        } else if (resetElapsed < 1120) {
          position = groundPosition.clone();
        } else if (resetElapsed < RESET_DURATION) {
          position = groundPosition.clone().lerp(flight, smoothstep((resetElapsed - 1120) / (RESET_DURATION - 1120)));
        }
      }
      currentPositions.set(contestant.id, position.clone());

      const scale = scaleBase * contestant.profile.scale * (contestant.lives === 1 ? 0.91 : 1);
      const flapAmount = resetState && resetElapsed > 640 && resetElapsed < 1160
        ? 0.12
        : Math.sin(elapsedSeconds * (10.5 + contestant.speed * 2.3) + contestant.profile.phase) * 0.74;
      const yaw = Math.sin(elapsedSeconds * 0.42 * contestant.speed + contestant.profile.phase) * 0.38;
      const rotation = new THREE.Euler(0, yaw, 0);
      const participantColor = tempColor.set(contestant.accent);
      const bodyColor = contestant.id === resetState?.targetId ? duckHitBodyColor : participantColor;
      const wingColor = tempWingColor.copy(bodyColor).lerp(duckWhite, 0.22);
      body.setColorAt(index, bodyColor);
      leftWing.setColorAt(index, wingColor);
      rightWing.setColorAt(index, wingColor);
      tail.setColorAt(index, wingColor);
      head.setColorAt(index, contestant.id === resetState?.targetId ? duckHitHeadColor : duckHeadColor);

      setInstanceTransform(body, index, position, rotation, new THREE.Vector3(1.35, 0.82, 0.78).multiplyScalar(scale));
      const headPosition = position.clone().add(new THREE.Vector3(0.66 * scale, 0.25 * scale, 0));
      setInstanceTransform(head, index, headPosition, rotation, new THREE.Vector3(0.95, 0.95, 0.95).multiplyScalar(scale));
      const wingScale = new THREE.Vector3(1.22, 0.24, 0.72).multiplyScalar(scale);
      setInstanceTransform(leftWing, index, position.clone().add(new THREE.Vector3(0, 0.18 * scale, 0.42 * scale)), new THREE.Euler(flapAmount, yaw, 0.08), wingScale);
      setInstanceTransform(rightWing, index, position.clone().add(new THREE.Vector3(0, 0.18 * scale, -0.42 * scale)), new THREE.Euler(-flapAmount, yaw, -0.08), wingScale);
      setInstanceTransform(beak, index, headPosition.clone().add(new THREE.Vector3(0.38 * scale, -0.03 * scale, 0)), new THREE.Euler(0, 0, -Math.PI / 2), new THREE.Vector3(0.8, 1, 0.8).multiplyScalar(scale));
      setInstanceTransform(eye, index, headPosition.clone().add(new THREE.Vector3(0.22 * scale, 0.12 * scale, 0.27 * scale)), rotation, new THREE.Vector3(1, 1, 1).multiplyScalar(scale));
      setInstanceTransform(tail, index, position.clone().add(new THREE.Vector3(-0.72 * scale, 0.04 * scale, 0)), new THREE.Euler(0, 0, Math.PI / 2), new THREE.Vector3(0.82, 1.05, 0.82).multiplyScalar(scale));
      setInstanceTransform(neckRing, index, position.clone().add(new THREE.Vector3(0.43 * scale, 0.2 * scale, 0)), new THREE.Euler(0, Math.PI / 2 + yaw, 0), new THREE.Vector3(1, 1, 1).multiplyScalar(scale));
      if (contestant.previousWinner) {
        setInstanceTransform(winnerCrown, index, headPosition.clone().add(new THREE.Vector3(0, 0.58 * scale, 0)), new THREE.Euler(0, -yaw, 0), new THREE.Vector3(1, 1, 1).multiplyScalar(scale));
      } else {
        hideInstance(winnerCrown, index);
      }
      if (contestant.shielded) {
        setInstanceTransform(shields, index, position, new THREE.Euler(0, elapsedSeconds * 0.8, 0), new THREE.Vector3(1.15, 0.92, 0.92).multiplyScalar(scale));
      } else {
        hideInstance(shields, index);
      }
    });

    duckMeshes.forEach((mesh) => {
      mesh.count = contestants.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    if (labelSprite && resetState) {
      const targetPosition = currentPositions.get(resetState.targetId);
      if (targetPosition) labelSprite.position.copy(targetPosition).add(new THREE.Vector3(0, 1.1, 0));
      labelSprite.visible = resetElapsed < 1780;
    }
    if (resetState && resetElapsed >= RESET_DURATION) {
      resetState = null;
      removeLabel();
    }
    return visible;
  };

  let animationFrame = 0;
  const render = (now: number) => {
    if (disposed) return;
    resize();
    const visible = updateDucks(now);
    const cameraBlend = hasStarted
      ? running ? smoothstep((now - runStartedAt) / 1650) : 1
      : 0;
    camera.position.lerpVectors(readyCameraPosition, overviewCameraPosition, cameraBlend);
    cameraTarget.lerpVectors(readyCameraTarget, overviewCameraTarget, cameraBlend);
    camera.lookAt(cameraTarget);
    pond.rotation.z = Math.sin(now / 2200) * 0.012;
    const flashMaterial = flash.material as THREE.SpriteMaterial;
    flashMaterial.opacity = shotFlashUntil > now ? Math.max(0, (shotFlashUntil - now) / 120) : 0;
    renderer.render(scene, camera);
    frames += 1;
    if (now - statsStartedAt >= 1000) {
      onStats?.({
        fps: Math.round((frames * 1000) / (now - statsStartedAt)),
        visible,
        renderCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      });
      statsStartedAt = now;
      frames = 0;
    }
    animationFrame = window.requestAnimationFrame(render);
  };
  animationFrame = window.requestAnimationFrame(render);

  return {
    updateContestants(nextContestants) {
      contestants = [...nextContestants];
    },
    setRunning(nextRunning) {
      running = nextRunning;
      if (nextRunning && !hasStarted) {
        hasStarted = true;
        runStartedAt = performance.now();
      }
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
      const radius = contestants.length > 120 ? 24 : contestants.length > 60 ? 29 : 38;
      contestants.forEach((contestant) => {
        if (contestant.knockedOut) return;
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
    resetFlock(targetId, labelOverride) {
      const entropy = new Uint32Array(1);
      crypto.getRandomValues(entropy);
      formationNonce = entropy[0];
      resetState = { startedAt: performance.now(), targetId, nonce: formationNonce };
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
      removeLabel();
      flashTexture?.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    },
  };
};
