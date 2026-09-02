import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Download, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatUpdateBytes } from "../update/updateProgress";
import { installSignedUpdate } from "../update/updateWorkflow";

type UpdateStatus = "ready" | "downloading" | "installing" | "restarting" | "error";

type AppUpdaterProps = {
  blocked?: boolean;
  onStartupCheckComplete?: () => void;
};

export function AppUpdater({ blocked = false, onStartupCheckComplete }: AppUpdaterProps) {
  const updateRef = useRef<Update | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const checkingRef = useRef(false);
  const installingRef = useRef(false);
  const startupCheckCompletedRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>("ready");
  const [currentVersion, setCurrentVersion] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const presented = visible && !blocked;

  const finishStartupCheck = useCallback(() => {
    if (startupCheckCompletedRef.current) return;
    startupCheckCompletedRef.current = true;
    onStartupCheckComplete?.();
  }, [onStartupCheckComplete]);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update || installingRef.current) return;

    installingRef.current = true;
    setStatus("downloading");
    setErrorMessage("");
    setProgress(null);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      await installSignedUpdate(update, (state) => {
        setStatus(state.phase);
        setProgress(state.progress);
        setDownloadedBytes(state.downloadedBytes);
        setTotalBytes(state.totalBytes);
      }, relaunch);
    } catch (error) {
      installingRef.current = false;
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo instalar la actualización firmada.",
      );
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (checkingRef.current) return;
    if (navigator.onLine === false) {
      finishStartupCheck();
      return;
    }

    checkingRef.current = true;
    try {
      const update = await check({ timeout: 8_000 });
      if (!update) {
        finishStartupCheck();
        return;
      }

      updateRef.current = update;
      setCurrentVersion(update.currentVersion);
      setVersion(update.version);
      setNotes(update.body ?? "Incluye mejoras y correcciones para Fortuna Real.");
      setStatus("ready");
      setVisible(true);
    } catch (error) {
      // Un endpoint sin publicación o una conexión temporalmente caída no debe
      // bloquear la apertura ni mostrar el antiguo aviso de "sin Internet".
      console.info("[Fortuna Real] Comprobación automática aplazada.", error);
      finishStartupCheck();
    } finally {
      checkingRef.current = false;
    }
  }, [finishStartupCheck]);

  useEffect(() => {
    if (!isTauri()) {
      finishStartupCheck();
      return;
    }

    const timer = window.setTimeout(() => void checkForUpdate(), 250);
    const retryWhenOnline = () => void checkForUpdate();
    window.addEventListener("online", retryWhenOnline, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retryWhenOnline);
    };
  }, [checkForUpdate, finishStartupCheck]);

  useEffect(() => {
    if (!presented || status !== "ready") return;
    void installUpdate();
  }, [installUpdate, presented, status]);

  useEffect(() => {
    if (!presented) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    const preventEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status !== "error") event.preventDefault();
    };
    document.addEventListener("keydown", preventEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", preventEscape);
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus();
    };
  }, [presented, status]);

  const continueWithoutUpdate = () => {
    const update = updateRef.current;
    updateRef.current = null;
    setVisible(false);
    setStatus("ready");
    installingRef.current = false;
    finishStartupCheck();
    if (update) void update.close().catch(() => undefined);
  };

  if (!presented) return null;

  const indeterminate = status === "downloading" && progress === null;
  const downloadedLabel = downloadedBytes > 0 ? formatUpdateBytes(downloadedBytes) : "Preparando descarga";
  const totalLabel = totalBytes > 0 ? ` de ${formatUpdateBytes(totalBytes)}` : "";

  return (
    <div className="update-overlay" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <section ref={dialogRef} className="update-card" tabIndex={-1} aria-live="polite">
        <div className={`update-icon ${status === "ready" || status === "installing" || status === "restarting" ? "update-icon--spinning" : ""}`} aria-hidden="true">
          {status === "error"
            ? <TriangleAlert size={34} />
            : status === "downloading"
              ? <Download size={34} />
              : <RefreshCw size={34} />}
        </div>

        <span className="eyebrow">ACTUALIZACIÓN AUTOMÁTICA SEGURA</span>
        <h2 id="update-title">
          {status === "ready"
            ? "Preparando actualización"
            : status === "downloading"
              ? "Actualizando Fortuna Real"
              : status === "installing"
                ? "Verificando e instalando"
                : status === "restarting"
                  ? "Reiniciando aplicación"
                  : "No se pudo actualizar"}
        </h2>

        {status !== "error" ? (
          <>
            <div className="update-version-route" aria-label={`Versión ${currentVersion} a ${version}`}>
              <span>{currentVersion || "Actual"}</span>
              <RefreshCw size={14} aria-hidden="true" />
              <strong>{version}</strong>
            </div>
            {status === "ready" && <p>Se encontró una versión más reciente. La descarga comenzará automáticamente.</p>}
            {status === "downloading" && <p>No cierres Fortuna Real mientras se descarga el paquete firmado.</p>}
            {status === "installing" && <p>Comprobando la firma y aplicando los archivos nuevos.</p>}
            {status === "restarting" && <p>La actualización terminó. Fortuna Real volverá a abrirse.</p>}

            {(status === "downloading" || status === "installing") && (
              <>
                <div
                  className={`update-progress ${indeterminate ? "update-progress--indeterminate" : ""}`}
                  role="progressbar"
                  aria-label="Progreso de actualización"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress ?? undefined}
                >
                  <span style={indeterminate ? undefined : { width: `${progress ?? 0}%` }} />
                </div>
                <strong className="update-percentage">
                  {status === "installing" ? "Instalando…" : progress === null ? "Descargando…" : `${progress}%`}
                </strong>
                {status === "downloading" && <small className="update-bytes">{downloadedLabel}{totalLabel}</small>}
              </>
            )}

            <div className="update-trust"><ShieldCheck size={16} /> Firma verificada antes de instalar</div>
            {notes && status === "ready" && <p className="update-notes">{notes}</p>}
          </>
        ) : (
          <>
            <p>{errorMessage}</p>
            <p className="update-error-help">Puedes continuar usando esta versión y volver a intentarlo en el próximo inicio.</p>
            <div className="update-actions">
              <button type="button" className="text-button" onClick={continueWithoutUpdate}>
                Continuar sin actualizar
              </button>
              <button type="button" className="start-button" onClick={() => void installUpdate()}>
                <RefreshCw size={18} /> Reintentar
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
