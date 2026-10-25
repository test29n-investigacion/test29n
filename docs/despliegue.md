# Despliegue de la web de la encuesta 29N

Se hace una vez, con la cuenta de Google y la de GitHub de Jaime. Unos 30 minutos. Necesitas Node 18 o superior en tu ordenador para los dos scripts de comprobación.

## 1. Hoja de respuestas y receptor (Google)

1. Crea una hoja de cálculo nueva en Google Drive, por ejemplo «Respuestas encuesta 29N». No la compartas con nadie: tiene las respuestas en bruto.
2. En la hoja: **Extensiones → Apps Script**.
3. Borra lo que haya en `Código.gs`, pega el contenido entero de `receptor/Code.gs` y guarda.
4. **Implementar → Nueva implementación → Tipo: Aplicación web.**
   - Descripción: «Receptor 29N».
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**. No elijas «Cualquier usuario con cuenta de Google»: la mayoría de los participantes no estarán conectados a Google en el móvil y sus envíos fallarían.
5. Autoriza los permisos. Google avisará de que «no ha verificado esta aplicación», porque el script es tuyo. Pulsa **Configuración avanzada → Ir a … (no seguro)**. Solo pide acceso a esa hoja.
6. Copia la **URL de la aplicación web**, que acaba en `/exec`.
7. Ábrela en el navegador. Debe mostrar `{"ok":true,"servicio":"encuesta 29N","version":"r2",…}`.

**Si alguna vez cambias `receptor/Code.gs`:** pégalo de nuevo y entra en **Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar**. Así la URL no cambia. Solo con guardar el código, la web sigue usando la versión anterior.

### Qué pestañas aparecerán solas en la hoja

| Pestaña | Qué guarda |
| --- | --- |
| `respuestas` | Una fila por participante (modos normal y piloto). Es la que se analiza. |
| `preensayo` | Las valoraciones del preensayo. |
| `pruebas` | Los envíos de `scripts/comprobar-despliegue.mjs`. No es para analizar. |
| `rechazadas` | Cualquier envío que no encaje con las columnas, guardado en bruto con el motivo. Debería estar vacía. Si aparece algo, avísame: los datos se recuperan del JSON. |
| `respuestas_2` | Solo aparece si cambias las columnas de la web en mitad de la recogida. Las filas nuevas nunca se mezclan con las viejas. |

**No edites la fila 1 (los nombres de las columnas) ni insertes columnas en `respuestas`.** Para analizar, trabaja sobre una copia.

## 2. Web (GitHub Pages)

1. Crea un repositorio en GitHub, por ejemplo `test29n`, y sube el proyecto entero a la rama `main` (incluida la carpeta `.github`).
2. En `web/config.js`, pega la URL del paso 1.6 en `RECEPTOR_URL`.
3. Las 16 imágenes ya están en `web/img/` (las genera `scripts/preparar-imagenes.py`). `node scripts/comprobar-banco.mjs` debe decir «Banco correcto».
4. En GitHub, ve a **Settings → Pages → Build and deployment → Source** y elige **GitHub Actions**. Cada vez que subas algo a `main`, la acción «Publicar web» pasa las pruebas, comprueba el banco y publica la carpeta `web/`. Si falta alguna imagen, no publica: es a propósito.
5. La web queda en `https://<usuario>.github.io/test29n/`.

## 3. Comprobación antes de lanzar

```
node scripts/comprobar-despliegue.mjs https://<usuario>.github.io/test29n/
```

El script comprueba:
- que `config.js` tiene la URL del receptor;
- que el receptor responde y tiene exactamente las mismas columnas que la web;
- que un envío de prueba llega a la pestaña `pruebas` y que repetirlo no lo duplica;
- que la web publicada sirve el banco y las 16 imágenes.

Tiene que acabar en «Todo correcto».

Después, en tu móvil y con datos móviles (no wifi), haz el test entero con `?modo=piloto&c=prueba`. Comprueba que la fila aparece en `respuestas` con `modo = piloto` y luego bórrala. Este último paso es el único que prueba el envío desde un navegador real hasta Google.

## 4. Enlaces por canal

Añade `?c=` y el nombre del canal (minúsculas, sin espacios):

- Instituto: `…/test29n/?c=instituto`
- Club de debate: `…/test29n/?c=debate`
- Redes: `…/test29n/?c=redes`
- Piloto: `…/test29n/?modo=piloto&c=piloto`
- Preensayo: `…/test29n/?modo=preensayo&c=preensayo`

## 5. Durante la recogida

Cada dos o tres días, descarga la pestaña `respuestas` (**Archivo → Descargar → Valores separados por comas**) y ejecuta:

```
node scripts/auditar-datos.mjs respuestas.csv
```

Muestra:
- **Errores:** filas que no deberían existir así. Debe salir 0.
- **Avisos:** filas válidas que conviene filtrar en el análisis, como quien dice que ya hizo el test, quien buscó en internet, quien tardó menos de 90 s en total o a quien no le cargaron imágenes.
- **Reparto por grupo A/B, por lista y por canal.**
- **Porcentaje de exposición de cada publicación,** que debe rondar el 50 %.
