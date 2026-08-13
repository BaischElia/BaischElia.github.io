#!/usr/bin/env python3
"""
compress_pdf.py — PDFs verkleinern, ohne Text und Vektoren anzutasten.

Das Gegenstück zum Bild-Kompressor auf der Website: PDF-Kompression
lässt sich im Browser nicht sinnvoll umsetzen, weil dafür die
eingebetteten Bilder einzeln ersetzt werden müssen, während Text,
Schriften und Vektorgrafik unverändert bleiben sollen.

Das Skript rechnet nur Bilder herunter, die feiner aufgelöst sind als
nötig (typisch 300 dpi Druckauflösung → 150 dpi für den Bildschirm),
und kodiert sie neu als JPEG. Strichgrafik und Schwarzweißbilder
bleiben unberührt.

Danach wird geprüft, was die Kompression tatsächlich gekostet hat:
Jede Seite wird vorher und nachher gerendert und pixelweise
verglichen (RMSE). Damit ist der Qualitätsverlust gemessen und nicht
geschätzt.

Installation:
    pip install PyMuPDF

Beispiele:
    python tools/compress_pdf.py files/*.pdf
    python tools/compress_pdf.py files/Portfolio.pdf --dpi 120 --quality 65
    python tools/compress_pdf.py files/*.pdf --out komprimiert/ --pruefen
    python tools/compress_pdf.py files/*.pdf --ersetzen --sicherung originale/
"""

import argparse
import math
import os
import shutil
import sys

try:
    import pymupdf
except ImportError:                                   # ältere Paketnamen
    try:
        import fitz as pymupdf
    except ImportError:
        sys.exit("Fehler: PyMuPDF fehlt.  ->  pip install PyMuPDF")


def groesse(n: int) -> str:
    return f"{n/1048576:.1f} MB" if n >= 1048576 else f"{n/1024:.0f} kB"


def komprimieren(pfad, ziel, dpi, quality):
    """Bilder im PDF herunterrechnen und neu kodieren."""
    doc = pymupdf.open(pfad)
    seiten = len(doc)
    # dpi_threshold verhindert, dass ohnehin grobe Bilder nochmals
    # durch den JPEG-Encoder gejagt werden (das würde nur schaden).
    doc.rewrite_images(dpi_threshold=dpi + 20, dpi_target=dpi,
                       quality=quality, bitonal=False)
    doc.save(ziel, garbage=4, deflate=True, clean=True)
    doc.close()
    return seiten


def abweichung(a_pfad, b_pfad, dpi=96, stichprobe=200_000):
    """
    Größte und mittlere Pixelabweichung je Seite, in Prozent.
    0 % = identisch. Unter 1,5 % ist der Unterschied nicht sichtbar.
    """
    a, b = pymupdf.open(a_pfad), pymupdf.open(b_pfad)
    schlimmste, summe = 0.0, 0.0
    try:
        if len(a) != len(b):
            return None, None, "Seitenzahl weicht ab"
        for i in range(len(a)):
            pa = a[i].get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
            pb = b[i].get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
            if (pa.width, pa.height) != (pb.width, pb.height):
                return None, None, f"Seite {i+1}: Abmessungen weichen ab"
            da, db = pa.samples, pb.samples
            schritt = max(1, len(da) // stichprobe)
            s = n = 0
            for k in range(0, len(da), schritt):
                d = da[k] - db[k]
                s += d * d
                n += 1
            rmse = math.sqrt(s / n) / 255 * 100
            schlimmste = max(schlimmste, rmse)
            summe += rmse
        return schlimmste, summe / len(a), None
    finally:
        a.close()
        b.close()


def urteil(d):
    if d is None:
        return "?"
    if d < 1.5:
        return "nicht sichtbar"
    if d < 3:
        return "kaum sichtbar"
    return "PRÜFEN"


def main(argv=None):
    p = argparse.ArgumentParser(
        description="PDFs verkleinern, ohne Text und Vektoren anzutasten.")
    p.add_argument("pdfs", nargs="+", help="eine oder mehrere PDF-Dateien")
    p.add_argument("--dpi", type=int, default=150,
                   help="Zielauflösung der Bilder (Standard 150 — Bildschirm)")
    p.add_argument("--quality", type=int, default=72,
                   help="JPEG-Qualität 0–100 (Standard 72)")
    p.add_argument("--out", default=None,
                   help="Ausgabeordner (Standard: neben dem Original als *-klein.pdf)")
    p.add_argument("--ersetzen", action="store_true",
                   help="Originale überschreiben (nur zusammen mit --sicherung sinnvoll)")
    p.add_argument("--sicherung", default=None,
                   help="Ordner, in den die Originale vorher kopiert werden")
    p.add_argument("--pruefen", action="store_true",
                   help="Qualitätsverlust je Seite messen (dauert länger)")
    args = p.parse_args(argv)

    if args.ersetzen and not args.sicherung:
        print("Warnung: --ersetzen ohne --sicherung überschreibt die Originale "
              "unwiderruflich.", file=sys.stderr)
        if input("Trotzdem fortfahren? [j/N] ").strip().lower() not in ("j", "y"):
            return 1

    if args.out:
        os.makedirs(args.out, exist_ok=True)
    if args.sicherung:
        os.makedirs(args.sicherung, exist_ok=True)

    kopf = f'{"Datei":42} {"vorher":>9} {"nachher":>9} {"Ersparnis":>10}'
    if args.pruefen:
        kopf += f' {"max Δ":>7}  Bewertung'
    print(kopf)
    print("-" * len(kopf))

    vorher_gesamt = nachher_gesamt = 0
    for pfad in args.pdfs:
        if not os.path.isfile(pfad):
            print(f"{os.path.basename(pfad):42} übersprungen (nicht gefunden)")
            continue

        name = os.path.basename(pfad)
        stamm, _ = os.path.splitext(name)
        if args.out:
            ziel = os.path.join(args.out, name)
        elif args.ersetzen:
            ziel = pfad + ".tmp"
        else:
            ziel = os.path.join(os.path.dirname(pfad) or ".", stamm + "-klein.pdf")

        vorher = os.path.getsize(pfad)
        try:
            komprimieren(pfad, ziel, args.dpi, args.quality)
        except Exception as exc:
            print(f"{name:42} FEHLER: {exc}")
            continue
        nachher = os.path.getsize(ziel)

        zeile = (f"{name:42} {groesse(vorher):>9} {groesse(nachher):>9} "
                 f"{100 - nachher/vorher*100:9.1f} %")

        if args.pruefen:
            schlimmste, _mittel, fehler = abweichung(pfad, ziel)
            if fehler:
                zeile += f"  {fehler}"
            else:
                zeile += f" {schlimmste:6.2f}%  {urteil(schlimmste)}"
        print(zeile)

        if args.sicherung:
            shutil.copy2(pfad, os.path.join(args.sicherung, name))
        if args.ersetzen:
            os.replace(ziel, pfad)

        vorher_gesamt += vorher
        nachher_gesamt += nachher

    if vorher_gesamt:
        print("-" * len(kopf))
        print(f'{"GESAMT":42} {groesse(vorher_gesamt):>9} {groesse(nachher_gesamt):>9} '
              f'{100 - nachher_gesamt/vorher_gesamt*100:9.1f} %')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
