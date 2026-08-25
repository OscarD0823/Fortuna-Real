import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import type { MarbleDifficulty, Participant } from "./core/types";
import { MarbleRace } from "./games/marbles/MarbleRace";

const query = new URLSearchParams(window.location.search);
const requestedCount = Number(query.get("count") ?? 24);
const initialCount = Math.min(200, Math.max(2, Number.isFinite(requestedCount) ? Math.round(requestedCount) : 24));
const requestedDifficulty = query.get("difficulty");
const requestedSeed = query.get("seed")?.trim() || undefined;
const initialDifficulty: MarbleDifficulty = requestedDifficulty === "easy" || requestedDifficulty === "hard"
  ? requestedDifficulty
  : "medium";

function MarblePreview() {
  const [difficulty, setDifficulty] = useState<MarbleDifficulty>(initialDifficulty);
  const participants = useMemo<Participant[]>(() => Array.from({ length: initialCount }, (_, index) => ({
    id: `preview-${index + 1}`,
    name: `Jugador ${index + 1}`,
    color: `hsl(${(index * 137.508) % 360} 76% 52%)`,
  })), []);

  return (
    <main style={{ minHeight: "100vh", height: "100vh", padding: 12, background: "#02070c", color: "#edf8f8", display: "flex", boxSizing: "border-box" }}>
      <MarbleRace
        participants={participants}
        mode="direct"
        difficulty={difficulty}
        disabled={false}
        previousWinnerIds={new Set()}
        initialSeed={requestedSeed}
        onCommit={() => undefined}
        onDifficultyChange={setDifficulty}
        onFinish={() => undefined}
      />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><MarblePreview /></React.StrictMode>,
);
