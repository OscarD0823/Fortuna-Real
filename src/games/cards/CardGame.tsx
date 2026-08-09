import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Hand, Layers3, Play, Shuffle, Sparkles } from "lucide-react";
import type { DrawMode, Participant } from "../../core/types";
import { fortunaAudio } from "../../shared/audio/audioEngine";
import { buildCardAssignments, shuffleCards, type CardAssignment } from "./cardDeck";

type CardPhase = "assigned" | "gathering" | "shuffling" | "redealing" | "choosing" | "revealing";

const phaseCopy: Record<CardPhase, { title: string; detail: string }> = {
  assigned: {
    title: "Cartas asignadas",
    detail: "Comprueba cada nombre antes de ocultar el mazo.",
  },
  gathering: {
    title: "Reuniendo el mazo",
    detail: "Todas las cartas vuelven al centro de la mesa.",
  },
  shuffling: {
    title: "Barajando",
    detail: "El orden queda oculto antes del nuevo reparto.",
  },
  redealing: {
    title: "Repartiendo de nuevo",
    detail: "Cada carta ocupa una posición de selección.",
  },
  choosing: {
    title: "Elige una carta",
    detail: "La carta que abras decidirá el resultado de esta ronda.",
  },
  revealing: {
    title: "Carta seleccionada",
    detail: "Fortuna Real está confirmando el resultado.",
  },
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const waitForAnimations = async (animations: Animation[], fallbackMs: number) => {
  await Promise.race([
    Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))),
    wait(fallbackMs),
  ]);
};

export function CardGame({
  participants,
  mode,
  disabled,
  onSelect,
}: {
  participants: Participant[];
  mode: DrawMode;
  disabled: boolean;
  onSelect: (assignment: CardAssignment, position: number) => void;
}) {
  const [assignments, setAssignments] = useState(() => buildCardAssignments(participants));
  const [phase, setPhase] = useState<CardPhase>("assigned");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const mountedRef = useRef(true);
  const reducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );
  const columns = Math.max(2, Math.ceil(Math.sqrt(assignments.length * 1.35)));
  const rows = Math.ceil(assignments.length / columns);
  const performanceMode = assignments.length > 120
    ? "ultra"
    : assignments.length > 64
      ? "dense"
      : "standard";
  const highDensity = performanceMode !== "standard";
  const copy = phaseCopy[phase];
  const faceDown = phase !== "assigned";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cardRefs.current.forEach((card) => {
        card.getAnimations().forEach((animation) => animation.cancel());
      });
    };
  }, []);

  const stackTransform = (card: HTMLElement, center: { x: number; y: number }, index: number) => {
    const rect = card.getBoundingClientRect();
    const offsetX = center.x - (rect.left + rect.width / 2);
    const offsetY = center.y - (rect.top + rect.height / 2);
    const rotation = ((index % 9) - 4) * 0.7;
    return `translate3d(${offsetX}px, ${offsetY}px, 16px) rotate(${rotation}deg) scale(.78)`;
  };

  const gatherAndShuffle = async () => {
    if (phase !== "assigned" || disabled) return;
    const board = boardRef.current;
    if (!board) return;

    setPhase("gathering");
    fortunaAudio.playCardGather();
    await wait(reducedMotion ? 30 : 330);
    if (!mountedRef.current) return;

    const boardRect = board.getBoundingClientRect();
    const center = {
      x: boardRect.left + boardRect.width / 2,
      y: boardRect.top + boardRect.height / 2,
    };
    const cards = assignments
      .map((assignment) => cardRefs.current.get(assignment.id))
      .filter((card): card is HTMLButtonElement => Boolean(card));
    const gatherDuration = reducedMotion ? 40 : highDensity ? 520 : 720;
    const gatherAnimations = cards.map((card, index) => card.animate(
      highDensity
        ? [
            { transform: "none", opacity: 1 },
            { transform: stackTransform(card, center, index), opacity: 0.82 },
          ]
        : [
            { transform: "none", filter: "brightness(1)" },
            { transform: stackTransform(card, center, index), filter: "brightness(.72)" },
          ],
      {
        duration: gatherDuration,
        delay: reducedMotion || highDensity ? 0 : Math.min(index * 9, 240),
        easing: "cubic-bezier(.55, 0, .2, 1)",
        fill: "forwards",
      },
    ));
    await waitForAnimations(
      gatherAnimations,
      gatherDuration + (reducedMotion || highDensity ? 90 : 340),
    );
    if (!mountedRef.current) return;

    setPhase("shuffling");
    fortunaAudio.playCardShuffle();
    const shuffleDuration = reducedMotion ? 50 : highDensity ? 820 : 1250;
    const visibleShuffleCards = performanceMode === "ultra"
      ? cards.slice(-24)
      : highDensity
        ? cards.slice(-42)
        : cards;
    const shuffleAnimations = visibleShuffleCards.map((card, index) => {
      const base = stackTransform(card, center, index);
      const side = index % 2 === 0 ? 1 : -1;
      return card.animate(
        [
          { transform: base },
          { transform: `${base} translate3d(${side * (22 + (index % 5) * 5)}px, -5px, 38px) rotateY(${side * 12}deg) rotate(${side * 8}deg)` },
          { transform: `${base} translate3d(${side * -18}px, 4px, 24px) rotateY(${side * -9}deg) rotate(${side * -6}deg)` },
          { transform: base },
        ],
        {
          duration: shuffleDuration,
          delay: reducedMotion || highDensity ? 0 : (index % 11) * 18,
          easing: "ease-in-out",
          fill: "forwards",
        },
      );
    });
    await waitForAnimations(
      shuffleAnimations,
      shuffleDuration + (reducedMotion || highDensity ? 90 : 300),
    );
    if (!mountedRef.current) return;

    cards.forEach((card) => card.getAnimations().forEach((animation) => animation.cancel()));
    setAssignments((current) => shuffleCards(current));
    setPhase("redealing");
    fortunaAudio.playCardDeal();
    await nextFrame();
    if (!mountedRef.current) return;

    const redealtCards = Array.from(cardRefs.current.values());
    const dealAnimations = redealtCards.map((card, index) => card.animate(
      [
        { transform: stackTransform(card, center, index), opacity: 0.72 },
        { transform: "none", opacity: 1 },
      ],
      {
        duration: reducedMotion ? 40 : 760,
        delay: reducedMotion || highDensity ? 0 : Math.min(index * 12, 360),
        easing: "cubic-bezier(.16, 1, .3, 1)",
        fill: "both",
      },
    ));
    await waitForAnimations(
      dealAnimations,
      (reducedMotion ? 40 : 760) + (reducedMotion || highDensity ? 90 : 470),
    );
    if (!mountedRef.current) return;
    setPhase("choosing");
  };

  const selectCard = async (assignment: CardAssignment, position: number) => {
    if (phase !== "choosing" || disabled) return;
    const card = cardRefs.current.get(assignment.id);
    const board = boardRef.current;
    setSelectedCardId(assignment.id);
    setPhase("revealing");
    fortunaAudio.playCardSelect();
    await nextFrame();
    if (card && board && !reducedMotion) {
      const cardRect = card.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      const offsetX = boardRect.left + boardRect.width / 2 - (cardRect.left + cardRect.width / 2);
      const offsetY = boardRect.top + boardRect.height / 2 - (cardRect.top + cardRect.height / 2);
      const scale = Math.min(2.35, Math.max(1.28, 104 / Math.max(cardRect.width, 1)));
      await waitForAnimations([
        card.animate(
          [
            { transform: "translate3d(0, 0, 0) scale(1)", offset: 0 },
            { transform: `translate3d(${offsetX * .72}px, ${offsetY * .72}px, 70px) rotateZ(-2deg) scale(${scale * .92})`, offset: .68 },
            { transform: `translate3d(${offsetX}px, ${offsetY}px, 96px) rotateZ(0deg) scale(${scale})`, offset: 1 },
          ],
          {
            duration: 780,
            easing: "cubic-bezier(.16, 1, .3, 1)",
            fill: "forwards",
          },
        ),
      ], 850);
    } else {
      await wait(reducedMotion ? 50 : 820);
    }
    if (!mountedRef.current) return;
    onSelect(assignment, position);
  };

  return (
    <div
      className={`card-game card-game--${phase} card-game--${mode}`}
      data-card-count={assignments.length}
      data-performance-mode={performanceMode}
    >
      <div className="card-game-status" aria-live="polite">
        <span className="card-game-status__icon">
          {phase === "assigned" ? <Layers3 size={18} /> : phase === "choosing" ? <Hand size={18} /> : <Shuffle size={18} />}
        </span>
        <div>
          <strong>{copy.title}</strong>
          <small>{copy.detail}</small>
        </div>
        <span className="card-game-status__count">{assignments.length} cartas</span>
      </div>

      <div className="card-table">
        <div className="card-table__felt" aria-hidden="true"><Crown size={100} /></div>
        <div className="card-table__rail" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className={`card-deck-stage card-deck-stage--${phase}`} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
          <span><Crown size={24} /><b>FR</b></span>
        </div>
        <div
          ref={boardRef}
          className={`card-grid ${assignments.length > 36 ? "card-grid--dense" : ""} ${assignments.length > 72 ? "card-grid--very-dense" : ""} ${highDensity ? "card-grid--ultra-dense" : ""}`}
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
          aria-label="Cartas y participantes del sorteo"
        >
          {assignments.map((assignment, index) => {
            const selected = selectedCardId === assignment.id;
            const showFace = !faceDown || selected;
            return (
              <button
                type="button"
                key={assignment.id}
                ref={(element) => {
                  if (element) cardRefs.current.set(assignment.id, element);
                  else cardRefs.current.delete(assignment.id);
                }}
                className={`playing-card ${showFace ? "is-face-up" : "is-face-down"} ${selected ? "is-selected" : ""}`}
                onClick={() => selectCard(assignment, index + 1)}
                disabled={phase !== "choosing" || disabled}
                aria-label={showFace ? `${assignment.label}, ${assignment.participant.name}` : `Carta oculta ${index + 1}`}
              >
                <span className="playing-card__inner">
                  <span className={`playing-card__face ${assignment.isRed ? "is-red" : ""}`}>
                    <span className="playing-card__corner"><strong>{assignment.rank}</strong><i>{assignment.suitSymbol}</i></span>
                    <span className="playing-card__suit">{assignment.suitSymbol}</span>
                    <span className="playing-card__person" title={assignment.participant.name}>{assignment.participant.name}</span>
                    <span className="playing-card__number">#{index + 1}</span>
                  </span>
                  <span className="playing-card__back">
                    <span><Crown size={25} /><b>FR</b></span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-game-controls">
        {phase === "assigned" ? (
          <button type="button" className="start-button card-shuffle-button" onClick={gatherAndShuffle} disabled={disabled}>
            <Shuffle size={19} /> Reunir y barajar
          </button>
        ) : phase === "choosing" ? (
          <div className="card-choice-callout"><Sparkles size={18} /> Toca cualquiera de las cartas para revelar el resultado</div>
        ) : phase === "revealing" ? (
          <div className="card-choice-callout is-revealing"><Crown size={18} /> Confirmando participante…</div>
        ) : (
          <div className="card-choice-callout is-busy"><Play size={17} /> {copy.title}…</div>
        )}
        <small className="card-fairness-note">La asignación queda fijada antes de la animación y no cambia al elegir.</small>
      </div>
    </div>
  );
}
