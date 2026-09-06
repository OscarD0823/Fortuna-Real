import assert from "node:assert/strict";
import * as THREE from "three";
import { trackFrameQuaternion } from "../src/games/marbles/marbleTrackFrame.ts";
import { constrainCameraSightline, createCameraTrackCollider } from "../src/games/marbles/marbleCameraCollision.ts";
import { cameraPathCeiling, measureCameraPath, offsetCameraProgress } from "../src/games/marbles/marbleCameraPath.ts";
import { getHeldPinballFlippers, getPinballFlipperBlend, pinballKeyControls } from "../src/games/pinball/pinballControls.ts";
import { getDuckWaveCoverAmount, getDuckVisibleTargetCount, getDuckVisualScale, prepareDuckContestants } from "../src/games/ducks/duckHuntEngine.ts";
import { getMarbleMotion, prepareMarbleRace } from "../src/games/marbles/marbleRaceEngine.ts";
import { isGamePlayable } from "../src/core/gameAvailability.ts";
import { pickVisibleDuckInstance } from "../src/games/ducks/duckShotCollision.ts";

const point = (x: number, y = 0, z = 0) => ({ position: { x, y, z } });
for (const length of [20, 100, 600]) {
  const distances = measureCameraPath([point(0), point(length * 0.1), point(length)]);
  const progress = 0.8;
  const startDistance = length * 0.64;
  const offsetProgress = offsetCameraProgress(distances, progress, -5);
  const actualDistance = offsetProgress <= 0.5
    ? offsetProgress * 2 * length * 0.1
    : length * 0.1 + (offsetProgress * 2 - 1) * length * 0.9;
  assert.ok(Math.abs(startDistance - actualDistance - 5) < 1e-9, "El seguimiento debe retroceder cinco metros independientemente del tamaño del circuito.");
  assert.equal(offsetCameraProgress(distances, 0, -5), 0);
  assert.equal(offsetCameraProgress(distances, 1, 5), 1);
}
assert.equal(offsetCameraProgress(measureCameraPath([point(0), point(0)]), 0.5, 8), 0);
assert.equal(cameraPathCeiling([point(-10, 6), point(10, 6)], 0, 0, 0, 1), 6, "Un puente entre muestras también debe bloquear la cámara.");
assert.equal(cameraPathCeiling([point(-10, 6), point(10, 6)], 0, 0, 3, 1), Infinity);
assert.equal(cameraPathCeiling([point(-10), point(10)], 0, 0, 0, 1), Infinity);

const bridge = createCameraTrackCollider([
  { position: new THREE.Vector3(-4, 3, 0) }, { position: new THREE.Vector3(4, 3, 0) },
], 2);
const raycaster = new THREE.Raycaster();
const intersections: THREE.Intersection[] = [];
const eye = new THREE.Vector3(0, 1, 0);
const camera = new THREE.Vector3(0, 5, 0);
assert.equal(constrainCameraSightline(eye, camera, bridge, raycaster, intersections), true);
assert.ok(camera.y < 2.5 && camera.y >= eye.y, "La cámara debe quedarse debajo del tablero, incluyendo su margen de seguridad.");
camera.set(0, 1, -5);
assert.equal(constrainCameraSightline(eye, camera, bridge, raycaster, intersections), false);
assert.deepEqual(camera.toArray(), [0, 1, -5], "El espacio libre no debe modificar la cámara.");
bridge.geometry.dispose();
bridge.material.dispose();

for (let angle = 0; angle < Math.PI * 2; angle += 0.13) {
  const tangent = new THREE.Vector3(Math.sin(angle), 0.4, Math.cos(angle)).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
  const up = new THREE.Vector3().crossVectors(tangent, right).applyAxisAngle(tangent, 0.3);
  const rotation = trackFrameQuaternion(up, tangent);
  assert.ok(Math.abs(rotation.length() - 1) < 1e-10, "Las piezas no deben deformarse por una rotación reflejada.");
  assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).distanceTo(tangent) < 1e-10);
  assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).distanceTo(up) < 1e-10);
}

const keys = new Map<string, "left" | "right" | "both">();
keys.set("KeyA", pinballKeyControls.KeyA);
keys.set("KeyW", pinballKeyControls.KeyW);
assert.deepEqual(getHeldPinballFlippers(keys.values()), { left: true, right: true });
keys.delete("KeyW");
assert.deepEqual(getHeldPinballFlippers(keys.values()), { left: true, right: false }, "Soltar W no puede soltar A.");
keys.set("ArrowLeft", pinballKeyControls.ArrowLeft);
keys.delete("KeyA");
assert.deepEqual(getHeldPinballFlippers(keys.values()), { left: true, right: false });
keys.clear();
assert.deepEqual(getHeldPinballFlippers(keys.values()), { left: false, right: false });
const angles = [30, 60, 144].map((fps) => {
  let angle = 0;
  for (let frame = 0; frame < fps; frame += 1) angle += (1 - angle) * getPinballFlipperBlend(1 / fps);
  return angle;
});
assert.ok(Math.max(...angles) - Math.min(...angles) < 1e-10, "La mecánica de flippers debe responder igual a diferentes FPS.");

const ducks = prepareDuckContestants(Array.from({ length: 200 }, (_, index) => ({ id: String(index), name: `Pato ${index}`, color: "#fff" })), "beta-cover-regression");
for (const duck of ducks) {
  assert.equal(getDuckWaveCoverAmount(duck, 0), 1);
  assert.equal(getDuckWaveCoverAmount(duck, 1.5), 0);
  let previous = getDuckWaveCoverAmount(duck, 0);
  let hiddenAfterTakeoff = false;
  let emergedAgain = false;
  for (let step = 1; step <= 2000; step += 1) {
    const cover = getDuckWaveCoverAmount(duck, step / 100);
    assert.ok(cover >= 0 && cover <= 1);
    assert.ok(Math.abs(cover - previous) < 0.05, "Un pato no debe teletransportarse al comenzar o terminar la cobertura.");
    if (step > 180 && cover === 1) hiddenAfterTakeoff = true;
    if (hiddenAfterTakeoff && cover === 0) emergedAgain = true;
    previous = cover;
  }
  assert.ok(emergedAgain, "Todo pato debe salir otra vez del refugio.");
}
assert.equal(getDuckVisibleTargetCount(200, 2), 2);
assert.equal(getDuckVisualScale(getDuckVisibleTargetCount(200, 2)), getDuckVisualScale(2));
assert.equal(isGamePlayable("pinball"), false);
for (const game of ["roulette", "cards", "marbles", "ducks"] as const) assert.equal(isGamePlayable(game), true);
const race = prepareMarbleRace([{ id: "a", name: "Ana", color: "#fff" }, { id: "b", name: "Bea", color: "#f00" }], "direct", "natural-event-motion-test", "hard");
const testRacer = { ...race.racers[0], power: null, incomingPower: null, recoveryAt: 2 };
const calmTrack = { ...race.track, events: [] };
for (const type of ["freeze", "river", "tornado", "quake"] as const) {
  const track = { ...calmTrack, events: [{ id: type, type, title: type, detail: type, color: "#fff", startProgress: 0.3, endProgress: 0.65, progress: 0.475, intensity: 1 }] };
  let maximumProgressChange = 0;
  let maximumVelocityChange = 0;
  let maximumLateralChange = 0;
  for (let i = 1; i < 1000; i += 1) {
    const elapsed = testRacer.durationMs * i / 1000;
    const motion = getMarbleMotion(testRacer, track, elapsed);
    const calm = getMarbleMotion(testRacer, calmTrack, elapsed);
    if (motion.activeTrackEvent !== type) continue;
    maximumProgressChange = Math.max(maximumProgressChange, Math.abs(motion.progress - calm.progress));
    maximumVelocityChange = Math.max(maximumVelocityChange, Math.abs(motion.velocity - calm.velocity));
    maximumLateralChange = Math.max(maximumLateralChange, Math.abs(motion.lateralImpulse - calm.lateralImpulse));
  }
  assert.ok(maximumProgressChange > 0.005 && maximumVelocityChange > 0.001 && maximumLateralChange > 0.2, `${type} debe afectar avance, velocidad y trayectoria, no solo el decorado.`);
  assert.equal(getMarbleMotion(testRacer, track, testRacer.durationMs).progress, 1, "Los eventos no invalidan la llegada comprometida.");
}
console.log(JSON.stringify({ metricMarbleCamera: true, bridgeSegmentDetection: true, overlappingPinballKeys: true, framerateIndependentFlippers: angles.length, continuousDuckCover: ducks.length, readableWaveTargets: true }));

const duckTarget = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial(), 1);
duckTarget.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, -4));
duckTarget.updateMatrixWorld();
const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.6), new THREE.MeshBasicMaterial());
trunk.position.set(0, 0, -2);
trunk.updateMatrixWorld();
const duckParts = new Set<THREE.Object3D>([duckTarget]);
raycaster.set(new THREE.Vector3(0.1, 0.05, 0), new THREE.Vector3(0, 0, -1));
assert.equal(pickVisibleDuckInstance(raycaster.intersectObjects([duckTarget, trunk]), duckParts, () => true), null, "Un tronco delante impide acertar al pato.");
trunk.position.x = 1;
trunk.updateMatrixWorld();
assert.equal(pickVisibleDuckInstance(raycaster.intersectObjects([duckTarget, trunk]), duckParts, () => true), 0, "Una parte que asoma fuera del tronco se puede disparar.");
assert.equal(pickVisibleDuckInstance(raycaster.intersectObjects([duckTarget]), duckParts, () => false), null, "Un pato completamente oculto no es un blanco válido.");
duckTarget.geometry.dispose(); duckTarget.material.dispose(); trunk.geometry.dispose(); trunk.material.dispose();
