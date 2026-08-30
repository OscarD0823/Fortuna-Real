import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function dependencyFingerprint(lock) {
  const dependencies = structuredClone(lock);
  dependencies.version = "product-version";
  if (!dependencies.packages?.[""]) throw new Error("package-lock.json no contiene el paquete raíz.");
  dependencies.packages[""].version = "product-version";
  return createHash("sha256").update(JSON.stringify(dependencies)).digest("hex").toUpperCase();
}

if (process.argv.includes("--self-test")) {
  const original = { version: "1.0.1", packages: { "": { version: "1.0.1", dependencies: { react: "19.1.0" } }, "node_modules/react": { version: "19.1.0", integrity: "sha512-test" } } };
  const newVersion = structuredClone(original);
  newVersion.version = "1.0.2";
  newVersion.packages[""].version = "1.0.2";
  assert.equal(dependencyFingerprint(original), dependencyFingerprint(newVersion));
  const newDependency = structuredClone(original);
  newDependency.packages["node_modules/react"].version = "19.2.0";
  assert.notEqual(dependencyFingerprint(original), dependencyFingerprint(newDependency));
  assert.equal(original.version, "1.0.1", "La huella no debe modificar los datos originales.");
  console.log("Caché de dependencias: cambio de versión reutilizado; cambio de paquete detectado.");
} else {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8").replace(/^\uFEFF/u, ""));
  console.log(dependencyFingerprint(lock));
}
