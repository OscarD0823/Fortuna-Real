import type { UpdatePhase } from "./updateWorkflow";
import { formatUpdateBytes } from "./updateProgress.ts";

export type UpdateStatus = "checking" | "ready" | UpdatePhase | "complete" | "error";
export const updateSteps = [
  { label: "Comprobar versión", detail: "Consultar la versión publicada en GitHub" },
  { label: "Descargar archivos", detail: "Recibir el paquete de actualización" },
  { label: "Verificar seguridad", detail: "Comprobar la firma del paquete" },
  { label: "Preparar el reinicio", detail: "Guardar la versión que se debe abrir" },
  { label: "Aplicar y volver a abrir", detail: "Reemplazar el programa y confirmar la versión" },
] as const;

export const updateStepIndex = (status: UpdateStatus): number => {
  switch (status) {
    case "checking": return 0;
    case "ready": case "downloading": return 1;
    case "verifying": return 2;
    case "preparing": return 3;
    case "installing": case "restarting": return 4;
    case "complete": return 5;
    case "error": return -1;
  }
};

export const updateHeadings: Record<UpdateStatus, { title: string; detail: string }> = {
  checking: { title: "Buscando actualizaciones", detail: "Consultando GitHub para comprobar si hay una versión nueva." },
  ready: { title: "Actualización encontrada", detail: "La descarga comenzará automáticamente cuando el programa esté libre." },
  downloading: { title: "Actualizando Fortuna Real", detail: "Descargando los archivos. Puedes ver el avance real; no cierres el programa." },
  verifying: { title: "Comprobando la firma", detail: "La descarga terminó. Verificando que el paquete firmado pertenece a Fortuna Real." },
  preparing: { title: "Preparando el reinicio", detail: "Firma verificada. Guardando la versión esperada para confirmar el resultado al volver." },
  installing: { title: "Aplicando actualización", detail: "Fortuna Real se cerrará brevemente para reemplazar sus archivos y abrirse de nuevo. No necesitas abrir otra ventana." },
  restarting: { title: "Volviendo a abrir Fortuna Real", detail: "Solicitando el reinicio. La nueva versión se comprobará al abrir el programa." },
  complete: { title: "Actualización completada", detail: "La versión que está ejecutándose ya coincide con la actualización. Tus participantes y resultados siguen en el programa." },
  error: { title: "No se pudo completar la actualización", detail: "Puedes volver a intentarlo o continuar usando el programa." },
};

export function describeUpdateFailure(error: unknown, phase: UpdateStatus): string {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/signature|firma|pubkey|public key|minisign/iu.test(detail)) return "La firma del paquete no es válida o no se pudo verificar. Por seguridad no se aplicó la actualización.";
  if (/timeout|timed out/iu.test(detail)) return "La conexión tardó demasiado. Revisa tu conexión y vuelve a intentarlo.";
  if (/network|fetch|connection|http|dns/iu.test(detail)) return "Se interrumpió la conexión con GitHub. Puedes seguir usando esta versión y volver a intentarlo.";
  if (/espacio|reinicio|completa|versión no es válida/iu.test(detail)) return detail;
  return phase === "installing" || phase === "restarting"
    ? "No se pudo completar el cambio de versión. Cierra otras ventanas de Fortuna Real y vuelve a intentarlo. No se ha confirmado la nueva versión."
    : "No se pudo preparar la actualización. No se aplicó ningún paquete nuevo; vuelve a intentarlo.";
}

/** A simple average is labelled approximate; never fabricate file-copy progress. */
export function downloadTelemetry(bytes: number, total: number, elapsedMs: number) {
  if (elapsedMs < 1500 || bytes <= 0 || !Number.isFinite(bytes) || !Number.isFinite(elapsedMs)) return null;
  const bytesPerSecond = bytes * 1000 / elapsedMs;
  const seconds = total > bytes ? Math.ceil((total - bytes) / bytesPerSecond) : null;
  return {
    speed: `${formatUpdateBytes(bytesPerSecond)}/s`,
    remaining: seconds === null ? null : seconds < 60 ? `aprox. ${seconds} s restantes` : `aprox. ${Math.ceil(seconds / 60)} min restantes`,
  };
}
