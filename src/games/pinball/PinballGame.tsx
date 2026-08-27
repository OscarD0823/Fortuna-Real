import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Bot, Camera, CircleGauge, Crown, Gamepad2, RefreshCw, Rocket, Sparkles, Zap } from "lucide-react";
import type { DrawMode, Participant, PinballControlMode } from "../../core/types";
import { fortunaAudio } from "../../shared/audio/audioEngine";
import {
  createPinballSeed,
  preparePinballRound,
  type PinballBallAssignment,
} from "./pinballEngine";
import {
  createPinballScene,
  type PinballSceneController,
  type PinballSceneStats,
} from "./pinball3d";

type PinballPhase = "ready" | "playing" | "finished";

export function PinballGame({
  participants,
  mode,
  controlMode,
  disabled,
  previousWinnerIds,
  initialSeed,
  onCommit,
  onFinish,
}: {
  participants: Participant[];
  mode: DrawMode;
  controlMode: PinballControlMode;
  disabled: boolean;
  previousWinnerIds: ReadonlySet<string>;
  initialSeed?: string;
  onCommit: (seed: string) => void;
  onFinish: (assignment: PinballBallAssignment, label: string) => void;
}) {
  const [seed, setSeed] = useState(() => initialSeed?.trim() || createPinballSeed());
  const [resumedSeed] = useState(() => Boolean(initialSeed?.trim()));
  const [roundParticipants] = useState(() => participants);
  const [roundPreviousWinnerIds] = useState(() => new Set(previousWinnerIds));
  const [phase, setPhase] = useState<PinballPhase>("ready");
  const [commitError, setCommitError] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<"webgl" | "fallback">("webgl");
  const [cameraTargetId, setCameraTargetId] = useState<string | null>(null);
  const [stats, setStats] = useState<PinballSceneStats>({ launched: 0, active: 0, collisions: 0, fps: 60, renderCalls: 0, triangles: 0 });
  const [manualNotice, setManualNotice] = useState(() => controlMode === "automatic"
    ? "La mesa lanzará todas las pelotas al mismo tiempo y accionará los flippers automáticamente."
    : "Pulsa LANZAR TODAS o la barra espaciadora para liberar el lote completo.");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<PinballSceneController | null>(null);
  const finishRef = useRef(onFinish);
  const lastImpactRef = useRef(0);
  const keyboardFlippersRef = useRef({ left: false, right: false });
  const pointerFlippersRef = useRef({ left: new Set<number>(), right: new Set<number>() });
  const fallbackTimerRef = useRef<number | null>(null);

  const syncManualFlippers = () => {
    const keyboard = keyboardFlippersRef.current;
    const pointers = pointerFlippersRef.current;
    controllerRef.current?.setFlippers(
      keyboard.left || pointers.left.size > 0,
      keyboard.right || pointers.right.size > 0,
    );
  };

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const round = useMemo(
    () => preparePinballRound(roundParticipants, mode, controlMode, seed, roundPreviousWinnerIds),
    [controlMode, mode, roundParticipants, roundPreviousWinnerIds, seed],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStats({ launched: 0, active: 0, collisions: 0, fps: 60, renderCalls: 0, triangles: 0 });
    setRenderMode("webgl");
    try {
      const controller = createPinballScene(canvas, round, {
        onStats: setStats,
        onImpact: (strength) => {
          const now = performance.now();
          if (now - lastImpactRef.current > 90) {
            fortunaAudio.playPinballImpact(strength);
            lastImpactRef.current = now;
          }
        },
        onFinish: (assignment, label) => {
          setPhase("finished");
          fortunaAudio.playPinballFinish();
          finishRef.current(assignment, label);
        },
      });
      controllerRef.current = controller;
      syncManualFlippers();
      return () => {
        controller.dispose();
        controllerRef.current = null;
      };
    } catch (error) {
      console.error("No se pudo crear Pinball 3D", error);
      setRenderMode("fallback");
      return;
    }
  }, [round]);

  useEffect(() => {
    controllerRef.current?.setFollowBall(cameraTargetId);
  }, [cameraTargetId, round]);

  useEffect(() => () => {
    if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
  }, []);

  useEffect(() => {
    if (controlMode !== "manual") return;
    const down = (event: KeyboardEvent) => {
      if (event.repeat || phase !== "playing") return;
      if (event.code === "Space") {
        event.preventDefault();
        const launched = controllerRef.current?.launchBurst() ?? 0;
        if (launched > 0) {
          fortunaAudio.playPinballLaunch();
          setManualNotice(`${roundParticipants.length} pelotas lanzadas simultáneamente.`);
        }
      }
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        keyboardFlippersRef.current.left = true;
        fortunaAudio.playPinballFlipper();
        syncManualFlippers();
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        event.preventDefault();
        keyboardFlippersRef.current.right = true;
        fortunaAudio.playPinballFlipper();
        syncManualFlippers();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") keyboardFlippersRef.current.left = false;
      if (event.code === "ArrowRight" || event.code === "KeyD") keyboardFlippersRef.current.right = false;
      syncManualFlippers();
    };
    const reset = () => {
      keyboardFlippersRef.current.left = false;
      keyboardFlippersRef.current.right = false;
      pointerFlippersRef.current.left.clear();
      pointerFlippersRef.current.right.clear();
      syncManualFlippers();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [controlMode, phase, roundParticipants.length]);

  const start = () => {
    if (disabled || phase !== "ready") return;
    try {
      onCommit(seed);
      setCommitError(null);
    } catch {
      setCommitError("La semilla no coincide con el compromiso persistente de esta mesa.");
      return;
    }
    setPhase("playing");
    fortunaAudio.playPinballStart();
    if (controllerRef.current) {
      controllerRef.current.start();
    } else {
      fallbackTimerRef.current = window.setTimeout(() => {
        setPhase("finished");
        fortunaAudio.playPinballFinish();
        finishRef.current(
          round.selected,
          round.drawMode === "direct" ? "RESULTADO SELLADO" : "ELIMINACIÓN SELLADA",
        );
      }, 1_350);
    }
    if (controlMode === "automatic") setManualNotice("La mesa liberará el lote completo a la vez y controlará los flippers.");
  };

  const regenerate = () => {
    if (phase !== "ready" || resumedSeed) return;
    setSeed(createPinballSeed());
  };

  const launch = () => {
    const launched = controllerRef.current?.launchBurst() ?? 0;
    if (launched > 0) {
      fortunaAudio.playPinballLaunch();
      setManualNotice(`${roundParticipants.length} pelotas lanzadas simultáneamente.`);
    } else if (stats.launched >= roundParticipants.length) {
      setManualNotice("Todas las pelotas están en juego. Usa los flippers para mantenerlas vivas.");
    }
  };

  const pressManualFlipper = (side: "left" | "right", event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const pointers = pointerFlippersRef.current[side];
    const wasPressed = pointers.size > 0;
    pointers.add(event.pointerId);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    syncManualFlippers();
    if (!wasPressed) fortunaAudio.playPinballFlipper();
  };

  const releaseManualFlipper = (side: "left" | "right", event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerFlippersRef.current[side].delete(event.pointerId);
    syncManualFlippers();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={`pinball-game pinball-game--${phase}`}
      data-ball-count={roundParticipants.length}
      data-control-mode={controlMode}
      data-fps={stats.fps}
      data-render-calls={stats.renderCalls}
      data-render-triangles={stats.triangles}
      data-render-mode={renderMode}
      data-launch-mode="simultaneous"
      data-camera-target={cameraTargetId ?? "overview"}
      data-release-stage="beta"
    >
      <div className="pinball-game__status" aria-live="polite">
        <span className="pinball-game__mode-icon">{controlMode === "automatic" ? <Bot size={19} /> : <Gamepad2 size={19} />}</span>
        <div>
          <strong>{controlMode === "automatic" ? "MESA AUTOMÁTICA" : "CONTROL MANUAL"}</strong>
          <small>{round.layout.name} · {round.layout.signature}</small>
        </div>
        <span className="pinball-game__fair"><Sparkles size={14} /> Resultado sellado</span>
        {round.balls.some((ball) => ball.previousWinner) && <span className="pinball-game__champions"><Crown size={12} fill="currentColor" /> Campeones en mesa</span>}
      </div>

      <div className="pinball-cabinet">
        <canvas ref={canvasRef} className={`pinball-canvas ${renderMode === "fallback" ? "is-inactive" : ""}`} aria-hidden={renderMode === "fallback"} aria-label={`Mesa de pinball 3D con ${roundParticipants.length} pelotas`} />
        {renderMode === "fallback" && (
          <div className="pinball-fallback" role="alert">
            <Gamepad2 size={42} />
            <strong>VISTA 3D NO DISPONIBLE</strong>
            <span>La ronda seguirá con el resultado comprometido, sin volver a decidir.</span>
          </div>
        )}
        <div className="pinball-cabinet__glass" aria-hidden="true" />
        <div className="pinball-cabinet__stats" aria-label={`${stats.launched} de ${roundParticipants.length} pelotas lanzadas`}>
          <span><Rocket size={13} /> LANZADAS <b>{stats.launched}/{roundParticipants.length}</b></span>
          <span><i /> EN MESA <b>{stats.active}</b></span>
          <span><Zap size={13} /> IMPACTOS <b>{stats.collisions}</b></span>
          <span><CircleGauge size={13} /> {stats.fps} FPS</span>
        </div>
        <label className="pinball-camera-control">
          <Camera size={16} aria-hidden="true" />
          <span><strong>CÁMARA</strong><small>{cameraTargetId ? "Siguiendo la pelota" : "Vista general"}</small></span>
          <select
            aria-label="Seguir a un participante desde su pelota"
            value={cameraTargetId ?? ""}
            onChange={(event) => {
              const nextTarget = event.target.value || null;
              setCameraTargetId(nextTarget);
              controllerRef.current?.setFollowBall(nextTarget);
              fortunaAudio.playClick();
            }}
            disabled={renderMode === "fallback"}
          >
            <option value="">Vista general</option>
            {round.balls.map((ball) => (
              <option key={ball.id} value={ball.id}>{ball.number}. {ball.participant.name}</option>
            ))}
          </select>
        </label>
        {phase === "ready" && (
          <div className="pinball-ready-panel">
            <strong>{roundParticipants.length} PELOTAS PREPARADAS</strong>
            <small>El lote saldrá unido; puedes elegir la cámara de cualquier participante.</small>
          </div>
        )}
      </div>

      <div className="pinball-controls">
        {phase === "ready" ? (
          <>
            <button type="button" className="pinball-regenerate" onClick={regenerate} disabled={disabled || resumedSeed}>
              <RefreshCw size={17} /> Nueva distribución
            </button>
            <button type="button" className="start-button pinball-start" onClick={start} disabled={disabled}>
              <Rocket size={20} /> Encender y jugar
            </button>
          </>
        ) : controlMode === "manual" && phase === "playing" ? (
          <div className="pinball-manual-controls">
            <button type="button" className="pinball-flipper pinball-flipper--left" onPointerDown={(event) => pressManualFlipper("left", event)} onPointerUp={(event) => releaseManualFlipper("left", event)} onPointerCancel={(event) => releaseManualFlipper("left", event)} onLostPointerCapture={(event) => releaseManualFlipper("left", event)}>A / ← <b>FLIPPER</b></button>
            <button type="button" className="pinball-launch" onClick={launch}><Rocket size={18} /> LANZAR TODAS <small>ESPACIO</small></button>
            <button type="button" className="pinball-flipper pinball-flipper--right" onPointerDown={(event) => pressManualFlipper("right", event)} onPointerUp={(event) => releaseManualFlipper("right", event)} onPointerCancel={(event) => releaseManualFlipper("right", event)} onLostPointerCapture={(event) => releaseManualFlipper("right", event)}><b>FLIPPER</b> → / D</button>
          </div>
        ) : (
          <div className="pinball-running"><span /><strong>{phase === "finished" ? "RESULTADO CONFIRMADO" : renderMode === "fallback" ? "RESOLVIENDO RONDA SELLADA" : "PINBALL EN MARCHA"}</strong></div>
        )}
        <small className="pinball-instruction">{commitError ?? (renderMode === "fallback" ? "Vista compatible activa: el resultado permanece verificable." : manualNotice)}</small>
        <small className="pinball-fairness">El resultado se compromete antes de jugar. La física y los controles solo cambian la presentación, nunca la persona seleccionada.</small>
      </div>
    </div>
  );
}
