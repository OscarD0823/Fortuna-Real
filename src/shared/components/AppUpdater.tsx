import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Download, RefreshCw, ShieldCheck, X } from "lucide-react";

type UpdateStatus = "available" | "downloading" | "restarting" | "error";

export function AppUpdater() {
  const updateRef = useRef<Update | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>("available");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isTauri()) return;

    const timer = window.setTimeout(async () => {
      try {
        const update = await check({ timeout: 12_000 });
        if (!update) return;

        updateRef.current = update;
        setVersion(update.version);
        setNotes(update.body ?? "Incluye mejoras y correcciones para Fortuna Real.");
        setStatus("available");
        setVisible(true);
      } catch {
        // La comprobación se repetirá en el siguiente inicio sin interrumpir el sorteo.
      }
    }, 4_500);

    return () => window.clearTimeout(timer);
  }, []);

  const installUpdate = async () => {
    const update = updateRef.current;
    if (!update) return;

    setStatus("downloading");
    setErrorMessage("");
    setProgress(0);
    let downloaded = 0;
    let contentLength = 0;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            setProgress(Math.min(100, Math.round((downloaded / contentLength) * 100)));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });

      setStatus("restarting");
      await relaunch();
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo instalar la actualización. Inténtalo nuevamente.",
      );
    }
  };

  if (!visible) return null;

  return (
    <div className="update-overlay" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <section className="update-card">
        {status === "available" && (
          <button
            type="button"
            className="update-close"
            aria-label="Actualizar más tarde"
            onClick={() => setVisible(false)}
          >
            <X size={18} />
          </button>
        )}

        <div className="update-icon" aria-hidden="true">
          {status === "restarting" ? <RefreshCw size={34} /> : <Download size={34} />}
        </div>

        <span className="eyebrow">ACTUALIZACIÓN SEGURA</span>
        <h2 id="update-title">
          {status === "available"
            ? `Fortuna Real ${version}`
            : status === "downloading"
              ? "Descargando actualización"
              : status === "restarting"
                ? "Actualización instalada"
                : "No se pudo actualizar"}
        </h2>

        {status === "available" ? (
          <>
            <p>{notes}</p>
            <div className="update-trust"><ShieldCheck size={16} /> Archivo firmado y verificado</div>
            <div className="update-actions">
              <button type="button" className="text-button" onClick={() => setVisible(false)}>
                Más tarde
              </button>
              <button type="button" className="start-button" onClick={installUpdate}>
                <Download size={18} /> Actualizar ahora
              </button>
            </div>
          </>
        ) : status === "downloading" ? (
          <>
            <p>No cierres Fortuna Real mientras termina la descarga.</p>
            <div className="update-progress" aria-label={`Descarga ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <strong className="update-percentage">{progress}%</strong>
          </>
        ) : status === "restarting" ? (
          <p>La aplicación se reiniciará con la nueva versión.</p>
        ) : (
          <>
            <p>{errorMessage}</p>
            <div className="update-actions">
              <button type="button" className="text-button" onClick={() => setVisible(false)}>
                Cerrar
              </button>
              <button type="button" className="start-button" onClick={installUpdate}>
                Intentar nuevamente
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
