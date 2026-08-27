import { useEffect, useMemo, useRef, useState } from "react";
import {
  Contrast,
  Crosshair,
  Crown,
  Feather,
  FastForward,
  Heart,
  Palette,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  TriangleAlert,
  Vibrate,
} from "lucide-react";
import type { Participant } from "../../core/types";
import { fortunaAudio } from "../../shared/audio/audioEngine";
import {
  createDuckCommitmentSeed,
  createSealedDuckCommitmentFromSeed,
  type DuckCommitment,
} from "./duckCommitment";
import {
  createDuckSeed,
  duckSabotageDefinitions,
  duckLivesLabel,
  getDuckResetDuration,
  hitDuckContestant,
  learnFromDuckShot,
  prepareDuckNextFlight,
  prepareDuckContestants,
  type DuckContestant,
  type DuckSabotagePower,
} from "./duckHuntEngine";
import {
  createDuckHunt3D,
  type DuckHuntController,
  type DuckHuntStats,
} from "./duckHunt3d";

type DuckPhase = "ready" | "flying" | "resetting" | "finished";

interface ActiveDuckPower {
  power: DuckSabotagePower;
  casterId: string;
  casterName: string;
}

const initialStats: DuckHuntStats = { fps: 60, visible: 0, renderCalls: 0, triangles: 0 };
const concealedColor = "#71808a";

const concealContestant = (contestant: DuckContestant): DuckContestant => {
  if (contestant.revealed || contestant.knockedOut) return contestant;
  return {
    ...contestant,
    accent: concealedColor,
    previousWinner: false,
    participant: {
      ...contestant.participant,
      name: `Pato oculto #${contestant.number}`,
      color: concealedColor,
    },
  };
};

export function DuckHunt({
  participants,
  previousWinnerIds,
  disabled,
  onCommit,
  onFinish,
  resumedCommitment,
}: {
  participants: Participant[];
  previousWinnerIds: ReadonlySet<string>;
  disabled: boolean;
  onCommit: (commitmentId: string, seed: string, survivorId: string) => void;
  onFinish: (survivor: DuckContestant, knockoutOrder: DuckContestant[]) => void;
  resumedCommitment?: { commitmentId: string; seed: string } | null;
}) {
  const [visualSeed, setVisualSeed] = useState(() => createDuckSeed());
  const [commitmentSeed, setCommitmentSeed] = useState(
    () => resumedCommitment?.seed ?? createDuckCommitmentSeed(),
  );
  const resumedCommitmentId = resumedCommitment?.commitmentId;
  const resumedCommitmentSeed = resumedCommitment?.seed;
  const [roundParticipants] = useState(() => participants);
  const [roundPreviousWinnerIds] = useState(() => new Set(previousWinnerIds));
  const initialContestants = useMemo(
    () => prepareDuckContestants(roundParticipants, visualSeed, roundPreviousWinnerIds),
    [roundParticipants, roundPreviousWinnerIds, visualSeed],
  );
  const [contestants, setContestants] = useState(initialContestants);
  const [commitment, setCommitment] = useState<DuckCommitment | null>(null);
  const [commitmentError, setCommitmentError] = useState<string | null>(null);
  const [rendererFailed, setRendererFailed] = useState(false);
  const [phase, setPhase] = useState<DuckPhase>("ready");
  const [stats, setStats] = useState(initialStats);
  const [shots, setShots] = useState(0);
  const [hits, setHits] = useState(0);
  const [hitStreak, setHitStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lastHit, setLastHit] = useState<DuckContestant | null>(null);
  const [activePower, setActivePower] = useState<ActiveDuckPower | null>(null);
  const [crosshair, setCrosshair] = useState({ x: 50, y: 48, visible: false });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<DuckHuntController | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const knockoutOrderRef = useRef<DuckContestant[]>([]);
  const commitmentCursorRef = useRef(0);
  const contestantsRef = useRef(initialContestants);

  useEffect(() => {
    let cancelled = false;
    setCommitment(null);
    setCommitmentError(null);
    createSealedDuckCommitmentFromSeed(
      initialContestants.map((contestant) => contestant.id),
      commitmentSeed,
    ).then((sealed) => {
      if (cancelled) return;
      if (resumedCommitmentId && sealed.commitmentId !== resumedCommitmentId) {
        setCommitmentError("El compromiso persistido no coincide con la lista actual.");
        return;
      }
      setCommitment(sealed);
    }).catch(() => {
      if (!cancelled) setCommitmentError("No fue posible sellar criptográficamente esta partida.");
    });
    return () => { cancelled = true; };
  }, [commitmentSeed, initialContestants, resumedCommitmentId]);

  useEffect(() => {
    setContestants(initialContestants);
    setPhase("ready");
    setShots(0);
    setHits(0);
    setHitStreak(0);
    setBestStreak(0);
    setLastHit(null);
    setActivePower(null);
    commitmentCursorRef.current = 0;
    knockoutOrderRef.current = [];
  }, [initialContestants]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendererFailed(false);
    try {
      const controller = createDuckHunt3D(
        canvas,
        initialContestants.map(concealContestant),
        setStats,
      );
      controllerRef.current = controller;
      return () => {
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
        controller.dispose();
        controllerRef.current = null;
      };
    } catch {
      controllerRef.current = null;
      setRendererFailed(true);
      return () => {
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      };
    }
  }, [initialContestants]);

  useEffect(() => {
    contestantsRef.current = contestants;
    controllerRef.current?.updateContestants(contestants.map(concealContestant));
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
  const resetDelay = getDuckResetDuration(contestants.length);

  useEffect(() => {
    if (phase !== "flying" || rendererFailed) {
      setActivePower(null);
      return;
    }
    let cancelled = false;
    let castTimer = 0;
    let clearTimer = 0;
    const randomFraction = () => {
      const entropy = new Uint32Array(1);
      crypto.getRandomValues(entropy);
      return entropy[0] / 2 ** 32;
    };
    const schedulePower = () => {
      castTimer = window.setTimeout(() => {
        if (cancelled) return;
        const candidates = contestantsRef.current.filter((contestant) => !contestant.knockedOut);
        if (candidates.length === 0) return;
        const caster = candidates[Math.min(candidates.length - 1, Math.floor(randomFraction() * candidates.length))];
        const definition = duckSabotageDefinitions[caster.power];
        setActivePower({
          power: caster.power,
          casterId: caster.id,
          casterName: caster.revealed ? caster.participant.name : `Pato oculto #${caster.number}`,
        });
        controllerRef.current?.castPower(caster.id);
        clearTimer = window.setTimeout(() => {
          if (cancelled) return;
          setActivePower(null);
          schedulePower();
        }, definition.durationMs);
      }, 2_000 + randomFraction() * 2_800);
    };
    schedulePower();
    return () => {
      cancelled = true;
      window.clearTimeout(castTimer);
      window.clearTimeout(clearTimer);
    };
  }, [phase, rendererFailed]);

  const start = () => {
    if (disabled || phase !== "ready" || !commitment || commitmentError) return;
    try {
      onCommit(commitment.commitmentId, commitmentSeed, commitment.survivorId);
    } catch {
      setCommitmentError("No se pudo registrar el compromiso central de la partida.");
      return;
    }
    fortunaAudio.playDuckStart();
    setActivePower(null);
    controllerRef.current?.setRunning(true);
    setPhase("flying");
  };

  const regenerate = () => {
    if (phase !== "ready") return;
    fortunaAudio.playClick();
    setVisualSeed(createDuckSeed());
    setCommitmentSeed(createDuckCommitmentSeed());
  };

  const updateCrosshair = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCrosshair({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      visible: true,
    });
  };

  const advanceCommittedHit = (visualHitId?: string) => {
    if (phase !== "flying" || !commitment) return;
    const targetId = commitment.hitOrder[commitmentCursorRef.current];
    if (!targetId) {
      setCommitmentError("El orden comprometido terminó sin producir un superviviente.");
      return;
    }
    const result = hitDuckContestant(contestants, targetId);
    if (!result) {
      setCommitmentError("El siguiente impacto comprometido ya no es válido.");
      return;
    }
    commitmentCursorRef.current += 1;
    const nextFlightContestants = prepareDuckNextFlight(result.contestants).map((contestant) => ({
      ...contestant,
      grazed: false,
      shielded: false,
    }));
    const target = nextFlightContestants.find((contestant) => contestant.id === targetId) ?? result.target;
    setHits((value) => value + 1);
    setHitStreak((value) => {
      const nextValue = value + 1;
      setBestStreak((currentBest) => Math.max(currentBest, nextValue));
      return nextValue;
    });
    setContestants(nextFlightContestants);
    setLastHit(target);
    setActivePower(null);
    setPhase("resetting");
    controllerRef.current?.updateContestants(nextFlightContestants.map(concealContestant));
    controllerRef.current?.resetFlock(
      visualHitId ?? targetId,
      `${target.participant.name} · ${duckLivesLabel(target.lives)}`,
    );
    fortunaAudio.playDuckShot(true);
    if (result.knockedOut) knockoutOrderRef.current = [...knockoutOrderRef.current, result.target];

    resetTimerRef.current = window.setTimeout(() => {
      if (result.survivor) {
        if (result.survivor.id !== commitment.survivorId) {
          setCommitmentError("El superviviente no coincide con el compromiso sellado.");
          return;
        }
        setPhase("finished");
        controllerRef.current?.setRunning(false);
        fortunaAudio.playDuckWinner();
        onFinish(result.survivor, knockoutOrderRef.current);
      } else {
        setPhase("flying");
        setLastHit(null);
        fortunaAudio.playDuckTakeoff();
      }
    }, resetDelay);
  };

  const shoot = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "flying") return;
    setShots((value) => value + 1);
    const shot = controllerRef.current?.shoot(event.clientX, event.clientY);
    if (!shot?.hitId) {
      if (shot) {
        setContestants((current) => learnFromDuckShot(
          current,
          shot.threatX,
          shot.threatY,
          shot.grazedId,
        ));
      }
      fortunaAudio.playDuckShot(false);
      setHitStreak(0);
      return;
    }
    advanceCommittedHit(shot.hitId);
  };

  const accessibleHit = () => {
    if (phase !== "flying") return;
    setShots((value) => value + 1);
    advanceCommittedHit();
  };

  const resolveCommittedOrder = () => {
    if (phase !== "flying" || !commitment) return;
    let workingContestants = contestants;
    let cursor = commitmentCursorRef.current;
    let resolvedHits = 0;
    let survivor: DuckContestant | null = null;
    const knockoutOrder = [...knockoutOrderRef.current];

    while (cursor < commitment.hitOrder.length) {
      const targetId = commitment.hitOrder[cursor];
      const result = hitDuckContestant(workingContestants, targetId);
      if (!result) {
        setCommitmentError("El orden sellado contiene un impacto que no se puede aplicar.");
        return;
      }
      resolvedHits += 1;
      cursor += 1;
      if (result.knockedOut) knockoutOrder.push(result.target);
      workingContestants = prepareDuckNextFlight(result.contestants).map((contestant) => ({
        ...contestant,
        grazed: false,
        shielded: false,
      }));
      if (result.survivor) {
        survivor = result.survivor;
        break;
      }
    }

    if (!survivor || survivor.id !== commitment.survivorId) {
      setCommitmentError("La resolución automática no coincide con el superviviente sellado.");
      return;
    }

    commitmentCursorRef.current = cursor;
    knockoutOrderRef.current = knockoutOrder;
    setShots((value) => value + resolvedHits);
    setHits((value) => value + resolvedHits);
    setContestants(workingContestants);
    setLastHit(survivor);
    setActivePower(null);
    setPhase("resetting");
    controllerRef.current?.updateContestants(workingContestants.map(concealContestant));
    controllerRef.current?.resetFlock(survivor.id, `${survivor.participant.name} · superviviente`);
    fortunaAudio.playDuckShot(true);

    resetTimerRef.current = window.setTimeout(() => {
      setPhase("finished");
      controllerRef.current?.setRunning(false);
      fortunaAudio.playDuckWinner();
      onFinish(survivor, knockoutOrder);
    }, Math.min(resetDelay, 900));
  };

  const accuracy = shots === 0 ? 0 : Math.round((hits / shots) * 100);
  const phaseLabel = phase === "ready"
    ? "Bandada preparada y sellada"
    : phase === "flying"
      ? "Cacería en curso"
      : phase === "resetting"
        ? "Bandada reagrupándose"
        : "Último pato en pie";
  const activePowerDefinition = activePower ? duckSabotageDefinitions[activePower.power] : null;
  const ActivePowerIcon = activePower?.power === "palette"
    ? Palette
    : activePower?.power === "shake"
      ? Vibrate
      : Contrast;

  return (
    <div
      className={`duck-hunt duck-hunt--${phase}`}
      data-duck-count={contestants.length}
      data-visible-ducks={stats.visible}
      data-fps={stats.fps}
      data-render-calls={stats.renderCalls}
      data-render-triangles={stats.triangles}
      data-render-mode={rendererFailed ? "fallback" : "webgl"}
      data-duck-power={activePower?.power ?? "none"}
      data-hit-streak={hitStreak}
      data-best-streak={bestStreak}
      data-release-stage="beta"
    >
      <div className="duck-hunt__status">
        <span className="duck-hunt__status-icon"><Feather size={19} /></span>
        <div>
          <strong>{phaseLabel}</strong>
          <small>
            {commitment
              ? `Compromiso SHA-256 ${commitment.commitmentId.slice(0, 12).toUpperCase()}…`
              : commitmentError ?? "Sellando orden antes de habilitar el inicio…"}
          </small>
        </div>
        <div className="duck-hunt__metrics">
          <span><Heart size={12} /> {livingCount} en pie</span>
          <span><ShieldCheck size={12} /> orden verificado</span>
          <span><Target size={12} /> {hits}/{shots}</span>
          <span><Crosshair size={12} /> racha ×{hitStreak}</span>
          <span>{accuracy}% precisión</span>
          <span>{rendererFailed ? "MODO 2D" : `${stats.fps} FPS`}</span>
        </div>
      </div>

      <div className={`duck-hunt__arena ${activePower ? `duck-power--${activePower.power}` : ""}`}>
        <canvas
          ref={canvasRef}
          onPointerMove={updateCrosshair}
          onPointerLeave={() => setCrosshair((value) => ({ ...value, visible: false }))}
          onPointerDown={shoot}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            accessibleHit();
          }}
          tabIndex={0}
          role="button"
          aria-disabled={phase !== "flying"}
          aria-label={`Campo de Patos con ${livingCount} en pie. Pulsa Enter o espacio para registrar el siguiente impacto comprometido.`}
        />
        <div
          className={`duck-crosshair ${crosshair.visible && phase === "flying" && !rendererFailed ? "is-visible" : ""}`}
          style={{ left: `${crosshair.x}%`, top: `${crosshair.y}%` }}
          aria-hidden="true"
        ><span /><i /></div>
        <div className="duck-hunt__render-badge"><span /> {rendererFailed ? "RESPALDO ACCESIBLE" : "CAMPO 3D EN VIVO"}</div>
        {activePower && activePowerDefinition && (
          <div className={`duck-power-alert duck-power-alert--${activePower.power}`} role="status" aria-live="assertive">
            <ActivePowerIcon size={18} />
            <strong>{activePowerDefinition.label}</strong>
            <span>{activePower.casterName} activó su poder</span>
          </div>
        )}
        <div className="duck-hunt__instruction" aria-live="polite">
          {commitmentError ? <><TriangleAlert size={18} /><strong>No se puede iniciar</strong><span>{commitmentError}</span></>
            : rendererFailed ? <><TriangleAlert size={18} /><strong>Vista 3D no disponible</strong><span>Usa el botón accesible: mantiene exactamente el mismo orden sellado.</span></>
              : phase === "ready" ? <><Crosshair size={18} /><strong>Apunta con el cursor</strong><span>Nombre, color y corona permanecen ocultos hasta el impacto.</span></>
                : phase === "resetting" && lastHit ? <><Target size={18} /><strong>{lastHit.participant.name}</strong><span>{lastHit.lives === 0 ? "Sin vidas · fuera de la partida" : `${duckLivesLabel(lastHit.lives)} · impacto oficial registrado`}</span></>
                  : phase === "finished" ? <><Trophy size={18} /><strong>Superviviente confirmado</strong><span>El resultado coincide con el compromiso previo.</span></>
                    : activePower && activePowerDefinition
                      ? <><ActivePowerIcon size={18} /><strong>{activePowerDefinition.label}</strong><span>{activePowerDefinition.description} El punto real del disparo no cambia.</span></>
                      : <><Crosshair size={18} /><strong>DISPARO HABILITADO</strong><span>Los patos se ocultan al azar; un impacto hace salir a toda la bandada.</span></>}
        </div>
      </div>

      <div className="duck-hunt__lower">
        <div className="duck-life-table">
          <header><span><Heart size={14} /> Tabla de vidas</span><small>Identidad oculta hasta el primer impacto</small></header>
          <div className="duck-life-table__list">
            {sortedContestants.map((contestant) => {
              const revealed = contestant.revealed || contestant.knockedOut;
              return (
                <div className={`duck-life-row ${contestant.knockedOut ? "is-out" : ""} ${lastHit?.id === contestant.id ? "is-hit" : ""}`} key={contestant.id}>
                  <b>#{contestant.number}</b>
                  <i style={{ background: revealed ? contestant.accent : concealedColor }} />
                  <strong className="duck-player-name">
                    <span>{revealed ? contestant.participant.name : `Participante oculto #${contestant.number}`}</span>
                    {revealed && contestant.previousWinner && <Crown className="duck-champion-crown" size={12} fill="currentColor" aria-label="Ganador anterior" />}
                  </strong>
                  <span className="duck-hearts" aria-label={duckLivesLabel(contestant.lives)}>
                    {[0, 1, 2].map((heart) => <Heart key={heart} size={12} fill={heart < contestant.lives ? "currentColor" : "none"} />)}
                  </span>
                  <em>{contestant.knockedOut ? "FUERA" : revealed ? `×${contestant.speed.toFixed(2)}` : "OCULTO"}</em>
                </div>
              );
            })}
          </div>
        </div>
        <div className="duck-hunt__controls">
          {phase === "ready" ? (
            <>
              <button type="button" className="text-button duck-regenerate" onClick={regenerate} disabled={!commitment || !!resumedCommitmentSeed}><RefreshCw size={15} /> Nueva bandada</button>
              <button type="button" className="start-button duck-start" onClick={start} disabled={disabled || !commitment || !!commitmentError}><Play size={19} fill="currentColor" /> Soltar los patos</button>
            </>
          ) : rendererFailed && phase === "flying" ? (
            <div className="duck-automatic-actions">
              <button type="button" className="text-button" onClick={accessibleHit}><Target size={18} /> Siguiente impacto</button>
              <button type="button" className="start-button" onClick={resolveCommittedOrder}><FastForward size={18} /> Resolver orden sellado</button>
            </div>
          ) : phase === "flying" ? (
            <div className="duck-automatic-actions">
              <div className="duck-flight-state duck-flight-state--flying"><span /><strong>APUNTA Y DISPARA</strong></div>
              <button type="button" className="text-button" onClick={accessibleHit}><Target size={18} /> Siguiente impacto</button>
              <button type="button" className="text-button" onClick={resolveCommittedOrder}><FastForward size={17} /> Resolución automática</button>
            </div>
          ) : (
            <div className={`duck-flight-state duck-flight-state--${phase}`}>
              <span /><strong>{phase === "resetting" ? "A CUBIERTO · SALIDA COLECTIVA" : "PARTIDA FINALIZADA"}</strong>
            </div>
          )}
          <small><Sparkles size={11} /> Tras cada impacto todos salen del pasto o los árboles en {(resetDelay / 1_000).toFixed(2)} s.</small>
        </div>
      </div>
    </div>
  );
}
