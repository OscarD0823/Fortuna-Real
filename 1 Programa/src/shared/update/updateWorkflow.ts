import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { calculateUpdateProgress } from "./updateProgress.ts";

export type UpdatePhase = "downloading" | "installing" | "restarting";

export type UpdateWorkflowState = {
  phase: UpdatePhase;
  downloadedBytes: number;
  totalBytes: number;
  progress: number | null;
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
) {
  let downloadedBytes = 0;
  let totalBytes = 0;

  const reportDownload = (event?: DownloadEvent) => {
    if (event?.event === "Started") {
      downloadedBytes = 0;
      totalBytes = event.data.contentLength ?? 0;
    } else if (event?.event === "Progress") {
      downloadedBytes += event.data.chunkLength;
    }

    onState({
      phase: "downloading",
      downloadedBytes,
      totalBytes,
      progress: event?.event === "Finished"
        ? 100
        : calculateUpdateProgress(downloadedBytes, totalBytes),
    });
  };

  reportDownload();
  await update.download(reportDownload, { timeout: 180_000 });
  onState({ phase: "installing", downloadedBytes, totalBytes, progress: 100 });
  await waitBeforeInstall(350);
  await update.install();

  // En Windows `install` cierra la aplicación al lanzar el instalador. Esta
  // ruta completa el reinicio en las plataformas donde el proceso continúa.
  onState({ phase: "restarting", downloadedBytes, totalBytes, progress: 100 });
  await relaunchApp();
}
