// Validación de la fila recibida. Code.gs lleva una copia idéntica de esta función (una prueba lo comprueba).
export function validarFilaRecibida(fila, campos) {
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
export function neutralizar(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
