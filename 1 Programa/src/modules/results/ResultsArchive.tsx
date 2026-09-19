import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, History, Pause, Play, Trophy, X } from "lucide-react";
import { useDrawStore } from "../participants/drawStore";
import { groupResultArchive, publishedWinners, resultGameNames } from "./resultArchive";
import type { ResultStanding } from "../../core/types";
import "./resultsStandings.css";

const dateLabel = (value: string) => new Date(value).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
const modeLabel = (mode: string) => mode === "direct" ? "Ganador directo" : "Eliminación";

export function WinnersRibbon() {
  const records = useDrawStore((state) => state.winnerRecords);
  const archive = useDrawStore((state) => state.resultArchive);
  const cancellations = useDrawStore((state) => state.sessionAudit);
  const winners = useMemo(() => publishedWinners(records, archive, cancellations), [records, archive, cancellations]);
  const [paused, setPaused] = useState(false);
  return <section className={`winners-ribbon ${paused ? "is-paused" : ""}`} aria-label="Cinta de ganadores">
    <span className="winners-ribbon__heading"><Trophy size={17} /> Ganadores</span>
    {winners.length ? <>
      <div className="winners-ribbon__viewport" tabIndex={0} aria-label="Ganadores; al enfocar se pausa el movimiento">
        <div className="winners-ribbon__track" style={{ animationDuration: `${Math.max(28, winners.length * 9)}s` }}>
          {[0, 1].map((copy) => <div className="winners-ribbon__copy" key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {winners.map((winner) => <span className="winners-ribbon__item" key={winner.id}>
              <strong>{winner.participantName}</strong><span>{resultGameNames[winner.game]} · {modeLabel(winner.mode)}</span>
              <b>{winner.prize}</b><time dateTime={winner.createdAt}>{dateLabel(winner.createdAt)}</time>
            </span>)}
          </div>)}
        </div>
      </div>
      <button className="icon-button" type="button" aria-label={paused ? "Reanudar cinta de ganadores" : "Pausar cinta de ganadores"} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
    </> : <span className="winners-ribbon__empty">Los nombres, premios y fechas aparecerán aquí al terminar las partidas.</span>}
  </section>;
}

export function ResultsArchive({ onClose }: { onClose: () => void }) {
  const archive = useDrawStore((state) => state.resultArchive);
  const records = useDrawStore((state) => state.winnerRecords);
  const cancellations = useDrawStore((state) => state.sessionAudit);
  const winners = useMemo(() => publishedWinners(records, archive, cancellations), [records, archive, cancellations]);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(50);
  const dialog = useRef<HTMLDialogElement>(null);
  const matches = useMemo(() => groupResultArchive(archive, new Set(cancellations.map(entry => entry.sessionId))), [archive, cancellations]);
  const filtered = matches.filter((match) => !query || [
    resultGameNames[match.latest.game], match.winner?.prize,
    ...match.rounds.map((round) => `${round.participantName} ${round.selectedParticipantName ?? ""}`),
    ...(match.winner?.standings?.map(row => row.participantName) ?? []),
  ].join(" ").toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previousFocus?.focus(); };
  }, []);
  const exportResults = () => {
    const file = new Blob([JSON.stringify({ format: "fortuna-results-v2", exportedAt: new Date().toISOString(), results: matches.flatMap(match => match.rounds), winners }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `resultados-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return createPortal(<dialog ref={dialog} className="results-archive" onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="results-archive-title">
    <header><div><History size={22} /><h2 id="results-archive-title">Resultados de las partidas</h2></div><button type="button" className="icon-button" aria-label="Cerrar resultados" onClick={onClose}><X size={20} /></button></header>
    <div className="results-archive__tools"><label>Buscar<input value={query} onChange={(event) => { setQuery(event.target.value); setShown(50); }} placeholder="Nombre, juego o premio" /></label><button type="button" onClick={exportResults}><Download size={16} /> Exportar copia</button></div>
    <p>{matches.length} {matches.length === 1 ? "partida terminada" : "partidas terminadas"}. Solo se publican partidas con ganador confirmado. Su clasificación se conserva al cambiar de juego o vaciar los participantes; las partidas abortadas no aparecen.</p>
    <div className="results-archive__list">
      {filtered.length === 0 && <p className="results-archive__empty">{matches.length ? "No hay coincidencias." : "Cuando una partida termine con ganador, aquí se guardarán todos los participantes, su clasificación, las rondas y el premio. Una partida en curso o abortada no se publica."}</p>}
      {filtered.slice(0, shown).map((match) => <details key={match.id} className="results-match">
        <summary><span><strong>{resultGameNames[match.latest.game]} · {modeLabel(match.latest.mode)}</strong><small>{dateLabel(match.latest.createdAt)}{match.legacy ? " · Registro anterior" : ` · ${match.rounds.length} ${match.rounds.length === 1 ? "resultado" : "resultados"}`}</small></span><span>{match.winner ? <><Trophy size={16} /> {match.winner.participantName}<small>{match.winner.prize}</small></> : "Sin ganador registrado"}</span></summary>
        {match.winner?.standings?.length ? <StandingsTable rows={match.winner.standings} label={match.winner.standingsLabel} />
          : <p className="results-legacy-note">Registro anterior: no se guardó la tabla completa. Estas son las rondas que pudieron conservarse; no se inventan participantes ni puestos faltantes.</p>}
        <h3 className="results-rounds-title">Recorrido hasta el ganador</h3>
        <ol className="results-match__rounds">{match.rounds.map((round) => <li key={round.id}>
          <span>Ronda {round.round}</span><div><strong>{round.kind === "winner" ? "Ganador" : round.kind === "eliminated" ? "Eliminado" : "Resultado"}: {round.participantName}</strong>
          {round.selectedParticipantName && round.kind === "winner" && <small>Último eliminado: {round.selectedParticipantName}</small>}
          <small>{round.kind === "winner" ? round.prize : `${round.remainingCount} participantes continúan`}</small></div>
          <time dateTime={round.createdAt}>{dateLabel(round.createdAt)}</time>
        </li>)}</ol>
      </details>)}
      {filtered.length > shown && <button type="button" onClick={() => setShown((count) => count + 50)}>Mostrar más partidas ({filtered.length - shown} pendientes)</button>}
    </div>
  </dialog>, document.body);
}

function StandingsTable({ rows, label }: { rows: readonly ResultStanding[]; label?: string }) {
  return <div className="results-standings" tabIndex={0} role="region" aria-label="Tabla completa de clasificación">
    <table><caption>{label ?? "Clasificación final"} · {rows.length} participantes</caption>
      <thead><tr><th scope="col">Puesto</th><th scope="col">Participante</th><th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.participantId} className={row.outcome === "winner" ? "is-winner" : ""}>
        <td>{row.position === null ? "—" : row.position}</td><th scope="row">{row.participantName}</th>
        <td>{row.outcome === "winner" ? "Ganador" : row.outcome === "eliminated" ? "Eliminado" : "No seleccionado"}</td>
        <td>{row.detail ?? (row.round ? `Ronda ${row.round}` : "—")}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
