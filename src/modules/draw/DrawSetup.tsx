import { CircleDot, Gem, Layers3, Trophy, UsersRound } from "lucide-react";
import { useDrawStore } from "../participants/drawStore";

export function DrawSetup() {
  const mode = useDrawStore((state) => state.mode);
  const prize = useDrawStore((state) => state.prize);
  const setMode = useDrawStore((state) => state.setMode);
  const setPrize = useDrawStore((state) => state.setPrize);

  return (
    <section className="panel setup-panel">
      <div className="section-heading section-heading--compact">
        <span className="step-number">2</span>
        <div><h2>Elegir juego</h2></div>
      </div>
      <div className="game-options">
        <button type="button" className="game-option is-active">
          <CircleDot size={23} />
          <span>Ruleta</span>
        </button>
        <button type="button" className="game-option" disabled title="Próximamente">
          <Gem size={22} />
          <span>Canicas</span>
          <small>Pronto</small>
        </button>
        <button type="button" className="game-option" disabled title="Próximamente">
          <Layers3 size={22} />
          <span>Cartas</span>
          <small>Pronto</small>
        </button>
      </div>

      <div className="section-heading section-heading--compact mode-heading">
        <span className="step-number">3</span>
        <div><h2>Modo y premio</h2></div>
      </div>
      <div className="mode-options">
        <button
          type="button"
          className={mode === "direct" ? "is-active" : ""}
          onClick={() => setMode("direct")}
        >
          <Trophy size={18} />
          <span><strong>Ganador</strong><small>Un resultado directo</small></span>
        </button>
        <button
          type="button"
          className={mode === "elimination" ? "is-active" : ""}
          onClick={() => setMode("elimination")}
        >
          <UsersRound size={18} />
          <span><strong>Eliminación</strong><small>Hasta dejar uno</small></span>
        </button>
      </div>

      <label className="prize-input">
        <span>Premio</span>
        <input
          value={prize}
          onChange={(event) => setPrize(event.target.value.slice(0, 60))}
          placeholder="Ej. Cena para dos"
        />
      </label>
    </section>
  );
}
