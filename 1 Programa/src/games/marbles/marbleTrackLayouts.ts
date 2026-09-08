import type { MarbleDifficulty } from "../../core/types";

export const marbleLayoutIds = ["canyon", "spiral", "clover"] as const;
export type MarbleLayout = typeof marbleLayoutIds[number];
export const marbleLayoutLabels: Record<MarbleLayout, { name: string; detail: string }> = {
  canyon: { name: "Cañón sinuoso", detail: "Terrazas, curvas en S y horquillas amplias." },
  spiral: { name: "Espiral descendente", detail: "Órbitas abiertas que descienden hacia el centro." },
  clover: { name: "Trébol de circuitos", detail: "Lóbulos enlazados con curvas interiores y exteriores." },
};

/** Continuous guides, deliberately without flat crossings or dead-end branches. */
export function buildMarbleGuide(layout: MarbleLayout, difficulty: MarbleDifficulty, random: () => number, rows: number) {
  const points: Array<{ x: number; y: number }> = [];
  const mirror = random() > 0.5;
  const add = (x: number, y: number) => points.push({ x: mirror ? 1 - x : x, y });
  if (layout === "canyon") {
    const left = 0.19 + random() * 0.012;
    const right = 0.81 - random() * 0.012;
    const gap = 0.72 / (rows - 1);
    const phase = random() * Math.PI * 2;
    for (let row = 0; row < rows; row += 1) {
      const y = 0.14 + row * gap;
      const east = row % 2 === 0;
      for (let i = row === 0 ? 0 : 1; i <= 80; i += 1) {
        const t = i / 80;
        const x = east ? left + (right - left) * t : right - (right - left) * t;
        // Zero displacement and derivative at the joins. The S is measured
        // against the lane spacing, not a tiny constant on an expanding map.
        const bend = Math.sin(t * Math.PI) ** 2 * Math.sin(t * Math.PI * 2 + phase + row * 0.65) * gap * 0.19;
        add(x, y + bend);
      }
      if (row < rows - 1) for (let i = 1; i <= 48; i += 1) {
        const angle = -Math.PI / 2 + i / 48 * Math.PI;
        add((east ? right : left) + (east ? 1 : -1) * 0.115 * Math.cos(angle), y + gap / 2 * (1 + Math.sin(angle)));
      }
    }
  } else {
    const difficultyIndex = difficulty === "easy" ? 0 : difficulty === "medium" ? 1 : 2;
    const turns = layout === "spiral" ? 2 + difficultyIndex * 0.4 : 1.5 + difficultyIndex * 0.4;
    const phase = random() * Math.PI * 2;
    const lobePhase = random() * Math.PI * 2;
    const outerRadius = layout === "spiral" ? 0.435 : 0.39;
    const innerRadius = layout === "spiral" ? 0.105 : 0.12;
    const samples = Math.ceil(turns * 240);
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const angle = phase + t * turns * Math.PI * 2;
      const lobes = layout === "clover" ? 0.055 * (1 - t) * Math.cos(3 * angle + lobePhase) : 0;
      const radius = outerRadius + (innerRadius - outerRadius) * t + lobes;
      add(0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius);
    }
  }
  return points;
}
