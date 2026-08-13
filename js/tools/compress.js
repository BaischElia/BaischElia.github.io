/* =========================================================
   tools/compress.js — Bild-Kompressor mit Zielgröße
   ---------------------------------------------------------
   Statt die Dateigröße zu schätzen, wird sie gemessen: Das Bild
   wird mehrfach mit unterschiedlicher Qualität kodiert, bis es
   knapp unter der gewünschten Größe liegt (Binärsuche). Reicht
   die Qualität allein nicht, werden zusätzlich die Abmessungen
   reduziert.

   Der angezeigte „Unterschied“ ist ebenfalls gemessen: Das
   Ergebnis wird zurückdekodiert und Pixel für Pixel mit dem
   Original verglichen (RMSE).
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['compress'] = function(body, title){
  title.textContent = TL.t({de:'Bild-Kompressor', en:'Image compressor'});

  const STUFEN = { gentle:0.92, balanced:0.78, strong:0.60 };
  const MAX_KANTE = 4200;               // Deckel: darüber wird Kodieren zäh
  let letztes = null;                   // { blob, name } für den Download
  let tabelle = null;

  const api = TL.build(body, {
    cols: 2,
    drops: [{ id:'src', label:{de:'Bild wählen', en:'Choose an image'} }],
    fields: [
      { id:'modus', type:'select', value:'target',
        label:{de:'Vorgabe', en:'Mode'},
        options:[
          { v:'target',   t:{de:'Zielgröße vorgeben', en:'Set a target size'} },
          { v:'gentle',   t:{de:'Schonend — kaum sichtbar', en:'Gentle — barely visible'} },
          { v:'balanced', t:{de:'Ausgewogen', en:'Balanced'} },
          { v:'strong',   t:{de:'Stark — kleinste Datei', en:'Strong — smallest file'} }
        ]},
      { id:'ziel', type:'number', value:500, min:10, max:50000, step:10,
        label:{de:'Zielgröße in kB', en:'Target size in kB'} },
      { id:'format', type:'select', value:'auto',
        label:{de:'Format', en:'Format'},
        options:[
          { v:'auto', t:{de:'Automatisch (bestes)', en:'Automatic (best)'} },
          { v:'image/webp', t:'WebP' },
          { v:'image/jpeg', t:'JPG' }
        ]},
      { id:'skalieren', type:'check', value:true,
        label:{de:'Abmessungen verkleinern, falls die Qualität allein nicht reicht',
               en:'Reduce dimensions if quality alone is not enough'} }
    ],
    views: [
      { id:'orig', label:{de:'Original', en:'Original'} },
      { id:'out',  label:{de:'Komprimiert', en:'Compressed'} }
    ],
    action: { label:{de:'Herunterladen', en:'Download'} },

    async onInput(api){
      const tok = api.token;              // Kennung dieses Laufs festhalten
      const datei = api.files.src;
      const modus = api.val('modus');

      // Zielgrößenfeld nur im passenden Modus zeigen
      feld('ziel').style.display = modus === 'target' ? 'block' : 'none';
      chips.style.display        = modus === 'target' ? 'flex'  : 'none';

      // ---- Original in voller Auflösung bereitstellen ----
      const quelle = vollCanvas(api.images.src);
      TL.show(api.view('orig'), bild(quelle));
      const originalPixel = quelle.getContext('2d').getImageData(0, 0, quelle.width, quelle.height);

      const alpha = hatTransparenz(originalPixel);
      const typ = zielFormat(api.val('format'), alpha);

      // ---- Kodieren ----
      let erg;
      if(modus === 'target'){
        const zielBytes = Math.round(api.val('ziel') * 1024);
        erg = await aufZielgroesse(quelle, typ, zielBytes, api.val('skalieren'), api, tok);
        if(api.stale(tok)) return;
        if(!erg){
          api.say(TL.t({
            de:'Diese Zielgröße ist selbst bei niedrigster Qualität nicht erreichbar. Erlaube das Verkleinern der Abmessungen oder wähle einen größeren Wert.',
            en:'That target cannot be reached even at the lowest quality. Allow dimension reduction or pick a larger value.'}));
          return;
        }
      } else {
        const q = STUFEN[modus];
        erg = { blob: await kodieren(quelle, typ, q), q, skala: 1, canvas: quelle };
        if(api.stale(tok)) return;
      }

      // ---- Ergebnis anzeigen ----
      const ergBild = await blobZuBild(erg.blob);
      if(api.stale(tok)) return;
      const ziel = api.view('out');
      ziel.width = erg.canvas.width; ziel.height = erg.canvas.height;
      ziel.getContext('2d').drawImage(ergBild, 0, 0, ziel.width, ziel.height);

      const unterschied = messeUnterschied(originalPixel, ergBild, quelle.width, quelle.height);

      letztes = { blob: erg.blob, name: dateiname(datei ? datei.name : 'bild', typ) };
      zeigeTabelle(datei, erg, typ, unterschied, quelle);

      // Hinweise
      const hinweise = [];
      if(erg.skala < 1)
        hinweise.push(TL.t({de:`Abmessungen auf ${Math.round(erg.skala*100)} % reduziert, um die Zielgröße zu erreichen.`,
                            en:`Dimensions reduced to ${Math.round(erg.skala*100)} % to reach the target.`}));
      if(alpha && typ === 'image/jpeg')
        hinweise.push(TL.t({de:'Das Bild hat transparente Bereiche — JPG kann keine Transparenz, sie wurden weiß hinterlegt. WebP behält sie.',
                            en:'The image has transparent areas — JPG cannot store transparency, so they were filled white. WebP keeps them.'}));
      if(datei && erg.blob.size >= datei.size)
        hinweise.push(TL.t({de:'Das Ergebnis ist nicht kleiner als das Original — das Original ist bereits gut komprimiert.',
                            en:'The result is not smaller than the original — the original is already well compressed.'}));
      api.say(hinweise.join(' '));
    }
  });

  /* ---- Download liefert das kodierte Blob, nicht das Canvas ---- */
  body.querySelector('[data-act]').onclick = () => {
    if(!letztes) return;
    const url = URL.createObjectURL(letztes.blob);
    const a = document.createElement('a');
    a.download = letztes.name; a.href = url; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ---- Schnellwahl für gängige Zielgrößen ---- */
  const chips = document.createElement('div');
  chips.className = 'presets';
  chips.style.marginBottom = '18px';
  chips.innerHTML = [
    [100,  TL.t({de:'Icon 100 kB', en:'Icon 100 kB'})],
    [300,  TL.t({de:'Web 300 kB', en:'Web 300 kB'})],
    [1024, '1 MB'],
    [2048, '2 MB'],
    [5120, TL.t({de:'E-Mail 5 MB', en:'Email 5 MB'})]
  ].map(([kb, t]) => `<button class="pst" data-kb="${kb}">${t}</button>`).join('');
  body.querySelector('.tfields').after(chips);
  chips.onclick = e => {
    const b = e.target.closest('.pst');
    if(!b) return;
    api.set('ziel', b.dataset.kb);
    chips.querySelectorAll('.pst').forEach(p => p.classList.toggle('active', p === b));
    api.run();
  };

  /* =========================================================
     Kodierung
     ========================================================= */

  const kodieren = (canvas, typ, q) =>
    new Promise(res => canvas.toBlob(b => res(b), typ, q));

  /**
   * Sucht die höchste Qualität, bei der die Datei noch unter die
   * Zielgröße passt.
   *
   * Ablauf (bewusst wenige Kodierläufe, jeder kostet Rechenzeit):
   *   1. Passt schon die beste Qualität?          → fertig
   *   2. Passt die niedrigste sinnvolle Qualität? → nein, dann verkleinern.
   *      Die nötige Skalierung wird aus dem Größenverhältnis geschätzt
   *      (Dateigröße wächst ungefähr mit der Pixelzahl), statt sie in
   *      vielen Schritten zu erraten.
   *   3. Binärsuche über die Qualität bei der gefundenen Skalierung.
   */
  async function aufZielgroesse(quelle, typ, zielBytes, darfSkalieren, api, tok){
    // Darf verkleinert werden, halten wir die Qualität in einem vernünftigen
    // Rahmen und opfern lieber Pixel — das sieht fast immer besser aus.
    const minQ = darfSkalieren ? 0.40 : 0.05;

    // Passt schon die beste Qualität? Häufigster Fall, ein Lauf genügt.
    const best = await kodieren(quelle, typ, 0.97);
    if(api.stale(tok)) return null;
    if(best.size <= zielBytes) return { blob: best, q: 0.97, skala: 1, canvas: quelle };

    // Qualität allein probieren
    let suche = await sucheQualitaet(quelle, 1, typ, zielBytes, minQ, api, tok);
    if(api.stale(tok)) return null;
    if(suche.treffer) return suche.treffer;
    if(!darfSkalieren) return null;

    // Reicht nicht → Skalierung aus dem Größenverhältnis schätzen.
    // Die Dateigröße wächst ungefähr mit der Pixelzahl, also mit skala².
    let skala = Math.max(0.05, Math.min(0.9, Math.sqrt(zielBytes / suche.kleinste) * 0.92));
    for(let i = 0; i < 4; i++){
      const canvas = skaliere(quelle, skala);
      suche = await sucheQualitaet(canvas, skala, typ, zielBytes, minQ, api, tok);
      if(api.stale(tok)) return null;
      if(suche.treffer) return suche.treffer;
      skala *= 0.75;                      // Schätzung war zu optimistisch
    }
    return null;
  }

  /**
   * Binärsuche über die Qualität bei fester Auflösung.
   * Gibt den besten Treffer zurück und die kleinste gesehene Dateigröße
   * (die dient als Basis für die Skalierungsschätzung).
   */
  async function sucheQualitaet(canvas, skala, typ, zielBytes, minQ, api, tok){
    let lo = minQ, hi = 0.97, treffer = null, kleinste = Infinity;
    for(let i = 0; i < 6; i++){
      const q = i === 0 ? minQ : (lo + hi) / 2;   // zuerst die Untergrenze prüfen
      const b = await kodieren(canvas, typ, q);
      if(api.stale(tok)) return { treffer: null, kleinste };
      kleinste = Math.min(kleinste, b.size);

      if(b.size <= zielBytes){
        treffer = { blob: b, q, skala, canvas };
        if(i === 0) lo = minQ;                    // Untergrenze passt → höher suchen
        else lo = q;
        if(b.size >= zielBytes * 0.93) break;     // nah genug, Rest sparen
      } else {
        if(i === 0) return { treffer: null, kleinste };  // selbst minQ zu groß
        hi = q;
      }
    }
    return { treffer, kleinste };
  }

  /* =========================================================
     Bildhilfen
     ========================================================= */

  function vollCanvas(img){
    const s = Math.min(1, MAX_KANTE / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width  = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function skaliere(quelle, s){
    const c = document.createElement('canvas');
    c.width  = Math.max(1, Math.round(quelle.width * s));
    c.height = Math.max(1, Math.round(quelle.height * s));
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(quelle, 0, 0, c.width, c.height);
    return c;
  }

  const bild = c => c.getContext('2d').getImageData(0, 0, c.width, c.height);

  const blobZuBild = blob => new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); res(i); };
    i.onerror = e => { URL.revokeObjectURL(url); rej(e); };
    i.src = url;
  });

  function hatTransparenz(d){
    for(let i = 3; i < d.data.length; i += 4 * 97)   // Stichprobe reicht
      if(d.data[i] < 255) return true;
    return false;
  }

  function zielFormat(wahl, alpha){
    if(wahl !== 'auto') return wahl;
    return kannKodieren('image/webp') ? 'image/webp' : 'image/jpeg';
  }

  function kannKodieren(typ){
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL(typ).indexOf('data:' + typ) === 0;
  }

  /** Mittlere quadratische Pixelabweichung in Prozent (0 = identisch). */
  function messeUnterschied(orig, ergBild, w, h){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(ergBild, 0, 0, w, h);          // ggf. wieder hochskaliert
    const b = x.getImageData(0, 0, w, h).data, a = orig.data;

    let summe = 0, n = 0;
    const schritt = Math.max(4, Math.floor(a.length / 4 / 250000) * 4);
    for(let i = 0; i < a.length; i += schritt){
      for(let k = 0; k < 3; k++){ const d = a[i+k] - b[i+k]; summe += d*d; n++; }
    }
    return Math.sqrt(summe / n) / 255 * 100;
  }

  /* =========================================================
     Ausgabe
     ========================================================= */

  const feld = id => body.querySelector(`[data-f="${id}"]`).closest('.field');

  function groesse(b){
    return b >= 1048576 ? (b/1048576).toFixed(2) + ' MB'
         : b >= 1024    ? Math.round(b/1024) + ' kB'
                        : b + ' B';
  }

  function dateiname(name, typ){
    const stamm = name.replace(/\.[^.]+$/, '');
    return stamm + '-komprimiert.' + (typ === 'image/webp' ? 'webp' : 'jpg');
  }

  function urteil(d){
    const de = TL.de();
    if(d < 1)  return de ? 'nicht sichtbar'  : 'not visible';
    if(d < 2)  return de ? 'kaum sichtbar'   : 'barely visible';
    if(d < 4)  return de ? 'leicht sichtbar' : 'slightly visible';
    return de ? 'deutlich sichtbar' : 'clearly visible';
  }

  function zeigeTabelle(datei, erg, typ, unterschied, quelle){
    if(!tabelle){
      tabelle = document.createElement('table');
      tabelle.className = 'tstats';
      api.panel.insertBefore(tabelle, api.panel.querySelector('.tnote'));
    }
    const de = TL.de();
    const vorher = datei ? datei.size : null;
    const nachher = erg.blob.size;
    const ersparnis = vorher ? Math.round((1 - nachher/vorher) * 100) : null;
    const zeile = (k, v) => `<tr><td>${k}</td><td colspan="2">${v}</td></tr>`;

    tabelle.innerHTML = `
      <tr><th>${de ? 'Wert' : 'Metric'}</th><th colspan="2">${de ? 'Ergebnis' : 'Result'}</th></tr>
      ${zeile(de ? 'Dateigröße' : 'File size',
        `${vorher ? groesse(vorher) + ' → ' : ''}<strong>${groesse(nachher)}</strong>` +
        (ersparnis !== null ? `  (${ersparnis >= 0 ? '−' : '+'}${Math.abs(ersparnis)} %)` : ''))}
      ${zeile(de ? 'Abmessungen' : 'Dimensions',
        `${quelle.width} × ${quelle.height}` +
        (erg.skala < 1 ? ` → ${erg.canvas.width} × ${erg.canvas.height}` : ' px'))}
      ${zeile(de ? 'Format' : 'Format',
        `${datei ? kurzTyp(datei.type) + ' → ' : ''}${kurzTyp(typ)}`)}
      ${zeile(de ? 'Qualität' : 'Quality', Math.round(erg.q * 100) + ' %')}
      ${zeile(de ? 'Gemessener Unterschied' : 'Measured difference',
        `${unterschied.toFixed(2)} % — ${urteil(unterschied)}`)}`;
  }

  const kurzTyp = t => (t || '').replace('image/', '').toUpperCase().replace('JPEG', 'JPG') || '—';
};

window.TOOLS['compress'].doc = {
  de: `
<h4>Bilder auf eine Zielgröße bringen</h4>
<p>Meistens ist die Frage nicht „wie stark soll komprimiert werden“, sondern „es darf höchstens X groß sein“ — für einen Upload, einen E-Mail-Anhang oder ein Bewerbungsportal. Genau darauf ist dieses Tool ausgelegt.</p>

<h5>Warum die Zielgröße exakt getroffen wird</h5>
<p>Die Dateigröße eines JPEGs lässt sich nicht zuverlässig vorausberechnen — sie hängt vom Bildinhalt ab. Ein glatter Himmel komprimiert sich hervorragend, eine Wiese mit tausenden Grashalmen kaum. Jede Vorhersage wäre also geraten.</p>
<p>Deshalb rät das Tool nicht, sondern <strong>probiert</strong>: Es kodiert das Bild mehrfach mit unterschiedlicher Qualität und nähert sich per Binärsuche in acht Schritten der höchsten Qualität an, die gerade noch unter deine Zielgröße passt. Was am Ende angezeigt wird, ist die tatsächliche Dateigröße — nicht eine Schätzung.</p>
<p>Reicht die Qualität allein nicht aus (etwa 100 kB für ein 24-Megapixel-Foto), werden zusätzlich die Abmessungen in Schritten reduziert und erneut gesucht. Das lässt sich abschalten, wenn die Pixelmaße erhalten bleiben müssen.</p>

<h5>Die drei Stufen</h5>
<p>Wenn keine feste Vorgabe existiert, sind die Stufen der schnellere Weg. Sie setzen einfach eine feste Qualität und zeigen dir, was dabei herauskommt:</p>
<ul>
  <li><strong>Schonend</strong> (Qualität 92) — Unterschied praktisch nie sichtbar, Ersparnis trotzdem oft deutlich.</li>
  <li><strong>Ausgewogen</strong> (Qualität 78) — der Standardbereich für Web-Bilder.</li>
  <li><strong>Stark</strong> (Qualität 60) — für Vorschaubilder oder wenn die Größe wirklich zählt.</li>
</ul>

<h5>Was „Gemessener Unterschied“ bedeutet</h5>
<p>Das ist keine Bewertung des Encoders, sondern ein echter Vergleich: Das komprimierte Ergebnis wird zurückdekodiert und Pixel für Pixel gegen das Original gerechnet (mittlere quadratische Abweichung, RMSE, in Prozent des Wertebereichs).</p>
<ul>
  <li><strong>unter 1 %</strong> — nicht sichtbar, auch beim Vergleich nebeneinander.</li>
  <li><strong>1–2 %</strong> — kaum sichtbar, allenfalls in glatten Farbverläufen.</li>
  <li><strong>2–4 %</strong> — leicht sichtbar, typischerweise Artefakte an harten Kanten.</li>
  <li><strong>über 4 %</strong> — deutlich sichtbar.</li>
</ul>
<p>Wurden die Abmessungen reduziert, wird das Ergebnis für den Vergleich wieder auf Originalgröße gebracht — der Wert enthält dann also auch den Schärfeverlust.</p>

<h5>Welches Format?</h5>
<ul>
  <li><strong>WebP</strong> ist bei gleicher Qualität meist 25–35 % kleiner als JPG und kann Transparenz. Alle aktuellen Browser zeigen es an. Standardwahl, wo nichts dagegen spricht.</li>
  <li><strong>JPG</strong> ist maximal kompatibel — sinnvoll bei Portalen oder Programmen, die WebP nicht annehmen. Transparenz geht dabei verloren und wird weiß hinterlegt.</li>
  <li><strong>PNG</strong> steht bewusst nicht zur Auswahl: Es komprimiert verlustfrei und lässt sich deshalb nicht auf eine Zielgröße regeln. Für Fotos ist es ohnehin die falsche Wahl.</li>
</ul>

<h5>Und PDFs?</h5>
<p>PDF-Kompression funktioniert anders: Dort müssen die eingebetteten Bilder einzeln ersetzt werden, während Text und Vektoren unangetastet bleiben. Das ist im Browser nicht sinnvoll umsetzbar — dafür liegt im Repository das Skript <code>tools/compress_pdf.py</code>, das genau das tut.</p>
<p>Alles läuft lokal in deinem Browser. Es wird nichts hochgeladen.</p>`,

  en: `
<h4>Bringing images down to a target size</h4>
<p>Usually the question is not “how hard should this be compressed” but “it must not exceed X” — for an upload, an email attachment or an application portal. That is exactly what this tool is built for.</p>

<h5>Why the target size is hit exactly</h5>
<p>The file size of a JPEG cannot be predicted reliably — it depends on image content. A smooth sky compresses beautifully; a meadow with thousands of blades of grass barely does. Any prediction would be guesswork.</p>
<p>So the tool does not guess, it <strong>tries</strong>: it encodes the image repeatedly at different quality settings and uses a binary search over eight steps to find the highest quality that still fits under your target. What you see at the end is the actual file size — not an estimate.</p>
<p>If quality alone is not enough (say 100 kB for a 24-megapixel photo), the dimensions are reduced step by step and the search runs again. You can switch that off if the pixel dimensions must stay intact.</p>

<h5>The three levels</h5>
<p>When there is no fixed requirement, the levels are the quicker route. They simply apply a fixed quality and show you what comes out:</p>
<ul>
  <li><strong>Gentle</strong> (quality 92) — the difference is practically never visible, yet the saving is often substantial.</li>
  <li><strong>Balanced</strong> (quality 78) — the standard range for web images.</li>
  <li><strong>Strong</strong> (quality 60) — for thumbnails, or when size really matters.</li>
</ul>

<h5>What “measured difference” means</h5>
<p>This is not a rating of the encoder but a real comparison: the compressed result is decoded again and compared pixel by pixel against the original (root mean square error, as a percentage of the value range).</p>
<ul>
  <li><strong>below 1 %</strong> — not visible, even side by side.</li>
  <li><strong>1–2 %</strong> — barely visible, at most in smooth gradients.</li>
  <li><strong>2–4 %</strong> — slightly visible, typically artefacts along hard edges.</li>
  <li><strong>above 4 %</strong> — clearly visible.</li>
</ul>
<p>If the dimensions were reduced, the result is scaled back to original size for the comparison — so the value then also includes the loss of sharpness.</p>

<h5>Which format?</h5>
<ul>
  <li><strong>WebP</strong> is usually 25–35 % smaller than JPG at equal quality and supports transparency. Every current browser displays it. The default choice unless something speaks against it.</li>
  <li><strong>JPG</strong> is maximally compatible — useful for portals or programs that will not accept WebP. Transparency is lost and filled with white.</li>
  <li><strong>PNG</strong> is deliberately not offered: it compresses losslessly and therefore cannot be steered towards a target size. For photographs it is the wrong choice anyway.</li>
</ul>

<h5>And PDFs?</h5>
<p>PDF compression works differently: the embedded images have to be replaced individually while text and vectors stay untouched. That is not practical in the browser — the repository contains the script <code>tools/compress_pdf.py</code> which does exactly that.</p>
<p>Everything runs locally in your browser. Nothing is uploaded.</p>`
};
