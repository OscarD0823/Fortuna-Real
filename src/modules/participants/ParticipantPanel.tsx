import { useState } from "react";
import { ClipboardPaste, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useDrawStore } from "./drawStore";

export function ParticipantPanel() {
  const [name, setName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [notice, setNotice] = useState("");
  const participants = useDrawStore((state) => state.participants);
  const eliminatedIds = useDrawStore((state) => state.eliminatedIds);
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
        (outcome.skipped ? ` · ${outcome.skipped} repetido${outcome.skipped === 1 ? "" : "s"}` : ""),
    );
    if (outcome.added) {
      setBulkText("");
      setShowBulk(false);
    }
  };

  return (
    <section className="panel participant-panel">
      <div className="section-heading">
        <span className="step-number">1</span>
        <div>
          <h2>Participantes</h2>
          <p>Agrega o pega los nombres</p>
        </div>
        <span className="count-pill"><Users size={14} /> {participants.length}</span>
      </div>

      <form
        className="name-entry"
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
        <button type="submit" aria-label="Agregar participante" disabled={!name.trim()}>
          <Plus size={18} />
        </button>
      </form>

      <div className="participant-actions">
        <button type="button" onClick={() => setShowBulk((visible) => !visible)}>
          <ClipboardPaste size={16} /> Pegar lista
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
          <Trash2 size={15} /> Limpiar
        </button>
      </div>

      {showBulk && (
        <div className="bulk-entry">
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={'Pega nombres separados por comas o líneas:\nLaura\nSantiago\nMariana'}
            autoFocus
          />
          <div>
            <button type="button" onClick={() => setShowBulk(false)}>Cancelar</button>
            <button type="button" className="primary-small" onClick={addBulk} disabled={!bulkText.trim()}>
              Agregar nombres
            </button>
          </div>
        </div>
      )}

      {notice && <div className="inline-notice" role="status">{notice}</div>}

      <div className="participant-list" aria-label="Lista de participantes">
        {participants.length === 0 ? (
          <div className="participant-empty">Tu lista está vacía.</div>
        ) : (
          participants.slice(0, 6).map((person) => (
            <div
              className={`participant-chip ${eliminatedIds.includes(person.id) ? "is-eliminated" : ""}`}
              key={person.id}
            >
              <span style={{ background: person.color }} />
              <strong>{person.name}</strong>
              {eliminatedIds.includes(person.id) && <em>fuera</em>}
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
        {participants.length > 6 && (
          <div className="more-participants">+ {participants.length - 6} nombres más</div>
        )}
      </div>
    </section>
  );
}
