import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, Gauge, Gem, Play, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import type { DrawMode, Participant } from "../../core/types";
import { fortunaAudio } from "../../shared/audio/audioEngine";
import {
  createMarbleSeed,
  getMarbleProgress,
  getTrackPosition,
  powerLabels,
  prepareMarbleRace,
  type MarbleRacer,
  type PreparedMarbleRace,
  type TrackObstacleType,
} from "./marbleRaceEngine";

type RacePhase = "ready" | "racing" | "finished";

interface RankingItem {
  racer: MarbleRacer;
  progress: number;
  finished: boolean;
}

interface PowerEvent {
  id: string;
  participantName: string;
  power: MarbleRacer["power"];
}

const drawObstacle = (
  context: CanvasRenderingContext2D,
  type: TrackObstacleType,
  x: number,
  y: number,
  elapsedMs: number,
) => {
  context.save();
  context.translate(x, y);
  context.lineWidth = 2;
  if (type === "spinner") {
    context.rotate(elapsedMs / 480);
    context.strokeStyle = "#f6bd35";
    context.beginPath();
    context.moveTo(-25, 0);
    context.lineTo(25, 0);
    context.moveTo(0, -25);
    context.lineTo(0, 25);
    context.stroke();
    context.fillStyle = "#07161c";
    context.beginPath();
    context.arc(0, 0, 7, 0, Math.PI * 2);
    context.fill();
  } else if (type === "bumpers") {
    [-18, 0, 18].forEach((offset, index) => {
      context.fillStyle = index % 2 === 0 ? "#09e0df" : "#f6bd35";
      context.beginPath();
      context.arc(offset, (index % 2) * 9 - 4, 7, 0, Math.PI * 2);
      context.fill();
    });
  } else if (type === "gate") {
    context.strokeStyle = "#e95b45";
    context.strokeRect(-27, -7, 54, 14);
    context.fillStyle = "rgba(233,91,69,.35)";
    context.fillRect(-25, -5, 18 + Math.sin(elapsedMs / 320) * 9, 10);
  } else if (type === "boost") {
    context.fillStyle = "#09e0df";
    [-15, 0, 15].forEach((offset) => {
      context.beginPath();
      context.moveTo(offset - 6, 8);
      context.lineTo(offset, -8);
      context.lineTo(offset + 6, 8);
      context.closePath();
      context.fill();
    });
  } else if (type === "ice") {
    context.fillStyle = "rgba(116,230,255,.42)";
    context.fillRect(-28, -10, 56, 20);
    context.strokeStyle = "rgba(255,255,255,.7)";
    context.beginPath();
    context.moveTo(-20, 6);
    context.lineTo(-8, -5);
    context.lineTo(3, 6);
    context.lineTo(18, -6);
    context.stroke();
  } else {
    context.strokeStyle = "#d97cff";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 21 + Math.sin(elapsedMs / 260) * 3, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
};

const drawRace = (
  canvas: HTMLCanvasElement,
  race: PreparedMarbleRace,
  elapsedMs: number,
  phase: RacePhase,
) => {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(400, bounds.width);
  const height = Math.max(420, bounds.height);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#03151a");
  background.addColorStop(0.52, "#06251f");
  background.addColorStop(1, "#02090d");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(9,224,223,.045)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 34) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y < height; y += 34) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }

  const paddingX = Math.max(65, width * 0.08);
  const paddingY = 22;
  const scalePoint = (point: { x: number; y: number }) => ({
    x: paddingX + point.x * (width - paddingX * 2),
    y: paddingY + point.y * (height - paddingY * 2),
  });
  const scaledPoints = race.track.points.map(scalePoint);
  const traceTrack = () => {
    context.beginPath();
    context.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    scaledPoints.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  };

  context.lineJoin = "round";
  context.lineCap = "round";
  traceTrack();
  context.strokeStyle = "rgba(246,189,53,.5)";
  context.lineWidth = 84;
  context.stroke();
  traceTrack();
  context.strokeStyle = "#07161a";
  context.lineWidth = 76;
  context.stroke();
  traceTrack();
  context.strokeStyle = "rgba(9,224,223,.14)";
  context.lineWidth = 66;
  context.stroke();
  traceTrack();
  context.setLineDash([7, 11]);
  context.strokeStyle = "rgba(255,255,255,.13)";
  context.lineWidth = 1;
  context.stroke();
  context.setLineDash([]);

  race.track.obstacles.forEach((obstacle) => {
    const point = getTrackPosition(race.track.points, obstacle.progress);
    const scaled = scalePoint(point);
    drawObstacle(context, obstacle.type, scaled.x, scaled.y, elapsedMs);
  });

  const start = scaledPoints[0];
  const finish = scaledPoints[scaledPoints.length - 1];
  context.fillStyle = "#f6bd35";
  context.fillRect(start.x - 35, start.y - 4, 70, 8);
  for (let index = 0; index < 8; index += 1) {
    context.fillStyle = index % 2 === 0 ? "#f7f7eb" : "#071116";
    context.fillRect(finish.x - 36 + index * 9, finish.y - 5, 9, 10);
  }

  const count = race.racers.length;
  const baseRadius = count > 150 ? 3.1 : count > 90 ? 3.8 : count > 48 ? 4.8 : count > 22 ? 6 : 8;
  const drawDetailed = count <= 80;
  const selectedId = phase === "finished" ? race.selected.id : null;
  const ordered = [...race.racers].sort((first, second) => {
    const firstProgress = getMarbleProgress(first, elapsedMs).progress;
    const secondProgress = getMarbleProgress(second, elapsedMs).progress;
    return firstProgress - secondProgress;
  });
  const stagingColumns = Math.max(2, Math.ceil(Math.sqrt(count * 1.85)));
  const stagingRows = Math.ceil(count / stagingColumns);
  const stagingSpacing = Math.max(6.6, baseRadius * 2.25);

  ordered.forEach((racer) => {
    const state = getMarbleProgress(racer, phase === "ready" ? 0 : elapsedMs);
    const point = getTrackPosition(race.track.points, state.progress);
    const scaled = scalePoint(point);
    const offset = racer.lane * Math.min(27, 11 + count * 0.08);
    const trackX = scaled.x - point.tangentY * offset;
    const trackY = scaled.y + point.tangentX * offset;
    const stagingIndex = racer.number - 1;
    const stagingColumn = stagingIndex % stagingColumns;
    const stagingRow = Math.floor(stagingIndex / stagingColumns);
    const stagingX = start.x + (stagingColumn - (stagingColumns - 1) / 2) * stagingSpacing;
    const stagingY = start.y + 8 + (stagingRow - (stagingRows - 1) / 2) * stagingSpacing;
    const launchBlend = phase === "ready" ? 0 : Math.min(1, elapsedMs / 720);
    const smoothLaunch = launchBlend * launchBlend * (3 - 2 * launchBlend);
    const x = stagingX + (trackX - stagingX) * smoothLaunch;
    const y = stagingY + (trackY - stagingY) * smoothLaunch;
    const radius = baseRadius * state.radiusScale;

    context.save();
    if (state.powerActive) {
      context.shadowColor = racer.accent;
      context.shadowBlur = 12;
    }
    if (racer.id === selectedId) {
      context.strokeStyle = "#fff1a8";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, radius + 5, 0, Math.PI * 2);
      context.stroke();
    }
    if (drawDetailed) {
      const marbleGradient = context.createRadialGradient(x - radius * 0.35, y - radius * 0.4, 1, x, y, radius);
      marbleGradient.addColorStop(0, "#ffffff");
      marbleGradient.addColorStop(0.22, racer.accent);
      marbleGradient.addColorStop(1, racer.color);
      context.fillStyle = marbleGradient;
    } else {
      context.fillStyle = racer.accent;
    }
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(0,0,0,.7)";
    context.lineWidth = 1;
    context.stroke();
    if (count <= 40 && radius >= 6) {
      context.fillStyle = "#031014";
      context.font = `900 ${Math.max(6, radius * 0.9)}px Arial`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(racer.number), x, y + 0.3);
    }
    context.restore();
  });
};

export function MarbleRace({
  participants,
  mode,
  disabled,
  onFinish,
}: {
  participants: Participant[];
  mode: DrawMode;
  disabled: boolean;
  onFinish: (racer: MarbleRacer, label: string) => void;
}) {
  const [seed, setSeed] = useState(createMarbleSeed);
  const [phase, setPhase] = useState<RacePhase>("ready");
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [powerEvents, setPowerEvents] = useState<PowerEvent[]>([]);
  const [fps, setFps] = useState(60);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);
  const finishTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const triggeredPowersRef = useRef(new Set<string>());
  const race = useMemo(() => prepareMarbleRace(participants, mode, seed), [mode, participants, seed]);

  const paint = useCallback((elapsedMs: number, currentPhase: RacePhase) => {
    if (canvasRef.current) drawRace(canvasRef.current, race, elapsedMs, currentPhase);
  }, [race]);

  useEffect(() => {
    const redraw = () => paint(phase === "finished" ? race.selected.durationMs : 0, phase);
    redraw();
    const observer = new ResizeObserver(redraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [paint, phase, race.selected.durationMs]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.cancelAnimationFrame(frameRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, []);

  const regenerateTrack = () => {
    if (phase === "racing") return;
    fortunaAudio.playClick();
    setSeed(createMarbleSeed());
    setPhase("ready");
    setRanking([]);
    setPowerEvents([]);
    triggeredPowersRef.current.clear();
  };

  const startRace = () => {
    if (disabled || phase === "racing") return;
    setPhase("racing");
    setPowerEvents([]);
    triggeredPowersRef.current.clear();
    fortunaAudio.playMarbleStart();
    const startedAt = performance.now();
    let lastUiUpdate = startedAt;
    let fpsWindow = startedAt;
    let frameCount = 0;
    const finishAt = race.selected.durationMs;

    const tick = (now: number) => {
      if (!mountedRef.current) return;
      const elapsed = now - startedAt;
      frameCount += 1;
      paint(elapsed, "racing");

      if (now - lastUiUpdate >= 180) {
        const ordered = race.racers
          .map((racer) => {
            const state = getMarbleProgress(racer, elapsed);
            return { racer, progress: state.progress, finished: state.finished };
          })
          .sort((first, second) => second.progress - first.progress);
        setRanking(ordered.slice(0, 6));
        const newEvents = race.racers.filter((racer) => {
          if (triggeredPowersRef.current.has(racer.id)) return false;
          const state = getMarbleProgress(racer, elapsed);
          if (!state.powerActive) return false;
          triggeredPowersRef.current.add(racer.id);
          return true;
        }).slice(0, 3).map((racer) => ({
          id: `${racer.id}-${elapsed}`,
          participantName: racer.participant.name,
          power: racer.power,
        }));
        if (newEvents.length > 0) {
          setPowerEvents((current) => [...newEvents, ...current].slice(0, 3));
          fortunaAudio.playMarblePower();
        }
        lastUiUpdate = now;
      }

      if (now - fpsWindow >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsWindow)));
        fpsWindow = now;
        frameCount = 0;
      }

      if (elapsed >= finishAt) {
        setPhase("finished");
        paint(finishAt, "finished");
        fortunaAudio.playMarbleFinish();
        const resultLabel = mode === "direct"
          ? `Canica #${race.selected.number} · llegó primera`
          : `Canica #${race.selected.number} · llegó de última`;
        finishTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) onFinish(race.selected, resultLabel);
        }, 650);
        return;
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  };

  const status = phase === "ready" ? "Pista preparada" : phase === "racing" ? "Carrera en vivo" : "Resultado confirmado";

  return (
    <div className={`marble-race marble-race--${phase}`} data-marble-count={participants.length} data-fps={fps}>
      <div className="marble-race-status" aria-live="polite">
        <span className="marble-race-status__icon">{phase === "racing" ? <Gauge size={18} /> : <Gem size={18} />}</span>
        <div><strong>{status}</strong><small>{race.track.name} · mapa #{race.track.seed.slice(0, 6).toUpperCase()}</small></div>
        <span className="marble-race-status__count">{participants.length} canicas · {phase === "racing" ? `${fps} FPS` : "lista"}</span>
      </div>

      <div className="marble-arena">
        <canvas ref={canvasRef} aria-label={`Pista ${race.track.name} con ${participants.length} canicas`} />
        <span className="marble-track-label marble-track-label--start"><Play size={11} /> SALIDA</span>
        <span className="marble-track-label marble-track-label--finish"><Flag size={11} /> META</span>

        {(phase === "racing" || phase === "finished") && (
          <div className="marble-live-ranking">
            <div><Gauge size={14} /> Clasificación</div>
            {ranking.map((item, index) => (
              <span key={item.racer.id}>
                <b>{index + 1}</b><i style={{ background: item.racer.accent }} />
                <strong>{item.racer.participant.name}</strong><em>{item.finished ? "META" : `${Math.round(item.progress * 100)}%`}</em>
              </span>
            ))}
          </div>
        )}

        {powerEvents.length > 0 && (
          <div className="marble-power-feed">
            {powerEvents.map((event) => (
              <span key={event.id}><WandSparkles size={12} /><strong>{event.participantName}</strong> · {powerLabels[event.power]}</span>
            ))}
          </div>
        )}
      </div>

      <div className="marble-controls">
        <button type="button" className="text-button marble-regenerate" onClick={regenerateTrack} disabled={phase === "racing"}>
          <RefreshCw size={15} /> Generar otra pista
        </button>
        <button type="button" className="start-button marble-start-button" onClick={startRace} disabled={disabled || phase === "racing" || phase === "finished"}>
          {phase === "racing" ? <><span className="spinner-dot" /> Carrera en curso…</> : phase === "finished" ? <><Flag size={18} /> Carrera finalizada</> : <><Play size={19} fill="currentColor" /> Abrir compuerta</>}
        </button>
        <small><Sparkles size={11} /> El mapa, los poderes y el resultado se fijan antes de abrir la compuerta.</small>
      </div>
    </div>
  );
}
