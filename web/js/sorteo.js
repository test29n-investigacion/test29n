// Sorteo de versión y de publicaciones (spec §5).

function rngSeguro() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

function elegir(lista, k, rng) {
  const resto = lista.slice();
  const salida = [];
  for (let i = 0; i < k && resto.length; i++) salida.push(resto.splice(Math.floor(rng() * resto.length), 1)[0]);
  return salida;
}

export function barajar(lista, rng = rngSeguro) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function noSoportada(detalle) {
  return new Error(`configuración de parejas no soportada: ${detalle}`);
}

/** Agrupa las publicaciones de un lado por tipo y detecta sus parejas. */
function lado(banco, nombre) {
  const de = tipo => banco.filter(b => b.lado === nombre && b.tipo === tipo).map(b => b.id);
  const porId = Object.fromEntries(banco.map(b => [b.id, b]));
  const parejas = [];
  for (const b of banco) {
    if (b.lado !== nombre || !b.pareja || b.id > b.pareja) continue;
    const otra = porId[b.pareja];
    if (!otra || otra.lado !== nombre) throw noSoportada(`${b.id}–${b.pareja} cruza de lado`);
    parejas.push([b, otra]);
  }
  return { v: de("verdadero"), t: de("tradicional"), i: de("ia"), parejas };
}

/** Sorteo libre de un lado sin parejas: 2 verdaderas, 1 tradicional, 1 IA (o todas las IA si hay menos de 2). */
function ladoLibre(g, rng) {
  const ia = g.i.length < 2 ? g.i.slice() : elegir(g.i, 1, rng);
  return [...elegir(g.v, 2, rng), ...elegir(g.t, 1, rng), ...ia];
}

/**
 * Listas contrabalanceadas para un lado con dos parejas:
 * una tradicional–IA (t, i) y otra tradicional–verdadera (t2, v).
 * Lista 1 = t + la otra IA + v + 1 verdadera más; lista 2 = t2 + i + 2 verdaderas (sin v).
 */
function construirListas(g) {
  const tipoDe = id => (g.v.includes(id) ? "v" : g.t.includes(id) ? "t" : g.i.includes(id) ? "i" : "?");
  let ti = null, tv = null;
  for (const [a, b] of g.parejas) {
    const par = { [tipoDe(a.id)]: a.id, [tipoDe(b.id)]: b.id };
    if (par.t && par.i) ti = par;
    else if (par.t && par.v) tv = par;
    else throw noSoportada(`${a.id}–${b.id}`);
  }
  if (g.parejas.length !== 2 || !ti || !tv || g.t.length !== 2 || g.i.length !== 2 || ti.t === tv.t) {
    throw noSoportada("se esperan una pareja tradicional–IA y otra tradicional–verdadera");
  }
  const otraIA = g.i.find(id => id !== ti.i);
  const restoV = g.v.filter(id => id !== tv.v);
  return {
    1: rng => [ti.t, otraIA, tv.v, ...elegir(restoV, 1, rng)],
    2: rng => [tv.t, ti.i, ...elegir(restoV, 2, rng)],
  };
}

/**
 * @param {object[]} banco entradas de banco.json
 * @param {() => number} [rng] número aleatorio en [0, 1)
 * @returns {{grupo: "A"|"B", listaDer: 0|1|2, orden: string[]}}
 */
export function sortear(banco, rng = rngSeguro) {
  const izq = lado(banco, "izq");
  const der = lado(banco, "der");
  if (izq.parejas.length) throw noSoportada("parejas en el lado izquierdo");

  const grupo = rng() < 0.5 ? "A" : "B";
  const elegidasIzq = ladoLibre(izq, rng);
  let listaDer = 0;
  let elegidasDer;
  if (der.parejas.length) {
    const listas = construirListas(der);
    listaDer = rng() < 0.5 ? 1 : 2;
    elegidasDer = listas[listaDer](rng);
  } else {
    elegidasDer = ladoLibre(der, rng);
  }
  return { grupo, listaDer, orden: barajar([...elegidasIzq, ...elegidasDer], rng) };
}
