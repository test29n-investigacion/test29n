// Uso: node scripts/comprobar-banco.mjs  → sale con código 1 si el banco o sus imágenes tienen errores.
import { readFileSync, existsSync } from "node:fs";
import { validarBanco } from "../web/js/banco.js";

const web = new URL("../web/", import.meta.url);
const banco = JSON.parse(readFileSync(new URL("banco.json", web), "utf8"));
const errores = validarBanco(banco, ruta => existsSync(new URL(ruta, web)));
if (errores.length) {
  console.error("Errores en el banco:\n- " + errores.join("\n- "));
  process.exit(1);
}
console.log(`Banco correcto: ${banco.length} publicaciones con imagen.`);
