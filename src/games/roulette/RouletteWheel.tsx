import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import type { Participant } from "../../core/types";

interface RouletteWheelProps {
  participants: Participant[];
  spinRequest: { participantId: string; nonce: number } | null;
  isSpinning: boolean;
  onSpinEnd: () => void;
}

const TAU = Math.PI * 2;

const normalizeDegrees = (value: number) => ((value % 360) + 360) % 360;

export function RouletteWheel({
  participants,
  spinRequest,
  isSpinning,
  onSpinEnd,
}: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const finishTimer = useRef<number | null>(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 720;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, size, size);

    const center = size / 2;
    const outerRadius = 345;
    const innerRadius = 116;

    if (participants.length === 0) {
      const gradient = context.createRadialGradient(center, center, 80, center, center, outerRadius);
      gradient.addColorStop(0, "#101a22");
      gradient.addColorStop(1, "#03080d");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(center, center, outerRadius, 0, TAU);
      context.fill();
      return;
    }

    const slice = TAU / participants.length;
    participants.forEach((participant, index) => {
      const start = -Math.PI / 2 + index * slice;
      const end = start + slice;
      const shade = context.createRadialGradient(center, center, innerRadius, center, center, outerRadius);
      shade.addColorStop(0, `${participant.color}aa`);
      shade.addColorStop(0.72, participant.color);
      shade.addColorStop(1, `${participant.color}c7`);

      context.beginPath();
      context.arc(center, center, outerRadius, start, end);
      context.arc(center, center, innerRadius, end, start, true);
      context.closePath();
      context.fillStyle = shade;
      context.fill();
      context.strokeStyle = "rgba(1, 7, 11, .82)";
      context.lineWidth = 4;
      context.stroke();

      const middle = start + slice / 2;
      context.save();
      context.translate(center, center);
      context.rotate(middle);
      context.translate(0, -outerRadius * 0.68);
      let textRotation = Math.PI / 2;
      const normalizedMiddle = normalizeDegrees((middle * 180) / Math.PI);
      if (normalizedMiddle > 0 && normalizedMiddle < 180) textRotation += Math.PI;
      context.rotate(textRotation);
      context.font = `700 ${participants.length > 18 ? 13 : participants.length > 12 ? 15 : 18}px Inter, Arial`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.shadowColor = "rgba(0, 0, 0, .85)";
      context.shadowBlur = 5;
      context.fillStyle = "#ffffff";
      const maxLength = participants.length > 18 ? 11 : 15;
      const label = participant.name.length > maxLength
        ? `${participant.name.slice(0, maxLength - 1)}…`
        : participant.name;
      context.fillText(label, 0, 0);
      context.restore();
    });

    context.beginPath();
    context.arc(center, center, outerRadius + 1, 0, TAU);
    context.strokeStyle = "#f8c349";
    context.lineWidth = 12;
    context.shadowColor = "rgba(247, 177, 43, .45)";
    context.shadowBlur = 16;
    context.stroke();

    context.beginPath();
    context.arc(center, center, innerRadius, 0, TAU);
    context.strokeStyle = "#f2b52d";
    context.lineWidth = 9;
    context.shadowBlur = 10;
    context.stroke();
  }, [participants]);

  useEffect(() => {
    if (!spinRequest || !isSpinning || participants.length < 2) return;
    const targetIndex = participants.findIndex(
      (person) => person.id === spinRequest.participantId,
    );
    if (targetIndex < 0) return;

    const sliceDegrees = 360 / participants.length;
    const desired = normalizeDegrees(-(targetIndex + 0.5) * sliceDegrees);
    const currentNormalized = normalizeDegrees(rotationRef.current);
    const adjustment = normalizeDegrees(desired - currentNormalized);
    const nextRotation = rotationRef.current + 7 * 360 + adjustment;
    rotationRef.current = nextRotation;

    window.requestAnimationFrame(() => setRotation(nextRotation));

    if (finishTimer.current) window.clearTimeout(finishTimer.current);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    finishTimer.current = window.setTimeout(onSpinEnd, reduceMotion ? 700 : 5900);

    return () => {
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
    };
  }, [isSpinning, onSpinEnd, participants, spinRequest]);

  return (
    <div className={`roulette ${isSpinning ? "roulette--spinning" : ""}`}>
      <div className="roulette-pointer" aria-hidden="true">
        <span />
      </div>
      <div className="wheel-outer-frame">
        <div
          className="wheel-rotor"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <canvas ref={canvasRef} className="wheel-canvas" aria-label="Ruleta de participantes" />
          <div className="wheel-studs" aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => (
              <i key={index} style={{ transform: `rotate(${index * 22.5}deg)` }} />
            ))}
          </div>
        </div>
        <div className="wheel-hub" aria-hidden="true">
          <span className="hub-ring" />
          <Crown size={42} strokeWidth={1.25} />
          <small>FORTUNA</small>
        </div>
      </div>
    </div>
  );
}
