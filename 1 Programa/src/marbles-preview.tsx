import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useDrawStore } from "./modules/participants/drawStore";
import "./App.css";
import type { MarbleDifficulty, MarbleFinishRule, Participant } from "./core/types";
import { MarbleRace } from "./games/marbles/MarbleRace";
import { PinballGame } from "./games/pinball/PinballGame";
import { DuckHunt } from "./games/ducks/DuckHunt";
import { UpdateDialog } from "./shared/components/AppUpdater";
import { updateHeadings, type UpdateStatus } from "./shared/update/updatePresentation";
import { prepareMarbleRace } from "./games/marbles/marbleRaceEngine";
import { marbleLayoutLabels } from "./games/marbles/marbleTrackLayouts";
import { disposeMarbleRace3D, drawMarbleRace3D, type MarbleFollowCameraStyle } from "./games/marbles/marbleRace3d";

const query = new URLSearchParams(window.location.search);
const inspectSetup = import.meta.env.DEV && query.get("game") === "setup";
if (inspectSetup) {
  // This lab must never modify the operator's actual participants or results.
  useDrawStore.persist.setOptions({ name: "fortuna-ui-lab", storage: {
    getItem: () => null, setItem: () => undefined, removeItem: () => undefined,
  } });
  useDrawStore.setState(useDrawStore.getInitialState(), true);
}
const requestedCount = Number(query.get("count") ?? 24);
const initialCount = Math.min(200, Math.max(2, Number.isFinite(requestedCount) ? Math.round(requestedCount) : 24));
const requestedDifficulty = query.get("difficulty");
const requestedSeed = query.get("seed")?.trim() || undefined;
const initialDifficulty: MarbleDifficulty = requestedDifficulty === "easy" || requestedDifficulty === "hard"
  ? requestedDifficulty
  : "medium";

function UpdaterInspection() {
  const requested = query.get("phase") ?? "downloading";
  const [phase, setPhase] = useState<UpdateStatus>(Object.prototype.hasOwnProperty.call(updateHeadings, requested) ? requested as UpdateStatus : "downloading");
  const [open, setOpen] = useState(true);
  return <section style={{ padding: 24 }}>
    <h1>Laboratorio de actualización</h1><p>Solo muestra estados de la interfaz. No descarga, instala, guarda recibos ni reinicia el programa.</p>
    <button className="start-button" type="button" onClick={() => { setPhase("downloading"); setOpen(true); }}>Abrir demostración</button>
    {open && <UpdateDialog preview status={phase} failurePhase="verifying" currentVersion="1.0.10" version="1.0.11"
      progress={46} downloadedBytes={175 * 1024 * 1024} totalBytes={382 * 1024 * 1024} elapsedMs={25000}
      signatureVerified={["preparing", "installing", "restarting", "complete"].includes(phase)}
      notes={"Ejemplo de presentación: mejoras de Patos Retro y actualización integrada.\nEsta es una demostración, no una versión publicada."}
      errorMessage="Ejemplo: no se pudo verificar la firma. No se aplicó ningún archivo."
      onContinue={() => setOpen(false)} onRetry={() => setPhase("checking")} onPreviewStatus={setPhase} />}
  </section>;
}

function CameraInspection({ participants }: { participants: Participant[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const race = useMemo(() => prepareMarbleRace(participants, "direct", requestedSeed ?? "camera-inspection", initialDifficulty, new Set(), "first"), [participants]);
  const initialTime = Number(query.get("at"));
  const [fraction, setFraction] = useState(Number.isFinite(initialTime) ? Math.max(0, Math.min(1, initialTime)) : 0.5);
  const initialView = query.get("view");
  const [style, setStyle] = useState<MarbleFollowCameraStyle | "overview">(
    initialView === "overview" || initialView === "onboard" || initialView === "trackside" || initialView === "aerial" ? initialView : "chase",
  );
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const render = () => drawMarbleRace3D(element, race, 1400 + fraction * race.racers[0].durationMs, "racing", style === "overview" ? null : race.racers[0].id, style === "overview" ? "chase" : style);
    render();
    const resize = new ResizeObserver(render);
    resize.observe(element);
    return () => { resize.disconnect(); disposeMarbleRace3D(element); };
  }, [race, fraction, style]);
  return <section style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
    <div>{marbleLayoutLabels[race.track.layout].name} · {race.track.lengthMeters} m · Inspección de cámara · {Math.round(fraction * 100)}% del tiempo
      <input aria-label="Tiempo de inspección" type="range" min="0" max="1" step="0.01" value={fraction} onChange={(event) => setFraction(Number(event.target.value))} />
      <select aria-label="Cámara de inspección" value={style} onChange={(event) => setStyle(event.target.value as MarbleFollowCameraStyle | "overview")}>
        <option value="overview">Mapa completo</option><option value="chase">Persecución</option><option value="onboard">Desde la canica</option><option value="trackside">Lateral</option><option value="aerial">Aérea</option>
      </select>
    </div>
    <canvas ref={canvas} style={{ width: "100%", flex: 1, minHeight: 0 }} />
  </section>;
}

function MarblePreview() {
  const game = query.get("game") ?? "marbles";
  const [difficulty, setDifficulty] = useState<MarbleDifficulty>(initialDifficulty);
  const [finishRule, setFinishRule] = useState<MarbleFinishRule>("first");
  const participants = useMemo<Participant[]>(() => Array.from({ length: initialCount }, (_, index) => ({
    id: `preview-${index + 1}`,
    name: `Jugador ${index + 1}`,
    color: `hsl(${(index * 137.508) % 360}, 76%, 52%)`,
  })), []);

  return (
    <main style={{ minHeight: "100vh", height: "100vh", padding: 12, background: "#02070c", color: "#edf8f8", display: "flex", boxSizing: "border-box" }}>
      {import.meta.env.DEV && game === "updater" ? <UpdaterInspection />
        : import.meta.env.DEV && game === "camera" ? <CameraInspection participants={participants} />
        : game === "pinball" ? <PinballGame participants={participants} mode="direct" controlMode={query.get("control") === "manual" ? "manual" : "automatic"} disabled={false} previousWinnerIds={new Set()} initialSeed={requestedSeed} onCommit={() => undefined} onFinish={() => undefined} />
        : game === "ducks" ? <DuckHunt participants={participants} previousWinnerIds={new Set()} disabled={false} onCommit={() => undefined} onFinish={() => undefined} />
        : <MarbleRace
        participants={participants}
        mode="direct"
        difficulty={difficulty}
        finishRule={finishRule}
        disabled={false}
        previousWinnerIds={new Set()}
        initialSeed={requestedSeed}
        onCommit={() => undefined}
        onDifficultyChange={setDifficulty}
        onFinishRuleChange={setFinishRule}
        onFinish={() => undefined}
      />}
    </main>
  );
}

const previewRoot = import.meta.hot?.data.previewRoot ?? ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
if (import.meta.hot) import.meta.hot.data.previewRoot = previewRoot;
previewRoot.render(
  <React.StrictMode>{inspectSetup ? <App /> : <MarblePreview />}</React.StrictMode>,
);
