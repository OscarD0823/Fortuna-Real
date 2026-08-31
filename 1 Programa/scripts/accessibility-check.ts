import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "src/App.css"), "utf8");
const instructions = readFileSync(resolve(root, "INSTRUCCIONES - LEER PRIMERO.txt"), "utf8");
const setup = readFileSync(resolve(root, "src/modules/draw/DrawSetup.tsx"), "utf8");
const marbleRace = readFileSync(resolve(root, "src/games/marbles/MarbleRace.tsx"), "utf8");
const pinballGame = readFileSync(resolve(root, "src/games/pinball/PinballGame.tsx"), "utf8");
const participantPanel = readFileSync(resolve(root, "src/modules/participants/ParticipantPanel.tsx"), "utf8");
const duckGame = readFileSync(resolve(root, "src/games/ducks/DuckHunt.tsx"), "utf8");
const duckScene = readFileSync(resolve(root, "src/games/ducks/duckHunt3d.ts"), "utf8");
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
if (!marbleRace.includes("data-camera-director") || !marbleRace.includes("Director: sigue al líder")) {
  throw new Error("Canicas debe incluir un director automático de cámara verificable.");
}
if (!pinballGame.includes("Seguir la pelota anterior") || !pinballGame.includes("Seguir la pelota siguiente")) {
  throw new Error("Pinball debe permitir recorrer las cámaras sin abrir el selector.");
}
if (!duckGame.includes("duck-cover-radar") || !duckGame.includes("data-cover-percent")) {
  throw new Error("Patos debe mostrar el estado de cobertura del bosque y el pasto.");
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
  pinballCameraStepper: true,
  duckCoverRadar: true,
  participantSearch: true,
  duckModelDetails: ["pupils", "feet", "shotRecoil"],
  guidedDemos: ["roulette", "cards", "pinball", "marbles", "ducks"],
  keyboardAccessibleTutorials: true,
}, null, 2));
