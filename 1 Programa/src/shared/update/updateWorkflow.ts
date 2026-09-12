import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { calculateUpdateProgress } from "./updateProgress.ts";

export type UpdatePhase = "downloading" | "verifying" | "preparing" | "installing" | "restarting";

export type UpdateWorkflowState = {
  phase: UpdatePhase;
  downloadedBytes: number;
  totalBytes: number;
  progress: number | null;
  signatureVerified: boolean;
};

type InstallableUpdate = Pick<Update, "download" | "install">;
type StateListener = (state: UpdateWorkflowState) => void;

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  globalThis.setTimeout(resolve, milliseconds);
});

export async function installSignedUpdate(
  update: InstallableUpdate,
  onState: StateListener,
  relaunchApp: () => Promise<void>,
  waitBeforeInstall: (milliseconds: number) => Promise<void> = wait,
  beforeInstall: () => Promise<void> = async () => undefined,
) {
  let downloadedBytes = 0;
  let totalBytes = 0;
  let downloadFinished = false;

  const reportDownload = (event?: DownloadEvent) => {
    if (event?.event === "Started") {
      downloadedBytes = 0;
      totalBytes = Number.isFinite(event.data.contentLength) && (event.data.contentLength ?? 0) > 0 ? event.data.contentLength! : 0;
    } else if (event?.event === "Progress") {
      if (Number.isFinite(event.data.chunkLength) && event.data.chunkLength > 0) downloadedBytes += event.data.chunkLength;
    } else if (event?.event === "Finished") {
      downloadFinished = true;
    }

    onState({
      // Tauri emits Finished BEFORE its native signature verification. Only
      // download() resolving successfully proves that verification succeeded.
      phase: downloadFinished ? "verifying" : "downloading",
      downloadedBytes,
      totalBytes,
      progress: downloadFinished
        ? 100
        : calculateUpdateProgress(downloadedBytes, totalBytes),
      signatureVerified: false,
    });
  };

  reportDownload();
  // The offline voice makes the signed bundle large. Allow slow connections
  // instead of timing out every three minutes before a full package can arrive.
  await update.download(reportDownload, { timeout: 1_200_000 });
  if (totalBytes > 0 && downloadedBytes !== totalBytes) {
    throw new Error("La descarga no está completa. Vuelve a intentarlo; la versión actual no se ha reemplazado.");
  }
  onState({ phase: "preparing", downloadedBytes, totalBytes, progress: null, signatureVerified: true });
  // Persist only a version receipt, never a path/command or unsigned payload.
  await beforeInstall();
  onState({ phase: "installing", downloadedBytes, totalBytes, progress: null, signatureVerified: true });
  await waitBeforeInstall(350);
  await update.install();

  // On Windows the verified NSIS package runs with /S /R /UPDATE and this
  // process exits. We must not claim completion until the next app verifies
  // its actual running version. Other platforms return here before relaunch.
  onState({ phase: "restarting", downloadedBytes, totalBytes, progress: null, signatureVerified: true });
  await relaunchApp();
}
