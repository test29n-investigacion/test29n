// Envío de la fila al receptor, con reintentos y protección contra el doble envío (spec §4).

const pausa = ms => new Promise(r => setTimeout(r, ms));

/**
 * Envía la fila por POST. Reintenta ante errores de red o de servidor, ante una respuesta que no es
 * JSON y cuando el receptor pide reintentar (cerrojo ocupado). No reintenta ante ok:false sin más:
 * repetir no lo arregla. La fila lleva id_envio, así que un reintento nunca crea una fila duplicada.
 * @returns {Promise<boolean>} true solo si el receptor confirma ok:true
 */
export async function enviarFila(fila, url, { fetchFn = fetch, intentos = 4, espera = 1000 } = {}) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetchFn(url, {
        method: "POST",
        // text/plain evita la petición previa de CORS, que Apps Script no responde.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(fila),
      });
      if (r.ok) {
        const cuerpo = await r.json();
        if (cuerpo && cuerpo.ok === true) return true;
        if (!(cuerpo && cuerpo.reintentar)) return false;
      }
    } catch {
      // error de red: se reintenta
    }
    // Espera creciente con algo de azar para que una clase entera no reintente a la vez.
    if (i < intentos - 1 && espera) await pausa(espera * (i + 1) * (0.75 + Math.random() / 2));
  }
  return false;
}

/**
 * Devuelve una función enviar(fila) que, mientras hay un envío en curso, devuelve la misma
 * promesa, y que tras un envío confirmado no vuelve a enviar.
 */
export function crearEnviador(url, opciones = {}) {
  let enCurso = null;
  let hecho = false;
  return fila => {
    if (hecho) return Promise.resolve(true);
    if (enCurso) return enCurso;
    enCurso = enviarFila(fila, url, opciones).then(ok => {
      hecho = ok;
      enCurso = null;
      return ok;
    });
    return enCurso;
  };
}
