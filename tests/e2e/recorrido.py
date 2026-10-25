"""Recorridos completos de la web en un navegador de móvil (Playwright + Chromium).

Uso: python3 tests/e2e/recorrido.py
Sirve web/ en un puerto local, sustituye config.js por uno de prueba y simula el receptor
interceptando las peticiones a https://receptor.test/exec.
"""
import asyncio, base64, functools, http.server, io, json, re, shutil, subprocess, sys, tempfile, threading, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

WEB = Path(__file__).resolve().parents[2] / "web"
RECEPTOR = "https://receptor.test/exec"
PUERTO = 8765
PUERTO_RECEPTOR = 8766
PUERTO_COPIA = 8767  # copia de web/ con config e imágenes de prueba: se prueba sin interceptar nada
LOCAL = f"http://127.0.0.1:{PUERTO_RECEPTOR}"
BANCO = json.loads((WEB / "banco.json").read_text())
POR_TEXTO = {b["texto"]: b for b in BANCO}
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
sys.path.insert(0, str(Path(__file__).parent))

CAMPOS = json.loads(__import__("subprocess").check_output(
    ["node", "-e", "import('./web/js/fila.js').then(m=>console.log(JSON.stringify({n:m.CAMPOS,p:m.CAMPOS_PREENSAYO})))"],
    cwd=WEB.parent, text=True))


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def servir(directorio=WEB, puerto=PUERTO):
    h = functools.partial(Silencioso, directory=str(directorio))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", puerto), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def preparar_copia():
    """Copia web/ a una carpeta temporal con un config.js que apunta al receptor local y 16 JPEG de prueba."""
    from PIL import Image
    d = Path(tempfile.mkdtemp(prefix="web29n-"))
    shutil.copytree(WEB, d, dirs_exist_ok=True)
    (d / "config.js").write_text(f'export const RECEPTOR_URL="{LOCAL}/exec";export const VERSION_APP="v-test";export const OLEADA="29N";')
    for k, b in enumerate(BANCO):
        buf = io.BytesIO()
        Image.new("RGB", (800, 600), (40 + 12 * k, 90, 160)).save(buf, "JPEG")
        (d / b["img"]).parent.mkdir(exist_ok=True)
        (d / b["img"]).write_bytes(buf.getvalue())
    return d


class Receptor:
    def __init__(self):
        self.filas, self.estado = [], 200

    async def instalar(self, page):
        async def config(route):
            await route.fulfill(content_type="text/javascript",
                                body=f'export const RECEPTOR_URL="{RECEPTOR}";export const VERSION_APP="v-test";export const OLEADA="29N";')
        async def receptor(route):
            if self.estado != 200:
                await route.fulfill(status=self.estado, body="error")
                return
            self.filas.append(json.loads(route.request.post_data))
            await route.fulfill(content_type="application/json", body='{"ok":true}',
                                headers={"Access-Control-Allow-Origin": "*"})
        await page.route("**/config.js", config)
        await page.route(RECEPTOR, receptor)


async def responder_pantalla(page, opcion=1):
    """Responde todas las preguntas visibles eligiendo la opción indicada (o la última si hay menos)."""
    grupos = page.locator("[data-pregunta]")
    for i in range(await grupos.count()):
        g = grupos.nth(i)
        opts = g.locator("button.opt")
        n = await opts.count()
        if n:
            await opts.nth(min(opcion, n - 1)).click()
    for s in await page.locator("select").all():
        await s.select_option(index=3)


async def recorrer(page, opcion=1, hasta="enviar", al_pasar=None):
    """Avanza respondiendo hasta la pantalla de envío. Devuelve el número de pantallas."""
    pasos = 0
    while pasos < 80:
        # La primera pantalla aparece cuando llega banco.json: esperar a que haya un botón.
        await page.locator("#siguiente, #enviar, #pantalla h2").first.wait_for()
        if await page.locator("#enviar").count():
            if hasta == "enviar":
                return pasos
        await responder_pantalla(page, opcion)
        if al_pasar:
            await al_pasar(page, pasos)
        if not await page.locator("#siguiente").count():
            return pasos
        await page.locator("#siguiente").click()
        pasos += 1
    raise AssertionError("demasiadas pantallas")


PRUEBAS = []
def prueba(f):
    PRUEBAS.append(f)
    return f


@prueba
async def recorrido_normal(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/?c=instituto")
    await recorrer(page)
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for()
    assert len(rec.filas) == 1, rec.filas
    f = rec.filas[0]
    assert list(f.keys()) == CAMPOS["n"], "las claves no son CAMPOS"
    assert f["grupo"] in ("A", "B") and f["canal"] == "instituto" and f["modo"] == "normal"
    ids = [f[f"t{i}_id"] for i in range(1, 9)]
    assert len(set(ids)) == 8 and all(f[f"t{i}_resp"] in ("Real", "Falsa") for i in range(1, 9))
    assert all(int(f[f"t{i}_ms"]) >= 0 for i in range(1, 9))
    assert await page.locator(".resultado-item").count() == 8
    assert await page.locator("#puntuacion").inner_text() != ""
    assert not await page.locator("#progreso").is_visible(), "la barra de progreso sigue visible en el resultado"


@prueba
async def version_a_muestra_cuenta_y_b_no(ctx, rec):
    vistos = {}
    for _ in range(12):
        page = await ctx.new_page()
        await rec.instalar(page)
        await page.goto(f"http://127.0.0.1:{PUERTO}/")
        async def mirar(p, n):
            if await p.locator(".post").count() and "grupo" not in vistos.get(id(p), {}):
                grupo = await p.locator("main").get_attribute("data-grupo")
                cuenta = await p.locator(".post .cuenta").count()
                oculta = await p.locator(".post .cuenta-oculta").count()
                vistos.setdefault(grupo, []).append((cuenta, oculta))
        await recorrer(page, al_pasar=mirar)
        await page.close()
    assert "A" in vistos and "B" in vistos, vistos.keys()
    assert all(c == 1 and o == 0 for c, o in vistos["A"])
    assert all(c == 0 and o == 1 for c, o in vistos["B"])


@prueba
async def menor_de_14(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    await page.locator("#siguiente").click()
    await page.get_by_role("button", name="Menos de 14").click()
    await page.locator("#siguiente").click()
    await page.get_by_text("Esta encuesta es para personas de 14 años o más").wait_for()
    assert rec.filas == []


@prueba
async def recarga_a_mitad(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    async def recargar(p, n):
        if await p.locator(".post").count():
            raise StopAsyncIteration
    try:
        await recorrer(page, al_pasar=recargar)
    except StopAsyncIteration:
        pass
    await page.reload()
    await page.get_by_text("¿Sabrías detectar los bulos").wait_for()
    assert rec.filas == []


@prueba
async def doble_click_enviar(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    await recorrer(page)
    await page.locator("#enviar").dblclick()
    await page.locator("#resultado").wait_for()
    await page.wait_for_timeout(300)
    assert len(rec.filas) == 1, len(rec.filas)


@prueba
async def receptor_caido(ctx, rec):
    rec.estado = 500
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    await recorrer(page)
    await page.locator("#enviar").click()
    await page.get_by_text("No hemos podido guardar tus respuestas").wait_for(timeout=15000)
    assert await page.locator("#resultado").count() == 0
    rec.estado = 200
    await page.locator("#reintentar").click()
    await page.locator("#resultado").wait_for(timeout=15000)
    assert len(rec.filas) == 1


@prueba
async def sin_vuelta_atras_en_publicaciones(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    vistas = []
    async def mirar(p, n):
        if await p.locator(".post").count():
            vistas.append(await p.get_by_role("button", name="Atrás").count())
    await recorrer(page, al_pasar=mirar)
    assert len(vistas) == 8 and sum(vistas) == 0


@prueba
async def imagen_rota_se_puede_responder(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.route("**/img/*", lambda r: r.fulfill(status=404, body=""))
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    textos = []
    async def mirar(p, n):
        if await p.locator(".post").count():
            await p.locator(".post .img-falta").wait_for()
            textos.append(await p.locator(".post .post-texto").inner_text())
    await recorrer(page, al_pasar=mirar)
    assert len(textos) == 8 and all(textos)


@prueba
async def modo_piloto(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/?modo=piloto&c=piloto")
    entiende = []
    async def mirar(p, n):
        if await p.locator(".post").count():
            entiende.append(await p.get_by_text("¿Entiendes de qué trata esta publicación?").count())
    await recorrer(page, al_pasar=mirar)
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for()
    f = rec.filas[0]
    assert entiende == [1] * 8
    assert f["modo"] == "piloto" and all(f[f"t{i}_entiende"] for i in range(1, 9))
    ids = [f[f"t{i}_id"] for i in range(1, 9)]
    assert (f["quien_extra"] != "") == ("C09" in ids)


@prueba
async def modo_preensayo(ctx, rec):
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/?modo=preensayo")
    posts = []
    async def mirar(p, n):
        if await p.locator(".post").count():
            posts.append(1)
            assert await p.get_by_text("¿Crees que lo que muestra").count() == 0
    await recorrer(page, al_pasar=mirar)
    await page.locator("#enviar").click()
    await page.locator("#gracias").wait_for()
    f = rec.filas[0]
    assert len(posts) == 16
    assert list(f.keys()) == CAMPOS["p"] and f["modo"] == "preensayo"
    assert len({f[f"p{i}_id"] for i in range(1, 17)}) == 16


@prueba
async def ancho_320_sin_desplazamiento(ctx, rec):
    page = await ctx.new_page()
    await page.set_viewport_size({"width": 320, "height": 640})
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/?modo=piloto")
    anchos = []
    async def medir(p, n):
        anchos.append(await p.evaluate("document.documentElement.scrollWidth"))
    await recorrer(page, al_pasar=medir)
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for()
    anchos.append(await page.evaluate("document.documentElement.scrollWidth"))
    assert max(anchos) <= 320, max(anchos)


@prueba
async def sin_terceros_ni_cookies(ctx, rec):
    page = await ctx.new_page()
    hosts = set()
    page.on("request", lambda r: hosts.add(r.url.split("/")[2]))
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    await recorrer(page)
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for()
    assert hosts <= {f"127.0.0.1:{PUERTO}", "receptor.test"}, hosts
    assert await page.evaluate("document.cookie") == ""
    assert await page.evaluate("localStorage.length + sessionStorage.length") == 0


# ---------- Con el receptor real (receptor/Code.gs ejecutado en tests/e2e/receptor-local.mjs) ----------

def local(ruta, metodo="GET"):
    req = urllib.request.Request(LOCAL + ruta, method=metodo, data=b"" if metodo == "POST" else None)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


class ReceptorReal:
    """Como Receptor, pero cada envío llega al Code.gs de verdad. perder_respuestas=n: los n primeros envíos
    se guardan pero la respuesta no llega al móvil (como si se cortara la conexión justo después)."""
    def __init__(self, perder_respuestas=0, imagenes=True, retraso_img=0):
        self.perder, self.imagenes, self.retraso_img = perder_respuestas, imagenes, retraso_img
        self.envios = 0

    async def instalar(self, page):
        async def config(route):
            await route.fulfill(content_type="text/javascript",
                                body=f'export const RECEPTOR_URL="{RECEPTOR}";export const VERSION_APP="v-test";export const OLEADA="29N";')
        async def receptor(route):
            self.envios += 1
            resp = await route.fetch(url=LOCAL + "/exec")
            if self.envios <= self.perder:
                await route.abort("connectionreset")
                return
            await route.fulfill(response=resp)
        async def img(route):
            if self.retraso_img:
                await asyncio.sleep(self.retraso_img)
            # Con caché, como GitHub Pages: la precarga deja la imagen lista antes de llegar a la publicación.
            await route.fulfill(content_type="image/png", body=PNG, headers={"Cache-Control": "max-age=600"})
        await page.route("**/config.js", config)
        await page.route(RECEPTOR, receptor)
        if self.imagenes:
            await page.route("**/img/*", img)


def hojas():
    return local("/hojas")


def respuestas():
    h = hojas()
    cab, *filas = h["respuestas"]
    return cab, [dict(zip(cab, f)) for f in filas]


async def contestar(page, valores):
    """En la pantalla actual, responde cada pregunta visible con valores[clave] (texto o lista)."""
    for g in await page.locator("[data-pregunta]").all():
        k = await g.get_attribute("data-pregunta")
        v = valores[k]
        sel = g.locator("select")
        if await sel.count():
            await sel.select_option(label=v)
            continue
        for x in (v if isinstance(v, list) else [v]):
            await g.locator(f'button.opt[data-v="{x}"]').click()


@prueba
async def dato_a_dato_lo_guardado_es_lo_pulsado(ctx, rec):
    """Recorrido con respuestas conocidas: cada celda de la hoja debe ser exactamente lo que se pulsó."""
    local("/reiniciar", "POST")
    page = await ctx.new_page()  # sin page.route: peticiones, caché y CORS como en la web publicada
    await page.goto(f"http://127.0.0.1:{PUERTO_COPIA}/?c=instituto")
    perfil = {"edad": "16–17", "estudios": "Bachillerato", "ccaa": "Castilla y León", "voto": "No, aún no tengo edad",
              "fuentes_info": ["TikTok", "Prensa digital o en papel"], "horas_redes": "2–4 h", "comprueba": "A veces",
              "conoce_verificadores": "Sí, pero no los uso", "autoestimacion": "5", "buscado": "No", "interes": "Poco",
              "con1": "Alberto Núñez Feijóo", "con2": "El Rey", "con3": "4", "ideologia": "7", "repetido": "No"}
    vistos, esperado_pub, grupo = [], {}, None
    await page.locator("#siguiente").click()  # bienvenida
    while not await page.locator("#enviar").count():
        if await page.locator(".post").count():
            k = len(vistos)
            grupo = await page.locator("main").get_attribute("data-grupo")
            texto = await page.locator(".post-texto").inner_text()
            b = POR_TEXTO[texto]
            if grupo == "A":
                assert await page.locator(".post .cuenta").inner_text() == b["cuenta"]
            else:
                assert await page.locator(".post .cuenta").count() == 0
            assert await page.locator(".post .fecha").inner_text() == b["fecha"]
            await page.wait_for_function("document.querySelector('.post-imagen')?.complete")
            assert await page.locator(".img-falta").count() == 0
            resp, seg, visto = ("Real" if k in (0, 3, 4, 6) else "Falsa"), str(k % 5 + 1), ["Sí", "No", "No estoy seguro"][k % 3]
            if k == 2:
                await page.wait_for_timeout(1600)
            if k == 4:
                await page.evaluate("""() => {
                  Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
                  document.dispatchEvent(new Event('visibilitychange'));
                  Object.defineProperty(document, 'hidden', {configurable: true, get: () => false});
                  document.dispatchEvent(new Event('visibilitychange'));
                }""")
            await contestar(page, {f"{b['id']}_resp": resp, f"{b['id']}_seg": seg, f"{b['id']}_visto": visto})
            vistos.append(b["id"])
            esperado_pub[b["id"]] = (resp, seg, visto)
        elif await page.locator("[data-pregunta]").count():
            await contestar(page, perfil)
        await page.locator("#siguiente").click()
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for()

    cab, filas = respuestas()
    assert cab == CAMPOS["n"] + ["recibido"], "cabecera de la hoja"
    assert len(filas) == 1, len(filas)
    f = filas[0]
    for k, v in perfil.items():
        assert f[k] == ("|".join(v) if isinstance(v, list) else v), (k, f[k], v)
    assert (f["version_app"], f["oleada"], f["modo"], f["canal"], f["grupo"]) == ("v-test", "29N", "normal", "instituto", grupo)
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", f["fecha"]) and f["recibido"] == "<fecha>"
    assert re.fullmatch(r"[0-9a-f]{16}", f["id_envio"])
    assert f["orden"] == "-".join(vistos)
    for i, id_ in enumerate(vistos, 1):
        resp, seg, visto = esperado_pub[id_]
        assert (f[f"t{i}_id"], f[f"t{i}_resp"], f[f"t{i}_seg"], f[f"t{i}_visto"]) == (id_, resp, seg, visto), i
        assert f[f"t{i}_img"] == "ok", (i, f[f"t{i}_img"])
        assert f[f"t{i}_entiende"] == ""
        assert f[f"t{i}_fuera"] == ("si" if i == 5 else "no"), (i, f[f"t{i}_fuera"])
    assert int(f["t3_ms"]) >= 1600, f["t3_ms"]
    assert all(int(f[f"t{i}_ms"]) < 1600 for i in (1, 2, 4, 5, 6, 7, 8)), [f[f"t{i}_ms"] for i in range(1, 9)]
    assert int(f["duracion_s"]) >= 1
    assert f["quien_extra"] == ""
    # La puntuación que ve el participante sale de lo guardado y del banco.
    tipo = {b["id"]: b["tipo"] for b in BANCO}
    aciertos = sum((f[f"t{i}_resp"] == "Real") == (tipo[f[f"t{i}_id"]] == "verdadero") for i in range(1, 9))
    assert await page.locator("#puntuacion").inner_text() == str(aciertos)
    # lista_der coherente con las publicaciones de la derecha (lo comprueba la auditoría).
    auditar_hoja()


def auditar_hoja():
    h = hojas()["respuestas"]
    csv = "\n".join(",".join('"' + str(v).replace('"', '""') + '"' for v in fila) for fila in h)
    ruta = Path("/tmp") / f"auditoria-{time.time_ns()}.csv"
    ruta.write_text(csv)
    r = subprocess.run(["node", "scripts/auditar-datos.mjs", str(ruta)], cwd=WEB.parent, text=True, capture_output=True)
    assert r.returncode == 0, r.stdout + r.stderr
    return r.stdout


@prueba
async def respuesta_perdida_no_duplica(ctx, rec):
    """El receptor guarda la fila pero la respuesta se pierde dos veces: la web reintenta y la hoja tiene una sola fila."""
    local("/reiniciar", "POST")
    rec = ReceptorReal(perder_respuestas=2)
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    await recorrer(page)
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for(timeout=20000)
    assert rec.envios == 3, rec.envios
    _, filas = respuestas()
    assert len(filas) == 1, len(filas)


@prueba
async def imagen_lenta_no_cuenta_en_el_tiempo(ctx, rec):
    """Con imágenes que tardan 2 s en llegar, el tiempo de decisión empieza cuando la imagen se ve."""
    local("/reiniciar", "POST")
    rec = ReceptorReal(retraso_img=2.0)
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.goto(f"http://127.0.0.1:{PUERTO}/?c=lento")
    async def esperar_img(p, n):
        pass
    pasos = 0
    while not await page.locator("#enviar").count():
        if await page.locator(".post").count():
            await page.wait_for_function("document.querySelector('.post-imagen')?.complete", timeout=10000)
        await responder_pantalla(page, 1)
        await page.locator("#siguiente").click()
        pasos += 1
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for()
    _, filas = respuestas()
    f = filas[0]
    assert all(f[f"t{i}_img"] == "ok" for i in range(1, 9))
    ms = [int(f[f"t{i}_ms"]) for i in range(1, 9)]
    assert max(ms) < 1500, ms


@prueba
async def sin_imagenes_queda_anotado(ctx, rec):
    local("/reiniciar", "POST")
    rec = ReceptorReal(imagenes=False)
    page = await ctx.new_page()
    await rec.instalar(page)
    await page.route("**/img/*", lambda r: r.fulfill(status=404, body=""))
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    await recorrer(page)
    await page.locator("#enviar").click()
    await page.locator("#resultado").wait_for()
    _, filas = respuestas()
    assert all(filas[0][f"t{i}_img"] == "falta" for i in range(1, 9))


@prueba
async def doce_a_la_vez_y_auditoria_limpia(ctx, rec):
    """Una clase enviando a la vez: 12 filas distintas, ninguna perdida ni duplicada, auditoría sin errores."""
    local("/reiniciar", "POST")
    async def uno(k):
        r = ReceptorReal()
        page = await ctx.new_page()
        await r.instalar(page)
        await page.goto(f"http://127.0.0.1:{PUERTO}/?modo={'piloto' if k % 3 == 0 else 'normal'}&c=clase")
        await recorrer(page, opcion=1 + k % 3)  # opción 0 sería «Menos de 14»
        if not await page.locator("#enviar").count():
            raise AssertionError(f"página {k} parada en: {(await page.locator('main').inner_text())[:200]!r}")
        await page.locator("#enviar").click()
        await page.locator("#resultado").wait_for(timeout=20000)
        await page.close()
    await asyncio.gather(*(uno(k) for k in range(12)))
    _, filas = respuestas()
    assert len(filas) == 12 and len({f["id_envio"] for f in filas}) == 12
    auditar_hoja()


@prueba
async def sin_receptor_configurado_no_empieza(ctx, rec):
    page = await ctx.new_page()
    await page.route("**/config.js", lambda r: r.fulfill(content_type="text/javascript",
        body='export const RECEPTOR_URL="";export const VERSION_APP="v";export const OLEADA="29N";'))
    await page.goto(f"http://127.0.0.1:{PUERTO}/")
    await page.get_by_text("La encuesta no está disponible").wait_for()


async def main():
    servir()
    copia = preparar_copia()
    servir(copia, PUERTO_COPIA)
    receptor = subprocess.Popen(["node", "tests/e2e/receptor-local.mjs", str(PUERTO_RECEPTOR)], cwd=WEB.parent,
                                stdout=subprocess.PIPE, text=True)
    receptor.stdout.readline()
    fallos = 0
    async with async_playwright() as p:
        nav = await p.chromium.launch()
        for f in PRUEBAS:
            ctx = await nav.new_context(viewport={"width": 390, "height": 844})
            ctx.set_default_timeout(8000)
            rec = Receptor()
            try:
                await asyncio.wait_for(f(ctx, rec), 120)
                print(f"ok - {f.__name__}")
            except Exception as e:
                fallos += 1
                print(f"not ok - {f.__name__}: {type(e).__name__}: {e}")
            await ctx.close()
        await nav.close()
    receptor.terminate()
    shutil.rmtree(copia, ignore_errors=True)
    print(f"# pass {len(PRUEBAS) - fallos}\n# fail {fallos}")
    sys.exit(1 if fallos else 0)


asyncio.run(main())
