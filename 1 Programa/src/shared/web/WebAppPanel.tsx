import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Download, Smartphone } from "lucide-react";
import { PROJECT_DOWNLOADS } from "../project";
import "./webApp.css";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export function WebAppPanel() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (isTauri()) return;
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", install); window.removeEventListener("appinstalled", done); };
  }, []);
  useEffect(() => {
    if (isTauri() || !import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const inspect = () => { if (!disposed && registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting); };
    const found = () => { installing?.removeEventListener("statechange", inspect); installing = registration?.installing ?? null; installing?.addEventListener("statechange", inspect); };
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: "none" })
      .then(value => {
        if (disposed) return;
        registration = value; inspect(); found(); value.addEventListener("updatefound", found);
        // Offline opening must not erase a working cache or show a false install failure.
        void value.update().catch(() => undefined);
      }).catch(() => { if (!disposed) setNotice("No se pudo preparar el modo sin conexión. Puedes seguir jugando y reintentar al volver a abrir con Internet."); });
    return () => { disposed = true; registration?.removeEventListener("updatefound", found); installing?.removeEventListener("statechange", inspect); };
  }, []);
  if (isTauri()) return null;
  const install = async () => {
    if (!prompt) { setHelp(value => !value); return; }
    try { await prompt.prompt(); const choice = await prompt.userChoice; setPrompt(null); setNotice(choice.outcome === "accepted" ? "Instalación solicitada al navegador." : "Puedes instalar la web más adelante."); }
    catch { setHelp(true); setPrompt(null); }
  };
  return <section className="web-app-panel" aria-label="Instalar y descargar Fortuna Real">
    <div><strong>{installed ? "Web instalada" : "Juega aquí o instala Fortuna Real"}</strong><small>Gratis · datos guardados en este navegador · sin sincronización entre equipos</small></div>
    <div className="web-app-panel__actions">
      {!installed && <button type="button" onClick={() => void install()}><Smartphone size={16} /> Instalar web</button>}
      <a href={PROJECT_DOWNLOADS} target="_blank" rel="noopener noreferrer"><Download size={16} /> Descargar Windows</a>

    </div>
    {help && <p>En Edge o Chrome abre el menú y elige «Instalar aplicación». En iPhone/iPad: Safari → Compartir → Añadir a pantalla de inicio. La opción depende del navegador. La voz Daniela High está integrada en Windows; la web utiliza las voces del navegador. El historial web y el de Windows son independientes.</p>}
    {waiting && <p role="status">Hay una nueva versión web preparada. Termina tus partidas, cierra todas las ventanas de Fortuna Real y vuelve a abrirla para actualizar. No se recargará ninguna partida automáticamente.</p>}
    {notice && <p role="status">{notice}</p>}
    <a className="web-privacy" href={`${import.meta.env.BASE_URL}privacidad.html`} target="_blank" rel="noopener noreferrer">Privacidad y funcionamiento sin conexión</a>
  </section>;
}
