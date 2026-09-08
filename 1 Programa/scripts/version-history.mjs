import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const programFile = path => new URL(`../${path}`, import.meta.url);
const read = path => readFileSync(programFile(path), "utf8").replace(/^\uFEFF/u, "").replace(/\r\n/gu, "\n");
const history = JSON.parse(read("src/shared/releases/versionHistory.json"));
const version = JSON.parse(read("package.json")).version;
assert.ok(Array.isArray(history) && history.length > 0);
assert.equal(history[0].version, version, "Falta el historial de la versión actual en src/shared/releases/versionHistory.json.");
const compareVersions = (a, b) => {
  const first = a.split(".").map(Number), second = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (first[i] !== second[i]) return first[i] - second[i];
  return 0;
};
const versions = new Set();
for (const [index, entry] of history.entries()) {
  assert.match(entry.version, /^\d+\.\d+\.\d+$/u);
  assert.ok(!versions.has(entry.version), `Versión duplicada: ${entry.version}`);
  versions.add(entry.version);
  if (index > 0) assert.ok(compareVersions(history[index - 1].version, entry.version) > 0, "El historial debe ordenarse por versión, de mayor a menor.");
  assert.ok(entry.title.length > 8 && typeof entry.notice === "string");
  if (entry.date) assert.ok(/^\d{4}-\d{2}-\d{2}$/u.test(entry.date) && Number.isFinite(Date.parse(`${entry.date}T00:00:00Z`)));
  else assert.ok(entry.notice.length > 30, "Una fecha desconocida requiere una explicación.");
  if (entry.source) {
    const source = new URL(entry.source);
    assert.equal(source.protocol, "https:");
    assert.equal(source.hostname, "github.com");
    assert.ok(source.pathname.startsWith("/OscarD0823/Fortuna-Real/"));
  }
  assert.ok(entry.groups.length > 0);
  for (const group of entry.groups) {
    assert.ok(group.title.length > 2 && group.items.length > 0);
    assert.ok(group.items.every(item => typeof item === "string" && item.length > 15));
    assert.equal(new Set(group.items).size, group.items.length);
  }
}
const renderEntry = (entry, index, level) => {
  const previous = history[index + 1]?.version;
  const title = `${previous ? `${previous} → ${entry.version}` : entry.version} — ${entry.title}`;
  return `${"#".repeat(level)} ${title}\n\n${entry.date ? `Fecha: ${entry.date}.` : "Fecha no confirmada."}${entry.version === version ? " Versión actual del código." : ""}\n\n`
    + (entry.notice ? `${entry.notice}\n\n` : "")
    + entry.groups.map(group => `${"#".repeat(level + 1)} ${group.title}\n\n${group.items.map(item => `- ${item}`).join("\n")}\n`).join("\n")
    + (entry.source ? `\n[Registro original de esta versión](${entry.source}).\n` : "");
};
const start = "<!-- VERSION-HISTORY:START -->";
const end = "<!-- VERSION-HISTORY:END -->";
const readme = read("../README.md");
assert.equal(readme.split(start).length, 2, "Falta un marcador único de inicio del historial en README.");
assert.equal(readme.split(end).length, 2, "Falta un marcador único de final del historial en README.");
const renderedHistory = `## Historial de cambios\n\nVersión actual del código: **${version}**. También disponible desde **Novedades** dentro del programa, sin conexión.\n\nLos cambios se resumen por función; los enlaces llevan al registro original. Las fechas de Releases usan el día de publicación en Colombia. Las versiones sin un Release conservado lo indican expresamente.\n\n${history.map((entry, index) => renderEntry(entry, index, 3)).join("\n")}`;
const expectedReadme = readme.slice(0, readme.indexOf(start) + start.length) + `\n${renderedHistory}\n` + readme.slice(readme.indexOf(end));
const notes = `# Fortuna Real ${version}\n\n${renderEntry(history[0], 0, 2)}`;
if (process.argv.includes("--write")) {
  writeFileSync(programFile("../README.md"), expectedReadme, "utf8");
  writeFileSync(programFile(`NOTAS-VERSION-${version}.md`), notes, "utf8");
} else {
  assert.equal(readme, expectedReadme, "El README no coincide con el historial: ejecuta npm run historial:actualizar.");
  assert.equal(read(`NOTAS-VERSION-${version}.md`), notes, "Las notas no coinciden con el historial: ejecuta npm run historial:actualizar.");
}
const app = read("src/App.tsx"), dialog = read("src/shared/releases/ReleaseHistory.tsx"), builder = read("crear-instalador.ps1");
for (const required of ["showVersions", "onOpenVersions", "versionsDisabled", "<ReleaseHistory"]) assert.ok(app.includes(required));
assert.ok(/blocked=\{[^}]*showVersions/u.test(app), "El actualizador no debe interrumpir el historial.");
for (const required of ["versionHistory.json", "showModal()", "onCancel", "previousFocus?.focus()", "Buscar en el historial de versiones", 'role="status"']) assert.ok(dialog.includes(required));
assert.ok(builder.includes("notes = $versionNotes") && builder.includes("--notes-file $versionNotesPath"), "El actualizador y el Release deben usar las notas reales.");
const updater = read("src/shared/components/AppUpdater.tsx");
assert.ok(updater.includes('<details className="update-changes">') && updater.includes('<pre className="update-notes">{notes}</pre>'), "Las notas deben poder desplegarse también durante la descarga, como texto seguro.");
console.log(JSON.stringify({ version, versions: history.length, sharedReadmeAndAppHistory: true, offlineHistory: true, missingHistoricalNotesDisclosed: true, releaseNotesInUpdater: true }));
