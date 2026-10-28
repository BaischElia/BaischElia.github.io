/* =========================================================
   cvrequest.js — Formular für Lebenslauf-Anfrage und Kontakt
   ---------------------------------------------------------
   Ein Modal, zwei Varianten:
     openCvRequest()  → „Lebenslauf anfragen“ (Button unter Über mich)
     openContact()    → „Kontakt“ (Klick auf die E-Mail ganz unten)

   Die Nachricht wird über FormSubmit (formsubmit.co) als E-Mail
   an CV_INBOX geschickt — ganz ohne eigenen Server, passend für
   GitHub Pages.

   Beim allerersten Absenden schickt FormSubmit einmalig eine
   Bestätigungs-Mail an CV_INBOX. Erst nach Klick auf
   „Activate Form“ kommen die Nachrichten an.
   ========================================================= */

const CV_INBOX = 'baischelia@gmx.de';
const CV_ENDPOINT = 'https://formsubmit.co/ajax/' + CV_INBOX;

/* Texte je Variante (DE/EN) */
const FORM_MODES = {
  cv: {
    title:  { de:'Lebenslauf anfragen', en:'Request my CV' },
    intro:  { de:'Meinen Lebenslauf schicke ich auf Anfrage gern per E-Mail. Sag mir kurz, wer du bist und wohin er gehen soll.',
              en:"I'm happy to send my CV by email on request. Just tell me who you are and where to send it." },
    email:  { de:'E-Mail für den Lebenslauf *', en:'Email for the CV *' },
    msg:    { de:'Nachricht (optional)', en:'Message (optional)' },
    msgRequired: false,
    send:   { de:'Anfrage senden', en:'Send request' },
    subject: name => 'Lebenslauf-Anfrage von ' + name,
    doneH:  { de:'Danke, deine Anfrage ist angekommen.', en:'Thanks, your request has arrived.' },
    doneP:  { de:'Ich schicke dir den Lebenslauf so bald wie möglich an die angegebene Adresse.',
              en:"I'll send my CV to the address you gave as soon as I can." }
  },
  contact: {
    title:  { de:'Kontakt', en:'Contact' },
    intro:  { de:'Schreib mir einfach hier. Die Nachricht landet direkt in meinem Postfach, ich antworte an deine E-Mail-Adresse.',
              en:'Just write to me here. Your message goes straight to my inbox and I reply to your email address.' },
    email:  { de:'Deine E-Mail *', en:'Your email *' },
    msg:    { de:'Nachricht *', en:'Message *' },
    msgRequired: true,
    send:   { de:'Nachricht senden', en:'Send message' },
    subject: name => 'Kontaktanfrage von ' + name,
    doneH:  { de:'Danke, deine Nachricht ist angekommen.', en:'Thanks, your message has arrived.' },
    doneP:  { de:'Ich melde mich so bald wie möglich bei dir.', en:"I'll get back to you as soon as I can." }
  }
};

let _formMode = 'cv';

const _cv = id => document.getElementById(id);
const _cvDE = () => (window.lang || 'de') === 'de';

/* Setzt Text in der aktuellen Sprache und hinterlegt beide Fassungen,
   damit der DE/EN-Umschalter (toggleLang) sie weiterhin tauschen kann. */
function _setText(id, t){
  const el = _cv(id);
  if(!el) return;
  el.setAttribute('data-de', t.de);
  el.setAttribute('data-en', t.en);
  el.textContent = _cvDE() ? t.de : t.en;
}

function _applyMode(mode){
  _formMode = mode;
  const m = FORM_MODES[mode];
  _setText('cvTitle',    m.title);
  _setText('cvIntro',    m.intro);
  _setText('cvEmailLbl', m.email);
  _setText('cvMsgLbl',   m.msg);
  _setText('cvDoneH',    m.doneH);
  _setText('cvDoneP',    m.doneP);
  _setText('cvSendLbl',  m.send);
  _cv('cvMsg').required = m.msgRequired;
  _cv('cvMsg').rows = m.msgRequired ? 5 : 3;
}

function _openForm(mode){
  const mb = _cv('cvMb');
  if(!mb) return;
  // Nach einer abgeschickten Nachricht oder beim Wechsel der Variante frisch starten
  if(_cv('cvDone').hidden === false || mode !== _formMode) resetCvForm();
  _applyMode(mode);
  mb.classList.add('show');
  document.body.style.overflow = 'hidden';
  setTimeout(()=> _cv('cvName') && _cv('cvName').focus(), 80);
}

function openCvRequest(){ _openForm('cv'); }
function openContact(){ _openForm('contact'); }

function closeCvRequest(){
  const mb = _cv('cvMb');
  if(!mb) return;
  mb.classList.remove('show');
  document.body.style.overflow = '';
}

function resetCvForm(){
  _cv('cvForm').reset();
  _cv('cvForm').hidden = false;
  _cv('cvDone').hidden = true;
  _cv('cvErr').hidden = true;
}

async function sendCvRequest(e){
  e.preventDefault();
  const form = _cv('cvForm');
  const btn  = _cv('cvSend');
  const err  = _cv('cvErr');
  err.hidden = true;

  // Pflichtfelder prüfen, Browser zeigt die Hinweise selbst an
  if(!form.reportValidity()) return;

  // Unsichtbares Feld: füllen nur Bots aus
  if(_cv('cvHoney').value) return;

  const name = _cv('cvName').value.trim();
  const data = {
    Art:         _formMode === 'cv' ? 'Lebenslauf-Anfrage' : 'Kontakt',
    Name:        name,
    Unternehmen: _cv('cvCompany').value.trim() || '—',
    'E-Mail':    _cv('cvEmail').value.trim(),
    Nachricht:   _cv('cvMsg').value.trim() || '—',
    _subject:    FORM_MODES[_formMode].subject(name),
    _replyto:    _cv('cvEmail').value.trim(),
    _template:   'table'
  };

  btn.disabled = true;
  const label = btn.querySelector('span');
  const before = label.textContent;
  label.textContent = _cvDE() ? 'Wird gesendet …' : 'Sending …';

  try{
    const res = await fetch(CV_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });
    const out = await res.json().catch(()=> ({}));
    if(!res.ok || out.success === 'false' || out.success === false) throw new Error(out.message || res.status);
    form.hidden = true;
    _cv('cvDone').hidden = false;
  } catch(ex){
    console.warn('Formular konnte nicht gesendet werden:', ex);
    err.hidden = false;
  } finally {
    btn.disabled = false;
    label.textContent = before;
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const mb = _cv('cvMb');
  if(!mb) return;
  mb.addEventListener('click', e=>{ if(e.target === mb) closeCvRequest(); });
  addEventListener('keydown', e=>{ if(e.key === 'Escape' && mb.classList.contains('show')) closeCvRequest(); });
  _cv('cvForm').addEventListener('submit', sendCvRequest);
});
