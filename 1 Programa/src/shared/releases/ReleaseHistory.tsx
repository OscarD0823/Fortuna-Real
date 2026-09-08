import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, Search, X } from "lucide-react";
import { version as currentVersion } from "../../../package.json";
import versionHistory from "./versionHistory.json";
import "./releaseHistory.css";

export { currentVersion };
const searchable = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");

export function ReleaseHistory({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = searchable(query.trim());
  const filtered = useMemo(() => versionHistory.filter(entry => searchable([
    entry.version, entry.date, entry.title, entry.notice,
    ...entry.groups.flatMap(group => [group.title, ...group.items]),
  ].join(" ")).includes(normalizedQuery)), [normalizedQuery]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    search.current?.focus();
    return () => { element?.close(); previousFocus?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="release-history" aria-labelledby="release-history-title" aria-describedby="release-history-description" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="release-history__header">
      <div><History size={23} /><div><h2 id="release-history-title">Novedades y versiones</h2><span>Versión de esta aplicación: <strong>{currentVersion}</strong></span></div></div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar historial de versiones"><X size={21} /></button>
    </header>
    <p id="release-history-description">Qué cambió en cada actualización. Este historial está incluido en el programa y se puede consultar sin internet.</p>
    <label className="release-history__search"><Search size={18} /><span className="sr-only">Buscar en el historial de versiones</span><input ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar versión, canicas, voz, instalador…" /></label>
    <p className="release-history__count" role="status">{filtered.length} {filtered.length === 1 ? "versión encontrada" : "versiones encontradas"}</p>
    <div className="release-history__list">
      {filtered.map(entry => {
        const index = versionHistory.findIndex(item => item.version === entry.version);
        const previousVersion = versionHistory[index + 1]?.version;
        return <details key={`${entry.version}:${normalizedQuery}`} className="release-history__entry" open={entry.version === currentVersion || !!normalizedQuery}>
          <summary><span className="release-history__version">{previousVersion ? `${previousVersion} → ` : "Inicio · "}<strong>{entry.version}</strong></span><span className="release-history__title">{entry.title}</span><span className="release-history__date">{entry.version === currentVersion ? "Esta versión · " : ""}{entry.date || "Sin fecha confirmada"}</span></summary>
          <div className="release-history__changes">
            {entry.notice && <p className="release-history__notice">{entry.notice}</p>}
            {entry.groups.map(group => <section key={group.title}><h3>{group.title}</h3><ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}
            {entry.source && <a href={entry.source} target="_blank" rel="noreferrer">Ver registro original en GitHub (requiere internet)</a>}
          </div>
        </details>;
      })}
      {!filtered.length && <p className="release-history__empty">No hay cambios que coincidan con «{query}». Prueba otra palabra o un número de versión.</p>}
    </div>
  </dialog>, document.body);
}
