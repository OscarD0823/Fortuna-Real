import { invoke, isTauri } from "@tauri-apps/api/core";
import type { RoundResult } from "../../core/types";

type StopSound = () => void;

type OfflineNarrationResponse = {
  audioBase64: string;
  sampleRate: number;
  durationMs: number;
  generationMs: number;
  engine: string;
  voice: string;
};

const narrationVoiceScore = (voice: SpeechSynthesisVoice, online: boolean) => {
  const language = voice.lang.toLocaleLowerCase();
  const identity = `${voice.name} ${voice.voiceURI} ${language}`.toLocaleLowerCase();
  if (!language.startsWith("es")) return Number.NEGATIVE_INFINITY;
  if (!online && !voice.localService) return Number.NEGATIVE_INFINITY;

  let score = 100;
  if (language === "es-co") score += 240;
  else if (language === "es-419") score += 190;
  else if (language === "es-mx") score += 150;
  else if (language === "es-us") score += 125;
  else if (language === "es-es") score += 90;
  if (/natural|neural|online/u.test(identity)) score += 210;
  if (/salome|gonzalo|dalia|jorge|elvira|alvaro|sabina|helena/u.test(identity)) score += 65;
  if (voice.localService) score += 24;
  if (voice.default) score += 8;
  return score;
};

const selectNarrationVoice = (voices: SpeechSynthesisVoice[]) => {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  return [...voices]
    .map((voice) => ({ voice, score: narrationVoiceScore(voice, online) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => right.score - left.score)[0]?.voice ?? null;
};

class FortunaAudioEngine {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private effectsEnabled = true;
  private voiceEnabled = true;
  private volume = 0.8;
  private announcementTimer: number | null = null;
  private voiceRetryTimer: number | null = null;
  private voiceChangeHandler: (() => void) | null = null;
  private narrationAudio: HTMLAudioElement | null = null;
  private narrationRequest = 0;

  setEnabled(enabled: boolean) {
    this.effectsEnabled = enabled;
    this.voiceEnabled = enabled;
    if (!enabled && this.context?.state === "running") {
      void this.context.suspend();
    }
    if (!enabled) this.cancelAnnouncement();
  }

  setEffectsEnabled(enabled: boolean) {
    this.effectsEnabled = enabled;
    if (!enabled && this.context?.state === "running") void this.context.suspend();
  }

  setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    if (!enabled) this.cancelAnnouncement();
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.output?.gain.setTargetAtTime(this.volume, this.context?.currentTime ?? 0, 0.015);
    if (this.narrationAudio) this.narrationAudio.volume = this.volume;
  }

  private getContext() {
    if (!this.effectsEnabled || typeof globalThis === "undefined") return null;
    if (!this.context) {
      const AudioContextConstructor = (
        globalThis as typeof globalThis & {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        }
      ).AudioContext ?? (
        globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext;
      if (!AudioContextConstructor) return null;
      try {
        this.context = new AudioContextConstructor();
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.18;
        this.output = this.context.createGain();
        this.output.gain.value = this.volume;
        this.output.connect(compressor).connect(this.context.destination);
      } catch {
        this.context = null;
        this.output = null;
        return null;
      }
    }
    if (this.context.state === "suspended") {
      void this.context.resume().catch(() => undefined);
    }
    return this.context;
  }

  private getOutput(context: AudioContext) {
    return this.output ?? context.destination;
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
    oscillator.connect(gain).connect(this.getOutput(context));
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
    source.connect(filter).connect(gain).connect(this.getOutput(context));
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

  private cancelNarrationPlayback() {
    this.narrationRequest += 1;
    if (this.voiceRetryTimer !== null) {
      globalThis.clearTimeout(this.voiceRetryTimer);
      this.voiceRetryTimer = null;
    }
    if (this.voiceChangeHandler && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.removeEventListener("voiceschanged", this.voiceChangeHandler);
      this.voiceChangeHandler = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.narrationAudio) {
      this.narrationAudio.pause();
      this.narrationAudio.removeAttribute("src");
      this.narrationAudio.load();
      this.narrationAudio = null;
    }
  }

  private cancelAnnouncement() {
    if (this.announcementTimer !== null) {
      globalThis.clearTimeout(this.announcementTimer);
      this.announcementTimer = null;
    }
    this.cancelNarrationPlayback();
  }

  private speakWithSystemVoice(
    text: string,
    naturalRate: number,
    fallbackRate: number,
    requestId: number,
  ) {
    if (
      requestId !== this.narrationRequest
      || !this.voiceEnabled
      || typeof window === "undefined"
      || !("speechSynthesis" in window)
      || typeof SpeechSynthesisUtterance === "undefined"
    ) return;

    let spoken = false;
    const speak = (allowDefaultVoice = false) => {
      if (spoken || requestId !== this.narrationRequest || !this.voiceEnabled) return;
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0 && !allowDefaultVoice) return;
      spoken = true;
      if (this.voiceRetryTimer !== null) window.clearTimeout(this.voiceRetryTimer);
      this.voiceRetryTimer = null;
      if (this.voiceChangeHandler) {
        window.speechSynthesis.removeEventListener("voiceschanged", this.voiceChangeHandler);
        this.voiceChangeHandler = null;
      }

      const voice = selectNarrationVoice(availableVoices);
      const naturalVoice = Boolean(voice && /natural|neural|online/iu.test(`${voice.name} ${voice.voiceURI}`));
      const narration = new SpeechSynthesisUtterance(text);
      narration.voice = voice;
      narration.lang = voice?.lang || "es-CO";
      narration.rate = naturalVoice ? naturalRate : fallbackRate;
      narration.pitch = naturalVoice ? 1 : 0.97;
      narration.volume = this.volume;
      window.speechSynthesis.speak(narration);
    };

    this.voiceChangeHandler = () => speak();
    window.speechSynthesis.addEventListener("voiceschanged", this.voiceChangeHandler, { once: true });
    speak();
    if (!spoken) {
      this.voiceRetryTimer = window.setTimeout(() => {
        speak(true);
        if (!spoken) this.voiceChangeHandler = null;
      }, 1_000);
    }
  }

  private speakNarration(text: string, naturalRate: number, fallbackRate: number) {
    if (!this.voiceEnabled || this.volume <= 0) return;
    this.cancelNarrationPlayback();
    const requestId = this.narrationRequest;

    if (isTauri() && typeof Audio !== "undefined") {
      void invoke<OfflineNarrationResponse>("synthesize_offline_speech", {
        request: { text, speed: naturalRate },
      }).then((response) => {
        if (requestId !== this.narrationRequest || !this.voiceEnabled || this.volume <= 0) return;
        const narration = new Audio(`data:audio/wav;base64,${response.audioBase64}`);
        narration.preload = "auto";
        narration.volume = this.volume;
        narration.addEventListener("ended", () => {
          if (this.narrationAudio === narration) this.narrationAudio = null;
        }, { once: true });
        this.narrationAudio = narration;
        void narration.play().catch(() => {
          if (this.narrationAudio === narration) this.narrationAudio = null;
          this.speakWithSystemVoice(text, naturalRate, fallbackRate, requestId);
        });
      }).catch(() => {
        this.speakWithSystemVoice(text, naturalRate, fallbackRate, requestId);
      });
      return;
    }

    this.speakWithSystemVoice(text, naturalRate, fallbackRate, requestId);
  }

  previewNarration() {
    this.speakNarration(
      "Atención, participantes. La siguiente ronda está a punto de comenzar.",
      0.9,
      0.86,
    );
  }

  speakGuide(text: string) {
    const guideText = text.replace(/\s+/gu, " ").trim().slice(0, 780);
    if (!guideText) return;
    this.speakNarration(guideText, 0.92, 0.88);
  }

  stopNarration() {
    this.cancelAnnouncement();
  }

  announceResult(result: RoundResult) {
    if (!this.voiceEnabled || (result.kind !== "winner" && result.kind !== "eliminated")) return;

    this.cancelAnnouncement();
    this.announcementTimer = window.setTimeout(() => {
      const contextLabel = result.game === "cards"
        ? result.selectionLabel || `Carta ${result.landedNumber}`
        : result.game === "pinball"
          ? result.selectionLabel || `Pelota ${result.landedNumber}`
        : result.game === "marbles"
          ? result.selectionLabel || `Canica ${result.landedNumber}`
        : result.game === "ducks"
          ? result.selectionLabel || `Pato ${result.landedNumber}`
          : `Número ${result.landedNumber}`;
      const announcementText = result.kind === "winner"
        ? result.selectedParticipantName
          ? `Resultado confirmado. ${result.selectedParticipantName} queda fuera de la ronda; y ${result.participantName} gana Fortuna Real. El premio es ${result.prize || "el premio del sorteo"}. ¡Felicitaciones!`
          : `Atención, Fortuna Real tiene un resultado. ${contextLabel}: ${result.participantName} gana. El premio es ${result.prize || "el premio del sorteo"}. ¡Felicitaciones!`
        : `Resultado confirmado. ${contextLabel}: ${result.participantName} queda fuera de la ronda.`;

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

      this.speakNarration(
        announcementText,
        result.kind === "winner" ? 0.92 : 0.9,
        result.kind === "winner" ? 0.88 : 0.86,
      );
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
    hum.connect(humGain).connect(this.getOutput(context));
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
