import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leerCSV, aObjetos, auditar } from "../scripts/auditoria.js";
import { CAMPOS, construirFila } from "../web/js/fila.js";
import { sortear } from "../web/js/sorteo.js";
import { cargarReceptor } from "./apoyo/gs.mjs";

const banco = JSON.parse(readFileSync(new URL("../web/banco.json", import.meta.url), "utf8"));

function filaSimulada(k) {
  const s = sortear(banco);
  const r = { edad: "16–17", estudios: "Bachillerato", repetido: "No", buscado: "No" };
  s.orden.forEach((id, i) => Object.assign(r, { [`${id}_resp`]: i % 2 ? "Real" : "Falsa", [`${id}_seg`]: "3", [`${id}_visto`]: "No" }));
  return construirFila({
    config: { version_app: "v1.0", oleada: "29N" }, modo: "normal", fecha: "2026-11-02", canal: "instituto",
    grupo: s.grupo, listaDer: s.listaDer, orden: s.orden, r,
    t: Object.fromEntries(s.orden.map(id => [id, 4000])), fuera: {}, img: Object.fromEntries(s.orden.map(id => [id, "ok"])),
    idEnvio: k.toString(16).padStart(16, "0"), duracion: 200,
  });
}

const hojaCon = filas => ({ cabecera: [...CAMPOS, "recibido"], filas: filas.map(f => ({ ...f, recibido: "x" })) });

test("400 filas generadas por la propia web pasan la auditoría sin errores y con ~50 % de exposición", () => {
  const r = auditar(hojaCon(Array.from({ length: 400 }, (_, k) => filaSimulada(k + 1))), banco);
  assert.deepEqual(r.errores, []);
  for (const p of Object.values(r.exposicion)) assert.ok(p > 38 && p < 62, p);
});

test("detecta duplicados, orden manipulado, lista_der falsa y respuestas no válidas", () => {
  const a = filaSimulada(1);
  const b = { ...filaSimulada(2), orden: "C12-C12" };
  const c = { ...filaSimulada(3) }; c.lista_der = c.lista_der === "1" ? "2" : "1";
  const d = { ...filaSimulada(4), t3_resp: "Quizá" };
  const r = auditar(hojaCon([a, { ...a }, b, c, d]), banco);
  const m = r.errores.map(x => `${x.fila}:${x.motivo}`).join("\n");
  assert.match(m, /^3:envío duplicado de la fila 2/m);
  assert.match(m, /^4:«orden» no coincide/m);
  assert.match(m, /^5:lista_der dice/m);
  assert.match(m, /^6:respuesta Real\/Falsa/m);
});

test("detecta dos publicaciones de una pareja juntas", () => {
  const f = filaSimulada(5);
  const ids = Array.from({ length: 8 }, (_, i) => f[`t${i + 1}_id`]);
  const p = banco.find(b => b.pareja && ids.includes(b.id));
  const otra = ids.find(id => id !== p.id && banco.find(b => b.id === id).lado === "der" && banco.find(b => b.id === id).tipo === banco.find(b => b.id === p.pareja).tipo);
  const i = ids.indexOf(otra);
  f[`t${i + 1}_id`] = p.pareja;
  ids[i] = p.pareja;
  f.orden = ids.join("-");
  assert.match(auditar(hojaCon([f]), banco).errores.map(x => x.motivo).join("\n"), /aparecen juntas/);
});

test("avisa (sin error) de quien repite, busca, va muy rápido o no ve imágenes", () => {
  const f = { ...filaSimulada(6), repetido: "Sí", buscado: "Sí", duracion_s: "40", t2_img: "falta", t4_fuera: "si" };
  const r = auditar(hojaCon([f]), banco);
  assert.deepEqual(r.errores, []);
  assert.equal(r.avisos.length, 5);
});

test("una cabecera de otra versión es un error", () => {
  assert.match(auditar({ cabecera: ["version_app"], filas: [] }, banco).errores[0].motivo, /cabecera/);
});

test("CSV: comillas, comas y saltos de línea dentro de un campo", () => {
  assert.deepEqual(leerCSV('a,b\r\n"x, y","di ""hola""\nadiós"\n'), [["a", "b"], ["x, y", 'di "hola"\nadiós']]);
});

test("de punta a punta: filas de la web → receptor real → hoja → auditoría sin errores", () => {
  const rec = cargarReceptor();
  for (let k = 1; k <= 50; k++) assert.equal(rec.post(filaSimulada(k)).ok, true);
  const hoja = rec.hojas.get("respuestas").filas.map(f => f.map(v => (v instanceof Object ? "fecha" : v)));
  const r = auditar(aObjetos(hoja), banco);
  assert.equal(r.total, 50);
  assert.deepEqual(r.errores, []);
});
