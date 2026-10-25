import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarFilaRecibida } from "../receptor/valida.js";
import { CAMPOS, CAMPOS_PREENSAYO } from "../web/js/fila.js";

const fila = (campos, cambios = {}) => ({ ...Object.fromEntries(campos.map(c => [c, "x"])), ...cambios });

test("acepta una fila válida", () => {
  assert.deepEqual(validarFilaRecibida(fila(CAMPOS), CAMPOS), { ok: true });
});

test("rechaza un campo extra (p. ej. ip)", () => {
  const r = validarFilaRecibida(fila(CAMPOS, { ip: "1.2.3.4" }), CAMPOS);
  assert.equal(r.ok, false);
  assert.match(r.error, /ip/);
});

test("rechaza un campo que falta", () => {
  const f = fila(CAMPOS);
  delete f.grupo;
  const r = validarFilaRecibida(f, CAMPOS);
  assert.equal(r.ok, false);
  assert.match(r.error, /grupo/);
});

test("rechaza un valor que no es texto", () => {
  assert.equal(validarFilaRecibida(fila(CAMPOS, { t1_ms: 3000 }), CAMPOS).ok, false);
});

test("rechaza un valor de más de 200 caracteres", () => {
  assert.equal(validarFilaRecibida(fila(CAMPOS, { estudios: "a".repeat(201) }), CAMPOS).ok, false);
});

test("rechaza algo que no es un objeto", () => {
  assert.equal(validarFilaRecibida(null, CAMPOS).ok, false);
  assert.equal(validarFilaRecibida(["x"], CAMPOS).ok, false);
});

test("una fila de preensayo se valida contra CAMPOS_PREENSAYO", () => {
  assert.equal(validarFilaRecibida(fila(CAMPOS_PREENSAYO), CAMPOS_PREENSAYO).ok, true);
  assert.equal(validarFilaRecibida(fila(CAMPOS_PREENSAYO), CAMPOS).ok, false);
});

test("las listas de Code.gs son iguales a CAMPOS y CAMPOS_PREENSAYO", () => {
  const gs = readFileSync(new URL("../receptor/Code.gs", import.meta.url), "utf8");
  const lista = nombre => JSON.parse(gs.match(new RegExp(`var ${nombre} = (\\[[^\\]]*\\]);`))[1]);
  assert.deepEqual(lista("CAMPOS"), CAMPOS);
  assert.deepEqual(lista("CAMPOS_PREENSAYO"), CAMPOS_PREENSAYO);
});

test("Code.gs lleva la misma validarFilaRecibida que valida.js", () => {
  const gs = readFileSync(new URL("../receptor/Code.gs", import.meta.url), "utf8");
  const js = readFileSync(new URL("../receptor/valida.js", import.meta.url), "utf8");
  const cuerpo = s => s.slice(s.indexOf("function validarFilaRecibida")).split("\n}\n")[0];
  assert.equal(cuerpo(gs), cuerpo(js));
});

test("neutralizar impide que un valor se ejecute como fórmula en la hoja", async () => {
  const { neutralizar } = await import("../receptor/valida.js");
  assert.equal(neutralizar("=IMPORTXML(\"http://x\",\"//a\")"), "'=IMPORTXML(\"http://x\",\"//a\")");
  assert.equal(neutralizar("+1"), "'+1");
  assert.equal(neutralizar("-1"), "'-1");
  assert.equal(neutralizar("@x"), "'@x");
  assert.equal(neutralizar("C12-C07"), "C12-C07");
  assert.equal(neutralizar("350"), "350");
  assert.equal(neutralizar(""), "");
});

test("Code.gs neutraliza cada valor antes de escribir la fila", () => {
  const gs = readFileSync(new URL("../receptor/Code.gs", import.meta.url), "utf8");
  assert.match(gs, /function neutralizar/);
  assert.match(gs, /neutralizar\(fila\[c\]\)/);
});
