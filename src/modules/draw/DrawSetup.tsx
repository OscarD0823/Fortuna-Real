import {
  CircleDot,
  Gem,
  Layers3,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useDrawStore } from "../participants/drawStore";

export function DrawSetup() {
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const setMode = useDrawStore((state) => state.setMode);
  const setPrize = useDrawStore((state) => state.setPrize);

  return (
    <div className="setup-options-stack">
      <section className="panel setup-choice-panel">
        <div className="section-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Elegir juego</h2>
            <p>La ruleta es el primer juego disponible</p>
          </div>
        </div>
        <div className="game-options game-options--large">
          <button type="button" className="game-option is-active">
            <CircleDot size={30} />
            <span>Ruleta casino</span>
            <small>Disponible</small>
          </button>
          <button type="button" className="game-option" disabled title="Próximamente">
            <Gem size={29} />
            <span>Canicas</span>
            <small>Próximamente</small>
          </button>
          <button type="button" className="game-option" disabled title="Próximamente">
            <Layers3 size={29} />
            <span>Cartas</span>
            <small>Próximamente</small>
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
              <small>Incluye las casillas PAR e IMPAR</small>
            </span>
          </button>
        </div>

        {mode === "elimination" && (
          <div className="casino-rule-preview elimination-rule-preview">
            <span className="parity-token parity-token--even">PAR</span>
                <p>Si cae en PAR, la siguiente tirada elimina un solo número par y después vuelven todos los demás.</p>
            <span className="parity-token parity-token--odd">IMPAR</span>
                <p>IMPAR hace lo mismo con los impares. Con N jugadores verás exactamente N + 2 casillas.</p>
          </div>
        )}

        {mode === "direct" && (
          <div className="direct-rule-preview">
            <Trophy size={17} />
            <p>Cada ganador queda fuera de las siguientes tiradas hasta que pulses “Volver a incluir”. Sus premios se guardan aunque cambies de modo.</p>
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
