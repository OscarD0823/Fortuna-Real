import { useMemo } from "react";
import { CircleDot, Gem, Gift, Layers3, RotateCcw, Trophy } from "lucide-react";
import type { WinnerRecord } from "../../core/types";
import { useDrawStore } from "../participants/drawStore";

interface WinnerGroup {
  participantId: string;
  participantName: string;
  awards: WinnerRecord[];
}

export function WinnerHistory({ compact = false }: { compact?: boolean }) {
  const winnerRecords = useDrawStore((state) => state.winnerRecords);
  const blockedWinnerIds = useDrawStore((state) => state.blockedWinnerIds);
  const reenableWinner = useDrawStore((state) => state.reenableWinner);
  const reenableAllWinners = useDrawStore((state) => state.reenableAllWinners);

  const groups = useMemo(() => {
    const byParticipant = new Map<string, WinnerGroup>();
    winnerRecords.forEach((record) => {
      const current = byParticipant.get(record.participantId);
      if (current) {
        current.awards.push(record);
      } else {
        byParticipant.set(record.participantId, {
          participantId: record.participantId,
          participantName: record.participantName,
          awards: [record],
        });
      }
    });
    return Array.from(byParticipant.values());
  }, [winnerRecords]);

  return (
    <section className={`panel winner-history-panel ${compact ? "winner-history-panel--compact" : ""}`}>
      <div className="panel-title panel-title--spread">
        <span><Trophy size={17} /> Ganadores y premios</span>
        <small>{winnerRecords.length} premio{winnerRecords.length === 1 ? "" : "s"}</small>
      </div>

      {groups.length === 0 ? (
        <div className="winner-empty">
          <Gift size={22} />
          <span>Los ganadores aparecerán aquí con todo lo que hayan ganado.</span>
        </div>
      ) : (
        <div className="winner-groups" aria-label="Historial de ganadores y premios">
          {groups.map((group) => {
            const isBlocked = blockedWinnerIds.includes(group.participantId);
            return (
              <article className="winner-group" key={group.participantId}>
                <div className="winner-group__header">
                  <span className="winner-medal">{group.awards.length}</span>
                  <strong>{group.participantName}</strong>
                  <button
                    type="button"
                    className={isBlocked ? "winner-enable" : "winner-enabled"}
                    onClick={() => isBlocked && reenableWinner(group.participantId)}
                    disabled={!isBlocked}
                    aria-label={
                      isBlocked
                        ? `Permitir que ${group.participantName} participe otra vez`
                        : `${group.participantName} ya puede participar`
                    }
                  >
                    <RotateCcw size={13} />
                    {isBlocked ? (compact ? "Incluir" : "Volver a incluir") : "Participando"}
                  </button>
                </div>
                <div className="winner-awards">
                  {group.awards.map((award) => (
                    <span key={award.id} title={new Date(award.createdAt).toLocaleString()}>
                      {award.game === "cards"
                        ? <Layers3 size={11} />
                        : award.game === "marbles"
                          ? <Gem size={11} />
                          : <CircleDot size={11} />}
                      {award.prize}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!compact && blockedWinnerIds.length > 1 && (
        <button type="button" className="enable-all-winners" onClick={reenableAllWinners}>
          <RotateCcw size={15} /> Habilitar nuevamente a todos los ganadores
        </button>
      )}
      {!compact && groups.length > 0 && (
        <p className="winner-participation-help">
          Volver a incluir no borra ningún premio: permite que esa persona aparezca de nuevo en cualquier juego.
        </p>
      )}
    </section>
  );
}
