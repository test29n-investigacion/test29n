import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarBanco } from "../web/js/banco.js";

const banco = JSON.parse(readFileSync(new URL("../web/banco.json", import.meta.url), "utf8"));
const copia = () => structuredClone(banco);
const cuenta = (tipo, lado) => banco.filter(b => b.tipo === tipo && b.lado === lado).length;

test("el banco real es válido", () => {
  assert.deepEqual(validarBanco(banco), []);
});

test("tiene 16 entradas: 4+4 verdaderas, 2+2 tradicionales, 2+2 IA", () => {
  assert.equal(banco.length, 16);
  for (const lado of ["izq", "der"]) {
    assert.equal(cuenta("verdadero", lado), 4);
    assert.equal(cuenta("tradicional", lado), 2);
    assert.equal(cuenta("ia", lado), 2);
  }
});

test("las parejas del 29N son C01-C21 y C04-C36", () => {
  const p = Object.fromEntries(banco.filter(b => b.pareja).map(b => [b.id, b.pareja]));
  assert.deepEqual(p, { C36: "C04", C01: "C21", C04: "C36", C21: "C01" });
});

test("detecta id repetido", () => {
  assert.match(validarBanco([...copia(), copia()[0]]).join(" "), /repetido/);
});

test("detecta pareja no recíproca", () => {
  const b = copia();
  delete b.find(x => x.id === "C21").pareja;
  assert.match(validarBanco(b).join(" "), /pareja/);
});

test("detecta pareja que apunta a un id inexistente", () => {
  const b = copia();
  b.find(x => x.id === "C01").pareja = "C99";
  assert.match(validarBanco(b).join(" "), /pareja/);
});

test("detecta campo que falta", () => {
  const b = copia();
  delete b[0].texto;
  assert.match(validarBanco(b).join(" "), /texto/);
});

test("detecta tipo inválido", () => {
  const b = copia();
  b[0].tipo = "montaje";
  assert.match(validarBanco(b).join(" "), /tipo/);
});

test("detecta lado inválido", () => {
  const b = copia();
  b[0].lado = "centro";
  assert.match(validarBanco(b).join(" "), /lado/);
});

test("detecta imagen inexistente si se pasa existeArchivo", () => {
  assert.match(validarBanco(banco, () => false).join(" "), /imagen/);
});

test("no exige imágenes si no se pasa existeArchivo", () => {
  assert.deepEqual(validarBanco(banco), []);
});
