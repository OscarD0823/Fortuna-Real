import {
  CircleDot,
  Flame,
  Gem,
  Gauge,
  Layers3,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useDrawStore } from "../participants/drawStore";

export function DrawSetup() {
  const game = useDrawStore((state) => state.game);
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const marbleDifficulty = useDrawStore((state) => state.marbleDifficulty);
  const setGame = useDrawStore((state) => state.setGame);
  const setMode = useDrawStore((state) => state.setMode);
  const setPrize = useDrawStore((state) => state.setPrize);
  const setMarbleDifficulty = useDrawStore((state) => state.setMarbleDifficulty);

  return (
    <div className="setup-options-stack">
      <section className="panel setup-choice-panel">
        <div className="section-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Elegir juego</h2>
            <p>Ruleta, cartas o carrera de canicas</p>
          </div>
        </div>
        <div className="game-options game-options--large">
          <button
            type="button"
            className={`game-option ${game === "roulette" ? "is-active" : ""}`}
            onClick={() => setGame("roulette")}
          >
            <CircleDot size={30} />
            <span>Ruleta casino</span>
            <small>Disponible</small>
          </button>
          <button
            type="button"
            className={`game-option ${game === "cards" ? "is-active" : ""}`}
            onClick={() => setGame("cards")}
          >
            <Layers3 size={29} />
            <span>Cartas</span>
            <small>Disponible</small>
          </button>
          <button
            type="button"
            className={`game-option ${game === "marbles" ? "is-active" : ""}`}
            onClick={() => setGame("marbles")}
          >
            <Gem size={29} />
            <span>Canicas</span>
            <small>Disponible</small>
          </button>
        </div>
      </section>

      <section className="panel setup-choice-panel mode-choice-panel">
        <div className="section-heading">
          <span className="step-number">3</span>
          <div>
            <h2>Elegir modo</h2>
            <p>Define cómo se resolverá cada tirada</p>
          </div>
        </div>
        <div className="mode-options mode-options--two">
          <button
            type="button"
            className={mode === "direct" ? "is-active" : ""}
            onClick={() => setMode("direct")}
          >
            <Trophy size={22} />
            <span>
              <strong>Ganador directo</strong>
              <small>Varios premios sin repetir ganador</small>
            </span>
          </button>
          <button
            type="button"
            className={mode === "elimination" ? "is-active" : ""}
            onClick={() => setMode("elimination")}
          >
            <UsersRound size={22} />
            <span>
              <strong>Eliminación</strong>
              <small>
                {game === "roulette"
                  ? "Incluye las casillas PAR e IMPAR"
                  : game === "cards"
                    ? "Una carta sale en cada ronda"
                    : "La última canica queda eliminada"}
              </small>
            </span>
          </button>
        </div>

        {mode === "elimination" && game === "roulette" && (
          <div className="casino-rule-preview elimination-rule-preview">
            <span className="parity-token parity-token--even">PAR</span>
                <p>Si cae en PAR, la siguiente tirada elimina un solo número par y después vuelven todos los demás.</p>
            <span className="parity-token parity-token--odd">IMPAR</span>
                <p>IMPAR hace lo mismo con los impares. Con N jugadores verás exactamente N + 2 casillas.</p>
          </div>
        )}

        {mode === "elimination" && game === "cards" && (
          <div className="direct-rule-preview cards-rule-preview">
            <Layers3 size={17} />
            <p>Las cartas se muestran, se reúnen, se barajan y se reparten boca abajo. La carta elegida elimina a una sola persona; el mazo se reconstruye con quienes continúan.</p>
          </div>
        )}

        {mode === "elimination" && game === "marbles" && (
          <div className="direct-rule-preview marbles-rule-preview">
            <Gem size={17} />
            <p>La última canica en cruzar queda eliminada. Cada ronda genera otra pista con obstáculos y poderes automáticos.</p>
          </div>
        )}

        {game === "marbles" && (
          <div className="marble-setup-difficulty">
            <div className="marble-setup-difficulty__heading">
              <Gauge size={17} />
              <span><strong>Dificultad de la pista</strong><small>Controla secciones, trampas y poderes automáticos</small></span>
            </div>
            <div className="marble-setup-difficulty__options">
              <button
                type="button"
                className={marbleDifficulty === "easy" ? "is-active" : ""}
                onClick={() => setMarbleDifficulty("easy")}
              >
                <ShieldCheck size={17} /><strong>Fácil</strong><small>1–2 trampas · 1 poder</small>
              </button>
              <button
                type="button"
                className={marbleDifficulty === "medium" ? "is-active" : ""}
                onClick={() => setMarbleDifficulty("medium")}
              >
                <Gauge size={17} /><strong>Media</strong><small>4–6 trampas · 4 poderes</small>
              </button>
              <button
                type="button"
                className={marbleDifficulty === "hard" ? "is-active" : ""}
                onClick={() => setMarbleDifficulty("hard")}
              >
                <Flame size={17} /><strong>Difícil</strong><small>8–10 trampas · 7 poderes</small>
              </button>
            </div>
          </div>
        )}

        {mode === "direct" && (
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
