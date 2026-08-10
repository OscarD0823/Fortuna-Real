import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bird,
  CheckCircle2,
  CircleDot,
  Crown,
  Gamepad2,
  Gem,
  Gift,
  Layers3,
  Medal,
  RotateCcw,
  Search,
  Trophy,
  UserCheck,
  UserRoundX,
  X,
} from "lucide-react";
import type { GameId, WinnerRecord } from "../../core/types";
import { useDrawStore } from "../participants/drawStore";

interface WinnerGroup {
  participantId: string;
  participantName: string;
  awards: WinnerRecord[];
  latestAt: number;
}

type WinnerFilter = "all" | "blocked" | "enabled";

const gameLabels: Record<GameId, string> = {
  roulette: "Ruleta",
  cards: "Cartas",
  pinball: "Pinball",
  marbles: "Canicas",
  ducks: "Patos 3D",
};

const formatAwardDate = (value: string, includeTime = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
};

const AwardGameIcon = ({ game, size = 12 }: { game: GameId; size?: number }) => game === "cards"
  ? <Layers3 size={size} />
  : game === "pinball"
    ? <Gamepad2 size={size} />
    : game === "marbles"
      ? <Gem size={size} />
      : game === "ducks"
        ? <Bird size={size} />
      : <CircleDot size={size} />;

export function WinnerHistory({ compact = false }: { compact?: boolean }) {
  const winnerRecords = useDrawStore((state) => state.winnerRecords);
  const blockedWinnerIds = useDrawStore((state) => state.blockedWinnerIds);
  const reenableWinner = useDrawStore((state) => state.reenableWinner);
  const reenableAllWinners = useDrawStore((state) => state.reenableAllWinners);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WinnerFilter>("all");

  const blockedSet = useMemo(() => new Set(blockedWinnerIds), [blockedWinnerIds]);
  const groups = useMemo(() => {
    const byParticipant = new Map<string, WinnerGroup>();
    winnerRecords.forEach((record) => {
      const createdAt = new Date(record.createdAt).getTime() || 0;
      const current = byParticipant.get(record.participantId);
      if (current) {
        current.awards.push(record);
        current.latestAt = Math.max(current.latestAt, createdAt);
      } else {
        byParticipant.set(record.participantId, {
          participantId: record.participantId,
          participantName: record.participantName,
          awards: [record],
          latestAt: createdAt,
        });
      }
    });
    return Array.from(byParticipant.values())
      .map((group) => ({ ...group, awards: group.awards.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()) }))
      .sort((left, right) => right.latestAt - left.latestAt);
  }, [winnerRecords]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return groups.filter((group) => {
      const isBlocked = blockedSet.has(group.participantId);
      if (filter === "blocked" && !isBlocked) return false;
      if (filter === "enabled" && isBlocked) return false;
      if (!normalizedQuery) return true;
      return group.participantName.toLocaleLowerCase("es").includes(normalizedQuery)
        || group.awards.some((award) => award.prize.toLocaleLowerCase("es").includes(normalizedQuery));
    });
  }, [blockedSet, filter, groups, query]);

  useEffect(() => {
    if (!showAll) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAll(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showAll]);

  const blockedGroups = groups.filter((group) => blockedSet.has(group.participantId)).length;
  const enabledGroups = groups.length - blockedGroups;

  return (
    <>
      <section className={`panel winner-history-panel ${compact ? "winner-history-panel--compact" : ""}`}>
        <div className="panel-title panel-title--spread">
          <span><Trophy size={17} /> Ganadores y premios</span>
          <div className="winner-history-heading-actions">
            <small>{groups.length} ganador{groups.length === 1 ? "" : "es"} · {winnerRecords.length} premio{winnerRecords.length === 1 ? "" : "s"}</small>
            {groups.length > 0 && (
              <button type="button" className="winner-history-open" onClick={() => setShowAll(true)}>
                <Crown size={12} /> Ver todos
              </button>
            )}
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="winner-empty">
            <Gift size={22} />
            <span>Los ganadores aparecerán aquí con todo lo que hayan ganado.</span>
          </div>
        ) : (
          <div className="winner-groups" aria-label="Resumen de ganadores y premios">
            {groups.map((group) => {
              const isBlocked = blockedSet.has(group.participantId);
              return (
                <article className="winner-group" key={group.participantId}>
                  <div className="winner-group__header">
                    <span className="winner-medal">{group.awards.length}</span>
                    <span className="winner-group__identity">
                      <strong>{group.participantName}</strong>
                      <small>Último premio · {formatAwardDate(group.awards[0].createdAt)}</small>
                    </span>
                    <button
                      type="button"
                      className={isBlocked ? "winner-enable" : "winner-enabled"}
                      onClick={() => isBlocked && reenableWinner(group.participantId)}
                      disabled={!isBlocked}
                      aria-label={isBlocked ? `Permitir que ${group.participantName} participe otra vez` : `${group.participantName} ya puede participar`}
                    >
                      {isBlocked ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                      {isBlocked ? (compact ? "Incluir" : "Volver a incluir") : "Participando"}
                    </button>
                  </div>
                  <div className="winner-awards">
                    {group.awards.map((award) => (
                      <span key={award.id} title={new Date(award.createdAt).toLocaleString()}>
                        <AwardGameIcon game={award.game} size={11} />
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

      {showAll && createPortal(
        <div className="winner-gallery-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowAll(false)}>
          <section className="winner-gallery" role="dialog" aria-modal="true" aria-labelledby="winner-gallery-title">
            <header className="winner-gallery__hero">
              <div className="winner-gallery__crown"><Crown size={31} /></div>
              <div>
                <span className="eyebrow">HISTORIAL COMPLETO</span>
                <h2 id="winner-gallery-title">Salón de ganadores</h2>
                <p>Cada premio permanece guardado aunque el ganador vuelva a participar.</p>
              </div>
              <button type="button" className="winner-gallery__close" onClick={() => setShowAll(false)} aria-label="Cerrar salón de ganadores">
                <X size={20} />
              </button>
            </header>

            <div className="winner-gallery__summary">
              <article><Medal size={19} /><span><strong>{groups.length}</strong>Ganadores únicos</span></article>
              <article><Gift size={19} /><span><strong>{winnerRecords.length}</strong>Premios entregados</span></article>
              <article><UserRoundX size={19} /><span><strong>{blockedGroups}</strong>Fuera del próximo sorteo</span></article>
              <article><UserCheck size={19} /><span><strong>{enabledGroups}</strong>Participando otra vez</span></article>
            </div>

            <div className="winner-gallery__toolbar">
              <label className="winner-gallery__search">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ganador o premio" autoFocus />
              </label>
              <div className="winner-gallery__filters" aria-label="Filtrar ganadores">
                <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Todos <b>{groups.length}</b></button>
                <button type="button" className={filter === "blocked" ? "is-active" : ""} onClick={() => setFilter("blocked")}>Fuera <b>{blockedGroups}</b></button>
                <button type="button" className={filter === "enabled" ? "is-active" : ""} onClick={() => setFilter("enabled")}>Participando <b>{enabledGroups}</b></button>
              </div>
              {blockedGroups > 1 && (
                <button type="button" className="winner-gallery__enable-all" onClick={reenableAllWinners}>
                  <RotateCcw size={14} /> Habilitar a todos
                </button>
              )}
            </div>

            <div className="winner-gallery__content">
              {filteredGroups.length === 0 ? (
                <div className="winner-gallery__no-results"><Search size={28} /><strong>Sin coincidencias</strong><span>Prueba con otro nombre, premio o filtro.</span></div>
              ) : filteredGroups.map((group, index) => {
                const isBlocked = blockedSet.has(group.participantId);
                return (
                  <article className={`winner-gallery-card ${isBlocked ? "is-blocked" : "is-enabled"}`} key={group.participantId}>
                    <div className="winner-gallery-card__header">
                      <span className="winner-gallery-card__position">#{String(index + 1).padStart(2, "0")}</span>
                      <span className="winner-gallery-card__avatar">{group.participantName.trim().charAt(0).toUpperCase() || "?"}</span>
                      <div className="winner-gallery-card__name">
                        <strong>{group.participantName}</strong>
                        <span><Gift size={11} /> {group.awards.length} premio{group.awards.length === 1 ? "" : "s"}</span>
                      </div>
                      <span className={`winner-gallery-card__status ${isBlocked ? "is-blocked" : "is-enabled"}`}>
                        {isBlocked ? <UserRoundX size={12} /> : <UserCheck size={12} />}
                        {isBlocked ? "Fuera" : "Participando"}
                      </span>
                    </div>
                    <div className="winner-gallery-card__awards">
                      {group.awards.map((award) => (
                        <div className="winner-gallery-award" key={award.id}>
                          <span className={`winner-gallery-award__icon game-${award.game}`}><AwardGameIcon game={award.game} size={15} /></span>
                          <span className="winner-gallery-award__detail">
                            <strong>{award.prize}</strong>
                            <small>{gameLabels[award.game]} · {award.mode === "direct" ? "Ganador directo" : "Eliminación"}</small>
                          </span>
                          <time dateTime={award.createdAt}>{formatAwardDate(award.createdAt, true)}</time>
                        </div>
                      ))}
                    </div>
                    <footer>
                      <span>Última victoria · {formatAwardDate(group.awards[0].createdAt, true)}</span>
                      <button type="button" disabled={!isBlocked} onClick={() => isBlocked && reenableWinner(group.participantId)}>
                        {isBlocked ? <><RotateCcw size={13} /> Volver a incluir</> : <><CheckCircle2 size={13} /> Ya participa</>}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
