import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "src/App.css"), "utf8");
const instructions = readFileSync(resolve(root, "INSTRUCCIONES - LEER PRIMERO.txt"), "utf8");

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

console.log(JSON.stringify({
  minimumTextSizePx: 12,
  lowContrastTokensRemoved: inaccessibleColors,
  fiveGamesDocumented: true,
}, null, 2));
