/** @OnlyCurrentDoc */
// Receptor de la encuesta 29N (Google Apps Script). Se pega entero en el editor de Apps Script.
// Guarda cada fila válida en la hoja «respuestas» (o «preensayo») de la hoja de cálculo a la que está vinculado.
// No guarda IP ni ningún dato que no venga en la lista de campos.

var CAMPOS = ["version_app","oleada","modo","fecha","canal","grupo","lista_der","orden","edad","estudios","ccaa","voto","info_tiktok","info_instagram","info_youtube","info_x","info_mensajeria","info_tv","info_prensa","info_radio","info_familia","horas_redes","comprueba","conoce_verificadores","t1_id","t2_id","t3_id","t4_id","t5_id","t6_id","t7_id","t8_id","t1_resp","t2_resp","t3_resp","t4_resp","t5_resp","t6_resp","t7_resp","t8_resp","t1_seg","t2_seg","t3_seg","t4_seg","t5_seg","t6_seg","t7_seg","t8_seg","t1_visto","t2_visto","t3_visto","t4_visto","t5_visto","t6_visto","t7_visto","t8_visto","t1_ms","t2_ms","t3_ms","t4_ms","t5_ms","t6_ms","t7_ms","t8_ms","t1_fuera","t2_fuera","t3_fuera","t4_fuera","t5_fuera","t6_fuera","t7_fuera","t8_fuera","autoestimacion","buscado","interes","con1","con2","con3","ideologia","repetido","t1_entiende","t2_entiende","t3_entiende","t4_entiende","t5_entiende","t6_entiende","t7_entiende","t8_entiende","quien_extra","id_envio","duracion_s","t1_img","t2_img","t3_img","t4_img","t5_img","t6_img","t7_img","t8_img"];
var CAMPOS_PREENSAYO = ["version_app","oleada","modo","fecha","canal","edad","ideologia","p1_id","p2_id","p3_id","p4_id","p5_id","p6_id","p7_id","p8_id","p9_id","p10_id","p11_id","p12_id","p13_id","p14_id","p15_id","p16_id","p1_cred","p2_cred","p3_cred","p4_cred","p5_cred","p6_cred","p7_cred","p8_cred","p9_cred","p10_cred","p11_cred","p12_cred","p13_cred","p14_cred","p15_cred","p16_cred","p1_lado","p2_lado","p3_lado","p4_lado","p5_lado","p6_lado","p7_lado","p8_lado","p9_lado","p10_lado","p11_lado","p12_lado","p13_lado","p14_lado","p15_lado","p16_lado","id_envio","duracion_s"];

function validarFilaRecibida(fila, campos) {
  if (fila === null || typeof fila !== "object" || Array.isArray(fila)) return { ok: false, error: "la fila no es un objeto" };
  var claves = Object.keys(fila);
  for (var i = 0; i < claves.length; i++) {
    if (campos.indexOf(claves[i]) === -1) return { ok: false, error: "campo no permitido: " + claves[i] };
  }
  for (var j = 0; j < campos.length; j++) {
    var v = fila[campos[j]];
    if (v === undefined) return { ok: false, error: "falta el campo: " + campos[j] };
    if (typeof v !== "string") return { ok: false, error: "el campo " + campos[j] + " no es texto" };
    if (v.length > 200) return { ok: false, error: "el campo " + campos[j] + " es demasiado largo" };
  }
  return { ok: true };
}

// Un valor que empieza por = + - @ se escribe con un apóstrofo delante para que la hoja lo trate
// como texto y no como fórmula (evita inyección de fórmulas como =IMPORTXML).
function neutralizar(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

var VERSION_RECEPTOR = "r2";

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function mismaCabecera(h, cabecera) {
  if (h.getLastColumn() !== cabecera.length) return false;
  var actual = h.getRange(1, 1, 1, cabecera.length).getValues()[0];
  for (var i = 0; i < cabecera.length; i++) if (String(actual[i]) !== cabecera[i]) return false;
  return true;
}

// Devuelve la hoja donde escribir. Si «nombre» ya existe con otras columnas (una versión anterior de la web),
// no se toca: se usa «nombre_2», «nombre_3»… para que nunca se mezclen columnas.
function hoja(nombre, cabecera) {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  for (var n = 1; n < 50; n++) {
    var nom = n === 1 ? nombre : nombre + "_" + n;
    var h = libro.getSheetByName(nom);
    if (!h) {
      h = libro.insertSheet(nom);
      h.appendRow(cabecera);
      return h;
    }
    if (h.getLastRow() === 0) { h.appendRow(cabecera); return h; }
    if (mismaCabecera(h, cabecera)) return h;
  }
  throw new Error("demasiadas versiones de la hoja " + nombre);
}

// Lo que no se puede guardar como fila se guarda en bruto en «rechazadas», para no perder ninguna respuesta.
function anotarRechazada(error, contenido) {
  hoja("rechazadas", ["recibido", "error", "contenido"]).appendRow([new Date(), error, neutralizar(String(contenido).slice(0, 45000))]);
}

function yaRecibida(id) {
  if (!id) return false;
  try { return CacheService.getScriptCache().get("envio:" + id) !== null; } catch (err) { return false; }
}

function marcarRecibida(id) {
  if (!id) return;
  try { CacheService.getScriptCache().put("envio:" + id, "1", 21600); } catch (err) { /* la caché es una ayuda, no imprescindible */ }
}

function doPost(e) {
  var contenido = e && e.postData ? e.postData.contents : "";
  var cerrojo = LockService.getScriptLock();
  if (!cerrojo.tryLock(30000)) return responder({ ok: false, reintentar: true });
  try {
    var fila;
    try {
      fila = JSON.parse(contenido);
    } catch (err) {
      anotarRechazada("JSON no válido", contenido);
      return responder({ ok: false, error: "JSON no válido" });
    }
    var modo = fila && fila.modo;
    var campos = modo === "preensayo" ? CAMPOS_PREENSAYO : CAMPOS;
    var r = validarFilaRecibida(fila, campos);
    if (!r.ok) {
      anotarRechazada(r.error, contenido);
      return responder({ ok: true, guardada: "rechazadas" });
    }
    if (yaRecibida(fila.id_envio)) return responder({ ok: true });
    var nombre = modo === "preensayo" ? "preensayo" : modo === "prueba" ? "pruebas" : "respuestas";
    var valores = campos.map(function (c) { return neutralizar(fila[c]); });
    valores.push(new Date());
    hoja(nombre, campos.concat(["recibido"])).appendRow(valores);
    marcarRecibida(fila.id_envio);
    return responder({ ok: true });
  } finally {
    cerrojo.releaseLock();
  }
}

// Abrir la URL del receptor en el navegador muestra su versión y sus campos (scripts/comprobar-despliegue.mjs lo usa).
function doGet() {
  return responder({ ok: true, servicio: "encuesta 29N", version: VERSION_RECEPTOR, campos: CAMPOS, campos_preensayo: CAMPOS_PREENSAYO });
}
