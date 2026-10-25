// Pruebas de receptor/Code.gs ejecutado de verdad (ver tests/apoyo/gs.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cargarReceptor } from "./apoyo/gs.mjs";
import { CAMPOS, CAMPOS_PREENSAYO } from "../web/js/fila.js";

let n = 0;
const fila = (cambios = {}, campos = CAMPOS) => ({
  ...Object.fromEntries(campos.map(c => [c, "x"])),
  modo: campos === CAMPOS ? "normal" : "preensayo",
  id_envio: (++n).toString(16).padStart(16, "0"),
  ...cambios,
});

test("una fila válida se guarda bajo una cabecera = CAMPOS + recibido", () => {
  const r = cargarReceptor();
  const f = fila({ canal: "instituto" });
  assert.deepEqual(r.post(f), { ok: true });
  const h = r.hojas.get("respuestas");
  assert.deepEqual(h.filas[0], [...CAMPOS, "recibido"]);
  assert.equal(h.filas.length, 2);
  assert.deepEqual(h.filas[1].slice(0, -1), CAMPOS.map(c => f[c]));
  assert.equal(Object.prototype.toString.call(h.filas[1].at(-1)), "[object Date]");
});

test("los valores que empiezan por = + - @ se guardan como texto", () => {
  const r = cargarReceptor();
  r.post(fila({ canal: "=IMPORTXML(\"http://x\",\"//a\")" }));
  const h = r.hojas.get("respuestas");
  assert.equal(h.filas[1][CAMPOS.indexOf("canal")], "'=IMPORTXML(\"http://x\",\"//a\")");
});

test("el preensayo va a su hoja con sus campos", () => {
  const r = cargarReceptor();
  assert.equal(r.post(fila({}, CAMPOS_PREENSAYO)).ok, true);
  assert.deepEqual(r.hojas.get("preensayo").filas[0], [...CAMPOS_PREENSAYO, "recibido"]);
  assert.equal(r.hojas.get("respuestas"), undefined);
});

test("modo prueba va a la hoja «pruebas» y no ensucia «respuestas»", () => {
  const r = cargarReceptor();
  assert.equal(r.post(fila({ modo: "prueba" })).ok, true);
  assert.equal(r.hojas.get("pruebas").filas.length, 2);
  assert.equal(r.hojas.get("respuestas"), undefined);
});

test("el mismo id_envio dos veces (reintento) deja una sola fila", () => {
  const r = cargarReceptor();
  const f = fila();
  assert.equal(r.post(f).ok, true);
  assert.equal(r.post(f).ok, true);
  assert.equal(r.hojas.get("respuestas").filas.length, 2);
});

test("si la caché de Google falla, la fila se guarda igual", () => {
  const r = cargarReceptor();
  r.ctrl.cacheRota = true;
  assert.equal(r.post(fila()).ok, true);
  assert.equal(r.hojas.get("respuestas").filas.length, 2);
});

test("una fila que no cuadra no se pierde: va entera a «rechazadas»", () => {
  const r = cargarReceptor();
  const f = fila({ ip: "1.2.3.4" });
  const res = r.post(f);
  assert.equal(res.ok, true);
  assert.equal(res.guardada, "rechazadas");
  const h = r.hojas.get("rechazadas");
  assert.deepEqual(h.filas[0], ["recibido", "error", "contenido"]);
  assert.match(h.filas[1][1], /ip/);
  assert.deepEqual(JSON.parse(h.filas[1][2]), f);
  assert.equal(r.hojas.get("respuestas"), undefined);
});

test("un cuerpo que no es JSON responde ok:false y queda anotado", () => {
  const r = cargarReceptor();
  assert.equal(r.post("esto no es json").ok, false);
  assert.equal(r.hojas.get("rechazadas").filas[1][2], "esto no es json");
});

test("si no consigue el cerrojo, pide reintentar y no escribe nada", () => {
  const r = cargarReceptor();
  r.ctrl.cerrojo = false;
  assert.deepEqual(r.post(fila()), { ok: false, reintentar: true });
  assert.equal(r.hojas.get("respuestas"), undefined);
});

test("si «respuestas» tiene otra cabecera (versión vieja), escribe en «respuestas_2» sin tocarla", () => {
  const r = cargarReceptor();
  const vieja = r.hojas.get("respuestas") || (r.post(fila()), r.hojas.get("respuestas"));
  vieja.filas[0] = ["version_app", "otra_cosa"];
  const antes = vieja.filas.length;
  assert.equal(r.post(fila()).ok, true);
  assert.equal(vieja.filas.length, antes);
  const nueva = r.hojas.get("respuestas_2");
  assert.deepEqual(nueva.filas[0], [...CAMPOS, "recibido"]);
  assert.equal(nueva.filas.length, 2);
});

test("doGet devuelve la versión del receptor y sus listas de campos", () => {
  const r = cargarReceptor();
  const g = r.get();
  assert.equal(g.ok, true);
  assert.equal(typeof g.version, "string");
  assert.deepEqual(g.campos, CAMPOS);
  assert.deepEqual(g.campos_preensayo, CAMPOS_PREENSAYO);
});
