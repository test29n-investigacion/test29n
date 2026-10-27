// Textos de la encuesta. Las preguntas son literales del «Cuestionario 29N — borrador v1», salvo con1
// (25 oct: «¿Cuántos diputados tiene el Congreso?» era demasiado difícil y se cambió por una sobre los candidatos)
// y las fuentes de información (26 oct: matriz de frecuencia en lugar de «elige hasta dos»).

export const TEXTOS = {
  titulo: "¿Sabrías detectar los bulos de esta campaña?",
  bienvenida: [
    "Hola. Soy Jaime, estudiante de bachillerato en el Colegio San Agustín de Madrid, y estoy haciendo una investigación sobre cómo los jóvenes distinguimos publicaciones reales y falsas durante las elecciones.",
    "Son unos 5 minutos. Es anónima: no pedimos nombre, correo ni ningún dato que te identifique, y no preguntamos a quién votas. Puedes dejarla cuando quieras; si no llegas al final, no se guarda nada. Los resultados solo se publicarán agrupados, nunca respuestas individuales.",
    "Al terminar verás tu puntuación y qué publicaciones eran reales y cuáles falsas.",
  ],
  bienvenidaPreensayo: [
    "Hola. Soy Jaime, estudiante de bachillerato en el Colegio San Agustín de Madrid. Estoy preparando una investigación sobre bulos en la campaña electoral y necesito tu ayuda para elegir las publicaciones del test.",
    "Son unos 5 minutos y es anónimo. Si no llegas al final, no se guarda nada.",
  ],
  menor: "Esta encuesta es para personas de 14 años o más. Gracias por tu interés; no se ha guardado nada.",
  correo: "test29n.investigacion@gmail.com",
  contacto: "Si tienes dudas sobre el estudio o sobre el uso de los datos, escribe a",
  noAcepto: "De acuerdo. No se ha guardado nada. Gracias por tu tiempo.",
  faltaRespuesta: "Te has dejado alguna pregunta sin responder. Puedes contestarla o seguir sin responder.",
  instruccionTitulo: "Ahora te mostramos las 8 publicaciones",
  instruccion: [
    "Imagina que estás mirando tus redes sociales y te van saliendo estas publicaciones.",
    "Son 8 publicaciones que han circulado en redes durante esta campaña electoral. Algunas son reales y otras falsas.",
    "No hay nota: nos interesa tu primera impresión, así que responde sin buscar en internet.",
    "Responde pensando en la publicación entera: lo que dice el texto y lo que muestra la imagen.",
  ],
  instruccionPreensayoTitulo: "Valora 16 publicaciones",
  instruccionPreensayo: [
    "No tienes que decidir si son reales o falsas. Para cada una, dinos cómo de creíble te parece y a quién crees que perjudica.",
  ],
  enviarTitulo: "Ya está",
  enviar: "Pulsa el botón para enviar tus respuestas. Hasta ahora no ha salido nada de tu móvil.",
  errorEnvio: "No hemos podido guardar tus respuestas. Comprueba tu conexión y vuelve a intentarlo.",
  gracias: "Gracias. Tus valoraciones nos ayudan a elegir las publicaciones del test.",
  noDisponible: "La encuesta no está disponible ahora mismo. Vuelve a intentarlo más tarde.",
  compartir: n => `He acertado ${n} de 8 en el test de bulos del 29N. ¿Y tú?`,
};

// Cada consejo: texto y, si hace falta, enlaces que se muestran detrás.
export const CONSEJOS = [
  { texto: "Busca de dónde ha salido la imagen: una comprobación rápida en Google Lens sirve." },
  {
    texto: "Antes de compartir u opinar, verifícalo con algún medio especializado:",
    enlaces: [
      { t: "Maldita", url: "https://maldita.es/" },
      { t: "Newtral", url: "https://www.newtral.es/zona-verificacion/" },
      { t: "EFE Verifica", url: "https://verifica.efe.com/" },
    ],
  },
  { texto: "Fíjate en los detalles de la publicación: quién la publica, la fecha y el estilo de redacción." },
];

// La edad es la única pregunta obligatoria: hace falta para comprobar que se puede participar (14 años o más).
export const EDAD = { k: "edad", t: "¿Cuántos años tienes?", sub: "Es la única pregunta obligatoria: la necesitamos para comprobar que puedes participar.",
  o: ["Menos de 14", "14–15", "16–17", "18–19", "20 o más"] };

// Matriz de frecuencia (sugerencia de A. Ardèvol-Abreu, 26 oct): una fila por medio, de 1 (nunca) a 5 (todo el tiempo).
// Cada fila se guarda en su propia columna (info_*); fila.js tiene la misma lista de claves (lo comprueba una prueba).
export const FUENTES = {
  k: "fuentes", t: "¿Con qué frecuencia te informas sobre política en cada uno de estos sitios?", sub: "De 1 (nunca) a 5 (todo el tiempo).",
  matriz: [
    { k: "info_tiktok", t: "TikTok" }, { k: "info_instagram", t: "Instagram" }, { k: "info_youtube", t: "YouTube" },
    { k: "info_x", t: "X (Twitter)" }, { k: "info_mensajeria", t: "WhatsApp o Telegram" }, { k: "info_tv", t: "Televisión" },
    { k: "info_prensa", t: "Prensa digital o en papel" }, { k: "info_radio", t: "Radio o pódcast" }, { k: "info_familia", t: "Familia y amigos" },
  ],
  o: ["1", "2", "3", "4", "5"], fila: 5, escala: ["Nunca", "Todo el tiempo"],
};

export const BLOQUE1 = [
  { k: "estudios", t: "¿Qué estás estudiando ahora?", o: ["ESO", "Bachillerato", "FP", "Universidad", "No estudio", "Otro"] },
  { k: "ccaa", t: "¿En qué comunidad autónoma vives?", lista: true,
    o: ["Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria", "Castilla-La Mancha", "Castilla y León", "Cataluña",
      "Comunidad Valenciana", "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarra", "País Vasco", "Ceuta", "Melilla"] },
  { k: "voto", t: "¿Podrás votar en las elecciones del 29 de noviembre?", o: ["Sí, por primera vez", "Sí, y ya he votado antes", "No, aún no tengo edad", "No lo sé"] },
  FUENTES,
  { k: "horas_redes", t: "¿Cuánto tiempo pasas al día en redes sociales?", o: ["Menos de 1 h", "1–2 h", "2–4 h", "Más de 4 h"] },
  { k: "comprueba", t: "Antes de creerte o compartir una noticia, ¿compruebas si es verdad?", o: ["Nunca", "A veces", "A menudo", "Siempre"] },
  { k: "conoce_verificadores", t: "¿Conoces Maldita, Newtral o EFE Verifica?", o: ["Sí, y los uso", "Sí, pero no los uso", "No"] },
];

export const IDEOLOGIA = {
  k: "ideologia",
  t: "Cuando se habla de política se usan las expresiones izquierda y derecha. En una escala del 1 (izquierda) al 10 (derecha), ¿dónde te situarías?",
  o: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Prefiero no responder"], fila: 10, escala: ["Izquierda", "Derecha"],
};

export const BLOQUE3 = [
  { k: "autoestimacion", t: "¿Cuántas de las 8 publicaciones crees que has acertado?", o: ["0", "1", "2", "3", "4", "5", "6", "7", "8"], fila: 9 },
  { k: "buscado", t: "¿Has buscado alguna de las publicaciones en internet?", sub: "No pasa nada si lo has hecho: nos ayuda a interpretar los datos.", o: ["Sí", "No"], fila: 2 },
  { k: "interes", t: "¿Cuánto te interesa la política?", o: ["Mucho", "Bastante", "Poco", "Nada"] },
  { k: "con1", t: "¿Quién es el candidato del PP a presidente del Gobierno en estas elecciones?", o: ["Isabel Díaz Ayuso", "Alberto Núñez Feijóo", "Santiago Abascal", "No lo sé"] },
  { k: "con2", t: "Tras las elecciones, ¿quién propone al candidato a presidente del Gobierno?", o: ["El presidente del Congreso", "El Rey", "El partido más votado", "No lo sé"] },
  { k: "con3", t: "¿Cada cuántos años, como máximo, se celebran elecciones generales?", o: ["3", "4", "5", "No lo sé"] },
  IDEOLOGIA,
  { k: "repetido", t: "¿Habías hecho ya este test antes?", o: ["Sí", "No"], fila: 2 },
];

// Preguntas que acompañan a cada publicación. El sufijo se añade al id: C12_resp, C12_seg…
export const POR_PUBLICACION = [
  { s: "resp", t: "¿Crees que esta publicación es real o falsa?", o: ["Real", "Falsa"], fila: 2 },
  { s: "seg", t: "¿Cómo de seguro estás?", o: ["1", "2", "3", "4", "5"], fila: 5, escala: ["Nada", "Totalmente"] },
  { s: "visto", t: "¿Habías visto antes esta publicación?", o: ["Sí", "No", "No estoy seguro"], fila: 3 },
];
export const PILOTO = { s: "entiende", t: "¿Entiendes de qué trata esta publicación?", o: ["Sí", "Más o menos", "No"], fila: 3 };
export const PILOTO_EXTRA = { s: "quien", t: "¿Sabes quién es la persona de la imagen?", o: ["Sí", "No"], fila: 2 };
export const PREENSAYO = [
  { s: "cred", t: "¿Cómo de creíble te parece?", o: ["1", "2", "3", "4", "5"], fila: 5, escala: ["Nada", "Totalmente"] },
  { s: "lado", t: "¿A quién crees que perjudica?", o: ["A la izquierda", "A la derecha", "A ninguno", "No lo sé"] },
];
