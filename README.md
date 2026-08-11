# Portfolio — Elia Baisch

Modulare Portfolio-Website. Eine Startseite, ausgelagerte Styles/Scripts,
einzelne Projekt-Unterseiten und die Tools als separate Scripts.
Alle Projektseiten benutzen dieselben Bausteine aus `css/style.css`,
damit sie automatisch einheitlich aussehen.

## Ordnerstruktur

```
Portfolio/
├─ index.html              → Startseite
├─ css/
│  └─ style.css            → alle Styles (auch für Projekt-Unterseiten)
├─ js/
│  ├─ main.js              → Nav, Sprache (DE/EN), Typed-Animation, Reveal, Uhr
│  ├─ projects.js          → HIER Projekte pflegen (Array)
│  ├─ project.js           → nur Projektseiten: Lightbox, fehlende Bilder
│  ├─ tools.js             → Modal-Steuerung + Info-Panel
│  └─ tools/
│     ├─ _lib.js           → gemeinsame Basis (Oberfläche + Bildhelfer)
│     ├─ hybrid.js         → Hybrid Image
│     ├─ fusion.js         → Laplacian Pyramid Fusion
│     ├─ awb.js            → Auto White Balance
│     ├─ mosaic.js         → Photo Mosaic
│     ├─ gradients.js      → Gradienten-Analyse (Bildforensik)
│     ├─ converter.js      → Image Converter
│     ├─ filter.js         → Image Filter Studio
│     └─ qr.js             → QR-Poster Generator (Port von QRCodeGenerator.py)
├─ projects/
│  ├─ _template.html       → Vorlage für neue Projektseiten (kopieren!)
│  ├─ sustainappility.html
│  ├─ vst3-plugin-dev.html
│  ├─ todolist.html
│  ├─ design-portfolios.html
│  ├─ 3d-modeling.html
│  ├─ videos.html
│  ├─ lunar-lunacy.html
│  └─ adventurous.html
├─ files/                  → PDFs (Lebenslauf, Portfolios, Messestand)
├─ assets/
│  ├─ portrait.jpg         → Foto im Hero
│  ├─ covers/              → ein Cover je Projekt (Liste + Projektkopf)
│  ├─ sustainappility/     → Screens & Sketches
│  ├─ todolist/            → App-Screenshots
│  ├─ plugin/              → Plugin-UIs
│  └─ modeling/            → 3D-Renderings
└─ README.md
```

## Neues Projekt hinzufügen

1. `projects/_template.html` kopieren, z. B. zu `projects/mein-projekt.html`.
   Die Vorlage enthält alle verfügbaren Bausteine als Kommentar-Blöcke —
   einfach löschen, was du nicht brauchst.
2. In `js/projects.js` ein Objekt zum `PROJECTS`-Array hinzufügen:

   ```js
   {
     title: 'Mein Projekt',
     tags:  { de:['Web','Design'], en:['Web','Design'] },
     year:  '2026',
     cover: 'assets/covers/mein-projekt.jpg',
     link:  'projects/mein-projekt.html'
   }
   ```

   (Externe URLs gehen auch, z. B. `link: 'https://…'` — öffnen im neuen Tab.)
3. Auf der vorherigen Projektseite unten den `.p-next`-Link anpassen,
   damit die Kette „Nächstes Projekt“ stimmt.

## Bausteine für Projektseiten

| Klasse | Wofür |
|---|---|
| `.project-kicker` | kleine Kategorie-Zeile über dem Titel |
| `.project-head` + `.project-lead` | Titel, Jahr, ein Satz Einleitung |
| `.project-meta` | Tag-Pillen (`.tag.soon` = „In Arbeit“) |
| `.project-cover` | Cover-Bild (`.contain` = Bild nicht beschneiden) |
| `.p-facts` | Faktenleiste: Rolle, Team, Kontext, Werkzeuge |
| `.p-quote` | Zitat mit Quelle |
| `.p-sec` | normaler Textabschnitt (`.p-kicker` + `h2` + `p`) |
| `.p-split` | Text neben Bild (`.rev` dreht die Seiten, `.phone` für Screenshots) |
| `.p-screens` / `.p-gallery` | Bildreihen |
| `.p-cards` | Karten für Teilprojekte |
| `.p-docs` | Liste mit PDF-Downloads |
| `.p-embed` | YouTube-/Video-Einbettung 16:9 |
| `.p-soon` | Hinweisbox für unfertige Projekte |
| `.p-next` | Link zum nächsten Projekt |
| `.rv` | Element blendet beim Scrollen ein |
| `img.zoom` | Bild öffnet sich per Klick in der Lightbox |
| `img[data-optional]` | fehlt das Bild, verschwindet der Block statt kaputt zu sein |

## PDFs

Alle PDFs liegen in `files/` und werden relativ verlinkt — von der
Startseite als `files/…`, von Projektseiten als `../files/…`. Dateinamen
mit Leerzeichen müssen im `href` als `%20` geschrieben werden, z. B.
`files/CV%20Elia%20Baisch.pdf`.

| Datei | verlinkt in |
|---|---|
| `CV Elia Baisch.pdf` | `index.html` (Über mich) |
| `Portfolio.pdf` | `index.html` (Ausgewählte Arbeiten) |
| `Grundlagen Design.pdf`, `A1_App_Deconstruction_Elia_Baisch.pdf`, `A2_Design_Prototyping.pdf`, `Design_Reflection.pdf` | `projects/design-portfolios.html` |
| `Messestand.pdf` | `projects/3d-modeling.html` |

## Bilder tauschen

Alle Bilder liegen in `assets/`. Um eines zu ersetzen, einfach die Datei
unter gleichem Namen überschreiben — die Seiten referenzieren nur Pfade.
Bilder mit `data-optional` blenden sich aus, wenn die Datei fehlt.

## Die Bildverarbeitungs-Tools

Fünf Verfahren aus meinen Projekten unter `ToolsTemplates/` laufen jetzt
vollständig im Browser — kein Server, kein Upload. Der Ordner
`ToolsTemplates/` bleibt als Python-Original bestehen, die Website
referenziert ihn nicht.

| Tool | Quelle | Was drin ist |
|---|---|---|
| Hybrid Image | `Hybrid Image/hybrid_image.py` | Gauß-Tief-/Hochpass, Gewichte, Graustufen, Fern-Vorschau |
| Laplacian Fusion | `Laplacian Fusion/laplacian_fusion*.py` | Gauß-/Laplace-Pyramide, Multi-Band-Blending, Vergleich zum naiven Überblenden |
| Auto White Balance | `Auto White Balance/backend/utils.py` | Gray World & White Patch im linearen Lichtraum, Perzentil einstellbar |
| Photo Mosaic | `Photo Mosaic/reconstruct_mosaic*.py` | alle 7 Methoden: Mittelwert, Median, Gauß, K-Means, Zentralpixel, Histogramm, Bilateral |
| Gradienten-Analyse | `Detecting generated images/src/gradients.py` | Sobel, Scharr, Laplace + Kennzahlen (entspricht `analyze_pair`) |

**Nicht portiert**, weil es PyTorch und ein trainiertes Modell braucht:
`extract_features`, `train` und der LGrad-/VGG16-Proxy aus dem
Erkennungsprojekt. Das steht so auch im Info-Panel des Tools.

### Erklärungen (Info-Panel)

Jedes Tool kann eine Erklärung mitbringen — im Modal erscheint dann oben
rechts ein Info-Symbol, das ein Panel über den Tool-Inhalt schiebt. Die
Texte stammen aus den README-Dateien der Projekte:

```js
window.TOOLS['meintool'].doc = {
  de: `<h4>Titel</h4><p>Text …</p><div class="fx">formel = a + b</div>`,
  en: `<h4>Title</h4><p>Text …</p>`
};
```

Verfügbare Bausteine im Info-Panel: `h4` (Überschrift), `h5` (Zwischen-
titel in Akzentfarbe), `p`, `ul`/`li`, `code` (inline), `.fx` (Formelblock,
scrollt bei Bedarf) und `.src` (Quellenangabe am Ende).

## Neues Tool hinzufügen

### Variante A — Bild-Tool über die gemeinsame Basis

`js/tools/_lib.js` baut die komplette Oberfläche (Dropzones, Regler,
Ausgabe-Canvases, Download-Button) aus einer Konfiguration. Damit bleibt
im Tool nur der eigentliche Algorithmus übrig:

```js
window.TOOLS['meintool'] = function(body, title){
  title.textContent = 'Mein Tool';
  TL.build(body, {
    cols: 2,
    drops:  [{ id:'src', label:{de:'Bild wählen', en:'Choose an image'} }],
    fields: [{ id:'staerke', type:'range', min:0, max:10, value:3,
               label:{de:'Stärke', en:'Strength'} }],
    views:  [{ id:'out', label:{de:'Ergebnis', en:'Result'} }],
    action: { label:{de:'Laden', en:'Download'}, name:'out.png' },
    onInput(api){
      const d = TL.pixels(api.images.src, 1200);
      // … rechnen …
      TL.show(api.view('out'), d);
      api.say('Hinweis unter dem Bild');
    }
  });
};
```

Feldtypen: `range`, `number`, `select` (mit `options`), `check`.
Nützliche Helfer in `TL`: `pixels`, `pixelsPair`, `toFloat`,
`toImageData`, `gray`, `blur`, `reduce`/`expand` (Pyramiden), `conv3` +
`KERNELS`, `percentile`, `stats`, `S2L`/`lin2srgb`, `show`, `download`.

### Variante B — freies Tool

```js
window.TOOLS['meintool'] = function(body, title){
  title.textContent = 'Mein Tool';
  body.innerHTML = ` … deine UI … `;
};
```

Danach in beiden Fällen:

1. In `index.html` das Script einbinden — **nach** `js/tools/_lib.js`:
   `<script src="js/tools/mein-tool.js"></script>`
2. In `index.html` eine Tool-Karte ergänzen mit
   `onclick="openTool('meintool')"`.

## Bibliotheken

- **Typed.js** (Hero-Schriftanimation) und **qrcode-generator** (QR-Tool)
  werden per CDN geladen — funktioniert online (z. B. GitHub Pages) out of the box.
- Das QR-Tool zeichnet das Poster selbst auf ein `<canvas>` (1080 × 1350) —
  die Bibliothek liefert nur die Modul-Matrix. Themes stehen oben in
  `js/tools/qr.js` im Objekt `QR_THEMES` und entsprechen 1:1 denen aus
  `QRCodeGenerator.py`.

## Sprache

DE/EN über den Button oben rechts. Übersetzte Texte stehen direkt im HTML
als `data-de="…"` / `data-en="…"` am jeweiligen Element. Enthält ein Element
ein Icon (SVG), wird nur der Text getauscht — das Icon bleibt erhalten.

## Lokal ansehen

```bash
python3 -m http.server 4321
```

Dann `http://localhost:4321` öffnen. (Direktes Öffnen per Doppelklick
funktioniert auch, nur die relativen Pfade sind über den Server sauberer.)
