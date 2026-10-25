// Servidor de pruebas: ejecuta receptor/Code.gs con una hoja en memoria.
// POST /exec → doPost · GET /hojas → contenido de todas las hojas · POST /reiniciar → hoja vacía.
// Uso: node tests/e2e/receptor-local.mjs 8766
import http from "node:http";
import { cargarReceptor } from "../apoyo/gs.mjs";

let rec = cargarReceptor();
const puerto = Number(process.argv[2] || 8766);
const json = (res, obj, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj));
};

http.createServer((req, res) => {
  let cuerpo = "";
  req.setEncoding("utf8");
  req.on("data", d => { cuerpo += d; });
  req.on("end", () => {
    if (req.method === "POST" && req.url === "/exec") return json(res, rec.post(cuerpo));
    if (req.method === "GET" && req.url === "/exec") return json(res, rec.get());
    if (req.method === "POST" && req.url === "/reiniciar") { rec = cargarReceptor(); return json(res, { ok: true }); }
    if (req.method === "GET" && req.url === "/hojas") {
      const salida = {};
      for (const [n, h] of rec.hojas) salida[n] = h.filas.map(f => f.map(v => (typeof v === "string" ? v : "<fecha>")));
      return json(res, salida);
    }
    json(res, { error: "ruta" }, 404);
  });
}).listen(puerto, "127.0.0.1", () => console.log("listo"));
