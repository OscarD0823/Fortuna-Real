import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import type { RouletteEntry } from "../../core/types";
import { calculateSpinRotations } from "./rouletteMath";

export { calculateSpinRotations } from "./rouletteMath";

interface RouletteWheelProps {
  entries: RouletteEntry[];
  spinRequest: { entryId: string; nonce: number; ballLandingAngle: number } | null;
  isSpinning: boolean;
  onSpinEnd: () => void;
}

const TAU = Math.PI * 2;
export function RouletteWheel({
  entries,
  spinRequest,
  isSpinning,
  onSpinEnd,
}: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const wheelRotationRef = useRef(0);
  const ballRotationRef = useRef(0);
  const finishTimer = useRef<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [ballPhase, setBallPhase] = useState<"ready" | "launching" | "landed">("ready");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 900;
    const ratio = Math.min(window.devicePixelRatio || 1, entries.length > 120 ? 1.5 : 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, size, size);

    const center = size / 2;
    const outerRadius = 425;
    const innerRadius = 150;

    if (entries.length === 0) {
      const emptyGradient = context.createRadialGradient(
        center,
        center,
        innerRadius,
        center,
        center,
        outerRadius,
      );
      emptyGradient.addColorStop(0, "#13252d");
      emptyGradient.addColorStop(1, "#02080c");
      context.fillStyle = emptyGradient;
      context.beginPath();
      context.arc(center, center, outerRadius, 0, TAU);
      context.fill();
      return;
    }

    const slice = TAU / entries.length;
    entries.forEach((entry, index) => {
      const start = -Math.PI / 2 - slice / 2 + index * slice;
      const end = start + slice;
      const isRed = index % 2 === 0;
      const isSpecial = entry.kind === "parity";
      const isEvenSpecial = isSpecial && entry.parity === "even";
      const baseColor = entry.disabled
        ? "#172329"
        : isSpecial
          ? isEvenSpecial
            ? "#08aaa9"
            : "#b77a10"
          : isRed
            ? "#c8382b"
            : "#071116";
      const edgeColor = entry.disabled
        ? "#071014"
        : isSpecial
          ? isEvenSpecial
            ? "#025c61"
            : "#684006"
          : isRed
            ? "#7b1814"
            : "#010406";
      const outerColor = entry.disabled
        ? "#24343a"
        : isSpecial
          ? isEvenSpecial
            ? "#10d7d3"
            : "#e7a61a"
          : isRed
            ? "#e04a34"
            : "#14252b";
      let segmentFill: string | CanvasGradient = baseColor;
      if (entries.length <= 120) {
        const segmentGradient = context.createRadialGradient(
          center,
          center,
          innerRadius,
          center,
          center,
          outerRadius,
        );
        segmentGradient.addColorStop(0, edgeColor);
        segmentGradient.addColorStop(0.3, baseColor);
        segmentGradient.addColorStop(0.84, outerColor);
        segmentGradient.addColorStop(1, edgeColor);
        segmentFill = segmentGradient;
      }

      context.beginPath();
      context.arc(center, center, outerRadius, start, end);
      context.arc(center, center, innerRadius, end, start, true);
      context.closePath();
      context.fillStyle = segmentFill;
      context.fill();
      context.strokeStyle = isSpecial
        ? "rgba(255, 246, 187, .98)"
        : entry.disabled
          ? "rgba(104, 137, 145, .35)"
          : "rgba(245, 188, 52, .82)";
      context.lineWidth = entries.length > 140 ? 0.65 : entries.length > 70 ? 0.9 : entries.length > 36 ? 1.4 : 3.2;
      context.stroke();

    });

    context.shadowColor = "rgba(247, 177, 43, .5)";
    context.shadowBlur = 18;
    context.strokeStyle = "#f6c348";
    context.lineWidth = 13;
    context.beginPath();
    context.arc(center, center, outerRadius, 0, TAU);
    context.stroke();

    context.shadowBlur = 10;
    context.lineWidth = 10;
    context.beginPath();
    context.arc(center, center, innerRadius, 0, TAU);
    context.stroke();
  }, [entries]);

  useEffect(() => {
    if (!spinRequest || !isSpinning || entries.length === 0) return;
    const targetIndex = entries.findIndex((entry) => entry.id === spinRequest.entryId);
    if (targetIndex < 0) return;

    const { wheelRotation: nextWheelRotation, ballRotation: nextBallRotation } =
      calculateSpinRotations({
        entryCount: entries.length,
        targetIndex,
        ballLandingAngle: spinRequest.ballLandingAngle,
        currentWheelRotation: wheelRotationRef.current,
        currentBallRotation: ballRotationRef.current,
      });

    setBallPhase("ready");
    const launchFrame = window.requestAnimationFrame(() => {
      wheelRotationRef.current = nextWheelRotation;
      ballRotationRef.current = nextBallRotation;
      setWheelRotation(nextWheelRotation);
      setBallRotation(nextBallRotation);
      setBallPhase("launching");
    });

    if (finishTimer.current) window.clearTimeout(finishTimer.current);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    finishTimer.current = window.setTimeout(() => {
      setBallPhase("landed");
      onSpinEnd();
    }, reduceMotion ? 700 : 5900);

    return () => {
      window.cancelAnimationFrame(launchFrame);
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
    };
  }, [entries, isSpinning, onSpinEnd, spinRequest]);

  useEffect(() => {
    if (isSpinning || entries.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastFrame = performance.now();
    let animationFrame = 0;
    const animateIdle = (now: number) => {
      if (document.hidden) {
        lastFrame = now;
        animationFrame = window.requestAnimationFrame(animateIdle);
        return;
      }
      const elapsed = Math.min(50, now - lastFrame);
      lastFrame = now;
      wheelRotationRef.current += elapsed * 0.00355;
      if (rotorRef.current) {
        rotorRef.current.style.transform = `rotate(${wheelRotationRef.current}deg)`;
      }
      animationFrame = window.requestAnimationFrame(animateIdle);
    };
    animationFrame = window.requestAnimationFrame(animateIdle);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [entries.length, isSpinning]);

  useEffect(() => {
    if (isSpinning || ballPhase !== "landed") return;
    const returnTimer = window.setTimeout(() => setBallPhase("ready"), 850);
    return () => window.clearTimeout(returnTimer);
  }, [ballPhase, isSpinning]);

  const studCount = Math.min(60, Math.max(18, entries.length));
  const showEntryNames = entries.length <= 32;
  const isLargeWheel = entries.length >= 33;
  const isHugeWheel = entries.length > 120;
  const numberFontSize = Math.max(4.5, Math.min(13, 880 / Math.max(entries.length, 1)));

  return (
    <div
      className={`roulette casino-roulette ${isLargeWheel ? "roulette--large" : ""} ${isHugeWheel ? "roulette--huge" : ""} ${entries.length > 0 && !isSpinning ? "roulette--idle" : ""} ${isSpinning ? "roulette--spinning" : ""}`}
      data-entry-count={entries.length}
    >
      <div className="roulette-pointer" aria-hidden="true"><span /></div>
      <div className="wheel-outer-frame casino-wheel-frame">
        <div className="wheel-floor-shadow" aria-hidden="true" />
        <div className="wheel-depth-rim" aria-hidden="true">
          {Array.from({ length: 24 }, (_, index) => <i key={index} style={{ transform: `rotate(${index * 15}deg)` }} />)}
        </div>
        <div className="wheel-bowl-slope" aria-hidden="true" />
        <div
          ref={rotorRef}
          className="wheel-rotor"
          style={{
            transform: `rotate(${wheelRotation}deg)`,
            transition: isSpinning
              ? "transform 5.8s cubic-bezier(.08,.66,.08,1)"
              : "transform .11s linear",
          }}
        >
          <canvas
            ref={canvasRef}
            className="wheel-canvas"
            aria-label={`Ruleta de casino con ${entries.length} casillas visibles`}
          />
          <div className="wheel-labels" aria-hidden="true">
            {entries.map((entry, index) => {
              const angle = (index * 360) / entries.length;
              const radians = (angle * Math.PI) / 180;
              const labelRadius = isHugeWheel
                ? index % 2 === 0 ? 43.3 : 39.1
                : entries.length > 80 ? 42 : entries.length > 32 ? 41 : 35.5;
              const left = 50 + Math.sin(radians) * labelRadius;
              const top = 50 - Math.cos(radians) * labelRadius;
              const maxLength = entries.length > 24 ? 8 : entries.length > 14 ? 11 : 15;
              const shortName = entry.label.length > maxLength
                ? `${entry.label.slice(0, maxLength - 1)}…`
                : entry.label;

              return (
                <span
                  className={`wheel-label ${entry.kind === "parity" ? "wheel-label--special" : ""} ${entry.disabled ? "is-disabled" : ""}`}
                  data-entry-kind={entry.kind}
                  data-entry-parity={entry.kind === "parity" ? entry.parity : undefined}
                  key={entry.id}
                  style={{ left: `${left}%`, top: `${top}%`, fontSize: `${numberFontSize}px` }}
                >
                  {entry.kind === "participant" && <strong>{entry.number}</strong>}
                  {showEntryNames && entry.kind === "participant" && <small>{shortName}</small>}
                </span>
              );
            })}
          </div>
          <div className="wheel-studs" aria-hidden="true">
            {Array.from({ length: studCount }, (_, index) => (
              <i key={index} style={{ transform: `rotate(${index * (360 / studCount)}deg)` }} />
            ))}
          </div>
        </div>
        <div className="wheel-reflection" aria-hidden="true" />

        <div className="casino-ball-track" aria-hidden="true">
          <div
            className={`casino-ball-orbit casino-ball-orbit--${ballPhase}`}
            data-ball-phase={ballPhase}
            style={{ transform: `rotate(${ballRotation}deg)` }}
          >
            <span className="casino-ball-trail" />
            <span className="casino-ball" />
          </div>
        </div>

        <div className="wheel-hub" aria-hidden="true">
          <span className="hub-ring" />
          <span className="hub-cross"><i /><i /><b /></span>
          <span className="hub-cap" />
          <Crown size={42} strokeWidth={1.25} />
          <small>FORTUNA REAL</small>
        </div>
      </div>
    </div>
  );
}
