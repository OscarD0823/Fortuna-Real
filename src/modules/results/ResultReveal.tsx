import { Binary, Crown, Target, Trophy, X } from "lucide-react";
import type { RoundResult } from "../../core/types";

export function ResultReveal({
  result,
  onClose,
}: {
  result: RoundResult;
  onClose: () => void;
}) {
  const isWinner = result.kind === "winner";
  const isQualifiedRound = result.kind === "qualified";
  const isParitySelection = result.kind === "parity-selected";
  const parityLabel = result.parity === "even" ? "PAR" : "IMPAR";

  return (
    <div className="reveal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className={`result-reveal ${
          isWinner
            ? "result-reveal--winner"
            : isQualifiedRound || isParitySelection
              ? `result-reveal--parity result-reveal--${result.parity}`
              : "result-reveal--eliminated"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Resultado de la ruleta"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="reveal-close" type="button" onClick={onClose} aria-label="Cerrar resultado">
          <X size={19} />
        </button>
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 22 }, (_, index) => <i key={index} />)}
        </div>
        <div className="reveal-icon">
          {isWinner ? <Crown size={51} /> : isQualifiedRound || isParitySelection ? <Binary size={50} /> : <Target size={48} />}
        </div>

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
                ? result.selectedParticipantName
                  ? `GANADOR TRAS SALIR ${result.selectedParticipantName.toUpperCase()}`
                  : "TENEMOS GANADOR"
                : `NÚMERO ${result.landedNumber} · SALE DE LA RULETA`}
            </span>
            <h2>{result.participantName}</h2>
            <p>
              {isWinner
                ? <>Se lleva <strong>{result.prize || "Premio del sorteo"}</strong>. Quedará fuera hasta que decidas habilitarlo nuevamente.</>
                : "Su casilla desaparece de la ruleta y el nombre queda marcado como eliminado."}
            </p>
          </>
        )}

        <button className="reveal-action" type="button" onClick={onClose}>
          {isWinner ? (
            <><Trophy size={17} /> {result.mode === "direct" ? "Continuar con otro ganador" : "Finalizar sorteo"}</>
          ) : isParitySelection ? (
            `Eliminar 1 entre ${result.eligibleCount}`
          ) : (
            "Continuar a la siguiente ronda"
          )}
        </button>
      </div>
    </div>
  );
}
