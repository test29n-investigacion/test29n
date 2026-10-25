"""Prepara las imágenes del banco a partir de las capturas originales.

Uso: python3 scripts/preparar-imagenes.py CARPETA_ORIGINALES
Para cada publicación: difumina caras de particulares y marcas de agua (coordenadas sobre la captura original),
y encaja la imagen ENTERA (sin recortes) en web/img/<ID>.jpg (1000x750) sin ampliarla más de ESCALA_MAX, para que no
se pixele: lo que no llena el 4:3 (vídeos verticales, panorámicos, capturas pequeñas) se rellena con la propia imagen
difuminada; las publicaciones con dos imágenes se montan enteras lado a lado.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

SALIDA = Path(__file__).resolve().parents[1] / "web" / "img"
ANCHO, ALTO = 1000, 750

# (cx, cy, rx, ry) en píxeles de la captura original
CARAS = {
    "C43": [(156, 728, 48, 58), (62, 770, 38, 44), (1362, 738, 44, 54), (1290, 690, 26, 30), (1435, 690, 22, 26)],
    "C34": [(25, 690, 34, 52), (100, 430, 14, 16), (60, 470, 16, 18)],
    "C42": [(100, 398, 12, 14), (75, 410, 12, 14), (30, 405, 12, 14), (124, 517, 36, 46), (505, 610, 34, 44),
            (562, 520, 14, 18), (572, 680, 14, 20),
            (330, 625, 150, 215)],  # cara de quien graba
    # Segundo vídeo de la publicación (cabecera de la marcha en el paseo de Gracia, segundo 2,4)
    "C42-b": [(553, 505, 48, 85), (462, 668, 64, 82), (374, 590, 52, 62), (302, 548, 22, 28), (276, 552, 20, 26),
              (240, 552, 12, 16), (222, 545, 10, 14), (196, 538, 10, 12), (170, 540, 10, 12), (142, 560, 10, 12),
              (50, 528, 9, 11), (20, 535, 9, 11), (382, 515, 22, 24)],
    "C38": [(660, 552, 18, 22)],
    "C09": [(778, 72, 32, 40)],
    "C45": [(18, 160, 22, 26), (65, 190, 22, 26), (100, 185, 22, 26), (140, 185, 22, 26), (180, 190, 22, 26), (225, 200, 22, 26), (255, 210, 22, 26), (240, 185, 22, 26), (330, 205, 22, 26), (380, 205, 22, 26), (410, 230, 22, 26), (430, 265, 22, 26), (480, 235, 22, 26), (530, 175, 22, 26), (575, 180, 22, 26), (575, 235, 22, 26), (615, 175, 22, 26), (645, 262, 22, 26), (660, 200, 22, 26), (710, 185, 22, 26), (750, 165, 22, 26), (800, 190, 22, 26), (845, 170, 22, 26), (830, 215, 22, 26), (905, 160, 22, 26), (940, 185, 22, 26), (990, 225, 22, 26), (995, 160, 22, 26), (280, 185, 22, 26), (300, 220, 22, 26), (455, 190, 22, 26), (500, 200, 22, 26), (540, 215, 22, 26), (690, 230, 22, 26), (760, 215, 22, 26), (880, 200, 22, 26)],
    "C49": [(178, 740, 8, 10), (258, 723, 9, 10), (238, 654, 7, 9), (220, 697, 7, 9), (40, 690, 7, 9), (282, 620, 7, 9),
            (197, 645, 7, 9), (250, 598, 7, 9)],
    # Imágenes hechas con IA: se difuminan igual que las reales (toda persona que no sea figura pública),
    # para que el difuminado no delate qué publicaciones son verdaderas.
    "C47": [(648, 180, 34, 50), (364, 281, 30, 38), (106, 249, 15, 19), (188, 190, 15, 19)],
    "C25": [(306, 102, 28, 36)],
    "C21": [(110, 410, 6, 8), (75, 418, 6, 8), (192, 417, 6, 8), (220, 415, 6, 8), (242, 407, 6, 8), (303, 417, 6, 8),
            (362, 407, 6, 8), (423, 417, 6, 8), (472, 408, 6, 8), (508, 427, 6, 8), (523, 410, 6, 8), (542, 390, 6, 8),
            (20, 385, 6, 8), (50, 410, 6, 8), (107, 393, 6, 8), (370, 430, 6, 8), (462, 427, 6, 8), (398, 417, 6, 8)],
    "C12": [(78, 775, 16, 18), (108, 672, 16, 18), (616, 615, 16, 18), (592, 690, 14, 16), (572, 800, 16, 18)],
}
# Rectángulos (x0, y0, x1, y1) que se difuminan por completo: multitudes con muchas caras y marcas de agua.
ZONAS = {
    "C07": [(0, 140, 190, 282)],
    "C51": [(612, 56, 694, 134)],  # logo de El Mundo
    "C12": [(614, 72, 696, 152)],  # logo de El Mundo
    "C25": [(498, 630, 748, 700)],  # marca de agua @antxon43
    "C01": [(5, 462, 100, 562)],
}
# Zona de la captura que se usa. Por defecto la imagen entera (sin recortes): se encaja en 4:3 sin ampliarla
# más de ESCALA_MAX y el hueco se rellena con la propia imagen difuminada, como hacen las redes.
RECORTE = {
    "C04": (57, 0, 984, 695),  # quita los márgenes de la captura de Instagram
    "C47": (36, 30, 928, 832),  # quita el marco de la captura de X
}
ESCALA_MAX = 1.3


def difuminar_caras(im, caras):
    for cx, cy, rx, ry in caras:
        caja = (max(cx - 2 * rx, 0), max(cy - 2 * ry, 0), min(cx + 2 * rx, im.width), min(cy + 2 * ry, im.height))
        trozo = im.crop(caja).filter(ImageFilter.GaussianBlur(max(rx, ry) * 0.45))
        mascara = Image.new("L", trozo.size, 0)
        ox, oy = cx - caja[0], cy - caja[1]
        ImageDraw.Draw(mascara).ellipse((ox - rx * 1.15, oy - ry * 1.15, ox + rx * 1.15, oy + ry * 1.15), fill=255)
        mascara = mascara.filter(ImageFilter.GaussianBlur(max(rx, ry) * 0.25))
        im.paste(trozo, caja[:2], mascara)
    return im


def difuminar_zonas(im, zonas):
    for caja in zonas:
        trozo = im.crop(caja).filter(ImageFilter.GaussianBlur(22))
        mascara = Image.new("L", trozo.size, 0)
        # Borde suave hacia dentro de la imagen; sin margen en los lados que tocan el borde, para que no quede nada nítido.
        x0, y0, x1, y1 = caja
        m = (0 if x0 <= 0 else 8, 0 if y0 <= 0 else 8,
             trozo.width - (0 if x1 >= im.width else 8), trozo.height - (0 if y1 >= im.height else 8))
        ImageDraw.Draw(mascara).rectangle(m, fill=255)
        mascara = mascara.filter(ImageFilter.GaussianBlur(6))
        if x0 <= 0:
            mascara.paste(255, (0, m[1] + 6, 6, max(m[1] + 6, m[3] - 6)))
        im.paste(trozo, caja[:2], mascara)
    return im


def encajar(im):
    """Encaja la imagen entera en 1000x750 sin ampliarla más de ESCALA_MAX; el hueco se rellena con la imagen difuminada."""
    s = min(ANCHO / im.width, ALTO / im.height, ESCALA_MAX)
    w, h = round(im.width * s), round(im.height * s)
    r = im.resize((w, h), Image.LANCZOS)
    if s > 1.05:
        r = r.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    if w >= ANCHO - 2 and h >= ALTO - 2:
        return r.resize((ANCHO, ALTO), Image.LANCZOS)
    fondo = cubrir(im, ANCHO, ALTO).filter(ImageFilter.GaussianBlur(28))
    fondo = ImageEnhance.Brightness(fondo).enhance(0.6)
    fondo.paste(r, ((ANCHO - w) // 2, (ALTO - h) // 2))
    return fondo


def cubrir(im, w, h):
    """Escala y recorta al centro para llenar w x h."""
    s = max(w / im.width, h / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((x, y, x + w, y + h))


def encajar_en_blanco(im):
    """Gráficas que no se pueden recortar sin perder datos: se encajan enteras sobre blanco."""
    lienzo = Image.new("RGB", (ANCHO, ALTO), (255, 255, 255))
    s = min((ANCHO - 40) / im.width, (ALTO - 40) / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    lienzo.paste(r, ((ANCHO - r.width) // 2, (ALTO - r.height) // 2))
    return lienzo


def dos_imagenes(a, b):
    """Las dos imágenes enteras, lado a lado y a la misma altura, sobre fondo difuminado."""
    alto = min(ALTO - 40, (ANCHO - 40 - 6) / (a.width / a.height + b.width / b.height))
    ra = a.resize((round(a.width * alto / a.height), round(alto)), Image.LANCZOS)
    rb = b.resize((round(b.width * alto / b.height), round(alto)), Image.LANCZOS)
    fondo = cubrir(a, ANCHO, ALTO).filter(ImageFilter.GaussianBlur(28))
    fondo = ImageEnhance.Brightness(fondo).enhance(0.6)
    x0 = (ANCHO - ra.width - rb.width - 6) // 2
    y0 = (ALTO - ra.height) // 2
    fondo.paste(ra, (x0, y0))
    fondo.paste(rb, (x0 + ra.width + 6, y0))
    return fondo


def main(origen):
    origen = Path(origen)
    SALIDA.mkdir(parents=True, exist_ok=True)
    hechas = []
    for f in sorted(origen.glob("C*.png")):
        k = f.stem
        if k.endswith("-b"):
            continue
        im = Image.open(f).convert("RGB")
        im = difuminar_caras(im, CARAS.get(k, []))
        im = difuminar_zonas(im, ZONAS.get(k, []))
        if k == "C36":
            final = encajar_en_blanco(im)
        elif (origen / f"{k}-b.png").exists():
            # Publicaciones con dos imágenes o vídeos que X muestra lado a lado (C09, C42).
            b = Image.open(origen / f"{k}-b.png").convert("RGB")
            b = difuminar_caras(b, CARAS.get(f"{k}-b", []))
            b = difuminar_zonas(b, ZONAS.get(f"{k}-b", []))
            final = dos_imagenes(im, b)
        else:
            caja = RECORTE.get(k)
            final = encajar(im.crop(caja) if caja else im)
        final.save(SALIDA / f"{k}.jpg", "JPEG", quality=82, optimize=True, progressive=True)
        hechas.append(k)
    print("Hechas:", " ".join(hechas))


if __name__ == "__main__":
    main(sys.argv[1])
