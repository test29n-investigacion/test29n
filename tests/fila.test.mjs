import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPOS, CAMPOS_PREENSAYO, leerCanal, construirFila, construirFilaPreensayo, fechaLocal } from "../web/js/fila.js";

const orden = ["C12", "C07", "C36", "C25", "C42", "C01", "C38", "C09"];
const r = {
  edad: "16–17", estudios: "Bachillerato", ccaa: "Madrid", voto: "No, aún no tengo edad",
  fuentes_info: ["TikTok", "Instagram"], horas_redes: "2–4 h", comprueba: "A veces", conoce_verificadores: "No",
  autoestimacion: "6", buscado: "No", interes: "Bastante", con1: "Alberto Núñez Feijóo", con2: "El Rey", con3: "4",
  ideologia: "Prefiero no responder", repetido: "No",
};
orden.forEach((id, n) => Object.assign(r, { [`${id}_resp`]: n % 2 ? "Falsa" : "Real", [`${id}_seg`]: "4", [`${id}_visto`]: "No" }));
const ejemplo = {
  config: { version_app: "v1.0", oleada: "29N" }, modo: "normal", fecha: "2026-10-28", canal: "instituto",
  grupo: "A", listaDer: 1, orden, r,
  t: Object.fromEntries(orden.map((id, n) => [id, 3000 + n + 0.4])), fuera: { C36: true },
  idEnvio: "0123456789abcdef", duracion: 241.6, img: { C12: "ok", C07: "falta" },
};

test("CAMPOS empieza por los campos generales en orden", () => {
  assert.deepEqual(CAMPOS.slice(0, 8), ["version_app", "oleada", "modo", "fecha", "canal", "grupo", "lista_der", "orden"]);
});

test("CAMPOS tiene 8 de cada tN_* y acaba en los del piloto y los de control de calidad", () => {
  for (const s of ["id", "resp", "seg", "visto", "ms", "fuera", "entiende", "img"]) {
    assert.equal(CAMPOS.filter(c => new RegExp(`^t[1-8]_${s}$`).test(c)).length, 8, s);
  }
  const serie = s => Array.from({ length: 8 }, (_, i) => `t${i + 1}_${s}`);
  assert.deepEqual(CAMPOS.slice(-21), ["ideologia", "repetido", ...serie("entiende"), "quien_extra", "id_envio", "duracion_s", ...serie("img")]);
  assert.equal(new Set(CAMPOS).size, CAMPOS.length);
});

test("construirFila devuelve exactamente CAMPOS, en orden, y solo texto", () => {
  const f = construirFila(ejemplo);
  assert.deepEqual(Object.keys(f), CAMPOS);
  for (const v of Object.values(f)) assert.equal(typeof v, "string");
});

test("tN_id sigue el orden y orden se une con '-'", () => {
  const f = construirFila(ejemplo);
  assert.equal(f.orden, "C12-C07-C36-C25-C42-C01-C38-C09");
  assert.equal(f.t1_id, "C12");
  assert.equal(f.t8_id, "C09");
  assert.equal(f.t2_resp, "Falsa");
});

test("tiempos redondeados y salida de página como si/no", () => {
  const f = construirFila(ejemplo);
  assert.equal(f.t1_ms, "3000");
  assert.equal(f.t3_fuera, "si");
  assert.equal(f.t1_fuera, "no");
});

test("fuentes_info múltiple se une con '|' y lista_der es texto", () => {
  const f = construirFila(ejemplo);
  assert.equal(f.fuentes_info, "TikTok|Instagram");
  assert.equal(f.lista_der, "1");
});

test("respuesta que falta queda vacía, no undefined", () => {
  const f = construirFila({ ...ejemplo, r: { ...r, ideologia: undefined } });
  assert.equal(f.ideologia, "");
  assert.equal(f.t1_entiende, "");
});

test("fechaLocal da AAAA-MM-DD sin hora", () => {
  assert.equal(fechaLocal(new Date(2026, 9, 5, 23, 59)), "2026-10-05");
});

test("leerCanal", () => {
  assert.equal(leerCanal("?c=instituto"), "instituto");
  assert.equal(leerCanal("?modo=piloto&c=debate_2"), "debate_2");
  assert.equal(leerCanal(""), "directo");
  assert.equal(leerCanal("?c="), "directo");
  assert.equal(leerCanal("?c=<script>"), "otro");
  assert.equal(leerCanal("?c=" + "a".repeat(200)), "otro");
  assert.equal(leerCanal("?c=Instituto"), "otro");
});

test("construirFilaPreensayo devuelve exactamente CAMPOS_PREENSAYO, en orden", () => {
  const ids = Array.from({ length: 16 }, (_, i) => `C${10 + i}`);
  const rp = { edad: "18–19", ideologia: "5" };
  ids.forEach(id => Object.assign(rp, { [`${id}_cred`]: "3", [`${id}_lado`]: "A la derecha" }));
  const f = construirFilaPreensayo({ config: ejemplo.config, modo: "preensayo", fecha: "2026-10-20", canal: "directo", orden: ids, r: rp });
  assert.deepEqual(Object.keys(f), CAMPOS_PREENSAYO);
  assert.deepEqual(CAMPOS_PREENSAYO.slice(0, 7), ["version_app", "oleada", "modo", "fecha", "canal", "edad", "ideologia"]);
  assert.equal(CAMPOS_PREENSAYO.length, 7 + 48 + 2);
  assert.equal(f.p16_id, "C25");
  assert.equal(f.p1_lado, "A la derecha");
});

test("id_envio, duracion_s (segundos enteros) y estado de cada imagen", () => {
  const f = construirFila(ejemplo);
  assert.equal(f.id_envio, "0123456789abcdef");
  assert.equal(f.duracion_s, "242");
  assert.equal(f.t1_img, "ok");
  assert.equal(f.t2_img, "falta");
  assert.equal(f.t3_img, "");
});

test("el preensayo también lleva id_envio y duracion_s", () => {
  assert.deepEqual(CAMPOS_PREENSAYO.slice(-2), ["id_envio", "duracion_s"]);
  const f = construirFilaPreensayo({ config: ejemplo.config, modo: "preensayo", fecha: "2026-10-20", canal: "directo",
    orden: ["C12"], r: {}, idEnvio: "ffffffffffffffff", duracion: 100.2 });
  assert.equal(f.id_envio, "ffffffffffffffff");
  assert.equal(f.duracion_s, "100");
});
