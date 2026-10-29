// Flujo de pantallas (spec §6, §7, §9). Es el único módulo que toca la página.
import { RECEPTOR_URL, VERSION_APP, OLEADA } from "../config.js";
import { validarBanco, activas } from "./banco.js";
import { sortear, barajar } from "./sorteo.js";
import { leerCanal, construirFila, construirFilaPreensayo, fechaLocal } from "./fila.js";
import { crearEnviador } from "./envio.js";
import {
  TEXTOS, CONSEJOS, EDAD, BLOQUE1, BLOQUE3, IDEOLOGIA, POR_PUBLICACION, PILOTO, PILOTO_EXTRA, PREENSAYO,
} from "./preguntas.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const params = new URLSearchParams(location.search);
const MODO = ["normal", "piloto", "preensayo"].includes(params.get("modo")) ? params.get("modo") : "normal";

const S = { r: {}, t: {}, fuera: {}, img: {}, i: 0, pantallas: [], inicio: 0, t0: 0, banco: [], porId: {}, idEnvio: "" };

/** 16 caracteres hexadecimales al azar. Solo sirve para que un reintento no cree una fila duplicada. */
function nuevoIdEnvio() {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

/* ---------- Construcción de la lista de pantallas ---------- */
function construirPantallas() {
  const p = [{ tipo: "bienvenida" }, { tipo: "pregunta", q: EDAD, filtroEdad: true }];
  if (MODO === "preensayo") {
    p.push({ tipo: "instruccion", titulo: TEXTOS.instruccionPreensayoTitulo, texto: TEXTOS.instruccionPreensayo });
    S.orden.forEach((id, n) => p.push({ tipo: "publicacion", id, n, total: S.orden.length }));
    p.push({ tipo: "pregunta", q: IDEOLOGIA });
  } else {
    BLOQUE1.forEach(q => p.push({ tipo: "pregunta", q }));
    p.push({ tipo: "instruccion", titulo: TEXTOS.instruccionTitulo, texto: TEXTOS.instruccion });
    S.orden.forEach((id, n) => p.push({ tipo: "publicacion", id, n, total: S.orden.length }));
    BLOQUE3.forEach(q => p.push({ tipo: "pregunta", q }));
  }
  p.push({ tipo: "enviar" });
  return p;
}

/* ---------- Piezas de interfaz ---------- */
function htmlPregunta(clave, q) {
  const v = S.r[clave];
  const marcada = o => (Array.isArray(v) ? v.includes(o) : v === o);
  let cuerpo;
  if (q.lista) {
    cuerpo = `<select class="opt" id="sel-${esc(clave)}" data-k="${esc(clave)}" aria-label="${esc(q.t)}">
      <option value="">Elige una opción</option>${q.o.map(o => `<option${v === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  } else {
    const n = q.fila || 0;
    const clases = ["opts", n ? "fila" : "", n > 5 ? "larga" : ""].join(" ");
    cuerpo = `<div class="${clases}" style="${n ? `--n:${n}` : ""}" role="group" aria-label="${esc(q.t)}">${q.o.map((o, i) =>
      `<button type="button" class="opt${n && i >= n ? " ancha" : ""}" data-k="${esc(clave)}" data-v="${esc(o)}" aria-pressed="${marcada(o)}">${esc(o)}</button>`).join("")}</div>`;
  }
  return `<div class="pregunta" data-pregunta="${esc(clave)}">
    <p class="enunciado">${esc(q.t)}</p>${q.sub ? `<p class="atenuado">${esc(q.sub)}</p>` : ""}
    ${cuerpo}${q.escala ? `<div class="escala"><span>${esc(q.escala[0])}</span><span>${esc(q.escala[1])}</span></div>` : ""}</div>`;
}

/** Matriz: una fila por elemento, cada una con la misma escala; cada fila se guarda en su propia clave. */
function htmlMatriz(q) {
  const filas = q.matriz.map(it => {
    const v = S.r[it.k];
    return `<div class="matriz-fila" data-pregunta="${esc(it.k)}"><p class="matriz-item">${esc(it.t)}</p>
      <div class="opts fila" style="--n:${q.o.length}" role="group" aria-label="${esc(it.t)}">${q.o.map(o =>
        `<button type="button" class="opt" data-k="${esc(it.k)}" data-v="${esc(o)}" aria-pressed="${v === o}">${esc(o)}</button>`).join("")}</div></div>`;
  }).join("");
  return `<div class="pregunta matriz"><p class="enunciado">${esc(q.t)}</p>${q.sub ? `<p class="atenuado">${esc(q.sub)}</p>` : ""}
    <div class="escala"><span>${esc(q.escala[0])}</span><span>${esc(q.escala[1])}</span></div>${filas}</div>`;
}

function htmlPublicacion(b) {
  const autor = S.grupo === "A" || MODO === "preensayo"
    ? `<span class="cuenta">${esc(b.cuenta)}</span>`
    : `<span class="cuenta-oculta" aria-label="Cuenta oculta"></span>`;
  return `<article class="post" aria-label="Publicación">
    <div class="post-cabecera"><span class="avatar" aria-hidden="true"></span>
      <div class="autor">${autor}<span class="fecha">${esc(b.fecha)}</span></div></div>
    <p class="post-texto">${esc(b.texto)}</p>
    <img class="post-imagen" src="${esc(b.img)}" alt="${esc(b.alt)}">
  </article>`;
}

function preguntasDePublicacion(b) {
  if (MODO === "preensayo") return PREENSAYO;
  const qs = [...POR_PUBLICACION];
  if (MODO === "piloto") qs.push(PILOTO);
  if (MODO === "piloto" && b.piloto_extra) qs.push(PILOTO_EXTRA);
  return qs;
}

/* ---------- Pantallas ---------- */
function pintar() {
  const p = S.pantallas[S.i];
  const m = $("pantalla");
  m.dataset.grupo = S.grupo || "";
  let html = "";
  let claves = [];
  let boton = "Siguiente";

  if (p.tipo === "bienvenida") {
    const parrafos = MODO === "preensayo" ? TEXTOS.bienvenidaPreensayo : TEXTOS.bienvenida;
    html = `<p class="etiqueta">Test · Elecciones 29N</p><h1>${esc(TEXTOS.titulo)}</h1>
      <div class="consentimiento">${parrafos.map(t => `<p>${esc(t)}</p>`).join("")}
      <p><a href="info.html" target="_blank" rel="noopener">Más información sobre el estudio</a></p>
      <p>${esc(TEXTOS.contacto)} <a href="mailto:${esc(TEXTOS.correo)}">${esc(TEXTOS.correo)}</a>.</p></div>`;
    boton = "Acepto y empiezo";
  } else if (p.tipo === "pregunta" && p.q.matriz) {
    html = htmlMatriz(p.q);
    claves = p.q.matriz.map(x => x.k);
  } else if (p.tipo === "pregunta") {
    html = htmlPregunta(p.q.k, p.q);
    claves = [p.q.k];
  } else if (p.tipo === "instruccion") {
    html = `<h2>${esc(p.titulo)}</h2>${p.texto.map(t => `<p>${esc(t)}</p>`).join("")}`;
    boton = "Empezar";
  } else if (p.tipo === "publicacion") {
    const b = S.porId[p.id];
    const qs = preguntasDePublicacion(b);
    html = htmlPublicacion(b) + qs.map(q => htmlPregunta(`${b.id}_${q.s}`, q)).join("");
    claves = qs.map(q => `${b.id}_${q.s}`);
    S.inicio = performance.now();
  } else if (p.tipo === "enviar") {
    html = `<h2>${esc(TEXTOS.enviarTitulo)}</h2><p>${esc(TEXTOS.enviar)}</p>
      <p class="aviso" id="error-envio" role="alert" hidden>${esc(TEXTOS.errorEnvio)}</p>
      <button type="button" class="boton" id="enviar">Enviar respuestas</button>
      <button type="button" class="boton" id="reintentar" hidden>Reintentar</button>`;
    boton = null;
  }

  m.innerHTML = html;
  if (boton) {
    m.insertAdjacentHTML("beforeend", `<p class="aviso" id="aviso-falta" role="status" hidden>${esc(TEXTOS.faltaRespuesta)}</p>
      <button type="button" class="boton" id="siguiente">${esc(boton)}</button>`);
    if (p.tipo === "bienvenida") {
      m.insertAdjacentHTML("beforeend", `<button type="button" class="boton secundario" id="no-acepto">No acepto</button>`);
      $("no-acepto").onclick = () => {
        $("progreso").hidden = true;
        $("pantalla").innerHTML = `<h2>Gracias</h2><p>${esc(TEXTOS.noAcepto)}</p>`;
      };
    }
    const sig = $("siguiente");
    const aviso = $("aviso-falta");
    // Ninguna respuesta es obligatoria salvo la edad (filtro de 14 años): si falta alguna, se avisa una vez
    // y el segundo clic deja seguir sin responder.
    const obligatoria = Boolean(p.filtroEdad);
    const actualizar = () => {
      const todas = claves.every(respondida);
      if (obligatoria) { sig.disabled = !todas; return; }
      if (todas) { aviso.hidden = true; sig.textContent = boton; }
    };
    actualizar();
    m.onclick = e => {
      const o = e.target.closest("button.opt[data-k]");
      if (!o) return;
      marcar(o.dataset.k, o.dataset.v, p.q);
      m.querySelectorAll(`button.opt[data-k="${CSS.escape(o.dataset.k)}"]`).forEach(x =>
        x.setAttribute("aria-pressed", String(estaMarcada(x.dataset.k, x.dataset.v))));
      actualizar();
    };
    m.onchange = e => {
      if (e.target.matches("select[data-k]")) { S.r[e.target.dataset.k] = e.target.value || undefined; actualizar(); }
    };
    sig.onclick = () => {
      if (!obligatoria && !claves.every(respondida) && S.avisado !== S.i) {
        S.avisado = S.i;
        aviso.hidden = false;
        sig.textContent = "Seguir sin responder";
        return;
      }
      avanzar(p);
    };
  } else {
    m.onclick = null;
    m.onchange = null;
  }
  if (p.tipo === "publicacion") {
    // El cronómetro cuenta desde que la imagen se ve (o desde que se sabe que no ha cargado), no desde
    // que se pinta la pantalla: con datos móviles lentos la espera no debe sumarse al tiempo de decisión.
    const img = m.querySelector(".post-imagen");
    const id = p.id;
    const sustituir = () => {
      if (S.pantallas[S.i] !== p) return;
      S.img[id] = "falta";
      if (!claves.some(respondida)) S.inicio = performance.now();
      img.replaceWith(Object.assign(document.createElement("div"), { className: "img-falta", textContent: img.alt }));
    };
    const cargada = () => {
      if (S.pantallas[S.i] !== p) return;
      S.img[id] = "ok";
      if (!claves.some(respondida)) S.inicio = performance.now();
    };
    if (img.complete && img.naturalWidth > 0) S.img[id] = "ok";
    else if (img.complete) sustituir();
    else {
      img.addEventListener("error", sustituir, { once: true });
      img.addEventListener("load", cargada, { once: true });
    }
  }
  if (p.tipo === "enviar") prepararEnvio();
  progreso(p);
  window.scrollTo(0, 0);
}

function respondida(k) {
  const v = S.r[k];
  return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
}
function estaMarcada(k, v) {
  const actual = S.r[k];
  return Array.isArray(actual) ? actual.includes(v) : actual === v;
}
function marcar(k, v, q) {
  if (q && q.k === k && q.max) {
    const a = Array.isArray(S.r[k]) ? S.r[k] : [];
    S.r[k] = a.includes(v) ? a.filter(x => x !== v) : a.length < q.max ? [...a, v] : a;
  } else {
    S.r[k] = v;
  }
}

function avanzar(p) {
  if (p.filtroEdad && S.r.edad === "Menos de 14") {
    $("progreso").hidden = true;
    $("pantalla").innerHTML = `<h2>Gracias</h2><p>${esc(TEXTOS.menor)}</p>`;
    return;
  }
  if (p.tipo === "bienvenida") S.t0 = performance.now();
  if (p.tipo === "publicacion") S.t[p.id] = performance.now() - S.inicio;
  S.i += 1;
  pintar();
}

function progreso(p) {
  const visible = p.tipo !== "bienvenida";
  $("progreso").hidden = !visible;
  $("barra").style.width = `${Math.round((100 * S.i) / (S.pantallas.length - 1))}%`;
  $("contador").textContent = p.tipo === "publicacion" ? `${p.n + 1} / ${p.total}` : "";
}

/* ---------- Envío y resultado ---------- */
function prepararEnvio() {
  const enviar = crearEnviador(RECEPTOR_URL);
  const fila = MODO === "preensayo" ? construirFilaPreensayo(estadoFila()) : construirFila(estadoFila());
  const intentar = async boton => {
    boton.disabled = true;
    boton.textContent = "Enviando…";
    $("error-envio").hidden = true;
    const ok = await enviar(fila);
    if (ok) return MODO === "preensayo" ? pintarGracias() : pintarResultado();
    $("error-envio").hidden = false;
    $("enviar").hidden = true;
    const r = $("reintentar");
    r.hidden = false;
    r.disabled = false;
    r.textContent = "Reintentar";
  };
  $("enviar").onclick = e => intentar(e.currentTarget);
  $("reintentar").onclick = e => intentar(e.currentTarget);
}

function estadoFila() {
  return {
    config: { version_app: VERSION_APP, oleada: OLEADA }, modo: MODO, fecha: fechaLocal(), canal: leerCanal(location.search),
    grupo: S.grupo, listaDer: S.listaDer, orden: S.orden, r: S.r, t: S.t, fuera: S.fuera, img: S.img,
    idEnvio: S.idEnvio, duracion: (performance.now() - S.t0) / 1000,
  };
}

function pintarGracias() {
  $("progreso").hidden = true;
  $("pantalla").innerHTML = `<div id="gracias" class="pila"><h2>Gracias</h2><p>${esc(TEXTOS.gracias)}</p></div>`;
}

function pintarResultado() {
  $("progreso").hidden = true;
  const aciertos = S.orden.filter(id => {
    const v = S.r[`${id}_resp`];
    return v && (v === "Real") === (S.porId[id].tipo === "verdadero");
  }).length;
  const tecnica = { ia: " · Imagen hecha con IA", tradicional: " · Imagen real fuera de contexto", verdadero: "" };
  const items = S.orden.map(id => {
    const b = S.porId[id];
    const real = b.tipo === "verdadero";
    const v = S.r[`${id}_resp`];
    const bien = v && (v === "Real") === real;
    const marca = !v ? `<span class="acierto neutro">Sin responder</span>`
      : `<span class="acierto ${bien ? "bien" : "mal"}">${bien ? "✓ Acertaste" : "✗ Fallaste"}</span>`;
    return `<li class="resultado-item"><span class="sello ${real ? "real" : "falso"}">${real ? "Real" : "Falsa"}</span>
      <div><p>${esc(b.texto)}</p><p class="tu-respuesta">${marca} · Tu respuesta: ${esc(v || "—")}${tecnica[b.tipo]}</p>
      <a href="${esc(b.verif)}" target="_blank" rel="noopener noreferrer">Ver la verificación</a></div></li>`;
  }).join("");
  $("pantalla").innerHTML = `<div id="resultado" class="pila">
    <p class="etiqueta">Tu resultado</p>
    <p><span class="puntos" id="puntuacion">${aciertos}</span><span class="atenuado"> / 8</span></p>
    <h2>Así eran las publicaciones</h2><ul class="resultados">${items}</ul>
    <h2>Tres consejos</h2><ol class="consejos">${CONSEJOS.map(c => `<li>${esc(c.texto)}${(c.enlaces || []).map((e, i) => `${i ? "," : ""} <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.t)}</a>`).join("")}${c.enlaces ? "." : ""}</li>`).join("")}</ol>
    <button type="button" class="boton" id="compartir">Compartir mi puntuación</button>
    <p class="atenuado" id="compartir-aviso">Solo se comparte el número de aciertos, nunca qué publicaciones eran falsas.</p></div>`;
  $("compartir").onclick = async () => {
    const texto = TEXTOS.compartir(aciertos);
    const url = `${location.origin}${location.pathname}?c=compartido`;
    const aviso = $("compartir-aviso");
    try {
      if (navigator.share) { await navigator.share({ text: texto, url }); return; }
      await navigator.clipboard.writeText(`${texto} ${url}`);
      aviso.textContent = "Texto copiado. Pégalo donde quieras compartirlo.";
    } catch {
      aviso.textContent = `${texto} ${url}`;
    }
  };
}

/* ---------- Arranque ---------- */
document.addEventListener("visibilitychange", () => {
  const p = S.pantallas[S.i];
  if (document.hidden && p && p.tipo === "publicacion") S.fuera[p.id] = true;
});

async function iniciar() {
  try {
    if (!RECEPTOR_URL) throw new Error("falta RECEPTOR_URL en config.js");
    S.idEnvio = nuevoIdEnvio();
    const banco = await (await fetch("banco.json", { cache: "no-store" })).json();
    if (validarBanco(banco).length) throw new Error("banco no válido");
    S.banco = banco;
    S.porId = Object.fromEntries(banco.map(b => [b.id, b]));
    // Las marcadas como «oculta» no se sortean en el test; el preensayo sigue mostrando las 16 para evaluarlas.
    const enUso = activas(banco);
    if (MODO === "preensayo") {
      S.orden = barajar(banco.map(b => b.id));
      S.grupo = "";
      S.listaDer = 0;
    } else {
      Object.assign(S, sortear(enUso));
    }
    // Precarga: cuando llegue cada publicación su imagen ya suele estar en el móvil.
    S.orden.forEach(id => { new Image().src = S.porId[id].img; });
    S.pantallas = construirPantallas();
    pintar();
  } catch {
    $("pantalla").innerHTML = `<p>${esc(TEXTOS.noDisponible)}</p>`;
  }
}
iniciar();
