// Comprueba la web y el receptor YA PUBLICADOS. Se ejecuta después de desplegar y antes de lanzar:
//   node scripts/comprobar-despliegue.mjs https://<usuario>.github.io/test29n/
// 1. config.js tiene una URL de receptor de Apps Script.
// 2. El receptor responde y tiene exactamente los mismos campos que esta versión de la web
//    (si no, te olvidaste de pegar el Code.gs nuevo o de publicar una versión nueva de la implementación).
// 3. Un envío de prueba se guarda (en la pestaña «pruebas», no en «respuestas») y repetirlo no lo duplica.
// 4. La web publicada sirve banco.json, config.js con esa misma URL y las 16 imágenes.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { CAMPOS, CAMPOS_PREENSAYO } from "../web/js/fila.js";
import { RECEPTOR_URL as URL_CONFIG } from "../web/config.js";

// RECEPTOR_PRUEBA solo lo usan las pruebas de este script contra un receptor local.
const RECEPTOR_URL = process.env.RECEPTOR_PRUEBA || URL_CONFIG;

let fallos = 0;
const bien = m => console.log("  ✔ " + m);
const mal = m => { fallos++; console.log("  ✘ " + m); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("1. config.js");
if (/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(RECEPTOR_URL)) bien("RECEPTOR_URL es una URL /exec de Apps Script");
else mal(`RECEPTOR_URL no parece la URL de la aplicación web (acaba en /exec): «${RECEPTOR_URL}»`);

console.log("2. Receptor");
try {
  const g = await (await fetch(RECEPTOR_URL)).json();
  bien(`responde (versión del receptor ${g.version || "desconocida"})`);
  if (igual(g.campos, CAMPOS) && igual(g.campos_preensayo, CAMPOS_PREENSAYO)) bien("los campos coinciden con esta versión de la web");
  else mal("los campos NO coinciden: pega receptor/Code.gs otra vez y publica una versión nueva (Implementar → Gestionar implementaciones → lápiz → Versión: nueva)");
} catch (e) {
  mal(`no responde como se espera (${e.message}). ¿Acceso «Cualquier usuario»? ¿La URL es la de /exec?`);
}

console.log("3. Envío de prueba");
try {
  const fila = Object.fromEntries(CAMPOS.map(c => [c, ""]));
  Object.assign(fila, { version_app: "comprobacion", modo: "prueba", canal: "comprobacion", id_envio: randomBytes(8).toString("hex") });
  const enviar = async () => (await fetch(RECEPTOR_URL, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(fila),
  })).json();
  const r1 = await enviar();
  if (r1.ok === true && !r1.guardada) bien("se guarda (mira la pestaña «pruebas» de la hoja: debe haber una fila «comprobacion»)");
  else mal(`respuesta inesperada: ${JSON.stringify(r1)}`);
  const r2 = await enviar();
  if (r2.ok === true) bien("repetir el mismo envío no da error (y no debe aparecer una segunda fila en «pruebas»)");
  else mal(`el reenvío falla: ${JSON.stringify(r2)}`);
} catch (e) {
  mal(`el envío falla: ${e.message}`);
}

const web = process.argv[2];
console.log("4. Web publicada");
if (!web) console.log("  (sin comprobar: pasa la URL de la web como argumento)");
else {
  const base = web.endsWith("/") ? web : web + "/";
  try {
    const cfg = await (await fetch(base + "config.js", { cache: "no-store" })).text();
    if (cfg.includes(RECEPTOR_URL)) bien("config.js publicado apunta al mismo receptor");
    else mal("config.js publicado NO tiene la URL del receptor (¿falta hacer push?)");
    const banco = await (await fetch(base + "banco.json", { cache: "no-store" })).json();
    const local = JSON.parse(readFileSync(new URL("../web/banco.json", import.meta.url), "utf8"));
    if (igual(banco, local)) bien(`banco.json publicado = el local (${banco.length} publicaciones)`);
    else mal("banco.json publicado es distinto del local (¿falta hacer push?)");
    let sinImagen = 0;
    for (const b of banco) {
      const r = await fetch(base + b.img, { method: "GET" });
      const tipo = r.headers.get("content-type") || "";
      if (!r.ok || !tipo.startsWith("image/")) { sinImagen++; mal(`${b.id}: ${b.img} no se sirve como imagen (${r.status} ${tipo})`); }
    }
    if (!sinImagen) bien(`las ${banco.length} imágenes se sirven`);
  } catch (e) {
    mal(`no se puede leer la web: ${e.message}`);
  }
}

console.log(fallos ? `\n${fallos} problema(s). No lances todavía.` : "\nTodo correcto. Último paso: haz el test en tu móvil con ?modo=piloto&c=prueba y mira la fila en «respuestas».");
process.exit(fallos ? 1 : 0);
