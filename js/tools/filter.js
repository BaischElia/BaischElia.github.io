/* =========================================================
   tools/filter.js — Image Filter Studio
   Registriert sich als window.TOOLS['filter']
   Presets + Live-Regler, PNG-Export. Alles clientseitig.
   ========================================================= */

window.TOOLS = window.TOOLS || {};

window.TOOLS['filter'] = function(body, title){
  const de = window.isDE();
  title.textContent = 'Image Filter Studio';
  body.innerHTML = `
    <div class="drop" id="fD">
      <div class="big">${de ? 'Bild laden' : 'Load image'}</div>
      <p>${de ? 'klicken oder ziehen' : 'click or drag'}</p>
      <input type="file" id="fF" accept="image/*" hidden>
    </div>
    <div id="fO" style="display:none">
      <div class="presets" id="fP">
        <button class="pst active" data-p="none">Original</button>
        <button class="pst" data-p="noir">Noir</button>
        <button class="pst" data-p="warm">Warm</button>
        <button class="pst" data-p="cool">Cool</button>
        <button class="pst" data-p="vivid">Vivid</button>
        <button class="pst" data-p="fade">Fade</button>
      </div>
      <div class="grid2">
        <div class="field"><label>${de ? 'Helligkeit' : 'Brightness'} · <span class="mval" id="fbV">100%</span></label><input type="range" id="fb" min="0" max="200" value="100"></div>
        <div class="field"><label>${de ? 'Kontrast' : 'Contrast'} · <span class="mval" id="fcV">100%</span></label><input type="range" id="fc" min="0" max="200" value="100"></div>
        <div class="field"><label>${de ? 'Sättigung' : 'Saturation'} · <span class="mval" id="fsV">100%</span></label><input type="range" id="fs" min="0" max="300" value="100"></div>
        <div class="field"><label>Sepia · <span class="mval" id="fseV">0%</span></label><input type="range" id="fse" min="0" max="100" value="0"></div>
        <div class="field"><label>${de ? 'Graustufen' : 'Grayscale'} · <span class="mval" id="fgV">0%</span></label><input type="range" id="fg" min="0" max="100" value="0"></div>
        <div class="field"><label>Blur · <span class="mval" id="fblV">0px</span></label><input type="range" id="fbl" min="0" max="12" value="0"></div>
      </div>
      <div class="out">
        <canvas id="fC"></canvas>
        <button class="mbtn" id="fDl">${de ? 'Als PNG speichern' : 'Save as PNG'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v13M7 11l5 5 5-5M5 21h14"/></svg></button>
      </div>
    </div>`;

  const drop = document.getElementById('fD');
  const file = document.getElementById('fF');
  const cv   = document.getElementById('fC');
  const fO   = document.getElementById('fO');
  let img = new Image();

  drop.onclick = () => file.click();
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); if(e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
  file.onchange = e => { if(e.target.files[0]) load(e.target.files[0]); };

  function load(f){
    const r = new FileReader();
    r.onload = ev => { img.onload = () => {
      fO.style.display = 'block';
      const mw = 520, s = Math.min(1, mw / img.width);
      cv.width = img.width * s; cv.height = img.height * s;
      apply();
    }; img.src = ev.target.result; };
    r.readAsDataURL(f);
  }

  const ids = ['fb','fc','fs','fse','fg','fbl'];
  const unit = { fb:'%', fc:'%', fs:'%', fse:'%', fg:'%', fbl:'px' };

  function apply(){
    const g = id => document.getElementById(id).value;
    ids.forEach(id => document.getElementById(id+'V').textContent = g(id) + unit[id]);
    const ctx = cv.getContext('2d');
    ctx.filter = `brightness(${g('fb')}%) contrast(${g('fc')}%) saturate(${g('fs')}%) sepia(${g('fse')}%) grayscale(${g('fg')}%) blur(${g('fbl')}px)`;
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
  }

  ids.forEach(id => document.getElementById(id).oninput = () => {
    document.querySelectorAll('#fP .pst').forEach(b => b.classList.remove('active'));
    apply();
  });

  const P = {
    none:  { fb:100, fc:100, fs:100, fse:0,  fg:0,   fbl:0 },
    noir:  { fb:105, fc:130, fs:0,   fse:0,  fg:100, fbl:0 },
    warm:  { fb:105, fc:105, fs:130, fse:35, fg:0,   fbl:0 },
    cool:  { fb:100, fc:112, fs:118, fse:0,  fg:0,   fbl:0 },
    vivid: { fb:105, fc:120, fs:180, fse:0,  fg:0,   fbl:0 },
    fade:  { fb:110, fc:85,  fs:80,  fse:15, fg:0,   fbl:0 }
  };
  document.querySelectorAll('#fP .pst').forEach(b => b.onclick = () => {
    document.querySelectorAll('#fP .pst').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const p = P[b.dataset.p];
    ids.forEach(id => document.getElementById(id).value = p[id]);
    apply();
  });

  document.getElementById('fDl').onclick = () => {
    const a = document.createElement('a');
    a.download = 'filtered.png';
    a.href = cv.toDataURL('image/png');
    a.click();
  };
};
