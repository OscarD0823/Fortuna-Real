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

  private noise(duration: number, volume = 0.025, delay = 0) {
    const context = this.getContext();
    if (!context) return;
    const start = context.currentTime + delay;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / channel.length);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1700, start);
    filter.Q.setValueAtTime(0.8, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(start);
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

  playCardGather() {
    this.noise(0.42, 0.035);
    this.tone(680, 0.42, { type: "triangle", volume: 0.035, endFrequency: 240 });
  }

  playCardShuffle() {
    [0, 0.12, 0.24, 0.39, 0.52, 0.66].forEach((delay, index) => {
      this.noise(0.09, 0.025 + (index % 2) * 0.008, delay);
      this.tone(index % 2 === 0 ? 230 : 310, 0.08, {
        type: "triangle",
        volume: 0.026,
        delay,
        endFrequency: index % 2 === 0 ? 360 : 180,
      });
    });
  }

  playCardDeal() {
    Array.from({ length: 9 }, (_, index) => index * 0.075).forEach((delay, index) => {
      this.noise(0.055, 0.018, delay);
      this.tone(360 + (index % 3) * 55, 0.055, {
        type: "triangle",
        volume: 0.025,
        delay,
        endFrequency: 250,
      });
    });
  }

  playCardSelect() {
    this.noise(0.2, 0.03);
    [392, 587, 784].forEach((frequency, index) => {
      this.tone(frequency, 0.34, {
        type: "triangle",
        volume: 0.05,
        delay: index * 0.085,
      });
    });
  }

  playPinballStart() {
    this.cancelAnnouncement();
    this.noise(0.24, 0.028);
    [147, 220, 330, 660].forEach((frequency, index) => {
      this.tone(frequency, 0.38, {
        type: index < 2 ? "sawtooth" : "triangle",
        volume: 0.034,
        delay: index * 0.065,
        endFrequency: frequency * 1.45,
      });
    });
  }

  playPinballLaunch() {
    this.noise(0.12, 0.025);
    this.tone(170, 0.17, { type: "sawtooth", volume: 0.032, endFrequency: 620 });
    this.tone(880, 0.08, { type: "square", volume: 0.025, delay: 0.11, endFrequency: 440 });
  }

  playPinballImpact(strength = 0.5) {
    const volume = 0.012 + Math.min(1, strength) * 0.018;
    this.tone(520 + strength * 540, 0.055, { type: "triangle", volume, endFrequency: 280 });
  }

  playPinballFlipper() {
    this.tone(125, 0.065, { type: "square", volume: 0.025, endFrequency: 230 });
  }

  playPinballFinish() {
    this.noise(0.32, 0.034);
    [392, 587, 784, 1175].forEach((frequency, index) => {
      this.tone(frequency, 0.44, { type: "triangle", volume: 0.046, delay: index * 0.08 });
    });
  }

  playMarbleStart() {
    this.cancelAnnouncement();
    this.noise(0.32, 0.035);
    [196, 294, 392, 587].forEach((frequency, index) => {
      this.tone(frequency, 0.48, {
        type: index < 2 ? "sawtooth" : "triangle",
        volume: 0.035,
        delay: index * 0.08,
        endFrequency: frequency * 1.35,
      });
    });
  }

  playMarblePower() {
    this.tone(460, 0.13, { type: "square", volume: 0.028, endFrequency: 920 });
    this.tone(740, 0.18, { type: "triangle", volume: 0.035, delay: 0.08, endFrequency: 1240 });
  }

  playMarbleFinish() {
    this.noise(0.28, 0.032);
    [392, 523, 659, 880].forEach((frequency, index) => {
      this.tone(frequency, 0.42, {
        type: "triangle",
        volume: 0.045,
        delay: index * 0.075,
      });
    });
  }

  playDuckStart() {
    this.cancelAnnouncement();
    this.noise(0.26, 0.025);
    [220, 330, 494, 740].forEach((frequency, index) => {
      this.tone(frequency, 0.34, {
        type: index < 2 ? "sawtooth" : "triangle",
        volume: 0.032,
        delay: index * 0.07,
        endFrequency: frequency * 1.32,
      });
    });
  }

  playDuckShot(hit: boolean) {
    this.noise(0.17, hit ? 0.07 : 0.052);
    this.tone(92, 0.16, { type: "sawtooth", volume: 0.055, endFrequency: 42 });
    if (hit) {
      this.tone(880, 0.11, { type: "square", volume: 0.04, delay: 0.09, endFrequency: 440 });
      this.tone(523, 0.2, { type: "triangle", volume: 0.038, delay: 0.17, endFrequency: 784 });
    }
  }

  playDuckShield() {
    this.noise(0.12, 0.028);
    this.tone(1180, 0.12, { type: "square", volume: 0.035, endFrequency: 620 });
    this.tone(520, 0.32, { type: "triangle", volume: 0.04, delay: 0.08, endFrequency: 1040 });
    this.tone(1560, 0.18, { type: "sine", volume: 0.025, delay: 0.16, endFrequency: 880 });
  }

  playDuckTakeoff() {
    [0, 0.09, 0.18, 0.27].forEach((delay, index) => {
      this.noise(0.075, 0.014, delay);
      this.tone(280 + index * 75, 0.12, { type: "triangle", volume: 0.022, delay, endFrequency: 520 + index * 80 });
    });
  }

  playDuckWinner() {
    this.noise(0.3, 0.035);
    [392, 523, 659, 880, 1175].forEach((frequency, index) => {
      this.tone(frequency, 0.48, { type: "triangle", volume: 0.047, delay: index * 0.085 });
    });
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
    this.announcementTimer = window.setTimeout(() => {
      const spanishVoices = window.speechSynthesis.getVoices().filter(
        (voice) => voice.lang.toLocaleLowerCase().startsWith("es"),
      );
      const voice = spanishVoices.find(
        (candidate) => /natural|neural|colombia|mexico|mexican|sabina|helena|dalia|elvira/i.test(
          `${candidate.name} ${candidate.lang}`,
        ),
      ) ?? spanishVoices[0] ?? null;

      const contextLabel = result.game === "cards"
        ? result.selectionLabel || `Carta ${result.landedNumber}`
        : result.game === "pinball"
          ? result.selectionLabel || `Pelota ${result.landedNumber}`
        : result.game === "marbles"
          ? result.selectionLabel || `Canica ${result.landedNumber}`
        : result.game === "ducks"
          ? result.selectionLabel || `Pato ${result.landedNumber}`
          : `Número ${result.landedNumber}`;
      const parts = result.kind === "winner"
        ? result.selectedParticipantName
          ? [
              { text: `Resultado confirmado. ${result.selectedParticipantName} ha sido eliminado.`, rate: 0.88, pitch: 0.82 },
              { text: `¡Atención! ${result.participantName} es el gran ganador de Fortuna Real.`, rate: 0.96, pitch: 1.08 },
              { text: `Premio: ${result.prize || "premio del sorteo"}. ¡Felicidades!`, rate: 1, pitch: 1.12 },
            ]
          : [
              { text: "¡Atención! Fortuna Real tiene un resultado.", rate: 0.97, pitch: 1.02 },
              { text: `${contextLabel}. ¡${result.participantName} es el gran ganador!`, rate: 0.94, pitch: 1.12 },
              { text: `Premio: ${result.prize || "premio del sorteo"}. ¡Felicidades!`, rate: 1, pitch: 1.15 },
            ]
        : [
            { text: "Atención. Resultado confirmado.", rate: 0.82, pitch: 0.78 },
            { text: `${contextLabel}. ${result.participantName}. Eliminado.`, rate: 0.76, pitch: 0.68 },
          ];

      if (result.kind === "winner") {
        [659, 831, 1047].forEach((frequency, index) => this.tone(frequency, 0.45, {
          type: "triangle",
          volume: 0.04,
          delay: index * 0.1,
        }));
      } else {
        this.tone(440, 0.18, { type: "sine", volume: 0.035 });
        this.tone(330, 0.32, { type: "sine", volume: 0.04, delay: 0.19, endFrequency: 220 });
      }

      parts.forEach((part) => {
        const announcement = new SpeechSynthesisUtterance(part.text);
        announcement.voice = voice;
        announcement.lang = voice?.lang || "es-CO";
        announcement.rate = part.rate;
        announcement.pitch = part.pitch;
        announcement.volume = 1;
        window.speechSynthesis.speak(announcement);
      });
      this.announcementTimer = null;
    }, result.kind === "winner" ? 720 : 560);
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
