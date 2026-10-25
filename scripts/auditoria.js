// Auditoría de las respuestas guardadas. La usa scripts/auditar-datos.mjs (con el CSV de la hoja «respuestas»)
// y las pruebas. «errores» = filas que no deberían existir así (fallo de la web o fila manipulada);
// «avisos» = filas válidas que conviene mirar o filtrar en el análisis.
import { CAMPOS } from "../web/js/fila.js";

const SERIE = s => Array.from({ length: 8 }, (_, i) => `t${i + 1}_${s}`);
const VISTO = ["Sí", "No", "No estoy seguro"];
const ENTIENDE = ["Sí", "Más o menos", "No"];

/** Lee un CSV (RFC 4180: comillas dobles, comillas escapadas, saltos de línea dentro de comillas). */
export function leerCSV(texto) {
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(v => v !== ""));
}

/** Convierte filas de hoja (la primera es la cabecera) en objetos. */
export function aObjetos(matriz) {
  const [cab, ...resto] = matriz;
  return { cabecera: cab.map(String), filas: resto.map(f => Object.fromEntries(cab.map((c, i) => [c, f[i] === undefined ? "" : String(f[i])]))) };
}

function composicion(ids, porId) {
  const c = { verdadero: 0, tradicional: 0, ia: 0 };
  ids.forEach(id => { c[porId[id].tipo]++; });
  return c;
}

export function auditar({ cabecera, filas }, banco) {
  const porId = Object.fromEntries(banco.map(b => [b.id, b]));
  const errores = [];
  const avisos = [];
  const esperada = [...CAMPOS, "recibido"];
  if (cabecera.join(",") !== esperada.join(",")) {
    errores.push({ fila: 1, motivo: "la cabecera no coincide con la versión actual de la web (¿hoja de otra versión?)" });
  }
  const vistos = new Map();
  const exposicion = Object.fromEntries(banco.map(b => [b.id, 0]));
  const cuenta = { grupo: {}, lista_der: {}, canal: {}, modo: {} };
  filas.forEach((f, i) => {
    const n = i + 2; // número de fila en la hoja
    const e = m => errores.push({ fila: n, motivo: m });
    const a = m => avisos.push({ fila: n, motivo: m });
    for (const k of Object.keys(cuenta)) cuenta[k][f[k]] = (cuenta[k][f[k]] || 0) + 1;

    if (!/^[0-9a-f]{16}$/.test(f.id_envio)) e("id_envio no válido");
    else if (vistos.has(f.id_envio)) e(`envío duplicado de la fila ${vistos.get(f.id_envio)}`);
    else vistos.set(f.id_envio, n);
    if (!["normal", "piloto"].includes(f.modo)) e(`modo inesperado: ${f.modo}`);
    if (!["A", "B"].includes(f.grupo)) e(`grupo no válido: ${f.grupo}`);
    if (f.edad === "Menos de 14") e("edad menor de 14 (no debería haberse guardado)");

    const ids = SERIE("id").map(c => f[c]);
    if (ids.some(id => !porId[id])) { e(`publicación desconocida: ${ids.filter(id => !porId[id]).join(", ")}`); return; }
    if (new Set(ids).size !== 8) e("publicaciones repetidas en la misma fila");
    if (f.orden !== ids.join("-")) e("«orden» no coincide con t1_id…t8_id");
    ids.forEach(id => { exposicion[id]++; });

    const izq = ids.filter(id => porId[id].lado === "izq");
    const der = ids.filter(id => porId[id].lado === "der");
    const ok = c => c.verdadero === 2 && c.tradicional === 1 && c.ia === 1;
    if (izq.length !== 4 || !ok(composicion(izq, porId))) e("el lado izquierdo no tiene 2 verdaderas, 1 tradicional y 1 IA");
    if (der.length !== 4 || !ok(composicion(der, porId))) e("el lado derecho no tiene 2 verdaderas, 1 tradicional y 1 IA");
    for (const id of ids) if (porId[id].pareja && ids.includes(porId[id].pareja)) e(`aparecen juntas ${id} y ${porId[id].pareja}`);
    const tradDer = der.find(id => porId[id].tipo === "tradicional");
    const lista = tradDer && porId[porId[tradDer].pareja]?.tipo === "ia" ? "1" : "2";
    if (f.lista_der !== lista) e(`lista_der dice ${f.lista_der} pero las publicaciones son de la lista ${lista}`);

    if (SERIE("resp").some(c => !["Real", "Falsa"].includes(f[c]))) e("respuesta Real/Falsa que falta o no es válida");
    if (SERIE("seg").some(c => !/^[1-5]$/.test(f[c]))) e("seguridad fuera de 1–5");
    if (SERIE("visto").some(c => !VISTO.includes(f[c]))) e("«¿la habías visto?» no válida");
    if (SERIE("ms").some(c => !/^\d+$/.test(f[c]))) e("tiempo de respuesta no numérico");
    if (SERIE("fuera").some(c => !["si", "no"].includes(f[c]))) e("tN_fuera no es si/no");
    if (SERIE("img").some(c => !["ok", "falta"].includes(f[c]))) e("tN_img no es ok/falta");
    if (f.modo === "piloto" && SERIE("entiende").some(c => !ENTIENDE.includes(f[c]))) e("piloto sin «¿entiendes?»");
    if (f.modo === "normal" && SERIE("entiende").some(c => f[c] !== "")) e("fila normal con preguntas del piloto");
    if (!/^\d+$/.test(f.duracion_s)) e("duracion_s no numérica");

    if (f.repetido === "Sí") a("dice que ya había hecho el test");
    if (f.buscado === "Sí") a("dice que buscó alguna publicación");
    if (/^\d+$/.test(f.duracion_s) && Number(f.duracion_s) < 90) a(`muy rápido: ${f.duracion_s} s en total`);
    const fuera = SERIE("fuera").filter(c => f[c] === "si").length;
    if (fuera) a(`salió de la página en ${fuera} publicación(es)`);
    const faltan = SERIE("img").filter(c => f[c] === "falta").length;
    if (faltan) a(`no le cargaron ${faltan} imagen(es)`);
  });
  const total = filas.length;
  const pct = Object.fromEntries(Object.entries(exposicion).map(([id, k]) => [id, total ? Math.round((1000 * k) / total) / 10 : 0]));
  return { total, errores, avisos, cuenta, exposicion: pct };
}

export function informe(r) {
  const l = [];
  l.push(`Filas: ${r.total}`);
  l.push(`Errores: ${r.errores.length}`);
  r.errores.slice(0, 50).forEach(x => l.push(`  fila ${x.fila}: ${x.motivo}`));
  l.push(`Avisos (válidas, a revisar en el análisis): ${r.avisos.length}`);
  r.avisos.slice(0, 50).forEach(x => l.push(`  fila ${x.fila}: ${x.motivo}`));
  for (const [k, v] of Object.entries(r.cuenta)) l.push(`${k}: ${Object.entries(v).map(([a, b]) => `${a || "(vacío)"}=${b}`).join("  ")}`);
  l.push("Exposición por publicación (% de filas; lo esperado es 50 %):");
  l.push("  " + Object.entries(r.exposicion).map(([id, p]) => `${id} ${p}%`).join("  "));
  return l.join("\n");
}
