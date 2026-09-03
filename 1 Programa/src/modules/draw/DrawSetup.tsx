import {
  Bird,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleDot,
  Flag,
  Gem,
  Gamepad2,
  Layers3,
  Trophy,
  UsersRound,
} from "lucide-react";
import type { GameId } from "../../core/types";
import { gameGuides } from "../../shared/tutorial/tutorialContent";
import { useDrawStore } from "../participants/drawStore";

export function DrawSetup({ onOpenDemo }: { onOpenDemo: (game: GameId) => void }) {
  const game = useDrawStore((state) => state.game);
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const pinballControlMode = useDrawStore((state) => state.pinballControlMode);
  const marbleFinishRule = useDrawStore((state) => state.marbleFinishRule);
  const setGame = useDrawStore((state) => state.setGame);
  const setMode = useDrawStore((state) => state.setMode);
  const setPrize = useDrawStore((state) => state.setPrize);
  const setPinballControlMode = useDrawStore((state) => state.setPinballControlMode);
  const setMarbleFinishRule = useDrawStore((state) => state.setMarbleFinishRule);
  const selectedGuide = gameGuides[game];
  const selectedIcon = game === "roulette"
    ? <CircleDot size={24} />
    : game === "cards"
      ? <Layers3 size={24} />
      : game === "pinball"
        ? <Gamepad2 size={24} />
        : game === "marbles"
          ? <Gem size={24} />
          : <Bird size={24} />;

  return (
    <div className="setup-options-stack">
      <section className="panel setup-choice-panel">
        <div className="section-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Elegir juego</h2>
            <p>Cinco juegos conectados al mismo sorteo e historial</p>
          </div>
        </div>
        <div className="game-options game-options--large" data-tour="game-picker" role="radiogroup" aria-label="Juego del sorteo">
          <button
            type="button"
            role="radio"
            aria-checked={game === "roulette"}
            className={`game-option ${game === "roulette" ? "is-active" : ""}`}
            onClick={() => setGame("roulette")}
          >
            <CircleDot size={30} />
            <span>Ruleta casino</span>
            <small>Disponible</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={game === "cards"}
            className={`game-option ${game === "cards" ? "is-active" : ""}`}
            onClick={() => setGame("cards")}
          >
            <Layers3 size={29} />
            <span>Cartas</span>
            <small>Disponible</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={game === "pinball"}
            className={`game-option game-option--beta ${game === "pinball" ? "is-active" : ""}`}
            onClick={() => setGame("pinball")}
          >
            <Gamepad2 size={29} />
            <span>Pinball 3D</span>
            <small>BETA · mesa física</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={game === "marbles"}
            className={`game-option game-option--beta ${game === "marbles" ? "is-active" : ""}`}
            onClick={() => setGame("marbles")}
          >
            <Gem size={29} />
            <span>Canicas</span>
            <small>BETA · 3D procedural</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={game === "ducks"}
            className={`game-option game-option--beta game-option--ducks ${game === "ducks" ? "is-active" : ""}`}
            onClick={() => {
              setGame("ducks");
              setMode("elimination");
            }}
          >
            <Bird size={29} />
            <span>Patos 3D</span>
            <small>BETA · supervivencia</small>
          </button>
        </div>
        <div className="selected-game-guide" data-tour="game-guide">
          <div className="selected-game-guide__icon">{selectedIcon}</div>
          <div className="selected-game-guide__copy">
            <span><BookOpen size={14} /> Así funciona {selectedGuide.title}</span>
            <strong>{selectedGuide.summary}</strong>
            <div>
              {selectedGuide.steps.slice(0, 3).map((step) => <small key={step.title}><Check size={12} /> {step.title}</small>)}
            </div>
          </div>
          <button type="button" onClick={() => onOpenDemo(game)} aria-label={`Ver demostración paso a paso de ${selectedGuide.title}`}>
            Ver demo paso a paso <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <section className="panel setup-choice-panel mode-choice-panel" data-tour="mode-picker">
        <div className="section-heading">
          <span className="step-number">3</span>
          <div>
            <h2>Elegir modo</h2>
            <p>Define cómo se resolverá cada tirada</p>
          </div>
        </div>
        <div className="mode-options mode-options--two" role="radiogroup" aria-label="Modo del sorteo">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "direct"}
            className={mode === "direct" ? "is-active" : ""}
            onClick={() => setMode("direct")}
            disabled={game === "ducks"}
            title={game === "ducks" ? "Patos 3D siempre se juega como supervivencia" : undefined}
          >
            <Trophy size={22} />
            <span>
              <strong>Ganador directo</strong>
              <small>Varios premios sin repetir ganador</small>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "elimination"}
            className={mode === "elimination" ? "is-active" : ""}
            onClick={() => setMode("elimination")}
          >
            <UsersRound size={22} />
            <span>
              <strong>Eliminación</strong>
              <small>{game === "roulette" ? "Incluye las casillas PAR e IMPAR" : game === "pinball" ? "La pelota sellada representa al eliminado" : game === "marbles" ? "La última canica queda eliminada" : game === "ducks" ? "Tres vidas; gana el último en pie" : "Una carta sale en cada ronda"}</small>
            </span>
          </button>
        </div>

        {mode === "elimination" && game === "roulette" && (
          <div className="casino-rule-preview elimination-rule-preview">
            <span className="parity-token parity-token--even">PAR</span>
            <p>Referencia visual para reconocer números pares; no cambia quién puede salir.</p>
            <span className="parity-token parity-token--odd">IMPAR</span>
            <p>Antes de girar se compromete uniformemente una persona habilitada. PAR e IMPAR no participan en la selección.</p>
          </div>
        )}

        {mode === "elimination" && game === "cards" && (
          <div className="direct-rule-preview cards-rule-preview">
            <Layers3 size={17} />
            <p>Las cartas se muestran, se reúnen, se barajan y se reparten boca abajo. El resultado se sella antes de elegir una posición; el mazo se reconstruye con quienes continúan.</p>
          </div>
        )}

        {game === "pinball" && (
          <div className="pinball-control-choice">
            <div className="pinball-control-choice__heading">
              <Gamepad2 size={17} />
              <span><strong>Control de la mesa</strong><small>Ambos modos conservan el mismo resultado sellado; Manual cambia la presentación.</small></span>
            </div>
            <div className="pinball-control-choice__options" role="radiogroup" aria-label="Control del Pinball 3D">
              <button type="button" role="radio" aria-checked={pinballControlMode === "automatic"} className={pinballControlMode === "automatic" ? "is-active" : ""} onClick={() => setPinballControlMode("automatic")}>
                <Bot size={20} /><span><strong>Automático</strong><small>La mesa lanza y acciona los flippers</small></span>
              </button>
              <button type="button" role="radio" aria-checked={pinballControlMode === "manual"} className={pinballControlMode === "manual" ? "is-active" : ""} onClick={() => setPinballControlMode("manual")}>
                <Gamepad2 size={20} /><span><strong>Manual</strong><small>Controla lanzador y flippers sin alterar el resultado</small></span>
              </button>
            </div>
          </div>
        )}

        {mode === "elimination" && game === "pinball" && (
          <div className="direct-rule-preview pinball-rule-preview">
            <Gamepad2 size={17} />
            <p>Antes de iniciar se sella una pelota de manera uniforme. La mesa representa ese compromiso y la siguiente ronda crea otra distribución verificable.</p>
          </div>
        )}

        {game === "marbles" && (
          <div className="marble-finish-choice">
            <div className="marble-finish-choice__heading">
              <Flag size={17} />
              <span><strong>¿Qué posición decide?</strong><small>Elige antes de entrar; el resultado se sella al iniciar la carrera.</small></span>
            </div>
            <div className="marble-finish-choice__options" role="radiogroup" aria-label="Posición de llegada que decide el resultado de Canicas">
              <button type="button" role="radio" aria-checked={marbleFinishRule === "first"} className={marbleFinishRule === "first" ? "is-active" : ""} onClick={() => setMarbleFinishRule("first")}>
                <Trophy size={19} /><span><strong>Primero</strong><small>{mode === "direct" ? "La primera canica gana" : "La primera canica sale"}</small></span>
              </button>
              <button type="button" role="radio" aria-checked={marbleFinishRule === "last"} className={marbleFinishRule === "last" ? "is-active" : ""} onClick={() => setMarbleFinishRule("last")}>
                <Flag size={19} /><span><strong>Último</strong><small>{mode === "direct" ? "La última canica gana" : "La última canica sale"}</small></span>
              </button>
            </div>
            <div className="direct-rule-preview marbles-rule-preview">
              <Gem size={17} />
              <p>Fácil usa un recorrido corto; Media amplía mapa y altura; Difícil añade más niveles, trampas y eventos extremos.</p>
            </div>
          </div>
        )}

        {game === "ducks" && (
          <div className="direct-rule-preview ducks-rule-preview">
            <Bird size={17} />
            <p>El superviviente y el orden de impactos se comprometen antes de soltar la bandada. Cada acierto solo revela y representa el siguiente impacto oficial.</p>
          </div>
        )}

        {mode === "direct" && game !== "ducks" && (
          <div className="direct-rule-preview">
            <Trophy size={17} />
            <p>Cada ganador queda fuera de las siguientes rondas hasta que pulses “Volver a incluir”. Sus premios se guardan aunque cambies de juego o de modo.</p>
          </div>
        )}

        <label className="prize-input prize-input--setup">
          <span>Premio de la siguiente tirada</span>
          <input
            value={prize}
            onChange={(event) => setPrize(event.target.value.slice(0, 60))}
            placeholder="Ej. Cena para dos"
          />
        </label>
      </section>
    </div>
  );
}
