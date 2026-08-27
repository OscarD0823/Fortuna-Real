import { useEffect, useRef, type KeyboardEvent } from "react";
import { fortunaAudio } from "../audio/audioEngine";

/** Keeps tutorial navigation separate from the game's keyboard controls. */
export function useTutorialDialog<T extends HTMLElement>(
  stepKey: string,
  onDone: () => void,
  onMove: (direction: -1 | 1) => void,
) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      fortunaAudio.stopNarration();
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      });
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    return () => fortunaAudio.stopNarration();
  }, [stepKey]);

  const onKeyDown = (event: KeyboardEvent<T>) => {
    event.stopPropagation();
    const editingText = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (event.key === "Escape") {
      event.preventDefault();
      onDone();
    } else if (!editingText && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      onMove(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Tab") {
      const dialog = dialogRef.current;
      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']") ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (active === dialog || !dialog?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return { dialogRef, onKeyDown, onKeyUp: (event: KeyboardEvent<T>) => event.stopPropagation() };
}
