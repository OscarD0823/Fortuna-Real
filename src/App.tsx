import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Crown,
  Dices,
  Expand,
  Gift,
  History,
  Medal,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Volume2,
  WandSparkles,
  Zap,
} from "lucide-react";
import "./App.css";
import type { Participant, RoundResult } from "./core/types";
import { RouletteWheel } from "./games/roulette/RouletteWheel";
import { DrawSetup } from "./modules/draw/DrawSetup";
import { ParticipantPanel } from "./modules/participants/ParticipantPanel";
import { useDrawStore } from "./modules/participants/drawStore";
import { ResultReveal } from "./modules/results/ResultReveal";
import { SplashScreen } from "./shared/components/SplashScreen";

const securePick = <T,>(items: T[]): T => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return items[Math.floor((values[0] / 2 ** 32) * items.length)];
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinRequest, setSpinRequest] = useState<{
    participantId: string;
    nonce: number;
  } | null>(null);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const pendingParticipant = useRef<Participant | null>(null);

  const participants = useDrawStore((state) => state.participants);
  const eliminatedIds = useDrawStore((state) => state.eliminatedIds);
  const pickedIds = useDrawStore((state) => state.pickedIds);
  const history = useDrawStore((state) => state.history);
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const recordSelection = useDrawStore((state) => state.recordSelection);
  const resetDraw = useDrawStore((state) => state.resetDraw);

  const activeParticipants = useMemo(
    () => participants.filter((person) => !eliminatedIds.includes(person.id)),
    [eliminatedIds, participants],
  );

  const latestResult = currentResult ?? history[0] ?? null;
  const champion =
    mode === "elimination" && activeParticipants.length === 1
      ? activeParticipants[0]
      : null;

  useEffect(() => {
    if (participants.length === 0) {
      setCurrentResult(null);
    }
  }, [participants.length]);

  const startSpin = () => {
    if (isSpinning || activeParticipants.length < 2 || champion) return;

    let eligible = activeParticipants.filter(
      (person) => !pickedIds.includes(person.id),
    );
    if (eligible.length === 0) eligible = activeParticipants;

    const selected = securePick(eligible);
    pendingParticipant.current = selected;
    setCurrentResult(null);
    setIsSpinning(true);
    setSpinRequest({ participantId: selected.id, nonce: Date.now() });
  };

  const finishSpin = () => {
    const selected = pendingParticipant.current;
    if (!selected) return;

    const result = recordSelection(selected.id);
    setIsSpinning(false);
    setCurrentResult(result);
    pendingParticipant.current = null;
  };

  const beginNewDraw = () => {
    resetDraw();
    setCurrentResult(null);
    setSpinRequest(null);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // El WebView nativo puede gestionar esta función de forma diferente.
    }
  };

  return (
    <div className="app-root">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <main className={`app-shell ${showSplash ? "app-shell--waiting" : ""}`}>
        <header className="topbar">
          <div className="brand-lockup" aria-label="Fortuna Real">
            <div className="brand-mark" aria-hidden="true">
              <span className="brand-mark__ring" />
              <Crown size={23} strokeWidth={1.7} />
            </div>
            <div>
              <div className="brand-name">
                FORTUNA <span>REAL</span>
              </div>
              <div className="brand-tagline">Sorteos con emoción real</div>
            </div>
          </div>

          <div className="fairness-pill">
            <ShieldCheck size={20} />
            <div>
              <strong>Selección justa activa</strong>
              <span>Sin repetir nombres hasta completar el ciclo</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" aria-label="Sonido próximamente" title="Sonidos próximamente" disabled>
              <Volume2 size={19} />
            </button>
            <button className="icon-button" aria-label="Configuración próximamente" title="Configuración próximamente" disabled>
              <Settings2 size={19} />
            </button>
            <button className="icon-button" aria-label="Pantalla completa" onClick={toggleFullscreen}>
              <Expand size={19} />
            </button>
          </div>
        </header>

        <section className="workspace">
          <aside className="left-column">
            <ParticipantPanel />
            <DrawSetup />

            <section className="panel launch-panel">
              <div className="section-heading">
                <span className="step-number">4</span>
                <div>
                  <h2>Iniciar</h2>
                  <p>La fortuna decidirá</p>
                </div>
              </div>
              <button
                className={`start-button ${isSpinning ? "is-spinning" : ""}`}
                type="button"
                onClick={startSpin}
                disabled={isSpinning || activeParticipants.length < 2 || !!champion}
              >
                {isSpinning ? (
                  <>
                    <span className="spinner-dot" /> Girando la ruleta…
                  </>
                ) : champion ? (
                  <>
                    <Trophy size={22} /> Sorteo finalizado
                  </>
                ) : (
                  <>
                    <span className="play-symbol">▶</span> Girar ruleta
                  </>
                )}
              </button>
              <button className="text-button" type="button" onClick={beginNewDraw}>
                <RotateCcw size={15} /> Nuevo sorteo
              </button>
            </section>
          </aside>

          <section className="stage-column">
            <div className="stage-heading">
              <div>
                <span className="eyebrow">JUEGO ACTIVO</span>
                <h1>Ruleta de la fortuna</h1>
              </div>
              <div className="live-badge">
                <span /> {isSpinning ? "EN MOVIMIENTO" : "LISTA PARA GIRAR"}
              </div>
            </div>

            <div className="roulette-stage">
              <div className="stage-glow stage-glow--one" />
              <div className="stage-glow stage-glow--two" />
              <RouletteWheel
                participants={activeParticipants}
                spinRequest={spinRequest}
                isSpinning={isSpinning}
                onSpinEnd={finishSpin}
              />
              <div className="wheel-caption">
                <Sparkles size={16} />
                {activeParticipants.length >= 2
                  ? `${activeParticipants.length} nombres compiten en esta ronda`
                  : "Agrega al menos 2 participantes para comenzar"}
              </div>
            </div>

            <div className="stats-grid">
              <StatCard
                icon={<Target />}
                tone="red"
                label="Eliminados"
                value={eliminatedIds.length}
              />
              <StatCard
                icon={<Trophy />}
                tone="gold"
                label="Ganadores"
                value={history.filter((item) => item.kind === "winner").length}
              />
              <StatCard
                icon={<Users />}
                tone="cyan"
                label="Participantes"
                value={participants.length}
              />
              <StatCard
                icon={<CheckCircle2 />}
                tone="green"
                label="En juego"
                value={activeParticipants.length}
              />
            </div>
          </section>

          <aside className="right-column">
            <section className="panel prize-panel">
              <div className="panel-title">
                <Gift size={18} /> Premio
              </div>
              <div className="prize-content">
                <div className="prize-icon"><Trophy size={35} /></div>
                <div>
                  <strong>{prize.trim() || "Premio sorpresa"}</strong>
                  <span><CircleDollarSign size={14} /> 1 ganador</span>
                </div>
              </div>
            </section>

            <section className="panel rules-panel">
              <div className="panel-title">
                <WandSparkles size={18} /> Reglas del sorteo
              </div>
              <ul>
                <li><CheckCircle2 /> Selección aleatoria y verificable.</li>
                <li><CheckCircle2 /> Sin nombres repetidos durante el ciclo.</li>
                <li><CheckCircle2 /> El modo eliminación deja un campeón.</li>
                <li><CheckCircle2 /> Los resultados se guardan en este equipo.</li>
              </ul>
            </section>

            <section className="panel result-panel">
              <div className="panel-title">
                <Dices size={18} /> Resultado actual
              </div>
              {champion ? (
                <div className="mini-result mini-result--winner">
                  <Medal size={26} />
                  <span>Campeón final</span>
                  <strong>{champion.name}</strong>
                </div>
              ) : latestResult ? (
                <div className={`mini-result mini-result--${latestResult.kind}`}>
                  {latestResult.kind === "winner" ? <Trophy size={24} /> : <Target size={24} />}
                  <span>{latestResult.kind === "winner" ? "Ganador" : "Eliminado"}</span>
                  <strong>{latestResult.participantName}</strong>
                </div>
              ) : (
                <div className="empty-result">
                  <Zap size={25} />
                  <strong>Aún no hay resultados</strong>
                  <span>Gira la ruleta para comenzar.</span>
                </div>
              )}
            </section>

            <section className="panel history-panel">
              <div className="panel-title panel-title--spread">
                <span><History size={18} /> Historial de rondas</span>
                <small>{history.length}</small>
              </div>
              <div className="history-list">
                {history.length === 0 ? (
                  <div className="history-empty">Las jugadas aparecerán aquí.</div>
                ) : (
                  history.slice(0, 5).map((item, index) => (
                    <div className="history-row" key={item.id}>
                      <span>Ronda {history.length - index}</span>
                      <strong>{item.participantName}</strong>
                      <em className={item.kind}>{item.kind === "winner" ? "Ganó" : "Salió"}</em>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </main>

      {currentResult && (
        <ResultReveal
          result={currentResult}
          champion={champion}
          prize={prize}
          onClose={() => setCurrentResult(null)}
        />
      )}
    </div>
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
