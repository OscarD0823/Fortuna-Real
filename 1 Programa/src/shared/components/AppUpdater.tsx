import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Check, Download, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatUpdateBytes } from "../update/updateProgress";
import { installSignedUpdate } from "../update/updateWorkflow";
import { clearUpdateReceipt, confirmUpdateReceipt, readUpdateReceipt, writeUpdateReceipt } from "../update/updateReceipt";
import { describeUpdateFailure, downloadTelemetry, updateHeadings, updateStepIndex, updateSteps, type UpdateStatus } from "../update/updatePresentation";
import "../update/updateInterface.css";

const clearReceipt = () => { try { clearUpdateReceipt(localStorage); } catch { /* Opening the app must remain possible with unavailable storage. */ } };

export interface UpdateDialogProps {
  status: UpdateStatus;
  failurePhase?: UpdateStatus;
  currentVersion: string;
  version: string;
  notes?: string;
  progress: number | null;
  downloadedBytes: number;
  totalBytes: number;
  elapsedMs?: number;
  waitingForData?: boolean;
  signatureVerified?: boolean;
  errorMessage?: string;
  onContinue: () => void;
  onRetry: () => void;
  preview?: boolean;
  onPreviewStatus?: (status: UpdateStatus) => void;
}

/** Same real dialog in production and in the isolated visual lab. No I/O here. */
export function UpdateDialog({
  status, failurePhase = "checking", currentVersion, version, notes = "", progress,
  downloadedBytes, totalBytes, elapsedMs = 0, waitingForData = false,
  signatureVerified = false, errorMessage = "", onContinue, onRetry, preview = false, onPreviewStatus,
}: UpdateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocusedRef = useRef<Element | null>(null);
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;
  const canClose = status === "error" || status === "complete";
  const canCloseRef = useRef(canClose);
  canCloseRef.current = canClose;
  useEffect(() => {
    const element = dialogRef.current;
    // Native dialog cancellation is not reliably preventable by React's
    // delegated cancel event in every WebView. Handle it on the element and
    // intercept Escape before the browser performs its default close action.
    const cancel = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (canCloseRef.current) continueRef.current();
    };
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(event); };
    lastFocusedRef.current = document.activeElement;
    element?.addEventListener("cancel", cancel);
    element?.addEventListener("keydown", keydown, true);
    element?.showModal();
    element?.focus();
    return () => {
      element?.removeEventListener("cancel", cancel);
      element?.removeEventListener("keydown", keydown, true);
      element?.close();
      const previous = lastFocusedRef.current;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const heading = updateHeadings[status];
  const currentStep = updateStepIndex(status === "error" ? failurePhase : status);
  const telemetry = downloadTelemetry(downloadedBytes, totalBytes, elapsedMs);
  const downloading = status === "downloading";
  return createPortal(
    <dialog ref={dialogRef} className="update-dialog" tabIndex={-1} aria-labelledby="update-title" aria-describedby="update-description">
      <section className="update-card" data-update-status={status} data-signature-verified={signatureVerified}>
        <div className={`update-icon ${!canClose ? "update-icon--spinning" : ""}`} aria-hidden="true">
          {status === "error" ? <TriangleAlert size={30} /> : status === "complete" ? <Check size={30} /> : status === "verifying" ? <ShieldCheck size={30} /> : downloading ? <Download size={30} /> : <RefreshCw size={30} />}
        </div>
        <span className="eyebrow">{preview ? "DEMOSTRACIÓN · NO INSTALA ARCHIVOS" : "ACTUALIZACIÓN AUTOMÁTICA SEGURA"}</span>
        <h2 id="update-title" role="status" aria-live="polite">{heading.title}</h2>
        <p id="update-description">{status === "error" ? errorMessage || heading.detail : heading.detail}</p>
        {version && <div className="update-version-route" aria-label={`Versión ${currentVersion} a ${version}`}>
          <span>{currentVersion || "Actual"}</span><span aria-hidden="true">→</span><strong>{version}</strong>
        </div>}
        <ol className="update-steps" aria-label="Pasos de la actualización">
          {updateSteps.map((step, index) => {
            const completed = index < currentStep;
            const active = index === currentStep;
            const state = completed ? "done" : active ? status === "error" ? "failed" : "active" : "pending";
            return <li key={step.label} className={`update-step update-step--${state}`} aria-current={active ? "step" : undefined}>
              <i aria-hidden="true">{completed ? <Check size={15} /> : state === "failed" ? <TriangleAlert size={14} /> : index + 1}</i>
              <div><strong>{step.label}</strong><small>{step.detail}</small></div>
              <span>{completed ? "Listo" : state === "failed" ? "Revisar" : active ? "En curso" : "Pendiente"}</span>
            </li>;
          })}
        </ol>
        {downloading && <div className="update-download-detail">
          <div className={`update-progress ${progress === null ? "update-progress--indeterminate" : ""}`} role="progressbar"
            aria-label="Descarga del paquete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined}>
            <span style={progress === null ? undefined : { width: `${progress}%` }} />
          </div>
          <div className="update-download-numbers"><strong>{progress === null ? "Recibiendo archivos…" : `${progress}% descargado`}</strong>
            <span>{formatUpdateBytes(downloadedBytes)}{totalBytes > 0 ? ` de ${formatUpdateBytes(totalBytes)}` : " · tamaño por confirmar"}</span></div>
          <small className="update-bytes">{waitingForData ? "Esperando datos de la conexión…" : telemetry ? `${telemetry.speed} de promedio${telemetry.remaining ? ` · ${telemetry.remaining}` : ""}` : "Conectando con el servidor de descarga…"}</small>
        </div>}
        {(status === "installing" || status === "restarting") && <div className="update-restart-notice"><RefreshCw size={16} /><span>Se abrirá automáticamente. No apagues el equipo durante este paso.</span></div>}
        {status !== "error" && <div className="update-trust"><ShieldCheck size={16} />
          {status === "complete" ? "Versión en ejecución confirmada" : signatureVerified ? "Firma del paquete verificada" : "Solo se aplicará un paquete con firma válida"}
        </div>}
        {notes && <details className="update-changes">
          <summary>Ver cambios de la versión {version}</summary>
          <pre className="update-notes">{notes}</pre>
        </details>}
        {status === "error" && <div className="update-actions">
          <button type="button" className="text-button" onClick={onContinue}>Continuar sin actualizar</button>
          <button type="button" className="start-button" onClick={onRetry}><RefreshCw size={17} /> Reintentar</button>
        </div>}
        {status === "complete" && <button type="button" className="start-button update-continue" onClick={onContinue}>Continuar en Fortuna Real</button>}
        {preview && onPreviewStatus && <label className="update-preview-controls">Estado de la demostración
          <select value={status} onChange={event => onPreviewStatus(event.target.value as UpdateStatus)}>
            {Object.entries(updateHeadings).map(([value, text]) => <option key={value} value={value}>{text.title}</option>)}
          </select>
        </label>}
      </section>
    </dialog>, document.body,
  );
}

export function AppUpdater({ blocked = false, onStartupCheckComplete }: {
  blocked?: boolean;
  onStartupCheckComplete?: () => void;
}) {
  const updateRef = useRef<Update | null>(null);
  const checkingRef = useRef(false);
  const installingRef = useRef(false);
  const mountedRef = useRef(false);
  const bootCompleteRef = useRef(false);
  const dismissedRef = useRef(false);
  const visibleRef = useRef(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const startupCheckCompletedRef = useRef(false);
  const statusRef = useRef<UpdateStatus>("checking");
  const downloadStartedRef = useRef(0);
  const lastByteAtRef = useRef(0);
  const lastRenderAtRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>("checking");
  const [failurePhase, setFailurePhase] = useState<UpdateStatus>("checking");
  const [currentVersion, setCurrentVersion] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [signatureVerified, setSignatureVerified] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [waitingForData, setWaitingForData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const presented = (visible && !blocked) || (visible && installingRef.current);

  const changeStatus = useCallback((value: UpdateStatus) => { statusRef.current = value; setStatus(value); }, []);
  const show = useCallback((value: boolean) => { visibleRef.current = value; setVisible(value); }, []);
  const finishStartupCheck = useCallback(() => {
    if (startupCheckCompletedRef.current) return;
    startupCheckCompletedRef.current = true;
    onStartupCheckComplete?.();
  }, [onStartupCheckComplete]);

  const closeUpdateResource = useCallback(async () => {
    const update = updateRef.current;
    updateRef.current = null;
    if (update) await update.close().catch(() => undefined);
  }, []);

  const checkForUpdate = useCallback(async (manualRetry = false) => {
    // Online notifications cannot replace a package while it is downloading,
    // retry an interrupted install without consent, or interrupt a game.
    if (checkingRef.current || installingRef.current || updateRef.current || dismissedRef.current
      || (visibleRef.current && statusRef.current !== "checking")) return;
    if (navigator.onLine === false) {
      if (manualRetry) {
        setFailurePhase("checking"); setErrorMessage("La conexión no está disponible. Puedes reintentar cuando vuelva o continuar usando el programa.");
        changeStatus("error"); show(true);
      } else { show(false); finishStartupCheck(); }
      return;
    }
    checkingRef.current = true;
    changeStatus("checking"); show(true);
    try {
      const update = await check({ timeout: 8_000 });
      if (!mountedRef.current) { await update?.close().catch(() => undefined); return; }
      if (!update) { if (manualRetry) clearReceipt(); show(false); finishStartupCheck(); return; }
      updateRef.current = update;
      setCurrentVersion(update.currentVersion);
      setVersion(update.version);
      setNotes(update.body ?? "Incluye mejoras y correcciones para Fortuna Real.");
      changeStatus("ready");
    } catch {
      // A failed background check is not proof that the PC has no Internet.
      console.info("[Fortuna Real] Comprobación automática aplazada.");
      if (mountedRef.current) {
        if (manualRetry) {
          setFailurePhase("checking"); setErrorMessage("No se pudo consultar la versión publicada en GitHub. Puedes reintentar o continuar usando el programa.");
          changeStatus("error"); show(true);
        } else { show(false); finishStartupCheck(); }
      }
    } finally { checkingRef.current = false; }
  }, [changeStatus, finishStartupCheck, show]);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update || installingRef.current || blockedRef.current) return;
    installingRef.current = true;
    changeStatus("downloading"); setErrorMessage(""); setProgress(null);
    setDownloadedBytes(0); setTotalBytes(0); setSignatureVerified(false); setElapsedMs(0); setWaitingForData(false);
    downloadStartedRef.current = performance.now(); lastByteAtRef.current = downloadStartedRef.current; lastRenderAtRef.current = 0;
    let previousBytes = 0;
    try {
      await installSignedUpdate(update, (state) => {
        if (!mountedRef.current) return;
        const now = performance.now();
        if (state.downloadedBytes > previousBytes) { lastByteAtRef.current = now; previousBytes = state.downloadedBytes; }
        if (state.phase === "downloading" && statusRef.current === "downloading" && now - lastRenderAtRef.current < 100) return;
        lastRenderAtRef.current = now;
        changeStatus(state.phase); setProgress(state.progress); setDownloadedBytes(state.downloadedBytes);
        setTotalBytes(state.totalBytes); setSignatureVerified(state.signatureVerified);
        setElapsedMs(now - downloadStartedRef.current);
      }, relaunch, undefined, async () => {
        if (!mountedRef.current || blockedRef.current) throw new Error("No se puede preparar el reinicio mientras hay otra partida o ventana activa.");
        writeUpdateReceipt(localStorage, { from: update.currentVersion, to: update.version, startedAt: Date.now() });
      });
    } catch (error) {
      installingRef.current = false;
      clearReceipt();
      if (mountedRef.current) {
        setFailurePhase(statusRef.current); setErrorMessage(describeUpdateFailure(error, statusRef.current)); changeStatus("error");
      }
    }
  }, [changeStatus]);

  const continueWithoutUpdate = useCallback(() => {
    if (installingRef.current) return;
    dismissedRef.current = true;
    clearReceipt();
    show(false); finishStartupCheck();
    void closeUpdateResource();
  }, [show, finishStartupCheck, closeUpdateResource]);

  const retryUpdate = useCallback(async () => {
    if (checkingRef.current || installingRef.current) return;
    changeStatus("checking"); setErrorMessage(""); setSignatureVerified(false);
    await closeUpdateResource();
    dismissedRef.current = false;
    await checkForUpdate(true);
  }, [changeStatus, closeUpdateResource, checkForUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    if (!isTauri()) { finishStartupCheck(); return () => { mountedRef.current = false; }; }
    // Keep the OS close button functional. onCloseRequested() would require
    // window:allow-destroy to complete a normal close, which we do not grant.
    // A close after preparation is detected by the next-launch version receipt.
    const boot = async () => {
      try {
        const actualVersion = await getVersion();
        if (cancelled) return;
        setCurrentVersion(actualVersion);
        const receipt = readUpdateReceipt(localStorage);
        if (receipt) {
          bootCompleteRef.current = true;
          setCurrentVersion(receipt.from); setVersion(actualVersion);
          if (confirmUpdateReceipt(receipt, actualVersion) === "complete") {
            clearReceipt(); changeStatus("complete"); show(true);
          } else {
            setCurrentVersion(actualVersion); setVersion(receipt.to); setFailurePhase("installing");
            setErrorMessage(`No se confirmó la versión ${receipt.to}. Se abrió la versión ${actualVersion}; puedes reintentar o continuar sin actualizar.`);
            changeStatus("error"); show(true);
          }
          return; // No automatic retry loop if silent installation failed.
        }
      } catch {
        if (cancelled) return;
        // Version/storage inspection must never stop an offline app opening.
      }
      if (!cancelled) { bootCompleteRef.current = true; await checkForUpdate(); }
    };
    const timer = window.setTimeout(() => void boot(), 250);
    const online = () => { if (bootCompleteRef.current) void checkForUpdate(); };
    window.addEventListener("online", online);
    return () => {
      cancelled = true; mountedRef.current = false;
      window.clearTimeout(timer); window.removeEventListener("online", online);
      if (!installingRef.current) void closeUpdateResource();
    };
  }, [changeStatus, checkForUpdate, closeUpdateResource, finishStartupCheck, show]);

  useEffect(() => { if (presented && status === "ready") void installUpdate(); }, [installUpdate, presented, status]);
  useEffect(() => {
    if (status !== "downloading") return;
    const timer = window.setInterval(() => {
      setElapsedMs(performance.now() - downloadStartedRef.current);
      setWaitingForData(performance.now() - lastByteAtRef.current > 6000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  if (!presented) return null;
  return <UpdateDialog status={status} failurePhase={failurePhase} currentVersion={currentVersion} version={version} notes={notes}
    progress={progress} downloadedBytes={downloadedBytes} totalBytes={totalBytes} signatureVerified={signatureVerified}
    elapsedMs={elapsedMs} waitingForData={waitingForData} errorMessage={errorMessage}
    onContinue={continueWithoutUpdate} onRetry={() => void retryUpdate()} />;
}
