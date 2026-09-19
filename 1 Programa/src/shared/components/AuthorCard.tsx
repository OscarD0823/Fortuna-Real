import { useState } from "react";
import { CodeXml, ExternalLink } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./authorCard.css";

export const PROJECT_AUTHOR = "OscarD0823";
export const PROJECT_REPOSITORY = "https://github.com/OscarD0823/Fortuna-Real";

export function AuthorCard() {
  const [error, setError] = useState(false);
  return <footer className="project-credit">
    <a className="project-author-card" href={PROJECT_REPOSITORY} target="_blank" rel="noopener noreferrer"
      aria-label={`Creado por ${PROJECT_AUTHOR}. Abrir repositorio de Fortuna Real en el navegador`}
      onClick={event => {
        if (!isTauri()) return;
        event.preventDefault(); setError(false);
        void openUrl(PROJECT_REPOSITORY).catch(() => setError(true));
      }}>
      <CodeXml size={22} aria-hidden="true" />
      <span><small>Creado por</small><strong>{PROJECT_AUTHOR}</strong><span>GitHub · Fortuna Real</span></span>
      <ExternalLink size={16} aria-hidden="true" />
    </a>
    {error && <p role="alert">No se pudo abrir el navegador. Puedes copiar este enlace: {PROJECT_REPOSITORY}</p>}
  </footer>;
}
