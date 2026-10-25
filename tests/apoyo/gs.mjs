// Ejecuta receptor/Code.gs tal cual en Node, con dobles de los servicios de Google (hoja, cerrojo, caché).
// Así las pruebas recorren el mismo código que se pega en Apps Script.
import { readFileSync } from "node:fs";
import vm from "node:vm";

function hojaFalsa(nombre) {
  return {
    nombre,
    filas: [],
    getName() { return nombre; },
    appendRow(a) { this.filas.push(Array.from(a)); }, // Array.from: copia como array de este contexto
    getLastRow() { return this.filas.length; },
    getLastColumn() { return this.filas.reduce((m, f) => Math.max(m, f.length), 0); },
    getRange(r, c, nr, nc) {
      const s = this;
      return {
        getValues() {
          return s.filas.slice(r - 1, r - 1 + nr).map(f => {
            const x = f.slice(c - 1, c - 1 + nc);
            while (x.length < nc) x.push("");
            return x;
          });
        },
      };
    },
  };
}

export function cargarReceptor() {
  const hojas = new Map();
  const cache = new Map();
  const ctrl = { cerrojo: true, cacheRota: false };
  const libro = {
    getSheetByName: n => hojas.get(n) || null,
    insertSheet: n => { const h = hojaFalsa(n); hojas.set(n, h); return h; },
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => libro },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => ctrl.cerrojo,
        waitLock() { if (!ctrl.cerrojo) throw new Error("Lock timeout"); },
        releaseLock() {},
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: k => { if (ctrl.cacheRota) throw new Error("cache"); return cache.has(k) ? cache.get(k) : null; },
        put: (k, v) => { if (ctrl.cacheRota) throw new Error("cache"); cache.set(k, v); },
      }),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: t => ({ texto: t, setMimeType() { return this; } }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../../receptor/Code.gs", import.meta.url), "utf8"), ctx);
  const post = cuerpo => JSON.parse(ctx.doPost({
    postData: { contents: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) },
  }).texto);
  const get = () => JSON.parse(ctx.doGet({}).texto);
  return { post, get, hojas, ctrl };
}
