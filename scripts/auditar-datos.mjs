// Uso: node scripts/auditar-datos.mjs respuestas.csv
// (En la hoja: pestaña «respuestas» → Archivo → Descargar → Valores separados por comas.)
// Sale con código 1 si encuentra errores.
import { readFileSync } from "node:fs";
import { leerCSV, aObjetos, auditar, informe } from "./auditoria.js";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: node scripts/auditar-datos.mjs respuestas.csv");
  process.exit(2);
}
const banco = JSON.parse(readFileSync(new URL("../web/banco.json", import.meta.url), "utf8"));
const r = auditar(aObjetos(leerCSV(readFileSync(ruta, "utf8"))), banco);
console.log(informe(r));
process.exit(r.errores.length ? 1 : 0);
