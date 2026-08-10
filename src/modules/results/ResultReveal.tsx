import { Binary, Bird, Crown, Gamepad2, Gem, Layers3, RotateCcw, Target, Trophy, Volume2, VolumeX, X } from "lucide-react";
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

  return (
    <div className="reveal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className={`result-reveal result-reveal--${result.game} ${
          isWinner
            ? "result-reveal--winner"
            : isQualifiedRound || isParitySelection
              ? `result-reveal--parity result-reveal--${result.parity}`
              : "result-reveal--eliminated"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={`Resultado de ${isCardGame ? "las cartas" : isPinballGame ? "Pinball 3D" : isMarbleGame ? "las canicas" : isDuckGame ? "Patos 3D" : "la ruleta"}`}
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
            <h2 className="parity-result-title">Solo juegan los {parityLabel === "PAR" ? "pares" : "impares"}</h2>
            <div className={`large-parity-badge large-parity-badge--${result.parity}`}>
              {parityLabel}
            </div>
            <p>
              La próxima tirada eliminará <strong>un solo participante</strong> entre los {parityLabel === "PAR" ? "pares" : "impares"}. Después, todos los demás volverán a estar disponibles.
            </p>
          </>
        ) : isQualifiedRound ? (
          <>
            <span className="reveal-kicker">LA PELOTA CAYÓ EN EL NÚMERO {result.landedNumber}</span>
            <h2 className="parity-result-title">Pasan los {parityLabel === "PAR" ? "pares" : "impares"}</h2>
            <div className={`large-parity-badge large-parity-badge--${result.parity}`}>
              {parityLabel}
            </div>
            <p>
              La casilla de <strong>{result.participantName}</strong> marcó {parityLabel}. Quedan {result.remainingCount} participantes para la ronda {result.round + 1}.
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
            <h2>{result.participantName}</h2>
            <p>
              {isWinner
                ? isDuckGame
                  ? <>Es el último participante con vida y se lleva <strong>{result.prize || "Premio del sorteo"}</strong>. Podrás habilitarlo otra vez sin perder este premio.</>
                  : result.selectedParticipantName
                  ? <>Tras salir <strong>{result.selectedParticipantName}</strong>, se convierte en ganador final y recibe <strong>{result.prize || "Premio del sorteo"}</strong>.</>
                  : <>Se lleva <strong>{result.prize || "Premio del sorteo"}</strong>. Quedará fuera hasta que decidas habilitarlo nuevamente.</>
                : isCardGame
                  ? "Su carta sale del mazo y el nombre queda marcado como eliminado para la siguiente ronda."
                  : isPinballGame
                    ? "Su pelota cayó al pozo y el nombre queda eliminado. La próxima ronda tendrá una distribución completamente nueva."
                  : isMarbleGame
                    ? "Su canica cruzó de última y el nombre queda marcado como eliminado. La próxima ronda tendrá una pista nueva."
                  : "Su casilla desaparece de la ruleta y el nombre queda marcado como eliminado."}
            </p>
          </>
        )}

        <div className="reveal-actions">
          <button className="reveal-action" type="button" onClick={onClose}>
            {isWinner ? (
              <><Trophy size={17} /> {result.mode === "direct" ? "Continuar sin repetir" : "Cerrar resultado"}</>
            ) : isParitySelection ? (
              `Eliminar 1 entre ${result.eligibleCount}`
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
