/* =========================================================
   contact.js — E-Mail-Links und „Kopieren“
   ---------------------------------------------------------
   Kein Formular, kein fremder Dienst: Die Buttons öffnen das
   Mailprogramm des Besuchers mit einer vorbereiteten Mail.
   Der Text folgt der eingestellten Sprache (DE/EN).
   ========================================================= */

const MAIL_TO = 'baischelia@gmx.de';

const CV_MAIL = {
  de: {
    subject: 'Lebenslauf-Anfrage',
    body: 'Hallo Elia,\n\nich würde gern deinen Lebenslauf erhalten.\n\nName:\nUnternehmen:\nWofür (z. B. Stelle):\n\nViele Grüße'
  },
  en: {
    subject: 'CV request',
    body: 'Hi Elia,\n\nI would like to receive your CV.\n\nName:\nCompany:\nWhat for (e.g. position):\n\nBest regards'
  }
};

function mailHref(to, subject, body){
  return 'mailto:' + to +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
}

/* Link für „Lebenslauf anfragen“ in der aktuellen Sprache setzen */
function updateMailLinks(){
  const a = document.getElementById('cvMail');
  if(!a) return;
  const t = CV_MAIL[(window.lang || 'de') === 'de' ? 'de' : 'en'];
  a.href = mailHref(MAIL_TO, t.subject, t.body);
}

/* Text in die Zwischenablage kopieren und am Button kurz bestätigen */
async function copyText(text, btn){
  const label = btn && btn.querySelector('span');
  let ok = false;
  try{
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch(e){
    // Fallback für ältere Browser: Text kurz markieren und kopieren
    const tmp = document.createElement('textarea');
    tmp.value = text; tmp.setAttribute('readonly', '');
    tmp.style.position = 'fixed'; tmp.style.opacity = '0';
    document.body.appendChild(tmp); tmp.select();
    try{ ok = document.execCommand('copy'); } catch(_){}
    tmp.remove();
  }
  if(!label) return;
  // Ursprünglichen Text in beiden Sprachen merken
  if(!label.dataset.orig){
    label.dataset.orig = '1';
    label.dataset.de0 = label.getAttribute('data-de') || label.textContent;
    label.dataset.en0 = label.getAttribute('data-en') || label.textContent;
  }
  const de = (window.lang || 'de') === 'de';
  label.textContent = ok ? (de ? 'Kopiert' : 'Copied') : (de ? 'Nicht möglich' : 'Not possible');
  btn.classList.toggle('done', ok);
  clearTimeout(btn._t);
  btn._t = setTimeout(()=>{
    // Sprache erst jetzt abfragen, falls sie inzwischen umgestellt wurde
    label.textContent = (window.lang || 'de') === 'de' ? label.dataset.de0 : label.dataset.en0;
    btn.classList.remove('done');
  }, 2000);
}

/* E-Mail-Adresse kopieren (Button im Kontaktbereich) */
function copyMail(){ copyText(MAIL_TO, document.getElementById('copyMail')); }

/* Nach dem Klick auf „Lebenslauf anfragen“ eine Absicherung zeigen:
   Hat der Besucher kein Mailprogramm eingerichtet, passiert beim
   mailto-Link sonst einfach gar nichts. */
function initCvFallback(){
  const a = document.getElementById('cvMail');
  const box = document.getElementById('cvFallback');
  if(!a || !box) return;
  a.addEventListener('click', ()=>{ setTimeout(()=>{ box.hidden = false; }, 600); });
  box.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', ()=>{
    const t = CV_MAIL[(window.lang || 'de') === 'de' ? 'de' : 'en'];
    const text = btn.dataset.copy === 'mail' ? MAIL_TO : t.subject + '\n\n' + t.body;
    copyText(text, btn);
  }));
}

/* Beim Sprachwechsel den Mailtext mitwechseln */
document.addEventListener('DOMContentLoaded', ()=>{
  updateMailLinks();
  initCvFallback();
  if(typeof window.toggleLang === 'function'){
    const original = window.toggleLang;
    window.toggleLang = function(){ original(); updateMailLinks(); };
  }
});
