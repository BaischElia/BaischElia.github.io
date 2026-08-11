/* =========================================================
   tools/awb.js — Auto White Balance
   ---------------------------------------------------------
   Portierung von ToolsTemplates/Auto White Balance/backend/utils.py
   Rechnet wie das Original im linearen Licht-Raum:
   sRGB → linear → Kanalverstärkung → zurück nach sRGB.
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['awb'] = function(body, title){
  title.textContent = TL.t({de:'Auto White Balance', en:'Auto white balance'});

  TL.build(body, {
    cols: 2,
    drops:  [{ id:'src', label:{de:'Bild wählen', en:'Choose an image'} }],
    fields: [
      { id:'algo', type:'select', value:'gray-world',
        label:{de:'Verfahren', en:'Algorithm'},
        options:[
          { v:'gray-world',  t:'Gray World' },
          { v:'white-patch', t:{de:'White Patch (Perfect Reflector)', en:'White Patch (perfect reflector)'} }
        ]},
      { id:'pct', type:'range', min:90, max:100, step:0.1, value:99.5, unit:'%',
        label:{de:'Perzentil (White Patch)', en:'Percentile (white patch)'} }
    ],
    views: [
      { id:'orig', label:{de:'Original', en:'Original'} },
      { id:'out',  label:{de:'Weißabgleich', en:'White balanced'} }
    ],
    action: { label:{de:'Ergebnis laden', en:'Download result'}, view:'out', name:'white-balanced.png' },

    onInput(api){
      const src = TL.pixels(api.images.src, 1400);
      TL.show(api.view('orig'), src);

      const n = src.width * src.height;
      // 1) sRGB → linear (LUT), Kanäle getrennt halten
      const lin = new Float32Array(n * 3);
      for(let i = 0; i < n; i++){
        lin[i*3]   = TL.S2L[src.data[i*4]];
        lin[i*3+1] = TL.S2L[src.data[i*4+1]];
        lin[i*3+2] = TL.S2L[src.data[i*4+2]];
      }

      // 2) Verstärkungen je Kanal bestimmen
      const gains = api.val('algo') === 'gray-world'
        ? grayWorld(lin, n)
        : whitePatch(lin, n, api.val('pct'));

      // 3) anwenden und zurück nach sRGB
      const out = new ImageData(src.width, src.height);
      for(let i = 0; i < n; i++){
        for(let c = 0; c < 3; c++)
          out.data[i*4+c] = Math.round(TL.lin2srgb(lin[i*3+c] * gains[c]) * 255);
        out.data[i*4+3] = 255;
      }
      TL.show(api.view('out'), out);

      // Perzentil-Regler nur beim White Patch anzeigen
      const pctField = body.querySelector('[data-f="pct"]').closest('.field');
      pctField.style.display = api.val('algo') === 'white-patch' ? 'block' : 'none';

      api.say(TL.t({
        de: `Verstärkung  R ${gains[0].toFixed(3)}  ·  G ${gains[1].toFixed(3)}  ·  B ${gains[2].toFixed(3)}`,
        en: `Gains  R ${gains[0].toFixed(3)}  ·  G ${gains[1].toFixed(3)}  ·  B ${gains[2].toFixed(3)}`
      }));
    }
  });

  /* Annahme: der Mittelwert der Szene ist neutrales Grau. */
  function grayWorld(lin, n){
    let r = 0, g = 0, b = 0;
    for(let i = 0; i < n; i++){ r += lin[i*3]; g += lin[i*3+1]; b += lin[i*3+2]; }
    r /= n; g /= n; b /= n;
    const grayMean = (r + g + b) / 3;
    return [grayMean/(r+1e-6), grayMean/(g+1e-6), grayMean/(b+1e-6)];
  }

  /* Annahme: das hellste Pixel ist eine perfekt weiße Fläche. */
  function whitePatch(lin, n, pct){
    const ch = [0,1,2].map(c => {
      const v = new Float32Array(n);
      for(let i = 0; i < n; i++) v[i] = lin[i*3+c];
      return TL.percentile(v, pct);
    });
    const max = Math.max(ch[0], ch[1], ch[2]);
    return ch.map(v => max / (v + 1e-6));
  }
};

window.TOOLS['awb'].doc = {
  de: `
<h4>Auto White Balance</h4>
<p>Farbstiche entstehen, weil Lichtquellen unterschiedliche Farbtemperaturen haben — Kerzenlicht ist warm, Schatten im Freien ist bläulich. Ein automatischer Weißabgleich schätzt diesen Stich und rechnet ihn heraus.</p>
<p>Beide Verfahren arbeiten hier im <strong>linearen Lichtraum</strong>: Das Bild wird erst von sRGB nach linear konvertiert, dann skaliert und anschließend zurückgerechnet. Das ist physikalisch korrekt — eine Verdopplung der Zahl entspricht dann wirklich doppelt so viel Licht.</p>

<h5>1 — Gray World</h5>
<p>Annahme: <em>Die Durchschnittsfarbe der gesamten Szene ist neutrales Grau.</em></p>
<p>Das Verfahren berechnet den Mittelwert für Rot, Grün und Blau über das ganze Bild und skaliert jeden Kanal so, dass diese Mittelwerte gleich werden. Ein globaler Farbstich verschwindet dadurch.</p>
<div class="fx">gain_c = mittelwert_grau / mittelwert_c</div>
<ul>
  <li><strong>Gut bei:</strong> Bildern mit reichhaltiger, ausgewogener Farbverteilung.</li>
  <li><strong>Schwach bei:</strong> Motiven, die von einer Farbe dominiert werden — eine rote Wand macht das Bild grünlich.</li>
</ul>

<h5>2 — White Patch (Perfect Reflector)</h5>
<p>Annahme: <em>Das hellste Pixel im Bild ist eine perfekt weiße oder spiegelnde Fläche.</em></p>
<p>Statt des Mittelwerts wird je Kanal der Maximalwert gesucht und das Bild so gestreckt, dass dieser Punkt zu reinem Weiß wird. Um nicht auf einzelne Ausreißer oder heiße Pixel hereinzufallen, wird nicht das echte Maximum genommen, sondern ein <strong>Perzentil</strong> (Standard 99,5 %) — den Wert kannst du im Tool verstellen.</p>
<ul>
  <li><strong>Gut bei:</strong> Szenen mit einem echten weißen oder sehr hellen neutralen Objekt.</li>
  <li><strong>Schwach bei:</strong> Bildern ohne weißen Bezugspunkt oder mit ausgebrannten Lichtern.</li>
</ul>

<h5>Was das Tool anzeigt</h5>
<p>Unter dem Bild stehen die berechneten Verstärkungen je Kanal. Werte nahe 1,0 bedeuten: Das Bild war schon fast neutral. Ein Wert von z. B. 1,25 beim Blaukanal heißt, dass Blau um 25 % angehoben wurde — das Original war also zu warm.</p>
<p class="src">Quelle: eigenes Projekt „Auto White Balance Web Application“ (Flask + NumPy), hier vollständig im Browser nachgebaut.</p>`,

  en: `
<h4>Auto white balance</h4>
<p>Colour casts happen because light sources have different colour temperatures — candlelight is warm, outdoor shade is bluish. Automatic white balance estimates that cast and removes it.</p>
<p>Both methods work in <strong>linear light</strong>: the image is converted from sRGB to linear, scaled, then converted back. That is physically correct — doubling the number then really means twice the light.</p>

<h5>1 — Gray World</h5>
<p>Assumption: <em>the average colour of the whole scene is neutral gray.</em></p>
<p>It computes the mean of the red, green and blue channels across the image and scales each channel so those means become equal, neutralising any global cast.</p>
<div class="fx">gain_c = mean_gray / mean_c</div>
<ul>
  <li><strong>Good for:</strong> images with a rich, balanced distribution of colours.</li>
  <li><strong>Weak for:</strong> scenes dominated by one colour — a red wall turns the image greenish.</li>
</ul>

<h5>2 — White Patch (perfect reflector)</h5>
<p>Assumption: <em>the brightest pixel is a perfectly white or specular surface.</em></p>
<p>Instead of the mean it finds the maximum per channel and stretches the image so that point becomes pure white. To avoid latching onto single outliers or hot pixels it uses a <strong>percentile</strong> (99.5 % by default) rather than the true maximum — you can change it in the tool.</p>
<ul>
  <li><strong>Good for:</strong> scenes containing a true white or very bright neutral object.</li>
  <li><strong>Weak for:</strong> images without a white reference, or with blown highlights.</li>
</ul>

<h5>What the tool shows</h5>
<p>Below the image you see the computed per-channel gains. Values near 1.0 mean the image was already close to neutral. A blue gain of 1.25, say, means blue was lifted by 25 % — so the original was too warm.</p>
<p class="src">Source: my own “Auto White Balance Web Application” project (Flask + NumPy), rebuilt entirely in the browser.</p>`
};
