import assert from "node:assert/strict";
import type { RoundResult } from "../src/core/types.ts";

class MockUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;

  constructor(text: string) {
    this.text = text;
  }
}

const spoken: MockUtterance[] = [];
const colombianVoice = {
  default: false,
  lang: "es-CO",
  localService: true,
  name: "Helena Natural Colombia",
  voiceURI: "mock-es-co",
} satisfies SpeechSynthesisVoice;
const englishVoice = {
  default: true,
  lang: "en-US",
  localService: true,
  name: "English",
  voiceURI: "mock-en-us",
} satisfies SpeechSynthesisVoice;
const speechSynthesis = {
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  cancel: () => undefined,
  getVoices: () => [englishVoice, colombianVoice],
  speak: (utterance: MockUtterance) => spoken.push(utterance),
};

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { speechSynthesis, setTimeout, clearTimeout },
});
Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
  configurable: true,
  value: MockUtterance,
});

const { fortunaAudio } = await import("../src/shared/audio/audioEngine.ts");
fortunaAudio.setEffectsEnabled(false);
fortunaAudio.setVoiceEnabled(true);
fortunaAudio.setVolume(0.37);

const result: RoundResult = {
  id: "audio-result",
  participantId: "participant-1",
  participantName: "Lucía",
  selectionLabel: "Canica #4",
  kind: "eliminated",
  landedNumber: 4,
  parity: "even",
  mode: "elimination",
  game: "marbles",
  round: 1,
  remainingCount: 7,
  eligibleCount: 8,
  createdAt: new Date(0).toISOString(),
};

fortunaAudio.announceResult(result);
await new Promise((resolve) => setTimeout(resolve, 700));
assert.equal(spoken.length, 2, "La eliminación debe anunciar contexto y nombre.");
assert.ok(spoken.every((utterance) => utterance.voice === colombianVoice));
assert.ok(spoken.every((utterance) => utterance.lang === "es-CO"));
assert.ok(spoken.every((utterance) => utterance.volume === 0.37));
assert.match(spoken[1].text, /Lucía\. Eliminado\./u);
assert.ok(spoken[1].rate >= 0.88, "La locución no debe ser innecesariamente lenta.");

fortunaAudio.setVoiceEnabled(false);
fortunaAudio.announceResult({ ...result, id: "muted-result", participantName: "Mateo" });
await new Promise((resolve) => setTimeout(resolve, 620));
assert.equal(spoken.length, 2, "Desactivar la voz debe impedir nuevas locuciones sin reactivar efectos.");

console.log(JSON.stringify({
  independentVoiceToggle: true,
  preferredLocale: spoken[0].lang,
  masterVolume: spoken[0].volume,
  eliminationRate: spoken[1].rate,
  status: "passed",
}));
