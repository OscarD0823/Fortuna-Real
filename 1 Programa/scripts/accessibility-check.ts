import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "src/App.css"), "utf8");
const instructions = readFileSync(resolve(root, "INSTRUCCIONES - LEER PRIMERO.txt"), "utf8");
const setup = readFileSync(resolve(root, "src/modules/draw/DrawSetup.tsx"), "utf8");
const marbleRace = readFileSync(resolve(root, "src/games/marbles/MarbleRace.tsx"), "utf8");
const marbleScene = readFileSync(resolve(root, "src/games/marbles/marbleRace3d.ts"), "utf8");
const pinballGame = readFileSync(resolve(root, "src/games/pinball/PinballGame.tsx"), "utf8");
const participantPanel = readFileSync(resolve(root, "src/modules/participants/ParticipantPanel.tsx"), "utf8");
const duckGame = readFileSync(resolve(root, "src/games/ducks/DuckHunt.tsx"), "utf8");
const duckScene = readFileSync(resolve(root, "src/games/ducks/duckHunt3d.ts"), "utf8");
const duckEngine = readFileSync(resolve(root, "src/games/ducks/duckHuntEngine.ts"), "utf8");
const pinballScene = readFileSync(resolve(root, "src/games/pinball/pinball3d.ts"), "utf8");
const pinballEngine = readFileSync(resolve(root, "src/games/pinball/pinballEngine.ts"), "utf8");
const app = readFileSync(resolve(root, "src/App.tsx"), "utf8");
const tutorialContent = readFileSync(resolve(root, "src/shared/tutorial/tutorialContent.ts"), "utf8");
const guidedTour = readFileSync(resolve(root, "src/shared/tutorial/GuidedTour.tsx"), "utf8");
const demoModal = readFileSync(resolve(root, "src/shared/tutorial/GameDemoModal.tsx"), "utf8");
const tutorialDialog = readFileSync(resolve(root, "src/shared/tutorial/useTutorialDialog.ts"), "utf8");

const undersized = Array.from(css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g))
  .map((match) => ({ value: Number(match[1]), offset: match.index }))
  .filter(({ value }) => value < 12);

if (undersized.length > 0) {
  const samples = undersized.slice(0, 8).map(({ value, offset }) => `${value}px@${offset}`).join(", ");
  throw new Error(`Hay ${undersized.length} tamaños de texto inferiores a 12px: ${samples}`);
}

const inaccessibleColors = ["#547078", "#536f75", "#4e6970", "#4c6970"];
const remainingColors = inaccessibleColors.filter((color) => css.toLowerCase().includes(color));
if (remainingColors.length > 0) {
  throw new Error(`Persisten colores secundarios de bajo contraste: ${remainingColors.join(", ")}`);
}

const expectedInstruction = "Selecciona Ruleta, Cartas, Pinball 3D, Canicas 3D o Patos 3D.";
if (!instructions.includes(expectedInstruction)) {
  throw new Error(`Las instrucciones deben contener exactamente: ${expectedInstruction}`);
}

for (const betaLabel of ["BETA · mesa física", "BETA · 3D procedural", "BETA · supervivencia"]) {
  if (!setup.includes(betaLabel)) throw new Error(`Falta identificar como beta: ${betaLabel}`);
}
for (const cameraLabel of ["PERSECUCIÓN", "A BORDO", "LATERAL", "AÉREA"]) {
  if (!marbleRace.includes(cameraLabel)) throw new Error(`Falta el modo de cámara de Canicas: ${cameraLabel}`);
}
for (const cameraLabel of ["CENITAL", "PERSECUCIÓN"]) {
  if (!pinballGame.includes(cameraLabel)) throw new Error(`Falta el modo de cámara de Pinball: ${cameraLabel}`);
}
if (!marbleRace.includes("data-camera-director") || !marbleRace.includes("Director estable: sigue al líder")) {
  throw new Error("Canicas debe incluir un director automático de cámara verificable.");
}
if (!marbleRace.includes("Posición que decide el resultado") || !setup.includes("¿Qué posición decide?")) {
  throw new Error("Canicas debe permitir elegir de forma accesible si decide el primero o el último.");
}
for (const eventName of ["Pista congelada", "Río", "Tornado", "Temblor"]) {
  if (!marbleRace.includes(eventName)) throw new Error(`Falta explicar el evento de Canicas: ${eventName}.`);
}
if (
  !marbleScene.includes("turboTurbulence")
  || !marbleScene.includes("cameraDistance")
  || !marbleScene.includes("cameraOcclusionGuard")
  || !marbleScene.includes("findOverheadTrackY")
  || !marbleScene.includes('"underpass"')
) {
  throw new Error("La cámara de Canicas no contiene el encuadre amplio, corredor bajo puentes y descontrol de Turbo.");
}
if (!css.includes(".marble-race { width: 100%; max-width: 100%; min-width: 0;")) {
  throw new Error("Canicas debe ajustarse al ancho disponible sin crear desplazamiento horizontal.");
}
if (!pinballGame.includes("Seguir la pelota anterior") || !pinballGame.includes("Seguir la pelota siguiente")) {
  throw new Error("Pinball debe permitir recorrer las cámaras sin abrir el selector.");
}
if (
  !pinballGame.includes('event.code === "ArrowUp"')
  || !pinballGame.includes('event.code === "KeyW"')
  || !pinballGame.includes("AMBOS FLIPPERS")
  || !pinballScene.includes("followBeacon")
  || !pinballScene.includes("flipperAssist")
  || !pinballEngine.includes("getPinballAutomaticFlipperThreat")
) {
  throw new Error("Pinball debe incluir control manual dual, seguimiento visible y piloto automático predictivo.");
}
if (!duckGame.includes("duck-cover-radar") || !duckGame.includes("data-cover-percent")) {
  throw new Error("Patos debe mostrar el estado de cobertura del bosque y el pasto.");
}
for (const eventType of ["wind", "mist", "fireflies", "storm"]) {
  if (!duckEngine.includes(`${eventType}: {`)) throw new Error(`Falta el evento de bosque: ${eventType}.`);
}
if (!duckGame.includes("data-forest-event") || !duckScene.includes("setForestEvent")) {
  throw new Error("Patos debe anunciar y representar en 3D el evento vivo del bosque.");
}
if (!participantPanel.includes("Buscar participante por nombre")) {
  throw new Error("Las listas grandes deben disponer de búsqueda accesible.");
}
for (const modelDetail of ["pupil", "leftFoot", "cameraRecoilUntil"]) {
  if (!duckScene.includes(modelDetail)) throw new Error(`Falta el detalle visual de Patos: ${modelDetail}`);
}
for (const game of ["roulette", "cards", "pinball", "marbles", "ducks"]) {
  if (!tutorialContent.includes(`${game}: {`)) throw new Error(`Falta la demostración de ${game}.`);
  if (!tutorialContent.includes(`target: \".`)) throw new Error("Las guías deben apuntar a controles reales.");
}
for (const modalSource of [guidedTour, demoModal]) {
  if (!modalSource.includes('role="dialog"') || !modalSource.includes('aria-modal="true"')) {
    throw new Error("Cada guía debe anunciarse como diálogo modal accesible.");
  }
  if (!modalSource.includes("useTutorialDialog") || !tutorialDialog.includes('event.key === "Escape"') || !tutorialDialog.includes('event.key === "Tab"')) {
    throw new Error("Cada guía debe permitir salir con Escape y retener correctamente el foco.");
  }
}
if (!app.includes("Tutorial del inicio") || !app.includes("Guía paso a paso")) {
  throw new Error("La ayuda debe permanecer visible tanto en el inicio como dentro de los juegos.");
}

console.log(JSON.stringify({
  minimumTextSizePx: 12,
  lowContrastTokensRemoved: inaccessibleColors,
  fiveGamesDocumented: true,
  betaGamesIdentified: ["pinball", "marbles", "ducks"],
  marbleCameraModes: 4,
  pinballCameraModes: 2,
  automaticMarbleCameraDirector: true,
  marbleCameraOcclusionGuard: true,
  marbleUnderpassCamera: true,
  marbleResponsiveWidth: true,
  marbleFinishRules: ["first", "last"],
  marbleTrackEvents: ["freeze", "river", "tornado", "quake"],
  pinballCameraStepper: true,
  pinballPredictiveAutomaticMode: true,
  pinballDualManualControl: true,
  duckCoverRadar: true,
  duckForestEvents: ["wind", "mist", "fireflies", "storm"],
  participantSearch: true,
  duckModelDetails: ["pupils", "feet", "shotRecoil"],
  guidedDemos: ["roulette", "cards", "pinball", "marbles", "ducks"],
  keyboardAccessibleTutorials: true,
}, null, 2));
