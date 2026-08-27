import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Download, RefreshCw, ShieldCheck, X } from "lucide-react";

type UpdateStatus = "available" | "downloading" | "restarting" | "error";

export function AppUpdater({ blocked = false }: { blocked?: boolean }) {
  const updateRef = useRef<Update | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>("available");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const presented = visible && !blocked;

  const checkForUpdate = useCallback(async () => {
    if (navigator.onLine === false) return;
    try {
      const update = await check({ timeout: 12_000 });
      if (!update) return;

      updateRef.current = update;
      setVersion(update.version);
      setNotes(update.body ?? "Incluye mejoras y correcciones para Fortuna Real.");
      setStatus("available");
      setVisible(true);
    } catch (error) {
      // La comprobación se ejecuta al iniciar y no debe confundir un endpoint sin
      // release publicado con una pérdida de Internet. Una instalación iniciada
      // por el usuario sí conserva su error visible más abajo.
      console.info("[Fortuna Real] Comprobación automática aplazada.", error);
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const timer = window.setTimeout(() => void checkForUpdate(), 4_500);
    const retryWhenOnline = () => void checkForUpdate();
    window.addEventListener("online", retryWhenOnline, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retryWhenOnline);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    if (!presented) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", trapFocus);
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus();
    };
  }, [presented]);

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

  if (!presented) return null;

  return (
    <div className="update-overlay" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <section ref={dialogRef} className="update-card" tabIndex={-1}>
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
