import {
  Bird,
  Bot,
  CircleDot,
  Gem,
  Gamepad2,
  Layers3,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useDrawStore } from "../participants/drawStore";

export function DrawSetup() {
  const game = useDrawStore((state) => state.game);
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const pinballControlMode = useDrawStore((state) => state.pinballControlMode);
  const setGame = useDrawStore((state) => state.setGame);
  const setMode = useDrawStore((state) => state.setMode);
  const setPrize = useDrawStore((state) => state.setPrize);
  const setPinballControlMode = useDrawStore((state) => state.setPinballControlMode);

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
            className={`game-option ${game === "pinball" ? "is-active" : ""}`}
            onClick={() => setGame("pinball")}
          >
            <Gamepad2 size={29} />
            <span>Pinball 3D</span>
            <small>Nuevo</small>
          </button>
          <button
            type="button"
            className={`game-option ${game === "marbles" ? "is-active" : ""}`}
            onClick={() => setGame("marbles")}
          >
            <Gem size={29} />
            <span>Canicas</span>
            <small>3D procedural</small>
          </button>
          <button
            type="button"
            className={`game-option game-option--ducks ${game === "ducks" ? "is-active" : ""}`}
            onClick={() => {
              setGame("ducks");
              setMode("elimination");
            }}
          >
            <Bird size={29} />
            <span>Patos 3D</span>
            <small>Supervivencia</small>
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
            className={mode === "elimination" ? "is-active" : ""}
            onClick={() => setMode("elimination")}
          >
            <UsersRound size={22} />
            <span>
              <strong>Eliminación</strong>
              <small>{game === "roulette" ? "Incluye las casillas PAR e IMPAR" : game === "pinball" ? "La primera pelota que cruza la meta sale" : game === "marbles" ? "La última canica queda eliminada" : game === "ducks" ? "Tres vidas; gana el último en pie" : "Una carta sale en cada ronda"}</small>
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

        {game === "pinball" && (
          <div className="pinball-control-choice">
            <div className="pinball-control-choice__heading">
              <Gamepad2 size={17} />
              <span><strong>Control de la mesa</strong><small>En manual, tus flippers sí influyen en la carrera física.</small></span>
            </div>
            <div className="pinball-control-choice__options">
              <button type="button" className={pinballControlMode === "automatic" ? "is-active" : ""} onClick={() => setPinballControlMode("automatic")}>
                <Bot size={20} /><span><strong>Automático</strong><small>La mesa lanza y acciona los flippers</small></span>
              </button>
              <button type="button" className={pinballControlMode === "manual" ? "is-active" : ""} onClick={() => setPinballControlMode("manual")}>
                <Gamepad2 size={20} /><span><strong>Manual</strong><small>Juega con teclado o controles en pantalla</small></span>
              </button>
            </div>
          </div>
        )}

        {mode === "elimination" && game === "pinball" && (
          <div className="direct-rule-preview pinball-rule-preview">
            <Gamepad2 size={17} />
            <p>Todas las pelotas representan a los participantes. La primera que cruza entre los flippers queda eliminada y la siguiente ronda crea otra distribución.</p>
          </div>
        )}

        {game === "marbles" && (
          <div className="direct-rule-preview marbles-rule-preview">
            <Gem size={17} />
            <p>La pista 3D se genera por módulos. Trampas, poderes, elevaciones y curvas cambian con cada semilla.</p>
          </div>
        )}

        {game === "ducks" && (
          <div className="direct-rule-preview ducks-rule-preview">
            <Bird size={17} />
            <p>Cada pato tiene tres vidas. Al impactarlo se revela su nombre, toda la bandada aterriza y despega en otra formación. Con menos vidas volará más rápido.</p>
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
