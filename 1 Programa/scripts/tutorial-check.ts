import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gameGuides, guidedTours } from "../src/shared/tutorial/tutorialContent.ts";

const root = resolve(import.meta.dirname, "..");
const games = ["roulette", "cards", "pinball", "marbles", "ducks"] as const;
const screenFiles = [
  "src/App.tsx", "src/modules/participants/ParticipantPanel.tsx", "src/modules/draw/DrawSetup.tsx",
  "src/games/cards/CardGame.tsx", "src/games/pinball/PinballGame.tsx",
  "src/games/marbles/MarbleRace.tsx", "src/games/ducks/DuckHunt.tsx",
];
const screenSources = screenFiles.map((path) => readFileSync(resolve(root, path), "utf8")).join("\n");
const demoSource = readFileSync(resolve(root, "src/shared/tutorial/GameDemoModal.tsx"), "utf8");
const dialogSource = readFileSync(resolve(root, "src/shared/tutorial/useTutorialDialog.ts"), "utf8");
for (const game of games) {
  const guide = gameGuides[game];
  assert.equal(guide.steps.length, 4, `${game}: la demo debe tener cuatro pasos breves.`);
  assert.equal(guide.beta, ["pinball", "marbles", "ducks"].includes(game));
  assert.ok(guide.steps.every((step) => step.title && step.description && step.action));
  assert.ok(guidedTours[game].length >= 3, `${game}: faltan instrucciones sobre los controles.`);
}
for (const [id, tour] of Object.entries(guidedTours)) {
  const targets = new Set<string>();
  for (const step of tour) {
    assert.ok(step.title && step.description && step.tip, `${id}: hay pasos sin explicación.`);
    assert.ok(step.target.startsWith("."));
    assert.ok(screenSources.includes(step.target.slice(1)), `${id}: no existe el ancla ${step.target}.`);
    assert.ok(!targets.has(step.target), `${id}: se repite un control sin necesidad.`);
    targets.add(step.target);
  }
}
assert.ok(guidedTours.setup.some((step) => step.description.includes("comas")), "Debe explicar cómo pegar listas.");
assert.ok(!demoSource.includes("useDrawStore"), "La práctica no debe acceder al estado real del sorteo.");
assert.ok(demoSource.includes("Nombre de prueba, no se guarda"), "Debe existir una práctica segura de nombres.");
assert.ok(demoSource.includes("Elegir carta de ejemplo"), "Debe existir una práctica de selección de cartas.");
assert.ok(dialogSource.includes("event.stopPropagation()"), "La guía no debe activar controles del juego.");
assert.ok(dialogSource.includes("editingText"), "Las flechas deben conservar su función dentro del campo de práctica.");
for (const source of [demoSource, readFileSync(resolve(root, "src/modules/participants/ParticipantPanel.tsx"), "utf8")]) {
  assert.ok(source.includes('event.key === "Enter"') && source.includes("event.nativeEvent.isComposing"), "Enter debe agregar nombres sin interferir con un teclado de composición.");
}
assert.ok(dialogSource.includes('document.documentElement.style.overflow = "hidden"'), "El fondo no debe desplazarse mientras se usa la guía.");
console.log(JSON.stringify({ games, demoSteps: 20, setupSteps: guidedTours.setup.length, isolatedPractice: true, targetsChecked: Object.values(guidedTours).reduce((total, steps) => total + steps.length, 0), status: "passed" }, null, 2));
