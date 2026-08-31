import { useState } from "react";
import {
  ClipboardPaste,
  ListChecks,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  MAX_PARTICIPANTS,
  MAX_PARTICIPANT_NAME_LENGTH,
  useDrawStore,
} from "./drawStore";

export function ParticipantPanel() {
  const [name, setName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const participants = useDrawStore((state) => state.participants);
  const game = useDrawStore((state) => state.game);
  const addNames = useDrawStore((state) => state.addNames);
  const removeParticipant = useDrawStore((state) => state.removeParticipant);
  const clearParticipants = useDrawStore((state) => state.clearParticipants);
  const isFull = participants.length >= MAX_PARTICIPANTS;
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const visibleParticipants = normalizedQuery
    ? participants.filter((participant) => participant.name.toLocaleLowerCase("es").includes(normalizedQuery))
    : participants;

  const addSingle = () => {
    const outcome = addNames([name]);
    if (outcome.added) {
      setName("");
      setNotice("Participante agregado");
    } else if (outcome.rejectedCapacity) {
      setNotice(`Límite alcanzado: máximo ${MAX_PARTICIPANTS} participantes`);
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
          : "")
        + (outcome.rejectedCapacity
          ? ` · ${outcome.rejectedCapacity} no agregado${outcome.rejectedCapacity === 1 ? "" : "s"} por el límite de ${MAX_PARTICIPANTS}`
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
          <p>
            {game === "roulette"
              ? "Sin casillas vacías: la rueda se adapta a cada lista"
              : game === "cards"
                ? "Cada nombre recibe una carta visible antes de barajar"
                : game === "pinball"
                  ? "Cada nombre recibe una pelota numerada en la mesa 3D"
                  : game === "marbles"
                    ? "Cada nombre recibe una canica identificada en la carrera"
                    : "Cada nombre recibe una ficha de pato con tres vidas"}
          </p>
        </div>
        <span className="count-pill">
          <Users size={14} /> {participants.length}/{MAX_PARTICIPANTS}
        </span>
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
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addSingle();
            }
          }}
          placeholder="Escribe un nombre"
          maxLength={MAX_PARTICIPANT_NAME_LENGTH}
          aria-label="Nombre del participante"
        />
        <button
          type="submit"
          aria-label="Agregar participante"
          disabled={!name.trim() || isFull}
        >
          <Plus size={18} />
        </button>
      </form>

      <div className="participant-actions setup-participant-actions">
        <button
          type="button"
          onClick={() => setShowBulk((visible) => !visible)}
          aria-expanded={showBulk}
          aria-controls="participant-bulk-entry"
          disabled={isFull}
        >
          <ClipboardPaste size={16} /> Pegar varios nombres
        </button>
        <button
          type="button"
          className="danger-link"
          onClick={() => {
            if (!window.confirm("¿Vaciar la lista de participantes? El historial de ganadores se conservará.")) return;
            clearParticipants();
            setNotice("Lista vacía · historial de ganadores conservado");
          }}
          disabled={participants.length === 0}
        >
          <Trash2 size={15} /> Limpiar lista
        </button>
      </div>

      {showBulk && (
        <div id="participant-bulk-entry" className="bulk-entry setup-bulk-entry">
          <textarea
            aria-label="Lista de nombres separados por comas o saltos de línea"
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={'Pega nombres separados por comas o líneas:\nLaura\nSantiago\nMariana'}
            maxLength={MAX_PARTICIPANTS * (MAX_PARTICIPANT_NAME_LENGTH + 1)}
            autoFocus
          />
          <div>
            <button type="button" onClick={() => setShowBulk(false)}>Cancelar</button>
            <button
              type="button"
              className="primary-small"
              onClick={addBulk}
              disabled={!bulkText.trim() || isFull}
            >
              Agregar nombres
            </button>
          </div>
        </div>
      )}

      {notice && <div className="inline-notice" role="status">{notice}</div>}

      <div className="full-roster-heading">
        <span><ListChecks size={15} /> Lista completa</span>
        <small>{normalizedQuery ? `${visibleParticipants.length} coincidencia${visibleParticipants.length === 1 ? "" : "s"}` : `${participants.length} en total`}</small>
      </div>
      {participants.length >= 10 && (
        <label className="participant-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Buscar participante</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar participante por nombre"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
              <X size={13} />
            </button>
          )}
        </label>
      )}
      <div className="participant-list participant-list--full" aria-label="Lista completa de participantes">
        {participants.length === 0 ? (
          <div className="participant-empty">
            <Users size={30} />
            <strong>Aún no hay participantes</strong>
            <span>Escribe un nombre o pega una lista completa.</span>
          </div>
        ) : visibleParticipants.length === 0 ? (
          <div className="participant-empty participant-empty--search">
            <Search size={27} />
            <strong>Sin coincidencias</strong>
            <span>Prueba con otra parte del nombre.</span>
          </div>
        ) : (
          visibleParticipants.map((person) => {
            const participantIndex = participants.findIndex((participant) => participant.id === person.id);
            return (
            <div className="participant-chip participant-chip--setup" key={person.id}>
              <span className="participant-order">{participantIndex + 1}</span>
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
            );
          })
        )}
      </div>
    </section>
  );
}
