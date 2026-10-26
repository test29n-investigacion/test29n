// Fila de datos que se envía al receptor (spec §8 y §9).

const N = 8;
// Una columna por medio de la matriz de fuentes (misma lista que FUENTES.matriz en preguntas.js).
export const INFO = ["info_tiktok", "info_instagram", "info_youtube", "info_x", "info_mensajeria", "info_tv", "info_prensa", "info_radio", "info_familia"];
const serie = (sufijo, n = N, prefijo = "t") => Array.from({ length: n }, (_, i) => `${prefijo}${i + 1}_${sufijo}`);

export const CAMPOS = [
  "version_app", "oleada", "modo", "fecha", "canal", "grupo", "lista_der", "orden",
  "edad", "estudios", "ccaa", "voto", ...INFO, "horas_redes", "comprueba", "conoce_verificadores",
  ...serie("id"), ...serie("resp"), ...serie("seg"), ...serie("visto"), ...serie("ms"), ...serie("fuera"),
  "autoestimacion", "buscado", "interes", "con1", "con2", "con3", "ideologia", "repetido",
  ...serie("entiende"), "quien_extra",
  // Control de calidad: identificador aleatorio del envío (para descartar duplicados), duración total
  // y si cada imagen llegó a cargarse («ok») o no («falta»).
  "id_envio", "duracion_s", ...serie("img"),
];

export const CAMPOS_PREENSAYO = [
  "version_app", "oleada", "modo", "fecha", "canal", "edad", "ideologia",
  ...serie("id", 16, "p"), ...serie("cred", 16, "p"), ...serie("lado", 16, "p"),
  "id_envio", "duracion_s",
];

const texto = v => (v === undefined || v === null ? "" : Array.isArray(v) ? v.join("|") : String(v));

/** Fecha local en formato AAAA-MM-DD, sin hora. */
export function fechaLocal(d = new Date()) {
  const dos = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Canal del enlace (?c=): solo minúsculas, cifras, «_» y «-», hasta 30 caracteres. */
export function leerCanal(search) {
  const c = new URLSearchParams(search).get("c");
  if (!c) return "directo";
  return /^[a-z0-9_-]{1,30}$/.test(c) ? c : "otro";
}

function comunes(e) {
  return {
    version_app: e.config.version_app, oleada: e.config.oleada, modo: e.modo, fecha: e.fecha, canal: e.canal,
    id_envio: e.idEnvio, duracion_s: e.duracion === undefined ? "" : Math.round(e.duracion),
  };
}

/** @returns {Record<string,string>} con exactamente las claves de CAMPOS, en orden */
export function construirFila(e) {
  const datos = { ...comunes(e), grupo: e.grupo, lista_der: e.listaDer, orden: e.orden.join("-") };
  for (const k of ["edad", "estudios", "ccaa", "voto", ...INFO, "horas_redes", "comprueba", "conoce_verificadores",
    "autoestimacion", "buscado", "interes", "con1", "con2", "con3", "ideologia", "repetido"]) datos[k] = e.r[k];
  e.orden.forEach((id, i) => {
    const n = i + 1;
    datos[`t${n}_id`] = id;
    datos[`t${n}_resp`] = e.r[`${id}_resp`];
    datos[`t${n}_seg`] = e.r[`${id}_seg`];
    datos[`t${n}_visto`] = e.r[`${id}_visto`];
    datos[`t${n}_ms`] = e.t?.[id] === undefined ? "" : Math.round(e.t[id]);
    datos[`t${n}_fuera`] = e.fuera?.[id] ? "si" : "no";
    datos[`t${n}_entiende`] = e.r[`${id}_entiende`];
    datos[`t${n}_img`] = e.img?.[id];
  });
  const extra = e.orden.find(id => e.r[`${id}_quien`] !== undefined);
  datos.quien_extra = extra ? e.r[`${extra}_quien`] : "";
  return Object.fromEntries(CAMPOS.map(c => [c, texto(datos[c])]));
}

/** @returns {Record<string,string>} con exactamente las claves de CAMPOS_PREENSAYO, en orden */
export function construirFilaPreensayo(e) {
  const datos = { ...comunes(e), edad: e.r.edad, ideologia: e.r.ideologia };
  e.orden.forEach((id, i) => {
    datos[`p${i + 1}_id`] = id;
    datos[`p${i + 1}_cred`] = e.r[`${id}_cred`];
    datos[`p${i + 1}_lado`] = e.r[`${id}_lado`];
  });
  return Object.fromEntries(CAMPOS_PREENSAYO.map(c => [c, texto(datos[c])]));
}
