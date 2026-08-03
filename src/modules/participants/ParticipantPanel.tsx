import { useState } from "react";
import {
  ClipboardPaste,
  ListChecks,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useDrawStore } from "./drawStore";

export function ParticipantPanel() {
  const [name, setName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [notice, setNotice] = useState("");
  const participants = useDrawStore((state) => state.participants);
  const game = useDrawStore((state) => state.game);
  const addNames = useDrawStore((state) => state.addNames);
  const removeParticipant = useDrawStore((state) => state.removeParticipant);
  const clearParticipants = useDrawStore((state) => state.clearParticipants);

  const addSingle = () => {
    const outcome = addNames([name]);
    if (outcome.added) {
      setName("");
      setNotice("Participante agregado");
    } else if (name.trim()) {
      setNotice("Ese nombre ya está en la lista");
    }
  };

  const addBulk = () => {
    const outcome = addNames(bulkText.split(/[\n,;]+/));
    setNotice(
      `${outcome.added} agregado${outcome.added === 1 ? "" : "s"}` +
        (outcome.skipped
          ? ` · ${outcome.skipped} repetido${outcome.skipped === 1 ? "" : "s"}`
          : ""),
    );
    if (outcome.added) {
      setBulkText("");
      setShowBulk(false);
    }
  };

  return (
    <section className="panel participant-panel setup-participants">
      <div className="section-heading">
        <span className="step-number">1</span>
        <div>
          <h2>Cargar participantes</h2>
          <p>{game === "roulette" ? "Sin casillas vacías: la rueda se adapta a cada lista" : "Cada nombre recibe una carta visible antes de barajar"}</p>
        </div>
        <span className="count-pill"><Users size={14} /> {participants.length}</span>
      </div>

      <form
        className="name-entry setup-name-entry"
        onSubmit={(event) => {
          event.preventDefault();
          addSingle();
        }}
      >
        <UserPlus size={18} />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Escribe un nombre"
          maxLength={42}
          aria-label="Nombre del participante"
        />
        <button
          type="submit"
          aria-label="Agregar participante"
          disabled={!name.trim()}
        >
          <Plus size={18} />
        </button>
      </form>

      <div className="participant-actions setup-participant-actions">
        <button type="button" onClick={() => setShowBulk((visible) => !visible)}>
          <ClipboardPaste size={16} /> Pegar varios nombres
        </button>
        <button
          type="button"
          className="danger-link"
          onClick={() => {
            clearParticipants();
            setNotice("Lista vacía");
          }}
          disabled={participants.length === 0}
        >
          <Trash2 size={15} /> Limpiar lista
        </button>
      </div>

      {showBulk && (
        <div className="bulk-entry setup-bulk-entry">
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={'Pega nombres separados por comas o líneas:\nLaura\nSantiago\nMariana'}
            autoFocus
          />
          <div>
            <button type="button" onClick={() => setShowBulk(false)}>Cancelar</button>
            <button
              type="button"
              className="primary-small"
              onClick={addBulk}
              disabled={!bulkText.trim()}
            >
              Agregar nombres
            </button>
          </div>
        </div>
      )}

      {notice && <div className="inline-notice" role="status">{notice}</div>}

      <div className="full-roster-heading">
        <span><ListChecks size={15} /> Lista completa</span>
        <small>{participants.length} en total</small>
      </div>
      <div className="participant-list participant-list--full" aria-label="Lista completa de participantes">
        {participants.length === 0 ? (
          <div className="participant-empty">
            <Users size={30} />
            <strong>Aún no hay participantes</strong>
            <span>Escribe un nombre o pega una lista completa.</span>
          </div>
        ) : (
          participants.map((person, index) => (
            <div className="participant-chip participant-chip--setup" key={person.id}>
              <span className="participant-order">{index + 1}</span>
              <i style={{ background: person.color }} />
              <strong title={person.name}>{person.name}</strong>
              <button
                type="button"
                aria-label={`Eliminar a ${person.name}`}
                onClick={() => removeParticipant(person.id)}
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
