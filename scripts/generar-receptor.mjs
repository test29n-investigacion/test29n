// Regenera receptor/Code.gs con las listas de campos de web/js/fila.js y la validación de receptor/valida.js.
import { readFileSync, writeFileSync } from "node:fs";
import { CAMPOS, CAMPOS_PREENSAYO } from "../web/js/fila.js";

const gsUrl = new URL("../receptor/Code.gs", import.meta.url);
const js = readFileSync(new URL("../receptor/valida.js", import.meta.url), "utf8");
let gs = readFileSync(gsUrl, "utf8");
const fn = js.slice(js.indexOf("function validarFilaRecibida")).split("\n}\n")[0] + "\n}\n";
gs = gs.replace(/var CAMPOS = \[[^\]]*\];/, `var CAMPOS = ${JSON.stringify(CAMPOS)};`)
  .replace(/var CAMPOS_PREENSAYO = \[[^\]]*\];/, `var CAMPOS_PREENSAYO = ${JSON.stringify(CAMPOS_PREENSAYO)};`);
const ini = gs.indexOf("function validarFilaRecibida");
const fin = gs.indexOf("\n}\n", ini) + 3;
gs = gs.slice(0, ini) + fn + gs.slice(fin);
writeFileSync(gsUrl, gs);
console.log("receptor/Code.gs actualizado");
