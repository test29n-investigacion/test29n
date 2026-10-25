import { test } from "node:test";
import assert from "node:assert/strict";
import { enviarFila, crearEnviador } from "../web/js/envio.js";

const respuesta = (cuerpo, ok = true, status = 200) => ({ ok, status, json: async () => cuerpo });

function fetchFalso(salidas) {
  const llamadas = [];
  const fn = async (url, opciones) => {
    llamadas.push({ url, opciones });
    const s = salidas[Math.min(llamadas.length - 1, salidas.length - 1)];
    if (s instanceof Error) throw s;
    return s;
  };
  fn.llamadas = llamadas;
  return fn;
}

test("devuelve true al primer intento correcto y envía la fila como texto JSON", async () => {
  const f = fetchFalso([respuesta({ ok: true })]);
  assert.equal(await enviarFila({ a: "1" }, "https://receptor", { fetchFn: f, espera: 0 }), true);
  assert.equal(f.llamadas.length, 1);
  assert.equal(f.llamadas[0].opciones.method, "POST");
  assert.equal(f.llamadas[0].opciones.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.deepEqual(JSON.parse(f.llamadas[0].opciones.body), { a: "1" });
});

test("reintenta hasta 4 veces y devuelve false si todos fallan", async () => {
  const f = fetchFalso([new Error("sin red")]);
  assert.equal(await enviarFila({}, "https://receptor", { fetchFn: f, espera: 0 }), false);
  assert.equal(f.llamadas.length, 4);
});

test("reintenta si el receptor pide reintentar (cerrojo ocupado)", async () => {
  const f = fetchFalso([respuesta({ ok: false, reintentar: true }), respuesta({ ok: true })]);
  assert.equal(await enviarFila({}, "https://receptor", { fetchFn: f, espera: 0 }), true);
  assert.equal(f.llamadas.length, 2);
});

test("reintenta si la respuesta no es JSON (página de error de Google)", async () => {
  const html = { ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } };
  const f = fetchFalso([html, respuesta({ ok: true })]);
  assert.equal(await enviarFila({}, "https://receptor", { fetchFn: f, espera: 0 }), true);
  assert.equal(f.llamadas.length, 2);
});

test("se recupera si el segundo intento funciona", async () => {
  const f = fetchFalso([respuesta({}, false, 500), respuesta({ ok: true })]);
  assert.equal(await enviarFila({}, "https://receptor", { fetchFn: f, espera: 0 }), true);
  assert.equal(f.llamadas.length, 2);
});

test("devuelve false si el receptor responde ok:false, sin reintentar", async () => {
  const f = fetchFalso([respuesta({ ok: false, error: "campo no permitido" })]);
  assert.equal(await enviarFila({}, "https://receptor", { fetchFn: f, espera: 0 }), false);
  assert.equal(f.llamadas.length, 1);
});

test("dos llamadas seguidas con crearEnviador hacen un solo fetch", async () => {
  const f = fetchFalso([respuesta({ ok: true })]);
  const enviar = crearEnviador("https://receptor", { fetchFn: f, espera: 0 });
  const [a, b] = await Promise.all([enviar({ x: "1" }), enviar({ x: "1" })]);
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(f.llamadas.length, 1);
});

test("tras un envío correcto, crearEnviador no vuelve a enviar", async () => {
  const f = fetchFalso([respuesta({ ok: true })]);
  const enviar = crearEnviador("https://receptor", { fetchFn: f, espera: 0 });
  await enviar({});
  assert.equal(await enviar({}), true);
  assert.equal(f.llamadas.length, 1);
});

test("tras un envío fallido, crearEnviador permite reintentar", async () => {
  const f = fetchFalso([new Error("x"), new Error("x"), new Error("x"), new Error("x"), respuesta({ ok: true })]);
  const enviar = crearEnviador("https://receptor", { fetchFn: f, espera: 0 });
  assert.equal(await enviar({}), false);
  assert.equal(await enviar({}), true);
  assert.equal(f.llamadas.length, 5);
});
