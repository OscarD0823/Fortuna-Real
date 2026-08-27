import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bird,
  Check,
  CircleDot,
  Gamepad2,
  Gem,
  Layers3,
  Lightbulb,
  Plus,
  Volume2,
  X,
} from "lucide-react";
import type { GameId } from "../../core/types";
import { fortunaAudio } from "../audio/audioEngine";
import { gameGuides } from "./tutorialContent";
import { useTutorialDialog } from "./useTutorialDialog";

const demoGames: GameId[] = ["roulette", "cards", "pinball", "marbles", "ducks"];
const gameIcons = {
  roulette: CircleDot,
  cards: Layers3,
  pinball: Gamepad2,
  marbles: Gem,
  ducks: Bird,
};

const demoPeople = ["Ana", "Bruno", "Camila", "Diego"];

function ParticipantPractice() {
  const [name, setName] = useState("");
  const [names, setNames] = useState(["Ana", "Bruno"]);
  const [notice, setNotice] = useState("Prueba con un nombre. Esta lista no se guarda.");
  const addExampleName = () => {
    const clean = name.trim();
    if (!clean || names.length >= 5) return;
    if (names.some((item) => item.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      setNotice("Ese nombre ya está en este ejemplo. Prueba con otro.");
      return;
    }
    setNames((items) => [...items, clean]);
    setName("");
    setNotice(`${clean} agregado al ejemplo. ¡Así de fácil!`);
  };
  return (
    <div className="game-demo-scene demo-participant-practice">
      <span className="demo-example-label">PRÁCTICA · NO MODIFICA TU SORTEO</span>
      <h4>Una persona, un lugar en el juego</h4>
      <form onSubmit={(event) => {
        event.preventDefault();
        addExampleName();
      }}>
        <input aria-label="Nombre de prueba, no se guarda" placeholder="Escribe un nombre de prueba" value={name} maxLength={32} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            addExampleName();
          }
        }} disabled={names.length >= 5} />
        <button type="submit" aria-label="Agregar nombre al ejemplo" disabled={!name.trim() || names.length >= 5}><Plus size={18} /></button>
      </form>
      <div className="demo-practice-names">{names.map((item, index) => <span key={item}><i>{index + 1}</i>{item}</span>)}</div>
      <small role="status">{notice}</small>
    </div>
  );
}

function CardPractice({ step }: { step: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const faces = ["A ♥", "K ♠", "Q ♦", "J ♣"];
  return (
    <div className={`game-demo-scene demo-cards demo-step-${step} ${selected !== null ? "has-selection" : ""}`}>
      <span className="demo-example-label">CARTAS DE EJEMPLO · NO REGISTRA RESULTADOS</span>
      <div className="demo-cards__hand">
        {demoPeople.map((person, index) => {
          const revealed = step === 0 || (step === 3 && index === 1) || selected === index;
          const faceIndex = step === 0 ? index : 1;
          return <button type="button" className={`demo-card ${revealed ? "is-revealed" : ""}`} key={person} disabled={step !== 2 || selected !== null} onClick={() => setSelected(index)} aria-label={revealed ? `${faces[faceIndex]} de ${demoPeople[faceIndex]}, ejemplo` : `Elegir carta de ejemplo ${index + 1}`}><strong>{revealed ? faces[faceIndex] : "?"}</strong>{revealed && <small>{demoPeople[faceIndex]}</small>}</button>;
        })}
      </div>
      <small className="demo-card-instruction" role="status">{selected !== null ? "Ejemplo revelado: Bruno. Cualquier posición revela el mismo resultado de ejemplo." : step === 2 ? "Toca un reverso para practicar cómo se revela una carta." : step === 0 ? "Cada persona tiene una carta. Primero puedes comprobarlas." : step === 1 ? "Las cartas se reúnen y se barajan antes de elegir." : "El anuncio oficial muestra el nombre y actualiza el historial."}</small>
    </div>
  );
}

function DemoScene({ game, step }: { game: GameId; step: number }) {
  if (game === "roulette") {
    if (step === 0) return <ParticipantPractice />;
    return <div className={`game-demo-scene demo-roulette demo-step-${step}`} aria-hidden="true"><div className="demo-roster"><i /><i /><i /><i /></div><div className="demo-wheel"><span /></div><div className="demo-result-token">7</div></div>;
  }
  if (game === "cards") {
    return <CardPractice step={step} />;
  }
  if (game === "pinball") {
    return <div className={`game-demo-scene demo-pinball demo-step-${step}`} aria-hidden="true"><div className="demo-pinball-rail" /><i /><i /><i /><div className="demo-flipper demo-flipper--left" /><div className="demo-flipper demo-flipper--right" /></div>;
  }
  if (game === "marbles") {
    return <div className={`game-demo-scene demo-marbles demo-step-${step}`} aria-hidden="true"><div className="demo-track" /><i /><i /><i /><span className="demo-power">✦</span></div>;
  }
  return <div className={`game-demo-scene demo-ducks demo-step-${step}`} aria-hidden="true"><div className="demo-trees"><i /><i /><i /><i /></div><div className="demo-grass" /><span className="demo-duck">◆</span><span className="demo-duck">◆</span><span className="demo-duck">◆</span></div>;
}

export function GameDemoModal({ initialGame, onDone, canNarrate }: { initialGame: GameId; onDone: () => void; canNarrate: boolean }) {
  const [game, setGame] = useState(initialGame);
  const [stepIndex, setStepIndex] = useState(0);
  const guide = gameGuides[game];
  const step = guide.steps[stepIndex];
  const isLast = stepIndex === guide.steps.length - 1;

  const { dialogRef, onKeyDown, onKeyUp } = useTutorialDialog<HTMLElement>(
    `${game}-${stepIndex}`,
    onDone,
    (direction) => setStepIndex((index) => Math.max(0, Math.min(guide.steps.length - 1, index + direction))),
  );

  const Icon = gameIcons[game];
  const changeGame = (nextGame: GameId) => {
    setGame(nextGame);
    setStepIndex(0);
    fortunaAudio.playClick();
  };

  return (
    <div className="game-demo-backdrop" role="presentation">
      <section ref={dialogRef} className="game-demo-modal" role="dialog" aria-modal="true" aria-labelledby="game-demo-title" tabIndex={-1} onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
        <header>
          <div className="game-demo-modal__title">
            <span><Icon size={25} /></span>
            <div><small>DEMOSTRACIÓN INTERACTIVA</small><h2 id="game-demo-title">{guide.title}</h2></div>
            <em className={guide.beta ? "is-beta" : ""}>{guide.badge}</em>
          </div>
          <button type="button" onClick={onDone} aria-label="Cerrar demostración"><X size={20} /></button>
        </header>

        <nav className="game-demo-tabs" aria-label="Elegir demostración de juego">
          {demoGames.map((item) => {
            const TabIcon = gameIcons[item];
            return <button type="button" aria-label={`Demo de ${gameGuides[item].title}`} aria-pressed={item === game} title={gameGuides[item].title} className={item === game ? "is-active" : ""} onClick={() => changeGame(item)} key={item}><TabIcon size={16} /><span>{gameGuides[item].title}</span>{gameGuides[item].beta && <small>BETA</small>}</button>;
          })}
        </nav>

        <div className="game-demo-modal__content">
          <div className="game-demo-visual-wrap">
            <DemoScene key={`${game}-${stepIndex}`} game={game} step={stepIndex} />
            <div className="game-demo-caption"><Icon size={17} /><span>{guide.summary}</span></div>
          </div>
          <div className="game-demo-copy" aria-live="polite">
            <span className="game-demo-copy__counter">PASO {stepIndex + 1} DE {guide.steps.length}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <div className="game-demo-copy__action"><Lightbulb size={17} /><span><strong>Qué hacer:</strong> {step.action}</span></div>
            <div className="game-demo-copy__progress">
              {guide.steps.map((item, index) => <button type="button" className={index === stepIndex ? "is-active" : index < stepIndex ? "is-complete" : ""} onClick={() => setStepIndex(index)} aria-label={`Ir al paso ${index + 1}: ${item.title}`} key={item.title}>{index < stepIndex ? <Check size={13} /> : index + 1}</button>)}
            </div>
          </div>
        </div>

        <footer>
          <button type="button" className="game-demo-listen" disabled={!canNarrate} title={canNarrate ? "Escuchar este paso" : "Activa la locución y sube el volumen en la barra superior"} onClick={() => fortunaAudio.speakGuide(`${guide.title}. Paso ${stepIndex + 1}. ${step.title}. ${step.description} ${step.action}`)}><Volume2 size={17} /> Escuchar paso</button>
          <span />
          <button type="button" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0}><ArrowLeft size={17} /> Anterior</button>
          <button type="button" className="game-demo-next" onClick={() => isLast ? onDone() : setStepIndex((index) => index + 1)}>{isLast ? <><Check size={17} /> Entendido, empezar</> : <>Siguiente <ArrowRight size={17} /></>}</button>
        </footer>
      </section>
    </div>
  );
}
