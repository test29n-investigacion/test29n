// Validación del banco de publicaciones (spec §4 y §5).
const CAMPOS_OBLIGATORIOS = ["id", "tipo", "lado", "fecha", "cuenta", "texto", "img", "alt", "verif"];
const TIPOS = ["verdadero", "tradicional", "ia"];
const LADOS = ["izq", "der"];

/**
 * Devuelve la lista de errores del banco (vacía si es válido).
 * @param {object[]} banco
 * @param {(ruta: string) => boolean} [existeArchivo] si se pasa, comprueba que cada imagen existe
 * @returns {string[]}
 */
export function validarBanco(banco, existeArchivo) {
  const errores = [];
  if (!Array.isArray(banco) || banco.length === 0) return ["el banco está vacío o no es una lista"];

  const ids = new Map();
  for (const [i, b] of banco.entries()) {
    const ref = b && b.id ? b.id : `entrada ${i + 1}`;
    for (const c of CAMPOS_OBLIGATORIOS) {
      if (typeof b[c] !== "string" || b[c].trim() === "") errores.push(`${ref}: falta el campo ${c}`);
    }
    if (b.tipo !== undefined && !TIPOS.includes(b.tipo)) errores.push(`${ref}: tipo inválido «${b.tipo}»`);
    if (b.lado !== undefined && !LADOS.includes(b.lado)) errores.push(`${ref}: lado inválido «${b.lado}»`);
    if (ids.has(b.id)) errores.push(`${ref}: id repetido`);
    ids.set(b.id, b);
    if (existeArchivo && typeof b.img === "string" && !existeArchivo(b.img)) {
      errores.push(`${ref}: no existe la imagen ${b.img}`);
    }
  }

  for (const b of banco) {
    if (b.pareja === undefined) continue;
    const otra = ids.get(b.pareja);
    if (!otra) errores.push(`${b.id}: la pareja ${b.pareja} no existe`);
    else if (otra.pareja !== b.id) errores.push(`${b.id}: la pareja con ${b.pareja} no es recíproca`);
  }
  return errores;
}
