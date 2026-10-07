import { useState } from "react";
import { CodeXml, Globe } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./authorCard.css";

import { PROJECT_AUTHOR, PROJECT_REPOSITORY, PROJECT_WEBSITE } from "../project";

export function AuthorCard() {
  const [error, setError] = useState(false);
  const follow = (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (!isTauri()) return;
    event.preventDefault(); setError(false);
    void openUrl(url).catch(() => setError(true));
  };
  return <div className="project-credit" aria-label="Autor y página oficial">
    <a className="project-author-card" href={PROJECT_REPOSITORY} target="_blank" rel="noopener noreferrer"
      aria-label={`Creado por ${PROJECT_AUTHOR}. Abrir repositorio de Fortuna Real en el navegador`}
      onClick={event => follow(event, PROJECT_REPOSITORY)}>
      <CodeXml size={17} aria-hidden="true" />
      <span><small>Creado por</small><strong>{PROJECT_AUTHOR}</strong></span>
    </a>
    <a className="project-website" href={PROJECT_WEBSITE} target="_blank" rel="noopener noreferrer" onClick={event => follow(event, PROJECT_WEBSITE)}><Globe size={14} aria-hidden="true" /> Web oficial</a>
    {error && <p role="alert">No se pudo abrir el navegador. Web: {PROJECT_WEBSITE} · Repositorio: {PROJECT_REPOSITORY}</p>}
  </div>;
}
