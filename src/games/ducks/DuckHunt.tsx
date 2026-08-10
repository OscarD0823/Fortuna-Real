import { useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Crown,
  Feather,
  Heart,
  Play,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import type { Participant } from "../../core/types";
import { fortunaAudio } from "../../shared/audio/audioEngine";
import {
  createDuckSeed,
  duckLivesLabel,
  hitDuckContestant,
  learnFromDuckShot,
  prepareDuckNextFlight,
  prepareDuckContestants,
  type DuckContestant,
} from "./duckHuntEngine";
import {
  createDuckHunt3D,
  type DuckHuntController,
  type DuckHuntStats,
} from "./duckHunt3d";

type DuckPhase = "ready" | "flying" | "resetting" | "finished";

const initialStats: DuckHuntStats = { fps: 60, visible: 0, renderCalls: 0, triangles: 0 };

export function DuckHunt({
  participants,
  previousWinnerIds,
  disabled,
  onFinish,
}: {
  participants: Participant[];
  previousWinnerIds: ReadonlySet<string>;
  disabled: boolean;
  onFinish: (survivor: DuckContestant, knockoutOrder: DuckContestant[]) => void;
}) {
  const [seed, setSeed] = useState(() => createDuckSeed());
  const initialContestants = useMemo(
    () => prepareDuckContestants(participants, seed, previousWinnerIds),
    [participants, previousWinnerIds, seed],
  );
  const [contestants, setContestants] = useState(initialContestants);
  const [phase, setPhase] = useState<DuckPhase>("ready");
  const [stats, setStats] = useState(initialStats);
  const [shots, setShots] = useState(0);
  const [hits, setHits] = useState(0);
  const [lastHit, setLastHit] = useState<DuckContestant | null>(null);
  const [grazeNotice, setGrazeNotice] = useState(false);
  const [shieldBlocked, setShieldBlocked] = useState(false);
  const [crosshair, setCrosshair] = useState({ x: 50, y: 48, visible: false });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<DuckHuntController | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const knockoutOrderRef = useRef<DuckContestant[]>([]);

  useEffect(() => {
    setContestants(initialContestants);
    setPhase("ready");
    setShots(0);
    setHits(0);
    setLastHit(null);
    setGrazeNotice(false);
    setShieldBlocked(false);
    knockoutOrderRef.current = [];
  }, [initialContestants]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = createDuckHunt3D(canvas, initialContestants, setStats);
    controllerRef.current = controller;
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      controller.dispose();
      controllerRef.current = null;
    };
  }, [initialContestants]);

  useEffect(() => {
    controllerRef.current?.updateContestants(contestants);
  }, [contestants]);

  const livingCount = contestants.filter((contestant) => !contestant.knockedOut).length;
  const sortedContestants = useMemo(
    () => [...contestants].sort((left, right) => {
      if (left.knockedOut !== right.knockedOut) return left.knockedOut ? 1 : -1;
      if (left.lives !== right.lives) return left.lives - right.lives;
      return left.number - right.number;
    }),
    [contestants],
  );

  const start = () => {
    if (disabled || phase !== "ready") return;
    fortunaAudio.playDuckStart();
    controllerRef.current?.setRunning(true);
    setPhase("flying");
  };

  const regenerate = () => {
    if (phase !== "ready") return;
    fortunaAudio.playClick();
    setSeed(createDuckSeed());
  };

  const updateCrosshair = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCrosshair({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      visible: true,
    });
  };

  const shoot = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "flying") return;
    setShots((value) => value + 1);
    const shot = controllerRef.current?.shoot(event.clientX, event.clientY);
    if (!shot) return;
    const learnedContestants = learnFromDuckShot(
      contestants,
      shot.threatX,
      shot.threatY,
      shot.grazedId,
    );
    if (!shot.hitId) {
      setContestants(learnedContestants);
      setGrazeNotice(!!shot.grazedId);
      setShieldBlocked(false);
      fortunaAudio.playDuckShot(false);
      return;
    }
    const result = hitDuckContestant(learnedContestants, shot.hitId);
    if (!result) return;
    const nextFlightContestants = prepareDuckNextFlight(result.contestants);
    const target = nextFlightContestants.find((contestant) => contestant.id === shot.hitId) ?? result.target;
    setHits((value) => value + 1);
    setContestants(nextFlightContestants);
    setLastHit(target);
    setGrazeNotice(false);
    setShieldBlocked(result.shieldAbsorbed);
    setPhase("resetting");
    controllerRef.current?.updateContestants(nextFlightContestants);
    controllerRef.current?.resetFlock(
      shot.hitId,
      result.shieldAbsorbed ? `${result.target.participant.name} · BLINDAJE ROTO` : undefined,
    );
    if (result.shieldAbsorbed) fortunaAudio.playDuckShield();
    else fortunaAudio.playDuckShot(true);
    if (result.knockedOut) knockoutOrderRef.current = [...knockoutOrderRef.current, result.target];

    resetTimerRef.current = window.setTimeout(() => {
      if (result.survivor) {
        setPhase("finished");
        controllerRef.current?.setRunning(false);
        fortunaAudio.playDuckWinner();
        onFinish(result.survivor, knockoutOrderRef.current);
      } else {
        setPhase("flying");
        setLastHit(null);
        setShieldBlocked(false);
        fortunaAudio.playDuckTakeoff();
      }
    }, 2080);
  };

  const accuracy = shots === 0 ? 0 : Math.round((hits / shots) * 100);
  const phaseLabel = phase === "ready"
    ? "Bandada completa en cámara"
    : phase === "flying"
      ? "Cacería en curso"
      : phase === "resetting"
        ? "Bandada reagrupándose"
        : "Último pato en pie";

  return (
    <div className={`duck-hunt duck-hunt--${phase}`} data-duck-count={contestants.length} data-fps={stats.fps}>
      <div className="duck-hunt__status">
        <span className="duck-hunt__status-icon"><Feather size={19} /></span>
        <div>
          <strong>{phaseLabel}</strong>
          <small>Semilla {seed.slice(-12).toUpperCase()} · cada impacto reinicia el vuelo</small>
        </div>
        <div className="duck-hunt__metrics">
          <span><Heart size={12} /> {livingCount} en pie</span>
          <span><ShieldCheck size={12} /> {contestants.filter((contestant) => contestant.shielded).length}</span>
          <span><Target size={12} /> {hits}/{shots}</span>
          <span>{accuracy}% precisión</span>
          <span>{stats.fps} FPS</span>
        </div>
      </div>

      <div className="duck-hunt__arena">
        <canvas
          ref={canvasRef}
          onPointerMove={updateCrosshair}
          onPointerLeave={() => setCrosshair((value) => ({ ...value, visible: false }))}
          onPointerDown={shoot}
          aria-label={`Campo de tiro 3D con ${livingCount} patos todavía en pie`}
        />
        <div
          className={`duck-crosshair ${crosshair.visible && phase === "flying" ? "is-visible" : ""}`}
          style={{ left: `${crosshair.x}%`, top: `${crosshair.y}%` }}
          aria-hidden="true"
        ><span /><i /></div>
        <div className="duck-hunt__render-badge"><span /> CAMPO 3D EN VIVO</div>
        <div className="duck-hunt__instruction">
          {phase === "ready" ? <><Crosshair size={18} /><strong>Apunta con el cursor</strong><span>Los nombres solo aparecen después del impacto.</span></>
            : phase === "resetting" && lastHit ? <><ShieldAlert size={18} /><strong>{lastHit.participant.name}</strong><span>{shieldBlocked ? "El blindaje absorbió la bala; no perdió una vida" : lastHit.lives === 0 ? "Sin vidas · fuera de la partida" : `${duckLivesLabel(lastHit.lives)} · ahora vuela más rápido`}</span></>
              : phase === "finished" ? <><Trophy size={18} /><strong>Superviviente confirmado</strong><span>El resultado se guardó en el salón de ganadores.</span></>
                : grazeNotice ? <><ShieldCheck size={18} /><strong>ROCE DETECTADO</strong><span>Ese pato podría despegar con blindaje en la próxima formación.</span></>
                  : <><Crosshair size={18} /><strong>DISPARO HABILITADO</strong><span>Impacta un pato para revelar su identidad.</span></>}
        </div>
      </div>

      <div className="duck-hunt__lower">
        <div className="duck-life-table">
          <header><span><Heart size={14} /> Tabla de vidas</span><small>Menos vidas = más velocidad</small></header>
          <div className="duck-life-table__list">
            {sortedContestants.map((contestant) => (
              <div className={`duck-life-row ${contestant.knockedOut ? "is-out" : ""} ${lastHit?.id === contestant.id ? "is-hit" : ""}`} key={contestant.id}>
                <b>#{contestant.number}</b>
                <i style={{ background: contestant.accent }} />
                <strong className="duck-player-name"><span>{contestant.participant.name}</span>{contestant.previousWinner && <Crown className="duck-champion-crown" size={12} fill="currentColor" aria-label="Ganador anterior" />}</strong>
                <span className="duck-hearts" aria-label={duckLivesLabel(contestant.lives)}>
                  {[0, 1, 2].map((heart) => <Heart key={heart} size={12} fill={heart < contestant.lives ? "currentColor" : "none"} />)}
                </span>
                <em>{contestant.knockedOut ? "FUERA" : contestant.shielded ? "ESCUDO" : `×${contestant.speed.toFixed(2)}`}</em>
              </div>
            ))}
          </div>
        </div>
        <div className="duck-hunt__controls">
          {phase === "ready" ? (
            <>
              <button type="button" className="text-button duck-regenerate" onClick={regenerate}><RefreshCw size={15} /> Nueva bandada</button>
              <button type="button" className="start-button duck-start" onClick={start} disabled={disabled}><Play size={19} fill="currentColor" /> Soltar los patos</button>
            </>
          ) : (
            <div className={`duck-flight-state duck-flight-state--${phase}`}>
              <span /><strong>{phase === "flying" ? "APUNTA Y DISPARA" : phase === "resetting" ? "ATERRIZANDO Y REINICIANDO" : "PARTIDA FINALIZADA"}</strong>
            </div>
          )}
          <small><Sparkles size={11} /> Cada pato tiene tres vidas; el último que conserve una vida gana.</small>
        </div>
      </div>
    </div>
  );
}
