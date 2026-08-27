import { useLayoutEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, Volume2, X } from "lucide-react";
import { fortunaAudio } from "../audio/audioEngine";
import { guidedTours, type TutorialId } from "./tutorialContent";
import { useTutorialDialog } from "./useTutorialDialog";

interface TourGeometry {
  spotlight: CSSProperties;
  card: CSSProperties;
  hasTarget: boolean;
}

const emptyGeometry: TourGeometry = {
  spotlight: {},
  card: {},
  hasTarget: false,
};

const calculateGeometry = (target: Element | null, cardHeight: number): TourGeometry => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = Math.min(390, viewportWidth - 28);
  const estimatedCardHeight = Math.min(cardHeight, viewportHeight - 28);
  const gap = 18;
  if (!target) {
    return {
      hasTarget: false,
      spotlight: {},
      card: {
        left: Math.max(14, (viewportWidth - cardWidth) / 2),
        top: Math.max(14, (viewportHeight - estimatedCardHeight) / 2),
        width: cardWidth,
      },
    };
  }

  const rect = target.getBoundingClientRect();
  const padding = viewportWidth < 700 ? 6 : 10;
  const spotlightLeft = Math.max(6, rect.left - padding);
  const spotlightTop = Math.max(6, rect.top - padding);
  const spotlightRight = Math.min(viewportWidth - 6, rect.right + padding);
  const spotlightBottom = Math.min(viewportHeight - 6, rect.bottom + padding);
  let left = spotlightRight + gap;
  let top = Math.max(14, spotlightTop);

  if (left + cardWidth > viewportWidth - 14) left = spotlightLeft - cardWidth - gap;
  if (left < 14) {
    left = Math.max(14, Math.min(viewportWidth - cardWidth - 14, spotlightLeft));
    top = spotlightBottom + gap;
    if (top + estimatedCardHeight > viewportHeight - 14) {
      top = Math.max(14, spotlightTop - estimatedCardHeight - gap);
    }
  }
  if (viewportWidth < 700) {
    left = 14;
    top = Math.max(14, viewportHeight - estimatedCardHeight - 14);
  }
  top = Math.min(top, Math.max(14, viewportHeight - estimatedCardHeight - 14));

  return {
    hasTarget: rect.width > 0 && rect.height > 0,
    spotlight: {
      left: spotlightLeft,
      top: spotlightTop,
      width: Math.max(0, spotlightRight - spotlightLeft),
      height: Math.max(0, spotlightBottom - spotlightTop),
    },
    card: { left, top, width: cardWidth },
  };
};

export function GuidedTour({
  tutorialId,
  onDone,
  canNarrate,
}: {
  tutorialId: TutorialId;
  onDone: () => void;
  canNarrate: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [geometry, setGeometry] = useState<TourGeometry>(emptyGeometry);
  const steps = guidedTours[tutorialId];
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const { dialogRef, onKeyDown, onKeyUp } = useTutorialDialog<HTMLDivElement>(
    `${tutorialId}-${stepIndex}`,
    onDone,
    (direction) => setStepIndex((index) => Math.max(0, Math.min(steps.length - 1, index + direction))),
  );

  useLayoutEffect(() => {
    let frame = 0;
    let settleTimer = 0;
    const target = document.querySelector(step.target);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "center", inline: "center" });
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setGeometry(calculateGeometry(document.querySelector(step.target), dialogRef.current?.offsetHeight ?? 320)));
    };
    update();
    settleTimer = window.setTimeout(update, 360);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [dialogRef, step.target]);

  return (
    <div className={`guided-tour ${geometry.hasTarget ? "guided-tour--has-target" : ""}`} data-tutorial={tutorialId}>
      <div className="guided-tour__shade" />
      {geometry.hasTarget && <div className="guided-tour__spotlight" style={geometry.spotlight} aria-hidden="true" />}
      <div
        ref={dialogRef}
        className="guided-tour__card"
        style={geometry.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <button type="button" className="guided-tour__close" onClick={onDone} aria-label="Cerrar tutorial"><X size={18} /></button>
        <span className="guided-tour__eyebrow">{step.eyebrow}</span>
        <h2 id="guided-tour-title">{step.title}</h2>
        <p id="guided-tour-description">{step.description}</p>
        <div className="guided-tour__tip"><Check size={15} /><span>{step.tip}</span></div>
        <div className="guided-tour__progress" aria-label={`Paso ${stepIndex + 1} de ${steps.length}`}>
          {steps.map((item, index) => <i className={index === stepIndex ? "is-active" : index < stepIndex ? "is-complete" : ""} key={item.title} />)}
        </div>
        <div className="guided-tour__actions">
          <button type="button" className="guided-tour__listen" disabled={!canNarrate} title={canNarrate ? "Escuchar este paso" : "Activa la locución y sube el volumen en la barra superior"} onClick={() => fortunaAudio.speakGuide(`${step.title}. ${step.description} ${step.tip}`)}>
            <Volume2 size={16} /> Escuchar
          </button>
          <span />
          <button type="button" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0} aria-label="Paso anterior"><ArrowLeft size={17} /></button>
          <button
            type="button"
            className="guided-tour__next"
            onClick={() => isLast ? onDone() : setStepIndex((index) => index + 1)}
          >
            {isLast ? <><Check size={17} /> Entendido</> : <>Siguiente <ArrowRight size={17} /></>}
          </button>
        </div>
        <small>Usa ← → para avanzar · Esc para cerrar</small>
      </div>
    </div>
  );
}
