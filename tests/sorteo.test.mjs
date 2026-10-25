import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sortear } from "../web/js/sorteo.js";

const banco = JSON.parse(readFileSync(new URL("../web/banco.json", import.meta.url), "utf8"));
const porId = Object.fromEntries(banco.map(b => [b.id, b]));
const cuenta = (orden, tipo, lado) => orden.filter(id => porId[id].tipo === tipo && porId[id].lado === lado).length;

function rngSemilla(semilla) {           // mulberry32: determinista para las pruebas
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("cada reparto: 8 ids distintos, 2+2 verdaderas, 1+1 tradicionales, 1+1 IA", () => {
  const rng = rngSemilla(1);
  for (let i = 0; i < 10000; i++) {
    const { orden } = sortear(banco, rng);
    assert.equal(orden.length, 8);
    assert.equal(new Set(orden).size, 8);
    for (const lado of ["izq", "der"]) {
      assert.equal(cuenta(orden, "verdadero", lado), 2);
      assert.equal(cuenta(orden, "tradicional", lado), 1);
      assert.equal(cuenta(orden, "ia", lado), 1);
    }
  }
});

test("las parejas nunca coinciden", () => {
  const rng = rngSemilla(2);
  for (let i = 0; i < 10000; i++) {
    const s = new Set(sortear(banco, rng).orden);
    assert.ok(!(s.has("C01") && s.has("C21")));
    assert.ok(!(s.has("C04") && s.has("C36")));
  }
});

test("lista 1 = C01, C09, C36 + 1; lista 2 = C04, C21 + 2", () => {
  const rng = rngSemilla(3);
  for (let i = 0; i < 2000; i++) {
    const { listaDer, orden } = sortear(banco, rng);
    const der = orden.filter(id => porId[id].lado === "der");
    if (listaDer === 1) for (const id of ["C01", "C09", "C36"]) assert.ok(der.includes(id));
    else {
      assert.equal(listaDer, 2);
      for (const id of ["C04", "C21"]) assert.ok(der.includes(id));
      assert.ok(!der.includes("C36"));
    }
  }
});

test("exposición al 50 % ± 0,5 % por publicación y grupo A/B al 50 % ± 0,5 %", () => {
  const rng = rngSemilla(4);
  const N = 1_000_000;
  const veces = Object.fromEntries(banco.map(b => [b.id, 0]));
  let a = 0;
  for (let i = 0; i < N; i++) {
    const s = sortear(banco, rng);
    if (s.grupo === "A") a++;
    for (const id of s.orden) veces[id]++;
  }
  for (const [id, v] of Object.entries(veces)) {
    const p = v / N;
    assert.ok(p > 0.495 && p < 0.505, `${id}: ${p}`);
  }
  assert.ok(a / N > 0.495 && a / N < 0.505, `A: ${a / N}`);
});

test("el orden está barajado: la primera posición varía", () => {
  const rng = rngSemilla(5);
  const primeros = new Set();
  for (let i = 0; i < 500; i++) primeros.add(sortear(banco, rng).orden[0]);
  assert.ok(primeros.size >= 12);
});

test("plan B: con un solo bulo IA por lado, ese bulo sale siempre", () => {
  const reducido = banco.filter(b => !["C25", "C09", "C21", "C01", "C04", "C36"].includes(b.id))
    .map(b => { const c = { ...b }; delete c.pareja; return c; });
  // reducido: IA izq = C47, IA der = ninguna salvo que añadamos una; añadimos C09 sin pareja
  reducido.push({ ...porId.C09 });
  const rng = rngSemilla(6);
  for (let i = 0; i < 500; i++) {
    const { orden, listaDer } = sortear(reducido, rng);
    assert.ok(orden.includes("C47"));
    assert.ok(orden.includes("C09"));
    assert.equal(listaDer, 0);
  }
});

test("es determinista con un rng fijo", () => {
  assert.deepEqual(sortear(banco, rngSemilla(7)), sortear(banco, rngSemilla(7)));
});

test("configuración de parejas no soportada lanza un error claro", () => {
  const raro = banco.map(b => ({ ...b }));
  raro.find(b => b.id === "C12").pareja = "C34";
  raro.find(b => b.id === "C34").pareja = "C12";
  assert.throws(() => sortear(raro, rngSemilla(8)), /parejas no soportada/);
});

test("barajar devuelve una permutación de la lista sin modificarla", async () => {
  const { barajar } = await import("../web/js/sorteo.js");
  const lista = banco.map(b => b.id);
  const copia = lista.slice();
  const b = barajar(lista, rngSemilla(9));
  assert.deepEqual(lista, copia);
  assert.deepEqual(b.slice().sort(), copia.slice().sort());
  assert.notDeepEqual(b, copia);
});
