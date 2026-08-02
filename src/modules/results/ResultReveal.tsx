import { Crown, Target, Trophy, X } from "lucide-react";
import type { Participant, RoundResult } from "../../core/types";

export function ResultReveal({
  result,
  champion,
  prize,
  onClose,
}: {
  result: RoundResult;
  champion: Participant | null;
  prize: string;
  onClose: () => void;
}) {
  const isWinner = result.kind === "winner";
  return (
    <div className="reveal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className={`result-reveal ${isWinner || champion ? "result-reveal--winner" : "result-reveal--eliminated"}`}
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
          {champion ? <Crown size={51} /> : isWinner ? <Trophy size={48} /> : <Target size={48} />}
        </div>
        <span className="reveal-kicker">
          {champion ? "TENEMOS CAMPEÓN" : isWinner ? "LA FORTUNA ELIGIÓ A" : "SALE DE LA RONDA"}
        </span>
        <h2>{champion?.name ?? result.participantName}</h2>
        <p>
          {champion
            ? `Se lleva ${prize.trim() || "el premio"}`
            : isWinner
              ? `Ganador de ${prize.trim() || "esta ronda"}`
              : "La ruleta ha decidido. Continúa hasta dejar un campeón."}
        </p>
        <button className="reveal-action" type="button" onClick={onClose}>
          {champion ? "Finalizar sorteo" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
