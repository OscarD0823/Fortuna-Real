import type { RoundResult } from "../../core/types";

type StopSound = () => void;

class FortunaAudioEngine {
  private context: AudioContext | null = null;
  private enabled = true;
  private announcementTimer: number | null = null;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && this.context?.state === "running") {
      void this.context.suspend();
    }
    if (!enabled) this.cancelAnnouncement();
  }

  private getContext() {
    if (!this.enabled) return null;
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    return this.context;
  }

  private tone(
    frequency: number,
    duration: number,
    options: {
      type?: OscillatorType;
      volume?: number;
      delay?: number;
      endFrequency?: number;
    } = {},
  ) {
    const context = this.getContext();
    if (!context) return;
    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.06, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  playClick() {
    this.tone(520, 0.08, { type: "triangle", volume: 0.045, endFrequency: 760 });
  }

  playEnterGame() {
    [392, 494, 587, 784].forEach((frequency, index) => {
      this.tone(frequency, 0.42, {
        type: "triangle",
        volume: 0.045,
        delay: index * 0.09,
      });
    });
  }

  playBallDrop() {
    this.tone(920, 0.08, { type: "square", volume: 0.035, endFrequency: 430 });
    this.tone(510, 0.16, { type: "triangle", volume: 0.055, delay: 0.08, endFrequency: 280 });
  }

  playResult(winner: boolean, parity?: "even" | "odd") {
    if (winner) {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        this.tone(frequency, 0.55, {
          type: "triangle",
          volume: 0.065,
          delay: index * 0.11,
        });
      });
      return;
    }

    const notes = parity === "even" ? [392, 523, 659] : [349, 466, 587];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.3, {
        type: "sine",
        volume: 0.05,
        delay: index * 0.08,
      });
    });
  }

  private cancelAnnouncement() {
    if (this.announcementTimer !== null) {
      globalThis.clearTimeout(this.announcementTimer);
      this.announcementTimer = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  announceResult(result: RoundResult) {
    if (!this.enabled || (result.kind !== "winner" && result.kind !== "eliminated")) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (typeof SpeechSynthesisUtterance === "undefined") return;

    this.cancelAnnouncement();
    const message = result.kind === "winner"
      ? `Atención. ${result.participantName} es el ganador. Premio: ${result.prize || "premio del sorteo"}.`
      : `Participante número ${result.landedNumber}. ${result.participantName}. Eliminado.`;

    this.announcementTimer = window.setTimeout(() => {
      const announcement = new SpeechSynthesisUtterance(message);
      const spanishVoices = window.speechSynthesis.getVoices().filter(
        (voice) => voice.lang.toLocaleLowerCase().startsWith("es"),
      );
      announcement.voice = spanishVoices.find(
        (voice) => /colombia|mexico|mexican|sabina|helena|pablo|jorge/i.test(
          `${voice.name} ${voice.lang}`,
        ),
      ) ?? spanishVoices[0] ?? null;
      announcement.lang = announcement.voice?.lang || "es-CO";
      announcement.rate = result.kind === "winner" ? 0.86 : 0.78;
      announcement.pitch = result.kind === "winner" ? 0.86 : 0.68;
      announcement.volume = 1;
      this.announcementTimer = null;
      window.speechSynthesis.speak(announcement);
    }, result.kind === "winner" ? 950 : 720);
  }

  startRoulette(): StopSound {
    this.cancelAnnouncement();
    const context = this.getContext();
    if (!context) return () => undefined;

    const hum = context.createOscillator();
    const humGain = context.createGain();
    hum.type = "sawtooth";
    hum.frequency.setValueAtTime(74, context.currentTime);
    hum.frequency.exponentialRampToValueAtTime(38, context.currentTime + 5.6);
    humGain.gain.setValueAtTime(0.0001, context.currentTime);
    humGain.gain.exponentialRampToValueAtTime(0.022, context.currentTime + 0.15);
    humGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 5.7);
    hum.connect(humGain).connect(context.destination);
    hum.start();
    hum.stop(context.currentTime + 5.75);

    let active = true;
    let delay = 58;
    let timer = 0;
    const tick = () => {
      if (!active) return;
      this.tone(780, 0.035, {
        type: "square",
        volume: Math.max(0.012, 0.038 - delay / 16000),
        endFrequency: 540,
      });
      delay = Math.min(410, delay * 1.075);
      timer = window.setTimeout(tick, delay);
    };
    tick();

    return () => {
      active = false;
      window.clearTimeout(timer);
      try {
        humGain.gain.cancelScheduledValues(context.currentTime);
        humGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.025);
      } catch {
        // El oscilador puede haber finalizado naturalmente.
      }
    };
  }
}

export const fortunaAudio = new FortunaAudioEngine();
