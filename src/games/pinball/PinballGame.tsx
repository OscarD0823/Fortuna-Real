import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CircleGauge, Crown, Gamepad2, RefreshCw, Rocket, Sparkles, Zap } from "lucide-react";
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

type PinballPhase = "ready" | "playing" | "finished" | "error";

export function PinballGame({
  participants,
  mode,
  controlMode,
  disabled,
  previousWinnerIds,
  onFinish,
}: {
  participants: Participant[];
  mode: DrawMode;
  controlMode: PinballControlMode;
  disabled: boolean;
  previousWinnerIds: ReadonlySet<string>;
  onFinish: (assignment: PinballBallAssignment, label: string) => void;
}) {
  const [seed, setSeed] = useState(createPinballSeed);
  const [roundParticipants] = useState(() => participants);
  const [phase, setPhase] = useState<PinballPhase>("ready");
  const [stats, setStats] = useState<PinballSceneStats>({ launched: 0, active: 0, collisions: 0, fps: 60 });
  const [manualNotice, setManualNotice] = useState("Pulsa LANZAR o la barra espaciadora para soltar las pelotas.");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<PinballSceneController | null>(null);
  const finishRef = useRef(onFinish);
  const lastImpactRef = useRef(0);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const round = useMemo(
    () => preparePinballRound(roundParticipants, mode, controlMode, seed, previousWinnerIds),
    [controlMode, mode, previousWinnerIds, roundParticipants, seed],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStats({ launched: 0, active: 0, collisions: 0, fps: 60 });
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
      return () => {
        controller.dispose();
        controllerRef.current = null;
      };
    } catch (error) {
      console.error("No se pudo crear Pinball 3D", error);
      setPhase("error");
      return;
    }
  }, [round]);

  useEffect(() => {
    if (controlMode !== "manual") return;
    const keys = { left: false, right: false };
    const update = () => controllerRef.current?.setFlippers(keys.left, keys.right);
    const down = (event: KeyboardEvent) => {
      if (event.repeat || phase !== "playing") return;
      if (event.code === "Space") {
        event.preventDefault();
        const launched = controllerRef.current?.launchBurst() ?? 0;
        if (launched > 0) {
          fortunaAudio.playPinballLaunch();
          setManualNotice(`${stats.launched + launched} de ${roundParticipants.length} pelotas lanzadas.`);
        }
      }
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        keys.left = true;
        fortunaAudio.playPinballFlipper();
        update();
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        event.preventDefault();
        keys.right = true;
        fortunaAudio.playPinballFlipper();
        update();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
      if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [controlMode, phase, roundParticipants.length, stats.launched]);

  const start = () => {
    if (disabled || phase !== "ready") return;
    setPhase("playing");
    fortunaAudio.playPinballStart();
    controllerRef.current?.start();
    if (controlMode === "automatic") setManualNotice("La mesa controla lanzador y flippers automáticamente.");
  };

  const regenerate = () => {
    if (phase !== "ready") return;
    setSeed(createPinballSeed());
  };

  const launch = () => {
    const launched = controllerRef.current?.launchBurst() ?? 0;
    if (launched > 0) {
      fortunaAudio.playPinballLaunch();
      setManualNotice(`${Math.min(roundParticipants.length, stats.launched + launched)} de ${roundParticipants.length} pelotas lanzadas.`);
    } else if (stats.launched >= roundParticipants.length) {
      setManualNotice("Todas las pelotas están en juego. Usa los flippers para mantenerlas vivas.");
    }
  };

  const setManualFlipper = (side: "left" | "right", pressed: boolean) => {
    const left = side === "left" ? pressed : false;
    const right = side === "right" ? pressed : false;
    controllerRef.current?.setFlippers(left, right);
    if (pressed) fortunaAudio.playPinballFlipper();
  };

  return (
    <div className={`pinball-game pinball-game--${phase}`} data-ball-count={roundParticipants.length} data-control-mode={controlMode}>
      <div className="pinball-game__status" aria-live="polite">
        <span className="pinball-game__mode-icon">{controlMode === "automatic" ? <Bot size={19} /> : <Gamepad2 size={19} />}</span>
        <div>
          <strong>{controlMode === "automatic" ? "MESA AUTOMÁTICA" : "CONTROL MANUAL"}</strong>
          <small>{round.layout.name} · {round.layout.signature}</small>
        </div>
        <span className="pinball-game__fair"><Sparkles size={14} /> Meta física real</span>
        {round.balls.some((ball) => ball.previousWinner) && <span className="pinball-game__champions"><Crown size={12} fill="currentColor" /> Campeones en mesa</span>}
      </div>

      <div className="pinball-cabinet">
        <canvas ref={canvasRef} className="pinball-canvas" aria-label={`Mesa de pinball 3D con ${roundParticipants.length} pelotas`} />
        <div className="pinball-cabinet__glass" aria-hidden="true" />
        <div className="pinball-cabinet__stats">
          <span><i /> EN MESA <b>{stats.active}</b></span>
          <span><Zap size={13} /> IMPACTOS <b>{stats.collisions}</b></span>
          <span><CircleGauge size={13} /> {stats.fps} FPS</span>
        </div>
        {phase === "ready" && (
          <div className="pinball-ready-panel">
            <strong>{roundParticipants.length} PELOTAS PREPARADAS</strong>
            <small>La cámara presenta a todos; al iniciar se alejará para mostrar la mesa completa.</small>
          </div>
        )}
      </div>

      <div className="pinball-controls">
        {phase === "ready" ? (
          <>
            <button type="button" className="pinball-regenerate" onClick={regenerate} disabled={disabled}>
              <RefreshCw size={17} /> Nueva distribución
            </button>
            <button type="button" className="start-button pinball-start" onClick={start} disabled={disabled}>
              <Rocket size={20} /> Encender y jugar
            </button>
          </>
        ) : controlMode === "manual" && phase === "playing" ? (
          <div className="pinball-manual-controls">
            <button type="button" className="pinball-flipper pinball-flipper--left" onPointerDown={() => setManualFlipper("left", true)} onPointerUp={() => setManualFlipper("left", false)} onPointerLeave={() => setManualFlipper("left", false)}>A / ← <b>FLIPPER</b></button>
            <button type="button" className="pinball-launch" onClick={launch}><Rocket size={18} /> LANZAR <small>ESPACIO</small></button>
            <button type="button" className="pinball-flipper pinball-flipper--right" onPointerDown={() => setManualFlipper("right", true)} onPointerUp={() => setManualFlipper("right", false)} onPointerLeave={() => setManualFlipper("right", false)}><b>FLIPPER</b> → / D</button>
          </div>
        ) : (
          <div className="pinball-running"><span /><strong>{phase === "finished" ? "RESULTADO CONFIRMADO" : "PINBALL REAL EN MARCHA"}</strong></div>
        )}
        <small className="pinball-instruction">{phase === "error" ? "Este equipo no pudo iniciar WebGL. Actualiza el controlador de video." : manualNotice}</small>
        <small className="pinball-fairness">El orden de salida se mezcla en cada mesa. El sensor confirma la primera pelota que atraviesa la meta.</small>
      </div>
    </div>
  );
}
