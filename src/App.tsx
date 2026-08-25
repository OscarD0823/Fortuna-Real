import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Bird,
  CheckCircle2,
  CircleDot,
  Crosshair,
  Crown,
  Dices,
  Expand,
  Flag,
  Gamepad2,
  Gem,
  Gift,
  Hash,
  History,
  Layers3,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import "./App.css";
import type {
  DrawMode,
  GameId,
  MarbleDifficulty,
  Participant,
  Parity,
  PinballControlMode,
  RouletteEntry,
  RoundResult,
} from "./core/types";
import { CardGame } from "./games/cards/CardGame";
import { prepareCardRound, type CardAssignment } from "./games/cards/cardDeck";
import { DuckHunt } from "./games/ducks/DuckHunt";
import type { DuckContestant } from "./games/ducks/duckHuntEngine";
import { MarbleRace } from "./games/marbles/MarbleRace";
import {
  difficultyLabels,
  prepareMarbleRace,
  powerLabels,
  powersByDifficulty,
  type MarbleRacer,
  type MarbleTrack,
} from "./games/marbles/marbleRaceEngine";
import { PinballGame } from "./games/pinball/PinballGame";
import {
  preparePinballRound,
  type PinballBallAssignment,
} from "./games/pinball/pinballEngine";
import { RouletteWheel } from "./games/roulette/RouletteWheel";
import { createRouletteCommitment } from "./games/roulette/rouletteCommitment";
import { arrangeEliminationEntries } from "./games/roulette/rouletteEntries";
import { DrawSetup } from "./modules/draw/DrawSetup";
import { ParticipantPanel } from "./modules/participants/ParticipantPanel";
import { useDrawStore } from "./modules/participants/drawStore";
import { ResultReveal } from "./modules/results/ResultReveal";
import { resolveFinalWinner } from "./modules/results/finalWinner";
import { WinnerHistory } from "./modules/winners/WinnerHistory";
import { fortunaAudio } from "./shared/audio/audioEngine";
import { sha256Hex } from "./shared/crypto/sha256";
import { SplashScreen } from "./shared/components/SplashScreen";
import { AppUpdater } from "./shared/components/AppUpdater";

const secureRandomDegrees = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] / 2 ** 32) * 360;
};

const modeLabels: Record<DrawMode, string> = {
  direct: "Ganador directo",
  elimination: "Eliminación",
};

const estimatedEliminationSeconds: Record<GameId, number> = {
  roulette: 7,
  cards: 5,
  pinball: 12,
  marbles: 17,
  ducks: 8,
};

const formatEstimatedDuration = (
  game: GameId,
  participantCount: number,
  marbleDifficulty: MarbleDifficulty,
) => {
  if (participantCount < 2) return "Agrega al menos dos participantes";
  const marbleSeconds = marbleDifficulty === "easy" ? 12 : marbleDifficulty === "hard" ? 22 : 17;
  const duckSeconds = participantCount > 100
    ? 0.78
    : participantCount > 50
      ? 1.56
      : participantCount > 20
        ? 2.94
        : 6.24;
  const secondsPerElimination = game === "marbles"
    ? marbleSeconds
    : game === "ducks"
      ? duckSeconds
      : estimatedEliminationSeconds[game];
  const totalMinutes = Math.max(1, Math.ceil(((participantCount - 1) * secondsPerElimination) / 60));
  return totalMinutes === 1 ? "≈ 1 minuto" : `≈ ${totalMinutes} minutos`;
};

const numberParity = (number: number): Parity =>
  number % 2 === 0 ? "even" : "odd";

type ActiveScreen = "setup" | "roulette" | "cards" | "pinball" | "marbles" | "ducks";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<ActiveScreen>("setup");
  const [cardRoundKey, setCardRoundKey] = useState(0);
  const [pinballRoundKey, setPinballRoundKey] = useState(0);
  const [marbleRoundKey, setMarbleRoundKey] = useState(0);
  const [duckRoundKey, setDuckRoundKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [roundAnimating, setRoundAnimating] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("fortuna-real-sound") !== "off",
  );
  const [voiceEnabled, setVoiceEnabled] = useState(
    () => localStorage.getItem("fortuna-real-voice") !== "off",
  );
  const [audioVolume, setAudioVolume] = useState(() => {
    const stored = Number(localStorage.getItem("fortuna-real-volume"));
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.8;
  });
  const [spinRequest, setSpinRequest] = useState<{
    entryId: string;
    nonce: number;
    ballLandingAngle: number;
  } | null>(null);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const pendingSelection = useRef<RouletteEntry | null>(null);
  const stopSpinSound = useRef<(() => void) | null>(null);

  const participants = useDrawStore((state) => state.participants);
  const eliminatedIds = useDrawStore((state) => state.eliminatedIds);
  const blockedWinnerIds = useDrawStore((state) => state.blockedWinnerIds);
  const eliminationParity = useDrawStore((state) => state.eliminationParity);
  const history = useDrawStore((state) => state.history);
  const winnerRecords = useDrawStore((state) => state.winnerRecords);
  const game = useDrawStore((state) => state.game);
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const pinballControlMode = useDrawStore((state) => state.pinballControlMode);
  const marbleDifficulty = useDrawStore((state) => state.marbleDifficulty);
  const roundNumber = useDrawStore((state) => state.roundNumber);
  const activeSession = useDrawStore((state) => state.activeSession);
  const beginSession = useDrawStore((state) => state.beginSession);
  const commitRound = useDrawStore((state) => state.commitRound);
  const cancelSession = useDrawStore((state) => state.cancelSession);
  const startDraw = useDrawStore((state) => state.startDraw);
  const recordSelection = useDrawStore((state) => state.recordSelection);
  const recordDuckSurvival = useDrawStore((state) => state.recordDuckSurvival);
  const reenableWinner = useDrawStore((state) => state.reenableWinner);
  const setMarbleDifficulty = useDrawStore((state) => state.setMarbleDifficulty);

  const activeParticipants = useMemo(
    () => {
      const committedIds = activeSession?.status === "committed"
        ? new Set(activeSession.participantIds)
        : null;
      return participants.filter(
        (person) =>
          (!committedIds || committedIds.has(person.id))
          && !eliminatedIds.includes(person.id)
          && (committedIds ? true : !blockedWinnerIds.includes(person.id)),
      );
    },
    [activeSession, blockedWinnerIds, eliminatedIds, participants],
  );
  const previousWinnerIds = useMemo(
    () => new Set(winnerRecords.map((record) => record.participantId)),
    [winnerRecords],
  );

  const wheelEntries = useMemo<RouletteEntry[]>(() => {
    const participantEntries = activeParticipants.map((person, index) => {
      const number = index + 1;
      const parity = numberParity(number);
      return {
        id: `participant-${person.id}`,
        kind: "participant" as const,
        label: person.name,
        color: person.color,
        number,
        participantId: person.id,
        parity,
        disabled: false,
      };
    });

    if (mode !== "elimination") return participantEntries;
    return arrangeEliminationEntries(participantEntries).map((entry) =>
      entry.kind === "parity" ? { ...entry, disabled: true } : entry,
    );
  }, [activeParticipants, mode]);

  const selectableEntries = useMemo(
    () => wheelEntries.filter((entry) => !entry.disabled),
    [wheelEntries],
  );
  const latestResult = currentResult ?? history[0] ?? null;
  const sessionWinner =
    mode === "direct" ? null : history.find((result) => result.kind === "winner") ?? null;
  const sessionCommitted = activeSession?.status === "committed";
  const roundLocked = roundAnimating || sessionCommitted;

  useEffect(() => {
    fortunaAudio.setEffectsEnabled(soundEnabled);
    localStorage.setItem("fortuna-real-sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(() => {
    fortunaAudio.setVoiceEnabled(voiceEnabled);
    localStorage.setItem("fortuna-real-voice", voiceEnabled ? "on" : "off");
  }, [voiceEnabled]);

  useEffect(() => {
    fortunaAudio.setVolume(audioVolume);
    localStorage.setItem("fortuna-real-volume", audioVolume.toFixed(2));
  }, [audioVolume]);

  useEffect(
    () => () => {
      stopSpinSound.current?.();
    },
    [],
  );

  useEffect(() => {
    if (activeSession?.status === "committed" && screen === "setup") {
      setScreen(activeSession.game);
    }
  }, [activeSession, screen]);

  const ensureSession = useCallback((options?: { seed?: string; commitmentId?: string }) => {
    const existing = useDrawStore.getState().activeSession;
    if (existing?.status === "committed") return existing;
    return beginSession(options);
  }, [beginSession]);

  const requestCommittedCancellation = useCallback((destination: string) => {
    const current = useDrawStore.getState().activeSession;
    if (current?.status !== "committed") return true;
    const confirmed = window.confirm(
      `La sesión ${current.sessionId.slice(-8).toUpperCase()} ya está comprometida. `
      + `Si continúas, se anulará el resultado pendiente y se registrará la cancelación. ¿Quieres ${destination}?`,
    );
    if (!confirmed) return false;
    const reason = window.prompt(
      "Indica el motivo de cancelación para el registro de auditoría:",
      `Operador solicitó ${destination}`,
    )?.trim();
    if (!reason) {
      window.alert("La sesión sigue activa: el motivo de cancelación es obligatorio.");
      return false;
    }
    cancelSession(reason);
    return true;
  }, [cancelSession]);

  const enterSelectedGame = () => {
    if (activeParticipants.length < 2) return;
    setRoundAnimating(false);
    setIsSpinning(false);
    setCurrentResult(null);
    setSpinRequest(null);
    setCardRoundKey((key) => key + 1);
    setPinballRoundKey((key) => key + 1);
    setMarbleRoundKey((key) => key + 1);
    setDuckRoundKey((key) => key + 1);
    setScreen(activeSession?.status === "committed" ? activeSession.game : game);
    fortunaAudio.playEnterGame();
  };

  const returnToSetup = () => {
    if (!requestCommittedCancellation("volver a la configuración")) return;
    fortunaAudio.playClick();
    stopSpinSound.current?.();
    stopSpinSound.current = null;
    pendingSelection.current = null;
    setRoundAnimating(false);
    setScreen("setup");
    setCurrentResult(null);
    setSpinRequest(null);
    setIsSpinning(false);
    if (useDrawStore.getState().activeSession?.status !== "committed") startDraw();
  };

  const startSpin = () => {
    if (
      isSpinning ||
      selectableEntries.length === 0 ||
      !!sessionWinner ||
      (mode === "elimination" && activeParticipants.length < 2)
    ) return;

    const pendingCommitment = useDrawStore.getState().activeSession?.roundCommitment;
    const freshCommitment = pendingCommitment ? null : createRouletteCommitment(selectableEntries);
    const selected = pendingCommitment
      ? selectableEntries.find((entry) => entry.participantId === pendingCommitment.expectedParticipantId)
      : freshCommitment?.selected;
    if (!selected) {
      window.alert("El compromiso pendiente no coincide con los participantes elegibles. Cancela la sesión para continuar.");
      return;
    }
    ensureSession();
    if (!pendingCommitment && freshCommitment) {
      commitRound({
        commitmentId: freshCommitment.commitmentId,
        seed: freshCommitment.seed,
        expectedParticipantId: selected.participantId ?? undefined,
        expectedLandedNumber: selected.number,
      });
    }
    setRoundAnimating(true);
    pendingSelection.current = selected;
    setCurrentResult(null);
    setIsSpinning(true);
    setSpinRequest({
      entryId: selected.id,
      nonce: Date.now(),
      ballLandingAngle: secureRandomDegrees(),
    });
    stopSpinSound.current?.();
    stopSpinSound.current = fortunaAudio.startRoulette();
  };

  const finishSpin = useCallback(() => {
    const selection = pendingSelection.current;
    if (!selection) return;

    stopSpinSound.current?.();
    stopSpinSound.current = null;
    fortunaAudio.playBallDrop();
    if (selection.kind !== "participant" || !selection.participantId) return;
    const result = recordSelection(selection.participantId, selection.number, `Número ${selection.number}`);
    setIsSpinning(false);
    setRoundAnimating(false);
    setCurrentResult(result);
    pendingSelection.current = null;

    window.setTimeout(() => {
      fortunaAudio.playResult(result.kind === "winner", result.parity);
      fortunaAudio.announceResult(result);
    }, 170);
  }, [recordSelection]);

  const finishCardSelection = useCallback((assignment: CardAssignment, position: number) => {
    const result = recordSelection(assignment.participant.id, position, assignment.label);
    setRoundAnimating(false);
    setCurrentResult(result);

    window.setTimeout(() => {
      fortunaAudio.playResult(result.kind === "winner", result.parity);
      fortunaAudio.announceResult(result);
    }, 170);
  }, [recordSelection]);

  const finishPinballSelection = useCallback((assignment: PinballBallAssignment, label: string) => {
    const result = recordSelection(assignment.participant.id, assignment.number, `${label} · Pelota ${assignment.number}`);
    setRoundAnimating(false);
    setCurrentResult(result);
    window.setTimeout(() => {
      fortunaAudio.playResult(result.kind === "winner", result.parity);
      fortunaAudio.announceResult(result);
    }, 170);
  }, [recordSelection]);

  const finishMarbleSelection = useCallback((racer: MarbleRacer, label: string) => {
    const result = recordSelection(racer.participant.id, racer.number, label);
    setRoundAnimating(false);
    setCurrentResult(result);
    window.setTimeout(() => {
      fortunaAudio.playResult(result.kind === "winner", result.parity);
      fortunaAudio.announceResult(result);
    }, 170);
  }, [recordSelection]);

  const finishDuckSurvival = useCallback((survivor: DuckContestant, knockoutOrder: DuckContestant[]) => {
    const winnerResult = recordDuckSurvival(
      survivor.participant.id,
      knockoutOrder.map((contestant) => ({
        participantId: contestant.participant.id,
        number: contestant.number,
      })),
    );
    setRoundAnimating(false);
    setCurrentResult(winnerResult);
    window.setTimeout(() => {
      fortunaAudio.playResult(true, winnerResult.parity);
      fortunaAudio.announceResult(winnerResult);
    }, 220);
  }, [recordDuckSurvival]);

  const closeCurrentResult = () => {
    setCurrentResult(null);
    if (screen === "cards") setCardRoundKey((key) => key + 1);
    if (screen === "pinball") setPinballRoundKey((key) => key + 1);
    if (screen === "marbles") setMarbleRoundKey((key) => key + 1);
    if (screen === "ducks") setDuckRoundKey((key) => key + 1);
  };

  const allowCurrentWinnerToReturn = () => {
    if (currentResult?.kind !== "winner" || !currentResult.participantId) return;
    reenableWinner(currentResult.participantId);
    if (useDrawStore.getState().activeSession?.status !== "committed") startDraw();
    fortunaAudio.playClick();
    setCurrentResult(null);
    setCardRoundKey((key) => key + 1);
    setPinballRoundKey((key) => key + 1);
    setMarbleRoundKey((key) => key + 1);
    setDuckRoundKey((key) => key + 1);
  };

  const restartSession = () => {
    if (roundLocked || (screen === "roulette" && isSpinning)) return;
    fortunaAudio.playClick();
    startDraw();
    setCurrentResult(null);
    setSpinRequest(null);
    setCardRoundKey((key) => key + 1);
    setPinballRoundKey((key) => key + 1);
    setMarbleRoundKey((key) => key + 1);
    setDuckRoundKey((key) => key + 1);
  };

  const commitSeededSession = useCallback((
    seed: string,
    commitmentId: string,
    expectedParticipantId: string,
    expectedLandedNumber?: number,
  ) => {
    ensureSession();
    const currentRound = useDrawStore.getState().activeSession?.roundCommitment;
    if (currentRound) {
      if (
        currentRound.seed !== seed
        || currentRound.commitmentId !== commitmentId
        || currentRound.expectedParticipantId !== expectedParticipantId
        || currentRound.expectedLandedNumber !== expectedLandedNumber
      ) {
        throw new Error("La semilla no coincide con el compromiso persistido.");
      }
    } else {
      commitRound({ seed, commitmentId, expectedParticipantId, expectedLandedNumber });
    }
    setRoundAnimating(true);
  }, [commitRound, ensureSession]);

  const commitCardSession = useCallback((seed: string) => {
    const prepared = prepareCardRound(activeParticipants, seed);
    commitSeededSession(seed, prepared.commitmentId, prepared.selected.participant.id);
  }, [activeParticipants, commitSeededSession]);

  const commitPinballSession = useCallback((seed: string) => {
    const prepared = preparePinballRound(
      activeParticipants,
      mode,
      pinballControlMode,
      seed,
      previousWinnerIds,
    );
    commitSeededSession(
      seed,
      prepared.commitmentId,
      prepared.selected.participant.id,
      prepared.selected.number,
    );
  }, [activeParticipants, commitSeededSession, mode, pinballControlMode, previousWinnerIds]);

  const commitMarbleSession = useCallback((seed: string) => {
    const prepared = prepareMarbleRace(
      activeParticipants,
      mode,
      seed,
      marbleDifficulty,
      previousWinnerIds,
    );
    const proof = JSON.stringify({
      version: 2,
      track: prepared.track.signature,
      participants: activeParticipants.map((participant) => participant.id),
      selectedParticipantId: prepared.selected.participant.id,
      selectedNumber: prepared.selected.number,
      selectedDurationMs: prepared.selected.durationMs,
      mode,
      difficulty: marbleDifficulty,
    });
    commitSeededSession(
      seed,
      `MAR-${sha256Hex(proof).toUpperCase()}`,
      prepared.selected.participant.id,
      prepared.selected.number,
    );
  }, [activeParticipants, commitSeededSession, marbleDifficulty, mode, previousWinnerIds]);

  const commitDuckSession = useCallback((commitmentId: string, seed: string, survivorId: string) => {
    ensureSession();
    const currentRound = useDrawStore.getState().activeSession?.roundCommitment;
    if (currentRound) {
      if (
        currentRound.commitmentId !== commitmentId
        || currentRound.seed !== seed
        || currentRound.expectedParticipantId !== survivorId
      ) {
        throw new Error("El compromiso de Patos no coincide con la ronda persistida.");
      }
    } else {
      commitRound({ commitmentId, seed, expectedParticipantId: survivorId });
    }
    setRoundAnimating(true);
  }, [commitRound, ensureSession]);

  const toggleSound = () => {
    setSoundEnabled((enabled) => {
      const nextValue = !enabled;
      fortunaAudio.setEffectsEnabled(nextValue);
      if (nextValue) fortunaAudio.playClick();
      return nextValue;
    });
  };

  const toggleFullscreen = async () => {
    try {
      fortunaAudio.playClick();
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Algunos WebView administran pantalla completa desde la ventana nativa.
    }
  };

  return (
    <div className="app-root">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <main className={`app-shell ${showSplash ? "app-shell--waiting" : ""}`}>
        <Topbar
          screen={screen}
          game={game}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled((enabled) => !enabled)}
          audioVolume={audioVolume}
          onVolumeChange={setAudioVolume}
          onToggleFullscreen={toggleFullscreen}
          onBack={returnToSetup}
          roundCommitted={roundLocked}
          roundNumber={roundNumber}
          activeCount={activeParticipants.length}
        />

        {screen === "setup" ? (
          <SetupScreen
            onStart={enterSelectedGame}
            game={game}
            participantCount={participants.length}
            eligibleCount={activeParticipants.length}
            mode={mode}
            marbleDifficulty={marbleDifficulty}
          />
        ) : screen === "roulette" ? (
          <RouletteScreen
            participants={participants}
            activeParticipants={activeParticipants}
            blockedWinnerIds={blockedWinnerIds}
            eliminatedIds={eliminatedIds}
            eliminationParity={eliminationParity}
            entries={wheelEntries}
            selectableCount={selectableEntries.length}
            history={history}
            latestResult={latestResult}
            mode={mode}
            prize={prize}
            roundNumber={roundNumber}
            sessionWinner={sessionWinner}
            isSpinning={isSpinning}
            spinRequest={spinRequest}
            onSpin={startSpin}
            onSpinEnd={finishSpin}
            onRestart={restartSession}
            restartDisabled={roundLocked}
          />
        ) : screen === "cards" ? (
          <CardsScreen
            key={cardRoundKey}
            participants={participants}
            activeParticipants={activeParticipants}
            blockedWinnerIds={blockedWinnerIds}
            eliminatedIds={eliminatedIds}
            history={history}
            latestResult={latestResult}
            mode={mode}
            prize={prize}
            roundNumber={roundNumber}
            sessionWinner={sessionWinner}
            onCommit={commitCardSession}
            initialSeed={activeSession?.game === "cards" ? activeSession.roundCommitment?.seed : undefined}
            onSelect={finishCardSelection}
            onRestart={restartSession}
            restartDisabled={roundLocked}
          />
        ) : screen === "pinball" ? (
          <PinballScreen
            key={pinballRoundKey}
            participants={participants}
            activeParticipants={activeParticipants}
            blockedWinnerIds={blockedWinnerIds}
            eliminatedIds={eliminatedIds}
            history={history}
            latestResult={latestResult}
            mode={mode}
            controlMode={pinballControlMode}
            prize={prize}
            roundNumber={roundNumber}
            sessionWinner={sessionWinner}
            previousWinnerIds={previousWinnerIds}
            onCommit={commitPinballSession}
            initialSeed={activeSession?.game === "pinball" ? activeSession.roundCommitment?.seed : undefined}
            onFinish={finishPinballSelection}
            onRestart={restartSession}
            restartDisabled={roundLocked}
          />
        ) : screen === "marbles" ? (
          <MarblesScreen
            key={marbleRoundKey}
            participants={participants}
            activeParticipants={activeParticipants}
            blockedWinnerIds={blockedWinnerIds}
            eliminatedIds={eliminatedIds}
            history={history}
            latestResult={latestResult}
            mode={mode}
            difficulty={marbleDifficulty}
            prize={prize}
            roundNumber={roundNumber}
            sessionWinner={sessionWinner}
            previousWinnerIds={previousWinnerIds}
            onCommit={commitMarbleSession}
            initialSeed={activeSession?.game === "marbles" ? activeSession.roundCommitment?.seed : undefined}
            onFinish={finishMarbleSelection}
            onDifficultyChange={(difficulty) => {
              if (!roundLocked) setMarbleDifficulty(difficulty);
            }}
            onRestart={restartSession}
            restartDisabled={roundLocked}
          />
        ) : (
          <DucksScreen
            key={duckRoundKey}
            participants={participants}
            activeParticipants={activeParticipants}
            blockedWinnerIds={blockedWinnerIds}
            eliminatedIds={eliminatedIds}
            history={history}
            latestResult={latestResult}
            prize={prize}
            sessionWinner={sessionWinner}
            previousWinnerIds={previousWinnerIds}
            onFinish={finishDuckSurvival}
            onCommit={commitDuckSession}
            resumedCommitment={activeSession?.game === "ducks" && activeSession.roundCommitment?.seed
              ? {
                  commitmentId: activeSession.roundCommitment.commitmentId,
                  seed: activeSession.roundCommitment.seed,
                }
              : null}
            onRestart={restartSession}
            restartDisabled={roundLocked}
          />
        )}
      </main>

      {currentResult && (
        <ResultReveal
          result={currentResult}
          onClose={closeCurrentResult}
          onReenableWinner={allowCurrentWinnerToReturn}
          soundEnabled={soundEnabled || voiceEnabled}
        />
      )}
      <AppUpdater />
    </div>
  );
}

function Topbar({
  screen,
  game,
  soundEnabled,
  onToggleSound,
  voiceEnabled,
  onToggleVoice,
  audioVolume,
  onVolumeChange,
  onToggleFullscreen,
  onBack,
  roundCommitted,
  roundNumber,
  activeCount,
}: {
  screen: ActiveScreen;
  game: GameId;
  soundEnabled: boolean;
  onToggleSound: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  audioVolume: number;
  onVolumeChange: (volume: number) => void;
  onToggleFullscreen: () => void;
  onBack: () => void;
  roundCommitted: boolean;
  roundNumber: number;
  activeCount: number;
}) {
  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="Fortuna Real">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-mark__ring" />
          <Crown size={23} strokeWidth={1.7} />
        </div>
        <div>
          <div className="brand-name">FORTUNA <span>REAL</span></div>
          <div className="brand-tagline">Sorteos con emoción real</div>
        </div>
      </div>

      {screen !== "setup" ? (
        <div className="round-pill">
          {screen === "roulette" ? <CircleDot size={19} />
            : screen === "cards" ? <Layers3 size={19} />
              : screen === "pinball" ? <Gamepad2 size={19} />
                : screen === "marbles" ? <Gem size={19} />
                  : <Bird size={19} />}
          <div>
            <strong>Ronda {roundNumber}</strong>
            <span>{activeCount} participantes · {screen === "roulette" ? "ruleta" : screen === "cards" ? "cartas" : screen === "pinball" ? "pinball 3D" : screen === "marbles" ? "canicas 3D" : "patos 3D"}</span>
          </div>
        </div>
      ) : (
        <div className="fairness-pill">
          <ShieldCheck size={20} />
          <div>
            <strong>Configuración del sorteo</strong>
            <span>
              {game === "roulette"
                ? "La ruleta se adapta a cada lista"
                : game === "cards"
                  ? "Asignación visible y barajado por fases"
                  : game === "pinball"
                    ? "Mesa 3D nueva en cada ingreso"
                    : game === "marbles"
                      ? "Pista 3D procedural y poderes automáticos"
                      : "Tres vidas y supervivencia 3D"}
            </span>
          </div>
        </div>
      )}

      <div className="topbar-actions">
        {screen !== "setup" && (
          <button
            className="back-button"
            type="button"
            onClick={onBack}
            aria-label={roundCommitted ? "Cancelar la ronda comprometida y volver al inicio" : "Volver al inicio"}
            title={roundCommitted ? "Solicita confirmación antes de cancelar la ronda" : undefined}
          >
            <ArrowLeft size={17} /> {roundCommitted ? "Cancelar ronda" : "Inicio"}
          </button>
        )}
        <button
          className={`icon-button ${soundEnabled ? "is-active" : ""}`}
          type="button"
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? "Desactivar sonidos" : "Activar sonidos"}
          title={soundEnabled ? "Desactivar sonidos" : "Activar sonidos"}
          onClick={onToggleSound}
        >
          {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button
          className={`icon-button ${voiceEnabled ? "is-active" : ""}`}
          type="button"
          aria-pressed={voiceEnabled}
          aria-label={voiceEnabled ? "Desactivar locución" : "Activar locución"}
          title={voiceEnabled ? "Desactivar locución" : "Activar locución"}
          onClick={onToggleVoice}
        >
          {voiceEnabled ? <Mic size={19} /> : <MicOff size={19} />}
        </button>
        <label className="topbar-volume" title={`Volumen ${Math.round(audioVolume * 100)} %`}>
          <span className="sr-only">Volumen general</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={audioVolume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            aria-label="Volumen general"
          />
        </label>
        <button className="icon-button" type="button" aria-label="Configuración de audio aplicada" disabled>
          <Settings2 size={19} />
        </button>
        <button className="icon-button" type="button" aria-label="Pantalla completa" onClick={onToggleFullscreen}>
          <Expand size={19} />
        </button>
      </div>
    </header>
  );
}

function SetupScreen({
  onStart,
  game,
  participantCount,
  eligibleCount,
  mode,
  marbleDifficulty,
}: {
  onStart: () => void;
  game: GameId;
  participantCount: number;
  eligibleCount: number;
  mode: DrawMode;
  marbleDifficulty: MarbleDifficulty;
}) {
  const estimatedDuration = formatEstimatedDuration(game, eligibleCount, marbleDifficulty);
  return (
    <section className="setup-page">
      <div className="setup-hero">
        <div>
          <span className="eyebrow">CREAR NUEVO SORTEO</span>
          <h1>Prepara la fortuna</h1>
          <p>Carga todos los nombres que necesites: solo aparecerán las casillas ocupadas.</p>
        </div>
        <div className="setup-hero-actions">
          <div className="setup-summary">
            <Users size={19} />
            <span>
              <strong>{participantCount}</strong> cargados · {eligibleCount} habilitados
              {mode === "elimination" && <> · Tiempo mínimo visual: <strong>{estimatedDuration}</strong></>}
            </span>
          </div>
          <button
            type="button"
            className="start-button setup-start-button setup-hero-start"
            onClick={onStart}
            disabled={eligibleCount < 2}
            title={eligibleCount < 2
              ? "Agrega al menos dos participantes"
              : `Entrar a ${game === "roulette" ? "la ruleta" : game === "cards" ? "la mesa de cartas" : game === "pinball" ? "Pinball 3D" : game === "marbles" ? "Canicas 3D" : "Patos 3D"}`}
          >
            <Play size={21} fill="currentColor" /> Iniciar sorteo
          </button>
        </div>
      </div>

      <div className="setup-grid">
        <ParticipantPanel />
        <div className="setup-right-column">
          <DrawSetup />
          <WinnerHistory />
        </div>
      </div>
    </section>
  );
}

function RouletteScreen({
  participants,
  activeParticipants,
  blockedWinnerIds,
  eliminatedIds,
  eliminationParity,
  entries,
  selectableCount,
  history,
  latestResult,
  mode,
  prize,
  roundNumber,
  sessionWinner,
  isSpinning,
  spinRequest,
  onSpin,
  onSpinEnd,
  onRestart,
  restartDisabled,
}: {
  participants: Participant[];
  activeParticipants: Participant[];
  blockedWinnerIds: string[];
  eliminatedIds: string[];
  eliminationParity: Parity | null;
  entries: RouletteEntry[];
  selectableCount: number;
  history: RoundResult[];
  latestResult: RoundResult | null;
  mode: DrawMode;
  prize: string;
  roundNumber: number;
  sessionWinner: RoundResult | null;
  isSpinning: boolean;
  spinRequest: { entryId: string; nonce: number; ballLandingAngle: number } | null;
  onSpin: () => void;
  onSpinEnd: () => void;
  onRestart: () => void;
  restartDisabled: boolean;
}) {
  const cannotSpin =
    isSpinning ||
    selectableCount === 0 ||
    !!sessionWinner ||
    (mode === "elimination" && activeParticipants.length < 2);

  return (
    <section className="casino-workspace">
      <aside className="panel casino-roster-panel">
        <div className="panel-title panel-title--spread">
          <span><Users size={18} /> Participantes</span>
          <small>{activeParticipants.length}/{participants.length}</small>
        </div>
        <p className="roster-help">El número enlaza cada nombre con su casilla actual.</p>
        <div className="roster-list" aria-label="Todos los participantes del sorteo">
          {participants.map((person) => {
            const activeIndex = activeParticipants.findIndex((active) => active.id === person.id);
            const isEliminated = eliminatedIds.includes(person.id);
            const isWinner = blockedWinnerIds.includes(person.id);
            const parity = activeIndex >= 0 ? numberParity(activeIndex + 1) : null;
            const rowClasses = [
              "roster-row",
              isEliminated ? "is-eliminated" : "",
              isWinner ? "is-winner" : "",
            ].filter(Boolean).join(" ");
            const status = isWinner
              ? "Ganador"
              : isEliminated
                ? "Eliminado"
                : parity === "even"
                    ? "Par"
                    : "Impar";
            return (
              <div className={rowClasses} key={person.id}>
                <span className="roster-number">{activeIndex >= 0 ? activeIndex + 1 : "—"}</span>
                <i style={{ background: person.color }} />
                <strong title={person.name}>{person.name}</strong>
                <em>{status}</em>
              </div>
            );
          })}
        </div>
        <div className="roster-legend">
          <span><i className="even-dot" /> Pares</span>
          <span><i className="odd-dot" /> Impares</span>
        </div>
      </aside>

      <section className="casino-stage-column">
        <div className="stage-heading casino-stage-heading">
          <div>
            <span className="eyebrow">{modeLabels[mode]} · RONDA {roundNumber}</span>
            <h1>Ruleta de casino</h1>
          </div>
          <div className="live-badge"><span /> {isSpinning ? "PELOTA EN JUEGO" : "GIRO DE ESPERA"}</div>
        </div>

        <div className="roulette-stage casino-stage">
          <div className="stage-glow stage-glow--one" />
          <div className="stage-glow stage-glow--two" />
          <div className="wheel-entry-count"><strong>{entries.length}</strong> casillas visibles</div>
          <RouletteWheel
            entries={entries}
            spinRequest={spinRequest}
            isSpinning={isSpinning}
            onSpinEnd={onSpinEnd}
          />
          <div className="wheel-caption">
            <Sparkles size={16} />
            {entries.length > 32
              ? "Cada número corresponde al nombre visible en la lista lateral"
              : "Cada casilla muestra su número y el nombre correspondiente"}
          </div>
        </div>

        <div className="casino-controls">
          <button
            className={`start-button casino-spin-button ${isSpinning ? "is-spinning" : ""}`}
            type="button"
            onClick={onSpin}
            disabled={cannotSpin}
          >
            {isSpinning ? (
              <><span className="spinner-dot" /> La pelota está girando…</>
            ) : sessionWinner ? (
              <><Trophy size={21} /> Sorteo finalizado</>
            ) : selectableCount === 0 ? (
              <>No hay casillas habilitadas</>
            ) : (
              <><Play size={20} fill="currentColor" /> Lanzar pelota</>
            )}
          </button>
          <button className="text-button" type="button" onClick={onRestart} disabled={isSpinning || restartDisabled}>
            <RotateCcw size={15} /> Reiniciar ronda con los habilitados
          </button>
        </div>
      </section>

      <aside className="casino-info-column">
        <section className="panel casino-mode-card">
          <div className="panel-title"><Dices size={18} /> {modeLabels[mode]}</div>
          {mode === "elimination" ? (
            <div className="compact-rule">
              <div><span className="parity-token parity-token--even">PAR</span><p>Referencia visual de números pares</p></div>
              <div><span className="parity-token parity-token--odd">IMPAR</span><p>Referencia visual de números impares</p></div>
              {eliminationParity && (
                <div className="active-filter-note">
                  Filtro heredado <strong>{eliminationParity === "even" ? "PAR" : "IMPAR"}</strong>; la selección oficial sigue siendo uniforme.
                </div>
              )}
              <div className="active-filter-note">PAR e IMPAR no compiten: antes de girar se compromete uniformemente a una persona habilitada.</div>
            </div>
          ) : (
            <p className="mode-description">Cada ganador queda fuera hasta que lo habilites de nuevo.</p>
          )}
        </section>

        <section className="panel casino-prize-card">
          <div className="panel-title"><Gift size={18} /> Premio actual</div>
          <div className="compact-prize"><Trophy size={28} /><strong>{prize || "Premio sorpresa"}</strong></div>
        </section>

        <section className="panel casino-current-result">
          <div className="panel-title"><Target size={18} /> Resultado actual</div>
          {sessionWinner ? (
            <div className="mini-result mini-result--winner"><Trophy size={25} /><span>Ganador final</span><strong>{sessionWinner.participantName}</strong></div>
          ) : latestResult ? (
            <div className={`round-result-summary round-result-summary--${latestResult.kind}`}>
              <span className="landed-number"><Hash size={15} /> {latestResult.landedNumber}</span>
              <strong>{latestResult.participantName}</strong>
              <em>
                {latestResult.kind === "qualified"
                  ? `Referencia ${latestResult.parity === "even" ? "PAR" : "IMPAR"}`
                  : latestResult.kind === "parity-selected"
                    ? `Referencia ${latestResult.participantName}`
                    : latestResult.kind === "winner"
                      ? "Ganador"
                      : "Eliminado"}
              </em>
            </div>
          ) : (
            <div className="empty-result"><CircleDot size={25} /><strong>Esperando la pelota</strong><span>Lánzala para iniciar la ronda.</span></div>
          )}
        </section>

        <WinnerHistory compact />

        <section className="panel history-panel casino-history-panel">
          <div className="panel-title panel-title--spread">
            <span><History size={18} /> Historial</span><small>{history.length}</small>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">Las rondas aparecerán aquí.</div>
            ) : (
              history.map((result) => (
                <div className="history-row casino-history-row" key={result.id}>
                  <span>R{result.round} · #{result.landedNumber}</span>
                  <strong>{result.participantName}</strong>
                  <em className={result.kind}>
                    {result.kind === "qualified"
                      ? result.parity === "even" ? "PAR" : "IMPAR"
                      : result.kind === "parity-selected"
                        ? "FILTRO"
                        : result.kind === "winner"
                          ? "GANÓ"
                          : "FUERA"}
                  </em>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="casino-stats-row">
          <StatCard icon={<Users />} tone="cyan" label="Activos" value={activeParticipants.length} />
          <StatCard icon={<CheckCircle2 />} tone="green" label="Casillas" value={entries.length} />
        </div>
      </aside>
    </section>
  );
}

function CardsScreen({
  participants,
  activeParticipants,
  blockedWinnerIds,
  eliminatedIds,
  history,
  latestResult,
  mode,
  prize,
  roundNumber,
  sessionWinner,
  onCommit,
  initialSeed,
  onSelect,
  onRestart,
  restartDisabled,
}: {
  participants: Participant[];
  activeParticipants: Participant[];
  blockedWinnerIds: string[];
  eliminatedIds: string[];
  history: RoundResult[];
  latestResult: RoundResult | null;
  mode: DrawMode;
  prize: string;
  roundNumber: number;
  sessionWinner: RoundResult | null;
  onCommit: (seed: string) => void;
  initialSeed?: string;
  onSelect: (assignment: CardAssignment, position: number) => void;
  onRestart: () => void;
  restartDisabled: boolean;
}) {
  const finalWinner = resolveFinalWinner(sessionWinner, latestResult, activeParticipants.length);
  const cannotPlay = !!finalWinner || activeParticipants.length < 2;

  return (
    <section className="cards-workspace">
      <aside className="panel casino-roster-panel cards-roster-panel">
        <div className="panel-title panel-title--spread">
          <span><Users size={18} /> Participantes</span>
          <small>{activeParticipants.length}/{participants.length}</small>
        </div>
        <p className="roster-help">Todos los nombres se muestran primero en su carta asignada.</p>
        <div className="roster-list" aria-label="Participantes de la mesa de cartas">
          {participants.map((person) => {
            const activeIndex = activeParticipants.findIndex((active) => active.id === person.id);
            const isEliminated = eliminatedIds.includes(person.id);
            const isWinner = blockedWinnerIds.includes(person.id);
            return (
              <div
                className={`roster-row ${isEliminated ? "is-eliminated" : ""} ${isWinner ? "is-winner" : ""}`}
                key={person.id}
              >
                <span className="roster-number">{activeIndex >= 0 ? activeIndex + 1 : "—"}</span>
                <i style={{ background: person.color }} />
                <strong title={person.name}>{person.name}</strong>
                <em>{isWinner ? "Ganador" : isEliminated ? "Eliminado" : "En juego"}</em>
              </div>
            );
          })}
        </div>
        <button className="text-button cards-restart-button" type="button" onClick={onRestart} disabled={restartDisabled}>
          <RotateCcw size={15} /> Reiniciar con los habilitados
        </button>
      </aside>

      <section className="cards-stage-column">
        <div className="stage-heading casino-stage-heading">
          <div>
            <span className="eyebrow">{modeLabels[mode]} · RONDA {roundNumber}</span>
            <h1>Mesa de cartas</h1>
          </div>
          <div className="live-badge"><span /> {finalWinner ? "RONDA FINALIZADA" : "MAZO VERIFICABLE"}</div>
        </div>

        {finalWinner ? (
          <div className="cards-final-state">
            <Crown size={58} />
            <span>Ganador final</span>
            <strong>{finalWinner.participantName}</strong>
            <p>El historial conserva el premio y permite habilitarlo para otro sorteo.</p>
          </div>
        ) : (
          <CardGame
            participants={activeParticipants}
            mode={mode}
            disabled={cannotPlay}
            initialSeed={initialSeed}
            onCommit={onCommit}
            onSelect={onSelect}
          />
        )}
      </section>

      <aside className="casino-info-column cards-info-column">
        <section className="panel casino-mode-card">
          <div className="panel-title"><Layers3 size={18} /> {modeLabels[mode]}</div>
          <p className="mode-description">
            {mode === "direct"
              ? "La carta sellada antes de elegir entrega el premio. Su ganador queda fuera hasta que lo habilites nuevamente."
              : "La carta sellada elimina una sola persona. Después se crea un nuevo mazo verificable con quienes siguen."}
          </p>
          <div className="cards-process-mini">
            <span>1 · Ver</span><span>2 · Reunir</span><span>3 · Barajar</span><span>4 · Elegir</span>
          </div>
        </section>

        <section className="panel casino-prize-card">
          <div className="panel-title"><Gift size={18} /> Premio actual</div>
          <div className="compact-prize"><Trophy size={28} /><strong>{prize || "Premio sorpresa"}</strong></div>
        </section>

        <section className="panel casino-current-result">
          <div className="panel-title"><Target size={18} /> Resultado actual</div>
          {latestResult ? (
            <div className={`round-result-summary round-result-summary--${latestResult.kind}`}>
              <span className="landed-number card-result-symbol"><Layers3 size={16} /></span>
              <strong>{latestResult.participantName}</strong>
              <em>{latestResult.kind === "winner" ? "Ganador" : "Eliminado"}</em>
              {latestResult.selectionLabel && <small>{latestResult.selectionLabel}</small>}
            </div>
          ) : (
            <div className="empty-result"><Layers3 size={25} /><strong>Mazo preparado</strong><span>Muestra y baraja las cartas.</span></div>
          )}
        </section>

        <WinnerHistory compact />

        <section className="panel history-panel casino-history-panel cards-history-panel">
          <div className="panel-title panel-title--spread">
            <span><History size={18} /> Historial</span><small>{history.length}</small>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">Las cartas elegidas aparecerán aquí.</div>
            ) : history.map((result) => (
              <div className="history-row casino-history-row" key={result.id}>
                <span>R{result.round} · carta {result.landedNumber}</span>
                <strong>{result.participantName}</strong>
                <em className={result.kind}>{result.kind === "winner" ? "GANÓ" : "FUERA"}</em>
              </div>
            ))}
          </div>
        </section>

        <div className="casino-stats-row">
          <StatCard icon={<Users />} tone="cyan" label="Activos" value={activeParticipants.length} />
          <StatCard icon={<Shuffle />} tone="gold" label="Cartas" value={activeParticipants.length} />
        </div>
      </aside>
    </section>
  );
}

function PinballScreen({
  participants,
  activeParticipants,
  blockedWinnerIds,
  eliminatedIds,
  history,
  latestResult,
  mode,
  controlMode,
  prize,
  roundNumber,
  sessionWinner,
  previousWinnerIds,
  onCommit,
  initialSeed,
  onFinish,
  onRestart,
  restartDisabled,
}: {
  participants: Participant[];
  activeParticipants: Participant[];
  blockedWinnerIds: string[];
  eliminatedIds: string[];
  history: RoundResult[];
  latestResult: RoundResult | null;
  mode: DrawMode;
  controlMode: PinballControlMode;
  prize: string;
  roundNumber: number;
  sessionWinner: RoundResult | null;
  previousWinnerIds: ReadonlySet<string>;
  onCommit: (seed: string) => void;
  initialSeed?: string;
  onFinish: (assignment: PinballBallAssignment, label: string) => void;
  onRestart: () => void;
  restartDisabled: boolean;
}) {
  const finalWinner = resolveFinalWinner(sessionWinner, latestResult, activeParticipants.length);
  const cannotPlay = !!finalWinner || activeParticipants.length < 2;

  return (
    <section className="pinball-workspace">
      <aside className="panel casino-roster-panel pinball-roster-panel">
        <div className="panel-title panel-title--spread">
          <span><Users size={18} /> Pelotas y participantes</span>
          <small>{activeParticipants.length}/{participants.length}</small>
        </div>
        <p className="roster-help">El número de cada pelota coincide con esta lista durante toda la ronda.</p>
        <div className="roster-list" aria-label="Participantes del Pinball 3D">
          {participants.map((person) => {
            const activeIndex = activeParticipants.findIndex((active) => active.id === person.id);
            const isEliminated = eliminatedIds.includes(person.id);
            const isWinner = blockedWinnerIds.includes(person.id);
            return (
              <div className={`roster-row ${isEliminated ? "is-eliminated" : ""} ${isWinner ? "is-winner" : ""}`} key={person.id}>
                <span className="roster-number">{activeIndex >= 0 ? activeIndex + 1 : "—"}</span>
                <i style={{ background: person.color }} />
                <strong className="roster-champion-name" title={person.name}>{person.name}{activeIndex >= 0 && previousWinnerIds.has(person.id) && <Crown size={11} fill="currentColor" aria-label="Ganador anterior" />}</strong>
                <em>{isWinner ? "Ganador" : isEliminated ? "Eliminado" : "En juego"}</em>
              </div>
            );
          })}
        </div>
        <button className="text-button cards-restart-button" type="button" onClick={onRestart} disabled={restartDisabled}>
          <RotateCcw size={15} /> Reiniciar con los habilitados
        </button>
      </aside>

      <section className="pinball-stage-column">
        <div className="stage-heading casino-stage-heading">
          <div>
            <span className="eyebrow">{modeLabels[mode]} · RONDA {roundNumber}</span>
            <h1>Pinball Real 3D</h1>
          </div>
          <div className="live-badge"><span /> {finalWinner ? "RONDA FINALIZADA" : controlMode === "automatic" ? "CONTROL AUTOMÁTICO" : "CONTROL MANUAL"}</div>
        </div>

        {finalWinner ? (
          <div className="cards-final-state pinball-final-state">
            <Crown size={58} />
            <span>Ganador final</span>
            <strong>{finalWinner.participantName}</strong>
            <p>El historial conserva el premio y permite habilitarlo para otro sorteo.</p>
          </div>
        ) : (
          <PinballGame
            participants={activeParticipants}
            previousWinnerIds={previousWinnerIds}
            mode={mode}
            controlMode={controlMode}
            disabled={cannotPlay}
            initialSeed={initialSeed}
            onCommit={onCommit}
            onFinish={onFinish}
          />
        )}
      </section>

      <aside className="casino-info-column pinball-info-column">
        <section className="panel casino-mode-card">
          <div className="panel-title"><Gamepad2 size={18} /> {modeLabels[mode]}</div>
          <p className="mode-description">
            {mode === "direct"
              ? "La pelota sellada antes de iniciar recibe el premio y queda fuera hasta que la habilites. La mesa representa el compromiso."
              : "La pelota sellada antes de iniciar queda eliminada. La próxima ronda genera otra distribución verificable."}
          </p>
          <div className="pinball-mode-chip"><span>{controlMode === "automatic" ? "AUTO" : "MANUAL"}</span>{controlMode === "automatic" ? "La máquina controla la partida" : "Espacio lanza · A/D mueven flippers"}</div>
        </section>

        <section className="panel casino-prize-card">
          <div className="panel-title"><Gift size={18} /> Premio actual</div>
          <div className="compact-prize"><Trophy size={28} /><strong>{prize || "Premio sorpresa"}</strong></div>
        </section>

        <section className="panel casino-current-result">
          <div className="panel-title"><Target size={18} /> Resultado actual</div>
          {latestResult ? (
            <div className={`round-result-summary round-result-summary--${latestResult.kind}`}>
              <span className="landed-number"><Gamepad2 size={16} /></span>
              <strong>{latestResult.participantName}</strong>
              <em>{latestResult.kind === "winner" ? "Ganador" : "Eliminado"}</em>
              {latestResult.selectionLabel && <small>{latestResult.selectionLabel}</small>}
            </div>
          ) : (
            <div className="empty-result"><Gamepad2 size={25} /><strong>Mesa preparada</strong><span>Enciende el pinball para comenzar.</span></div>
          )}
        </section>

        <WinnerHistory compact />

        <section className="panel history-panel casino-history-panel pinball-history-panel">
          <div className="panel-title panel-title--spread"><span><History size={18} /> Historial</span><small>{history.length}</small></div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">Los resultados del pinball aparecerán aquí.</div>
            ) : history.map((result) => (
              <div className="history-row casino-history-row" key={result.id}>
                <span>R{result.round} · pelota {result.landedNumber}</span>
                <strong>{result.participantName}</strong>
                <em className={result.kind}>{result.kind === "winner" ? "GANÓ" : "FUERA"}</em>
              </div>
            ))}
          </div>
        </section>

        <div className="casino-stats-row">
          <StatCard icon={<Users />} tone="cyan" label="Activos" value={activeParticipants.length} />
          <StatCard icon={<Gamepad2 />} tone="gold" label="Pelotas" value={activeParticipants.length} />
        </div>
      </aside>
    </section>
  );
}

function MarblesScreen({
  participants,
  activeParticipants,
  blockedWinnerIds,
  eliminatedIds,
  history,
  latestResult,
  mode,
  difficulty,
  prize,
  roundNumber,
  sessionWinner,
  previousWinnerIds,
  onCommit,
  initialSeed,
  onFinish,
  onDifficultyChange,
  onRestart,
  restartDisabled,
}: {
  participants: Participant[];
  activeParticipants: Participant[];
  blockedWinnerIds: string[];
  eliminatedIds: string[];
  history: RoundResult[];
  latestResult: RoundResult | null;
  mode: DrawMode;
  difficulty: MarbleDifficulty;
  prize: string;
  roundNumber: number;
  sessionWinner: RoundResult | null;
  previousWinnerIds: ReadonlySet<string>;
  onCommit: (seed: string) => void;
  initialSeed?: string;
  onFinish: (racer: MarbleRacer, label: string) => void;
  onDifficultyChange: (difficulty: MarbleDifficulty) => void;
  onRestart: () => void;
  restartDisabled: boolean;
}) {
  const finalWinner = resolveFinalWinner(sessionWinner, latestResult, activeParticipants.length);
  const cannotPlay = !!finalWinner || activeParticipants.length < 2;
  const [trackInfo, setTrackInfo] = useState<MarbleTrack | null>(null);

  return (
    <section className="marbles-workspace">
      <aside className="panel casino-roster-panel marbles-roster-panel">
        <div className="panel-title panel-title--spread">
          <span><Users size={18} /> Participantes</span>
          <small>{activeParticipants.length}/{participants.length}</small>
        </div>
        <p className="roster-help">Cada nombre conserva su número y color durante toda la carrera.</p>
        <div className="roster-list" aria-label="Participantes de la carrera de canicas">
          {participants.map((person) => {
            const activeIndex = activeParticipants.findIndex((active) => active.id === person.id);
            const isEliminated = eliminatedIds.includes(person.id);
            const isWinner = blockedWinnerIds.includes(person.id);
            return (
              <div
                className={`roster-row ${isEliminated ? "is-eliminated" : ""} ${isWinner ? "is-winner" : ""}`}
                key={person.id}
              >
                <span className="roster-number">{activeIndex >= 0 ? activeIndex + 1 : "—"}</span>
                <i style={{ background: person.color }} />
                <strong className="roster-champion-name" title={person.name}>{person.name}{activeIndex >= 0 && previousWinnerIds.has(person.id) && <Crown size={11} fill="currentColor" aria-label="Ganador anterior" />}</strong>
                <em>{isWinner ? "Ganador" : isEliminated ? "Eliminado" : "En carrera"}</em>
              </div>
            );
          })}
        </div>
        <button className="text-button cards-restart-button" type="button" onClick={onRestart} disabled={restartDisabled}>
          <RotateCcw size={15} /> Reiniciar con los habilitados
        </button>
      </aside>

      <section className="marbles-stage-column">
        <div className="stage-heading casino-stage-heading">
          <div>
            <span className="eyebrow">{modeLabels[mode]} · RONDA {roundNumber}</span>
            <h1>Carrera de canicas</h1>
          </div>
          <div className="live-badge"><span /> {finalWinner ? "CARRERA FINALIZADA" : "PISTA PROCEDURAL"}</div>
        </div>

        {finalWinner ? (
          <div className="cards-final-state marbles-final-state">
            <Crown size={58} />
            <span>Ganador final</span>
            <strong>{finalWinner.participantName}</strong>
            <p>El historial conserva el premio y permite habilitarlo para otra carrera.</p>
          </div>
        ) : (
          <MarbleRace
            participants={activeParticipants}
            mode={mode}
            difficulty={difficulty}
            disabled={cannotPlay}
            previousWinnerIds={previousWinnerIds}
            initialSeed={initialSeed}
            onCommit={onCommit}
            onDifficultyChange={onDifficultyChange}
            onTrackPrepared={setTrackInfo}
            onFinish={onFinish}
          />
        )}
      </section>

      <aside className="casino-info-column marbles-info-column">
        <section className="panel casino-mode-card">
          <div className="panel-title"><Flag size={18} /> {modeLabels[mode]}</div>
          <p className="mode-description">
            {mode === "direct"
              ? "La primera canica en cruzar la meta gana. Queda fuera hasta que decidas habilitarla nuevamente."
              : "La última canica en cruzar queda eliminada. En cada ronda se genera una pista nueva."}
          </p>
          <div className="cards-process-mini marbles-process-mini">
            <span>1 · Pista</span><span>2 · Poderes</span><span>3 · Carrera</span><span>4 · Meta</span>
          </div>
        </section>

        <section className="panel marble-map-info-card">
          <div className="panel-title panel-title--spread">
            <span><Dices size={18} /> Mapa actual</span>
            <small>{difficultyLabels[difficulty]}</small>
          </div>
          {trackInfo ? (
            <div className="marble-map-info-grid">
              <span><small>Semilla</small><strong>{trackInfo.signature.toUpperCase()}</strong></span>
              <span><small>Longitud</small><strong>{trackInfo.lengthRating}</strong></span>
              <span><small>Zonas</small><strong>{trackInfo.zones.length}</strong></span>
              <span><small>Secciones</small><strong>{trackInfo.sections.length}</strong></span>
              <span><small>Trampas</small><strong>{trackInfo.obstacles.length}</strong></span>
              <span><small>Poderes</small><strong>{trackInfo.powerZones.length}</strong></span>
            </div>
          ) : (
            <div className="history-empty">{finalWinner ? "Carrera finalizada" : "Generando módulos compatibles…"}</div>
          )}
        </section>

        <section className="panel marble-power-legend-card">
          <div className="panel-title"><Sparkles size={18} /> Poderes y efectos</div>
          <div className="marble-power-legend">
            {powersByDifficulty[difficulty].map((power) => (
              <span key={power} className={`marble-power-chip marble-power-chip--${power}`}>
                <i />{powerLabels[power]}
              </span>
            ))}
          </div>
        </section>

        <section className="panel casino-prize-card">
          <div className="panel-title"><Gift size={18} /> Premio actual</div>
          <div className="compact-prize"><Trophy size={28} /><strong>{prize || "Premio sorpresa"}</strong></div>
        </section>

        <section className="panel casino-current-result">
          <div className="panel-title"><Target size={18} /> Resultado actual</div>
          {latestResult ? (
            <div className={`round-result-summary round-result-summary--${latestResult.kind}`}>
              <span className="landed-number marble-result-symbol"><Gem size={16} /></span>
              <strong>{latestResult.participantName}</strong>
              <em>{latestResult.kind === "winner" ? "Ganador" : "Eliminado"}</em>
              {latestResult.selectionLabel && <small>{latestResult.selectionLabel}</small>}
            </div>
          ) : (
            <div className="empty-result"><Gem size={25} /><strong>Compuerta cerrada</strong><span>Abre la salida para iniciar.</span></div>
          )}
        </section>

        <WinnerHistory compact />

        <section className="panel history-panel casino-history-panel marbles-history-panel">
          <div className="panel-title panel-title--spread">
            <span><History size={18} /> Historial</span><small>{history.length}</small>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">Los resultados de meta aparecerán aquí.</div>
            ) : history.map((result) => (
              <div className="history-row casino-history-row" key={result.id}>
                <span>R{result.round} · canica {result.landedNumber}</span>
                <strong>{result.participantName}</strong>
                <em className={result.kind}>{result.kind === "winner" ? "GANÓ" : "ÚLTIMA"}</em>
              </div>
            ))}
          </div>
        </section>

        <div className="casino-stats-row">
          <StatCard icon={<Users />} tone="cyan" label="Activos" value={activeParticipants.length} />
          <StatCard icon={<Gem />} tone="gold" label="Canicas" value={activeParticipants.length} />
        </div>
      </aside>
    </section>
  );
}

function DucksScreen({
  participants,
  activeParticipants,
  blockedWinnerIds,
  eliminatedIds,
  history,
  latestResult,
  prize,
  sessionWinner,
  previousWinnerIds,
  onFinish,
  onCommit,
  resumedCommitment,
  onRestart,
  restartDisabled,
}: {
  participants: Participant[];
  activeParticipants: Participant[];
  blockedWinnerIds: string[];
  eliminatedIds: string[];
  history: RoundResult[];
  latestResult: RoundResult | null;
  prize: string;
  sessionWinner: RoundResult | null;
  previousWinnerIds: ReadonlySet<string>;
  onFinish: (survivor: DuckContestant, knockoutOrder: DuckContestant[]) => void;
  onCommit: (commitmentId: string, seed: string, survivorId: string) => void;
  resumedCommitment: { commitmentId: string; seed: string } | null;
  onRestart: () => void;
  restartDisabled: boolean;
}) {
  const finalWinner = resolveFinalWinner(sessionWinner, latestResult, activeParticipants.length);
  const cannotPlay = !!finalWinner || activeParticipants.length < 2;

  return (
    <section className="ducks-workspace">
      <section className="ducks-stage-column">
        <div className="stage-heading casino-stage-heading ducks-stage-heading">
          <div>
            <span className="eyebrow">SUPERVIVENCIA · 3 VIDAS</span>
            <h1>Patos de Fortuna</h1>
          </div>
          <div className="live-badge"><span /> {finalWinner ? "PARTIDA FINALIZADA" : "CAMPO DE TIRO 3D"}</div>
        </div>

        {finalWinner ? (
          <div className="cards-final-state ducks-final-state">
            <Bird size={64} />
            <span>Último pato en pie</span>
            <strong>{finalWinner.participantName}</strong>
            <p>Conservó al menos una vida. El premio ya está guardado en el salón de ganadores.</p>
          </div>
        ) : (
          <DuckHunt
            participants={activeParticipants}
            previousWinnerIds={previousWinnerIds}
            disabled={cannotPlay}
            onCommit={onCommit}
            resumedCommitment={resumedCommitment}
            onFinish={onFinish}
          />
        )}
      </section>

      <aside className="casino-info-column ducks-info-column">
        <section className="panel ducks-rule-card">
          <div className="panel-title"><Crosshair size={18} /> Reglas de supervivencia</div>
          <div className="duck-rule-steps">
            <span><b>1</b><strong>Tres vidas</strong><small>Cada participante empieza completo.</small></span>
            <span><b>2</b><strong>Impacto</strong><small>Revela el nombre y resta una vida.</small></span>
            <span><b>3</b><strong>Bosque activo</strong><small>Se ocultan al azar entre árboles y pasto.</small></span>
            <span><b>4</b><strong>Orden comprometido</strong><small>El clic solo avanza el próximo impacto ya sellado.</small></span>
            <span><b>5</b><strong>Identidad protegida</strong><small>Nombre, color y corona se revelan después del impacto.</small></span>
            <span><b>6</b><strong>Poderes de pato</strong><small>Paleta, temblor o inversión visual; nunca cambian el ganador.</small></span>
            <span><b>7</b><strong>Salida colectiva</strong><small>Cada impacto hace salir a toda la bandada de su refugio.</small></span>
          </div>
        </section>

        <section className="panel casino-prize-card ducks-prize-card">
          <div className="panel-title"><Gift size={18} /> Premio actual</div>
          <div className="compact-prize"><Trophy size={28} /><strong>{prize || "Premio sorpresa"}</strong></div>
        </section>

        <section className="panel casino-current-result ducks-current-result">
          <div className="panel-title"><Target size={18} /> Resultado</div>
          {latestResult ? (
            <div className={`round-result-summary round-result-summary--${latestResult.kind}`}>
              <span className="landed-number"><Bird size={16} /></span>
              <strong>{latestResult.participantName}</strong>
              <em>{latestResult.kind === "winner" ? "Superviviente" : "Sin vidas"}</em>
              {latestResult.selectionLabel && <small>{latestResult.selectionLabel}</small>}
            </div>
          ) : (
            <div className="empty-result"><Bird size={25} /><strong>Bandada intacta</strong><span>Los nombres se revelan al acertar.</span></div>
          )}
        </section>

        <WinnerHistory compact />

        <section className="panel history-panel casino-history-panel ducks-history-panel">
          <div className="panel-title panel-title--spread"><span><History size={18} /> Bajas</span><small>{history.length}</small></div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">Aquí aparecerá el orden de eliminación.</div>
            ) : history.map((result) => (
              <div className="history-row casino-history-row" key={result.id}>
                <span>Pato {result.landedNumber}</span>
                <strong>{result.participantName}</strong>
                <em className={result.kind}>{result.kind === "winner" ? "GANÓ" : "FUERA"}</em>
              </div>
            ))}
          </div>
        </section>

        <button className="text-button cards-restart-button ducks-restart" type="button" onClick={onRestart} disabled={restartDisabled}>
          <RotateCcw size={15} /> Reiniciar supervivencia
        </button>

        <div className="casino-stats-row">
          <StatCard icon={<Users />} tone="cyan" label="Cargados" value={participants.length} />
          <StatCard icon={<Bird />} tone="gold" label="En partida" value={activeParticipants.length - eliminatedIds.filter((id) => activeParticipants.some((participant) => participant.id === id)).length} />
        </div>
        {blockedWinnerIds.length > 0 && <small className="ducks-winner-note">Los ganadores anteriores siguen fuera hasta que decidas volver a incluirlos.</small>}
      </aside>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "red" | "gold" | "cyan" | "green";
}) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div>{icon}<span>{label}</span></div>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
