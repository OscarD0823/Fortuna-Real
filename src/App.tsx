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
  CheckCircle2,
  CircleDot,
  Crown,
  Dices,
  Expand,
  Flag,
  Gem,
  Gift,
  Hash,
  History,
  Layers3,
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
  Participant,
  Parity,
  RouletteEntry,
  RoundResult,
} from "./core/types";
import { CardGame } from "./games/cards/CardGame";
import type { CardAssignment } from "./games/cards/cardDeck";
import { MarbleRace } from "./games/marbles/MarbleRace";
import type { MarbleRacer } from "./games/marbles/marbleRaceEngine";
import { RouletteWheel } from "./games/roulette/RouletteWheel";
import { arrangeEliminationEntries } from "./games/roulette/rouletteEntries";
import { DrawSetup } from "./modules/draw/DrawSetup";
import { ParticipantPanel } from "./modules/participants/ParticipantPanel";
import { useDrawStore } from "./modules/participants/drawStore";
import { ResultReveal } from "./modules/results/ResultReveal";
import { WinnerHistory } from "./modules/winners/WinnerHistory";
import { fortunaAudio } from "./shared/audio/audioEngine";
import { SplashScreen } from "./shared/components/SplashScreen";
import { AppUpdater } from "./shared/components/AppUpdater";

const securePick = <T,>(items: T[]): T => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return items[Math.floor((values[0] / 2 ** 32) * items.length)];
};

const secureRandomDegrees = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] / 2 ** 32) * 360;
};

const modeLabels: Record<DrawMode, string> = {
  direct: "Ganador directo",
  elimination: "Eliminación",
};

const numberParity = (number: number): Parity =>
  number % 2 === 0 ? "even" : "odd";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<"setup" | GameId>("setup");
  const [cardRoundKey, setCardRoundKey] = useState(0);
  const [marbleRoundKey, setMarbleRoundKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("fortuna-real-sound") !== "off",
  );
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
  const game = useDrawStore((state) => state.game);
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const roundNumber = useDrawStore((state) => state.roundNumber);
  const startDraw = useDrawStore((state) => state.startDraw);
  const recordSelection = useDrawStore((state) => state.recordSelection);
  const recordParitySelection = useDrawStore((state) => state.recordParitySelection);
  const reenableWinner = useDrawStore((state) => state.reenableWinner);

  const activeParticipants = useMemo(
    () =>
      participants.filter(
        (person) =>
          !eliminatedIds.includes(person.id) &&
          !blockedWinnerIds.includes(person.id),
      ),
    [blockedWinnerIds, eliminatedIds, participants],
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
        disabled:
          mode === "elimination" &&
          eliminationParity !== null &&
          parity !== eliminationParity,
      };
    });

    if (mode !== "elimination") return participantEntries;
    return arrangeEliminationEntries(participantEntries).map((entry) =>
      entry.kind === "parity"
        ? { ...entry, disabled: eliminationParity !== null }
        : entry,
    );
  }, [activeParticipants, eliminationParity, mode]);

  const selectableEntries = useMemo(
    () => wheelEntries.filter((entry) => !entry.disabled),
    [wheelEntries],
  );
  const latestResult = currentResult ?? history[0] ?? null;
  const sessionWinner =
    mode === "direct" ? null : history.find((result) => result.kind === "winner") ?? null;

  useEffect(() => {
    fortunaAudio.setEnabled(soundEnabled);
    localStorage.setItem("fortuna-real-sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(
    () => () => {
      stopSpinSound.current?.();
    },
    [],
  );

  const enterSelectedGame = () => {
    if (activeParticipants.length < 2) return;
    startDraw();
    setIsSpinning(false);
    setCurrentResult(null);
    setSpinRequest(null);
    setCardRoundKey((key) => key + 1);
    setMarbleRoundKey((key) => key + 1);
    setScreen(game);
    fortunaAudio.playEnterGame();
  };

  const returnToSetup = () => {
    if (screen === "roulette" && isSpinning) return;
    fortunaAudio.playClick();
    setScreen("setup");
    setCurrentResult(null);
    setSpinRequest(null);
    setIsSpinning(false);
    startDraw();
  };

  const startSpin = () => {
    if (
      isSpinning ||
      selectableEntries.length === 0 ||
      !!sessionWinner ||
      (mode === "elimination" && activeParticipants.length < 2)
    ) return;

    const selected = securePick(selectableEntries);
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
    const result = selection.kind === "parity"
      ? recordParitySelection(selection.parity, selection.number)
      : recordSelection(selection.participantId as string, selection.number, `Número ${selection.number}`);
    setIsSpinning(false);
    setCurrentResult(result);
    pendingSelection.current = null;

    window.setTimeout(() => {
      fortunaAudio.playResult(result.kind === "winner", result.parity);
      fortunaAudio.announceResult(result);
    }, 170);
  }, [recordParitySelection, recordSelection]);

  const finishCardSelection = useCallback((assignment: CardAssignment, position: number) => {
    const result = recordSelection(assignment.participant.id, position, assignment.label);
    setCurrentResult(result);

    window.setTimeout(() => {
      fortunaAudio.playResult(result.kind === "winner", result.parity);
      fortunaAudio.announceResult(result);
    }, 170);
  }, [recordSelection]);

  const finishMarbleRace = useCallback((racer: MarbleRacer, label: string) => {
    const result = recordSelection(racer.participant.id, racer.number, label);
    setCurrentResult(result);

    window.setTimeout(() => {
      fortunaAudio.playResult(result.kind === "winner", result.parity);
      fortunaAudio.announceResult(result);
    }, 170);
  }, [recordSelection]);

  const closeCurrentResult = () => {
    setCurrentResult(null);
    if (screen === "cards") setCardRoundKey((key) => key + 1);
    if (screen === "marbles") setMarbleRoundKey((key) => key + 1);
  };

  const allowCurrentWinnerToReturn = () => {
    if (currentResult?.kind !== "winner" || !currentResult.participantId) return;
    reenableWinner(currentResult.participantId);
    if (currentResult.mode === "elimination") startDraw();
    fortunaAudio.playClick();
    setCurrentResult(null);
    setCardRoundKey((key) => key + 1);
    setMarbleRoundKey((key) => key + 1);
  };

  const restartSession = () => {
    if (screen === "roulette" && isSpinning) return;
    fortunaAudio.playClick();
    startDraw();
    setCurrentResult(null);
    setSpinRequest(null);
    setCardRoundKey((key) => key + 1);
    setMarbleRoundKey((key) => key + 1);
  };

  const toggleSound = () => {
    setSoundEnabled((enabled) => {
      const nextValue = !enabled;
      fortunaAudio.setEnabled(nextValue);
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
          onToggleFullscreen={toggleFullscreen}
          onBack={returnToSetup}
          roundNumber={roundNumber}
          activeCount={activeParticipants.length}
        />

        {screen === "setup" ? (
          <SetupScreen
            onStart={enterSelectedGame}
            game={game}
            participantCount={participants.length}
            eligibleCount={activeParticipants.length}
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
            onSelect={finishCardSelection}
            onRestart={restartSession}
          />
        ) : (
          <MarblesScreen
            key={marbleRoundKey}
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
            onFinish={finishMarbleRace}
            onRestart={restartSession}
          />
        )}
      </main>

      {currentResult && (
        <ResultReveal
          result={currentResult}
          onClose={closeCurrentResult}
          onReenableWinner={allowCurrentWinnerToReturn}
          soundEnabled={soundEnabled}
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
  onToggleFullscreen,
  onBack,
  roundNumber,
  activeCount,
}: {
  screen: "setup" | GameId;
  game: GameId;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
  onBack: () => void;
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
          {screen === "roulette" ? <CircleDot size={19} /> : screen === "cards" ? <Layers3 size={19} /> : <Gem size={19} />}
          <div>
            <strong>Ronda {roundNumber}</strong>
            <span>{activeCount} participantes · {screen === "roulette" ? "ruleta" : screen === "cards" ? "cartas" : "canicas"}</span>
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
                  : "Pistas procedurales y carrera verificable"}
            </span>
          </div>
        </div>
      )}

      <div className="topbar-actions">
        {screen !== "setup" && (
          <button className="back-button" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Inicio
          </button>
        )}
        <button
          className={`icon-button ${soundEnabled ? "is-active" : ""}`}
          aria-label={soundEnabled ? "Desactivar sonidos" : "Activar sonidos"}
          title={soundEnabled ? "Desactivar sonidos" : "Activar sonidos"}
          onClick={onToggleSound}
        >
          {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button className="icon-button" aria-label="Configuración próximamente" disabled>
          <Settings2 size={19} />
        </button>
        <button className="icon-button" aria-label="Pantalla completa" onClick={onToggleFullscreen}>
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
}: {
  onStart: () => void;
  game: GameId;
  participantCount: number;
  eligibleCount: number;
}) {
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
            <span><strong>{participantCount}</strong> cargados · {eligibleCount} habilitados</span>
          </div>
          <button
            type="button"
            className="start-button setup-start-button setup-hero-start"
            onClick={onStart}
            disabled={eligibleCount < 2}
            title={eligibleCount < 2
              ? "Agrega al menos dos participantes"
              : `Entrar a ${game === "roulette" ? "la ruleta" : game === "cards" ? "la mesa de cartas" : "la pista de canicas"}`}
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
            const isPaused =
              mode === "elimination" &&
              eliminationParity !== null &&
              parity !== null &&
              parity !== eliminationParity;
            const rowClasses = [
              "roster-row",
              isEliminated ? "is-eliminated" : "",
              isWinner ? "is-winner" : "",
              isPaused ? "is-paused" : "",
            ].filter(Boolean).join(" ");
            const status = isWinner
              ? "Ganador"
              : isEliminated
                ? "Eliminado"
                : isPaused
                  ? "No juega"
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
          <button className="text-button" type="button" onClick={onRestart} disabled={isSpinning}>
            <RotateCcw size={15} /> Reiniciar ronda con los habilitados
          </button>
        </div>
      </section>

      <aside className="casino-info-column">
        <section className="panel casino-mode-card">
          <div className="panel-title"><Dices size={18} /> {modeLabels[mode]}</div>
          {mode === "elimination" ? (
            <div className="compact-rule">
              <div><span className="parity-token parity-token--even">PAR</span><p>La próxima eliminación será entre los pares</p></div>
              <div><span className="parity-token parity-token--odd">IMPAR</span><p>La próxima eliminación será entre los impares</p></div>
              {eliminationParity && (
                <div className="active-filter-note">
                  Una eliminación entre <strong>{eliminationParity === "even" ? "PARES" : "IMPARES"}</strong>; después vuelven todos.
                </div>
              )}
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
                  ? latestResult.parity === "even" ? "Pasan pares" : "Pasan impares"
                  : latestResult.kind === "parity-selected"
                    ? `Filtro ${latestResult.participantName}`
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
  onSelect,
  onRestart,
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
  onSelect: (assignment: CardAssignment, position: number) => void;
  onRestart: () => void;
}) {
  const cannotPlay = !!sessionWinner || activeParticipants.length < 2;

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
        <button className="text-button cards-restart-button" type="button" onClick={onRestart}>
          <RotateCcw size={15} /> Reiniciar con los habilitados
        </button>
      </aside>

      <section className="cards-stage-column">
        <div className="stage-heading casino-stage-heading">
          <div>
            <span className="eyebrow">{modeLabels[mode]} · RONDA {roundNumber}</span>
            <h1>Mesa de cartas</h1>
          </div>
          <div className="live-badge"><span /> {sessionWinner ? "RONDA FINALIZADA" : "MAZO VERIFICABLE"}</div>
        </div>

        {sessionWinner ? (
          <div className="cards-final-state">
            <Crown size={58} />
            <span>Ganador final</span>
            <strong>{sessionWinner.participantName}</strong>
            <p>El historial conserva el premio y permite habilitarlo para otro sorteo.</p>
          </div>
        ) : (
          <CardGame
            participants={activeParticipants}
            mode={mode}
            disabled={cannotPlay}
            onSelect={onSelect}
          />
        )}
      </section>

      <aside className="casino-info-column cards-info-column">
        <section className="panel casino-mode-card">
          <div className="panel-title"><Layers3 size={18} /> {modeLabels[mode]}</div>
          <p className="mode-description">
            {mode === "direct"
              ? "La carta elegida entrega el premio. Su ganador queda fuera hasta que lo habilites nuevamente."
              : "La carta elegida elimina una sola persona. Después se crea un nuevo mazo con quienes siguen."}
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

function MarblesScreen({
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
  onFinish,
  onRestart,
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
  onFinish: (racer: MarbleRacer, label: string) => void;
  onRestart: () => void;
}) {
  const cannotPlay = !!sessionWinner || activeParticipants.length < 2;

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
                <strong title={person.name}>{person.name}</strong>
                <em>{isWinner ? "Ganador" : isEliminated ? "Eliminado" : "En carrera"}</em>
              </div>
            );
          })}
        </div>
        <button className="text-button cards-restart-button" type="button" onClick={onRestart}>
          <RotateCcw size={15} /> Reiniciar con los habilitados
        </button>
      </aside>

      <section className="marbles-stage-column">
        <div className="stage-heading casino-stage-heading">
          <div>
            <span className="eyebrow">{modeLabels[mode]} · RONDA {roundNumber}</span>
            <h1>Carrera de canicas</h1>
          </div>
          <div className="live-badge"><span /> {sessionWinner ? "CARRERA FINALIZADA" : "PISTA PROCEDURAL"}</div>
        </div>

        {sessionWinner ? (
          <div className="cards-final-state marbles-final-state">
            <Crown size={58} />
            <span>Ganador final</span>
            <strong>{sessionWinner.participantName}</strong>
            <p>El historial conserva el premio y permite habilitarlo para otra carrera.</p>
          </div>
        ) : (
          <MarbleRace
            participants={activeParticipants}
            mode={mode}
            disabled={cannotPlay}
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
