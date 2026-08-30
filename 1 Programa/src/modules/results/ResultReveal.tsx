import { Binary, Bird, Copy, Crown, Gamepad2, Gem, Layers3, RotateCcw, ShieldCheck, Target, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { RoundResult } from "../../core/types";

export function ResultReveal({
  result,
  onClose,
  onReenableWinner,
  soundEnabled,
}: {
  result: RoundResult;
  onClose: () => void;
  onReenableWinner?: () => void;
  soundEnabled: boolean;
}) {
  const isWinner = result.kind === "winner";
  const isQualifiedRound = result.kind === "qualified";
  const isParitySelection = result.kind === "parity-selected";
  const isCardGame = result.game === "cards";
  const isMarbleGame = result.game === "marbles";
  const isPinballGame = result.game === "pinball";
  const isDuckGame = result.game === "ducks";
  const parityLabel = result.parity === "even" ? "PAR" : "IMPAR";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `result-title-${result.id}`;
  const descriptionId = `result-description-${result.id}`;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => {
      (primaryActionRef.current ?? dialogRef.current)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus();
      } else {
        document.querySelector<HTMLElement>(
          ".cards-restart-button:not([disabled]), .text-button:not([disabled]), button:not([disabled])",
        )?.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="reveal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        ref={dialogRef}
        className={`result-reveal result-reveal--${result.game} ${
          isWinner
            ? "result-reveal--winner"
            : isQualifiedRound || isParitySelection
              ? `result-reveal--parity result-reveal--${result.parity}`
              : "result-reveal--eliminated"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="reveal-close" type="button" onClick={onClose} aria-label="Cerrar resultado">
          <X size={19} />
        </button>
        <div className="reveal-spotlights" aria-hidden="true"><i /><i /><i /></div>
        <div className={`confetti ${isWinner ? "is-celebrating" : ""}`} aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => <i key={index} />)}
        </div>
        {isWinner ? (
          <div className="reward-chest" aria-hidden="true">
            <span className="reward-chest__aura" />
            <span className="reward-chest__rays"><i /><i /><i /><i /><i /><i /></span>
            <span className="reward-chest__coins"><i /><i /><i /><i /><i /></span>
            <span className="reward-chest__scene">
              <span className="reward-chest__lid"><i /><b /></span>
              <span className="reward-chest__body"><i /><b /></span>
              <span className="reward-chest__lock"><Crown size={21} /></span>
              <span className="reward-chest__foot reward-chest__foot--left" />
              <span className="reward-chest__foot reward-chest__foot--right" />
            </span>
          </div>
        ) : (
          <div className="reveal-icon">
            {isQualifiedRound || isParitySelection ? <Binary size={50} /> : isCardGame ? <Layers3 size={48} /> : isPinballGame ? <Gamepad2 size={48} /> : isMarbleGame ? <Gem size={48} /> : isDuckGame ? <Bird size={48} /> : <Target size={48} />}
          </div>
        )}

        {(isWinner || (!isQualifiedRound && !isParitySelection)) && (
          <div className="reveal-announcement" aria-live="assertive">
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>
              {soundEnabled
                ? isWinner ? "Locución celebratoria: ganador" : "Anuncio oficial: eliminado"
                : "Anuncio por voz silenciado"}
            </span>
          </div>
        )}

        {isParitySelection ? (
          <>
            <span className="reveal-kicker">CASILLA ESPECIAL {parityLabel}</span>
            <h2 id={titleId} className="parity-result-title">Referencia visual {parityLabel}</h2>
            <div className={`large-parity-badge large-parity-badge--${result.parity}`}>
              {parityLabel}
            </div>
            <p id={descriptionId}>
              Este es un resultado heredado. La paridad ya no filtra participantes: la siguiente persona se comprometerá <strong>uniformemente entre todos los habilitados</strong>.
            </p>
          </>
        ) : isQualifiedRound ? (
          <>
            <span className="reveal-kicker">LA PELOTA CAYÓ EN EL NÚMERO {result.landedNumber}</span>
            <h2 id={titleId} className="parity-result-title">Referencia visual {parityLabel}</h2>
            <div className={`large-parity-badge large-parity-badge--${result.parity}`}>
              {parityLabel}
            </div>
            <p id={descriptionId}>
              La casilla de <strong>{result.participantName}</strong> marcó {parityLabel}, solo como presentación. Quedan {result.remainingCount} participantes habilitados.
            </p>
          </>
        ) : (
          <>
            <span className="reveal-kicker">
              {isWinner
                ? isDuckGame
                  ? `ÚLTIMO PATO EN PIE · ${result.selectionLabel?.toUpperCase() || "SUPERVIVIENTE"}`
                  : result.selectedParticipantName
                  ? `GANADOR TRAS SALIR ${result.selectedParticipantName.toUpperCase()}`
                  : (isMarbleGame || isPinballGame) && result.selectionLabel
                    ? `${result.selectionLabel.toUpperCase()} · TENEMOS GANADOR`
                    : "TENEMOS GANADOR"
                : isCardGame
                  ? `${(result.selectionLabel || `CARTA ${result.landedNumber}`).toUpperCase()} · CARTA SELECCIONADA`
                  : isPinballGame
                    ? `${(result.selectionLabel || `PELOTA ${result.landedNumber}`).toUpperCase()} · PINBALL FINALIZADO`
                  : isMarbleGame
                    ? `${(result.selectionLabel || `CANICA ${result.landedNumber}`).toUpperCase()} · CARRERA FINALIZADA`
                  : `NÚMERO ${result.landedNumber} · SALE DE LA RULETA`}
            </span>
            <h2 id={titleId}>{result.participantName}</h2>
            <p id={descriptionId}>
              {isWinner
                ? isDuckGame
                  ? <>Es la última persona con vida y se lleva <strong>{result.prize || "Premio del sorteo"}</strong>. Podrás habilitarla otra vez sin perder este premio.</>
                  : result.selectedParticipantName
                  ? <>Tras salir <strong>{result.selectedParticipantName}</strong>, se convierte en ganador final y recibe <strong>{result.prize || "Premio del sorteo"}</strong>.</>
                  : <>Se lleva <strong>{result.prize || "Premio del sorteo"}</strong>. Esta persona quedará fuera hasta que decidas habilitarla nuevamente.</>
                : isCardGame
                  ? "Su carta sale del mazo y el nombre queda marcado como eliminado para la siguiente ronda."
                  : isPinballGame
                    ? "Su pelota activó el resultado sellado y el nombre queda eliminado. La próxima ronda tendrá un compromiso completamente nuevo."
                  : isMarbleGame
                    ? "Su canica cruzó de última y el nombre queda marcado como eliminado. La próxima ronda tendrá una pista nueva."
                  : "Su casilla desaparece de la ruleta y el nombre queda marcado como eliminado."}
            </p>
          </>
        )}

        {result.auditHash && result.commitmentId && (
          <div className="result-proof" aria-label="Comprobante verificable de la ronda">
            <ShieldCheck size={16} />
            <span><strong>Ronda verificada</strong><small>{result.auditHash.slice(0, 20).toUpperCase()}…</small></span>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(JSON.stringify({
                auditId: result.auditId,
                commitmentId: result.commitmentId,
                revealedSeed: result.revealedSeed,
                auditHash: result.auditHash,
                result: {
                  participantId: result.participantId,
                  participantName: result.participantName,
                  kind: result.kind,
                  landedNumber: result.landedNumber,
                },
              }, null, 2))}
              aria-label="Copiar comprobante de la ronda"
            ><Copy size={14} /> Copiar</button>
          </div>
        )}

        <div className="reveal-actions">
          <button ref={primaryActionRef} className="reveal-action" type="button" onClick={onClose}>
            {isWinner ? (
              <><Trophy size={17} /> {result.mode === "direct" ? "Continuar sin repetir" : "Cerrar resultado"}</>
            ) : isParitySelection ? (
              "Cerrar referencia de paridad"
            ) : (
              "Continuar a la siguiente ronda"
            )}
          </button>
          {isWinner && onReenableWinner && (
            <button className="reveal-reenable" type="button" onClick={onReenableWinner}>
              <RotateCcw size={16} />
              {result.mode === "direct"
                ? `Permitir que ${result.participantName} participe otra vez`
                : "Habilitar ganador e iniciar un nuevo sorteo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
