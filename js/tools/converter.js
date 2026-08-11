/* =========================================================
   tools/converter.js — Image Converter
   ---------------------------------------------------------
   Ergänzt um die Formatkunde aus
   ToolsTemplates/Image Converter/image_formats.md
   Alles clientseitig, kein Upload.
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['conv'] = function(body, title){
  title.textContent = 'Image Converter';

  // Der Browser kann nicht jedes Format schreiben — erst prüfen, was geht.
  const supported = [
    { v:'image/png',  t:'PNG',  lossy:false },
    { v:'image/jpeg', t:'JPG',  lossy:true  },
    { v:'image/webp', t:'WebP', lossy:true  },
    { v:'image/avif', t:'AVIF', lossy:true  }
  ].filter(f => canEncode(f.v));

  let srcBytes = 0;

  TL.build(body, {
    drops:  [{ id:'src', label:{de:'Bild wählen', en:'Choose an image'} }],
    fields: [
      { id:'fmt', type:'select', value:'image/png',
        label:{de:'Zielformat', en:'Target format'},
        options: supported.map(f => ({ v:f.v, t:f.t })) },
      { id:'scale', type:'range', min:5, max:100, step:1, value:100, unit:' %',
        label:{de:'Größe', en:'Size'} },
      { id:'q', type:'range', min:10, max:100, step:1, value:90, unit:' %',
        label:{de:'Qualität (nur verlustbehaftet)', en:'Quality (lossy formats only)'} }
    ],
    views:  [{ id:'out', label:{de:'Vorschau', en:'Preview'} }],
    action: { label:{de:'Konvertieren & laden', en:'Convert & download'}, view:'out' },

    onInput(api){
      const img = api.images.src;
      const s = api.val('scale') / 100;
      const c = api.view('out');
      c.width  = Math.max(1, Math.round(img.width  * s));
      c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      const fmt = api.val('fmt');
      // JPG kann keine Transparenz — sonst wird sie schwarz.
      if(fmt === 'image/jpeg'){
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);

      const lossy = (supported.find(f => f.v === fmt) || {}).lossy;
      const qField = body.querySelector('[data-f="q"]').closest('.field');
      qField.style.display = lossy ? 'block' : 'none';

      const url = c.toDataURL(fmt, api.val('q') / 100);
      const bytes = Math.round((url.length - url.indexOf(',') - 1) * 0.75);
      const ext = (supported.find(f => f.v === fmt) || {}).t.toLowerCase();

      // Download-Button auf das aktuelle Format umhängen
      const btn = body.querySelector('[data-act]');
      btn.onclick = () => {
        const a = document.createElement('a');
        a.download = 'converted.' + (ext === 'jpg' ? 'jpg' : ext);
        a.href = url;
        a.click();
      };

      const rel = srcBytes ? ` (${bytes < srcBytes ? '−' : '+'}${Math.abs(Math.round((1 - bytes/srcBytes) * 100))} %)` : '';
      api.say(TL.t({
        de: `${c.width} × ${c.height} px · ${kb(bytes)}${rel} · Original ${kb(srcBytes)}`,
        en: `${c.width} × ${c.height} px · ${kb(bytes)}${rel} · original ${kb(srcBytes)}`
      }));
    }
  });

  // Originalgröße merken, um den Vergleich anzeigen zu können.
  const input = body.querySelector('.tdrop input');
  input.addEventListener('change', e => { if(e.target.files[0]) srcBytes = e.target.files[0].size; });
  body.querySelector('.tdrop').addEventListener('drop', e => {
    const f = e.dataTransfer.files[0]; if(f) srcBytes = f.size;
  });

  function canEncode(type){
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL(type).indexOf('data:' + type) === 0;
  }

  const kb = b => b >= 1048576 ? (b/1048576).toFixed(2) + ' MB' : Math.round(b/1024) + ' kB';
};

window.TOOLS['conv'].doc = {
  de: `
<h4>Bildformate im Vergleich</h4>
<p>Das richtige Dateiformat entscheidet über Ladezeit, Druckqualität und Bildtreue. Die Formate unterscheiden sich vor allem in ihrer Kompression und in den Funktionen, die sie unterstützen.</p>

<h5>Die wichtigsten Formate</h5>
<ul>
  <li><strong>JPEG / JPG</strong> — verlustbehaftet, 24-Bit-Farbe, keine Transparenz. Exzellente Kompression bei komplexen Bildern, überall unterstützt. <em>Für: Fotos, Bilder mit Farbverläufen, wenn Dateigröße wichtiger ist als perfekte Qualität.</em></li>
  <li><strong>PNG</strong> — verlustfrei, Alphatransparenz mit weichen Übergängen, erhält scharfe Details wie Text und Linien. <em>Für: Logos, Icons, Screenshots, Strichgrafik.</em></li>
  <li><strong>WebP</strong> — verlustbehaftet und verlustfrei, von Google für das Web entwickelt. Deutlich bessere Kompression als JPEG und PNG bei vergleichbarer Qualität, mit Transparenz und Animation. <em>Für: der moderne Standardersatz im Web.</em></li>
  <li><strong>AVIF</strong> — das neueste Format mit der derzeit besten Kompression, spürbar kleiner als JPEG und WebP. Unterstützt HDR, Transparenz und Animation. <em>Für: Web, wenn Dateigröße höchste Priorität hat.</em></li>
  <li><strong>GIF</strong> — verlustfrei, aber nur 256 Farben, Animation, 1-Bit-Transparenz. <em>Für: einfache Animationen und farbarme Grafiken.</em></li>
  <li><strong>SVG</strong> — Vektor, auflösungsunabhängig, mit CSS und JavaScript ansteuerbar, Text bleibt durchsuchbar. <em>Für: Logos, Icons, Diagramme.</em></li>
  <li><strong>HEIC / HEIF</strong> — etwa doppelt so effizient wie JPEG, Standardformat vieler Smartphones. <em>Für: platzsparende Speicherung hochwertiger Fotos.</em></li>
  <li><strong>TIFF</strong> — verlustfrei oder verlustbehaftet, Ebenen, mehrere Seiten, CMYK. Sehr große Dateien. <em>Für: Druckvorstufe, Archivierung, medizinische Bildgebung.</em></li>
  <li><strong>BMP</strong> — unkomprimiert, sehr große Dateien, alt. <em>Für: praktisch nur noch Altlasten.</em></li>
  <li><strong>RAW</strong> (CR2, NEF, ARW …) — kaum verarbeitete Sensordaten, maximale Spielräume bei Weißabgleich und Belichtung. <em>Für: professionelle Fotoworkflows.</em></li>
</ul>

<h5>Grundbegriffe</h5>
<ul>
  <li><strong>Verlustbehaftet</strong> — verkleinert die Datei, indem Bilddaten dauerhaft verworfen werden (JPEG, WebP, AVIF).</li>
  <li><strong>Verlustfrei</strong> — verkleinert ohne Datenverlust, das Original ist exakt rekonstruierbar (PNG, GIF, TIFF).</li>
  <li><strong>Raster vs. Vektor</strong> — Raster besteht aus Pixeln und verliert beim Vergrößern an Qualität; Vektor ist mathematisch beschrieben und beliebig skalierbar.</li>
  <li><strong>1-Bit- vs. Alphatransparenz</strong> — entweder ganz sichtbar oder ganz unsichtbar (GIF), oder stufenlos durchscheinend (PNG, WebP, AVIF, SVG).</li>
</ul>

<h5>Hinweis zu diesem Tool</h5>
<p>Die Konvertierung läuft vollständig im Browser — dein Bild verlässt den Rechner nicht. Deshalb stehen nur die Formate zur Auswahl, die der Browser selbst schreiben kann (PNG, JPG, WebP, je nach Browser auch AVIF). Formate wie TIFF, BMP oder GIF beherrscht die Python-Fassung des Projekts über Pillow, der Browser aber nicht.</p>
<p class="src">Quelle: eigenes Projekt „Image Converter“ (Flask + Pillow) samt Formatvergleich aus <code>image_formats.md</code>.</p>`,

  en: `
<h4>Image formats compared</h4>
<p>The right file format decides loading time, print quality and visual fidelity. Formats differ mainly in their compression and in the features they support.</p>

<h5>The main formats</h5>
<ul>
  <li><strong>JPEG / JPG</strong> — lossy, 24-bit colour, no transparency. Excellent compression for complex images, universally supported. <em>For: photographs, images with gradients, when file size matters more than perfect quality.</em></li>
  <li><strong>PNG</strong> — lossless, alpha transparency with smooth gradients, preserves sharp detail such as text and lines. <em>For: logos, icons, screenshots, line art.</em></li>
  <li><strong>WebP</strong> — lossy and lossless, developed by Google for the web. Noticeably better compression than JPEG and PNG at comparable quality, with transparency and animation. <em>For: the modern default replacement on the web.</em></li>
  <li><strong>AVIF</strong> — the newest format with the best compression available, significantly smaller than JPEG and WebP. Supports HDR, transparency and animation. <em>For: the web when file size is the top priority.</em></li>
  <li><strong>GIF</strong> — lossless but limited to 256 colours, animation, 1-bit transparency. <em>For: simple animations and low-colour graphics.</em></li>
  <li><strong>SVG</strong> — vector, resolution-independent, scriptable with CSS and JavaScript, text stays searchable. <em>For: logos, icons, diagrams.</em></li>
  <li><strong>HEIC / HEIF</strong> — roughly twice as efficient as JPEG, the default format on many smartphones. <em>For: storing high-quality photos compactly.</em></li>
  <li><strong>TIFF</strong> — lossless or lossy, layers, multiple pages, CMYK. Very large files. <em>For: print production, archiving, medical imaging.</em></li>
  <li><strong>BMP</strong> — uncompressed, very large files, legacy. <em>For: essentially legacy use only.</em></li>
  <li><strong>RAW</strong> (CR2, NEF, ARW …) — minimally processed sensor data, maximum latitude for white balance and exposure. <em>For: professional photo workflows.</em></li>
</ul>

<h5>Key concepts</h5>
<ul>
  <li><strong>Lossy</strong> — shrinks the file by permanently discarding image data (JPEG, WebP, AVIF).</li>
  <li><strong>Lossless</strong> — shrinks without losing data; the original can be reconstructed exactly (PNG, GIF, TIFF).</li>
  <li><strong>Raster vs. vector</strong> — raster is made of pixels and degrades when scaled up; vector is defined mathematically and scales freely.</li>
  <li><strong>1-bit vs. alpha transparency</strong> — either fully visible or fully invisible (GIF), or continuously translucent (PNG, WebP, AVIF, SVG).</li>
</ul>

<h5>A note on this tool</h5>
<p>Conversion runs entirely in the browser — your image never leaves your machine. That is why only the formats the browser itself can write are offered (PNG, JPG, WebP, and AVIF depending on the browser). Formats such as TIFF, BMP or GIF are handled by the Python version of the project through Pillow, but not by the browser.</p>
<p class="src">Source: my own “Image Converter” project (Flask + Pillow) including the format comparison from <code>image_formats.md</code>.</p>`
};
