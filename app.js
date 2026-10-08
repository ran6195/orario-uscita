import {
  calcolaUscita,
  fineMensaAutomatica,
  formatDataIt,
  generaCsv,
  parseTime,
  tempoMancante,
  USCITA_MINIMA,
  INIZIO_MENSA_DEFAULT,
  FINE_MENSA_DEFAULT,
} from './calc.js';

const STORAGE_KEY = 'mensa_helper.giorni';

const $ = (id) => document.getElementById(id);
const el = {
  eyebrow: $('eyebrow'),
  data: $('data'),
  entrata: $('entrata'),
  inizio: $('inizio-mensa'),
  fine: $('fine-mensa'),
  uscita: $('uscita'),
  salvato: $('salvato'),
  progress: $('progress'),
  progressBar: $('progress-bar'),
  progressEntrata: $('progress-entrata'),
  progressPct: $('progress-pct'),
  tileCountdown: $('tile-countdown'),
  countdownLabel: $('countdown-label'),
  countdownValue: $('countdown-value'),
  pausaLabel: $('pausa-label'),
  pausaValue: $('pausa-value'),
  nota: $('nota'),
  avviso: $('avviso'),
  ripristina: $('ripristina'),
  tabOggi: $('tab-oggi'),
  tabStorico: $('tab-storico'),
  viewOggi: $('view-oggi'),
  viewStorico: $('view-storico'),
  lista: $('lista-storico'),
  conteggio: $('conteggio'),
  vuoto: $('storico-vuoto'),
  esporta: $('esporta'),
  timerMensa: $('timer-mensa'),
  timerMensaTesto: $('timer-mensa-testo'),
};

let vistaCorrente = 'oggi';
let uscitaCorrenteMin = null;

const ICONA_CESTINO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" '
  + 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/>'
  + '<path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';

// ---------- Persistenza (un record per data, chiave AAAA-MM-GG) ----------

function caricaTutti() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function salvaTutti(giorni) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(giorni));
    return true;
  } catch {
    return false;
  }
}

// ---------- Date ----------

function oggiISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dataDaISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function aggiornaEyebrow() {
  if (vistaCorrente === 'storico') {
    el.eyebrow.textContent = maiuscola(new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }));
  } else if (el.data.value) {
    el.eyebrow.textContent = maiuscola(dataDaISO(el.data.value).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long',
    }));
  }
}

function oraDa(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Giorno corrente ----------

function caricaGiorno(data) {
  const r = caricaTutti()[data];
  el.data.value = data;
  el.entrata.value = r?.entrata ?? '';
  el.inizio.value = r?.inizio_mensa ?? INIZIO_MENSA_DEFAULT;
  el.fine.value = r?.fine_mensa ?? FINE_MENSA_DEFAULT;
  mostraSalvato(r ? `Salvato ${oraDa(r.ultimo_aggiornamento)}` : '');
  aggiornaEyebrow();
  aggiorna(false);
}

function mostraSalvato(testo) {
  el.salvato.textContent = testo;
  el.salvato.hidden = !testo;
}

function aggiorna(salva = true) {
  const r = calcolaUscita({
    entrata: el.entrata.value,
    inizioMensa: el.inizio.value,
    fineMensa: el.fine.value,
  });

  el.uscita.textContent = r.uscita || '--:--';
  el.uscita.classList.toggle('placeholder', !r.uscita);
  uscitaCorrenteMin = r.uscitaMin;

  if (r.durataPausa == null) {
    el.pausaLabel.textContent = 'Pausa non valida';
    el.pausaValue.textContent = '+0 min';
  } else {
    el.pausaLabel.textContent = `Pausa ${r.durataPausa} min`;
    el.pausaValue.textContent = `+${r.minutiExtra} min`;
  }

  if (!el.entrata.value) {
    el.nota.textContent = 'Inserisci l\'orario di entrata';
  } else if (r.minimoApplicato) {
    el.nota.textContent = `Uscita minima ${USCITA_MINIMA} applicata`;
  } else {
    el.nota.textContent = '';
  }
  el.nota.hidden = !el.nota.textContent;

  if (r.errore === 'fine_prima_di_inizio') {
    el.avviso.textContent = 'La fine mensa è prima dell\'inizio: nessun minuto extra applicato.';
  } else if (r.errore === 'mensa_non_valida') {
    el.avviso.textContent = 'Orari della mensa non validi.';
  } else {
    el.avviso.textContent = '';
  }
  el.avviso.hidden = !el.avviso.textContent;

  aggiornaTempo();
  if (salva) salvaGiorno(r);
}

function salvaGiorno(r) {
  const data = el.data.value;
  if (!data) return;
  const giorni = caricaTutti();
  // Non creare record vuoti: si salva solo se c'è l'entrata o il giorno esiste già.
  if (!el.entrata.value && !giorni[data]) return;

  const adesso = new Date().toISOString();
  giorni[data] = {
    data,
    entrata: el.entrata.value,
    inizio_mensa: el.inizio.value,
    fine_mensa: el.fine.value,
    durata_pausa_min: r.durataPausa,
    minuti_extra: r.minutiExtra,
    uscita_calcolata: r.uscita,
    ultimo_aggiornamento: adesso,
  };
  mostraSalvato(salvaTutti(giorni) ? `Salvato ${oraDa(adesso)}` : 'Non salvato');
}

// ---------- Countdown, avanzamento e timer mensa (solo per il giorno di oggi) ----------

function secondiAdesso() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function aggiornaTimerMensa() {
  const inizio = parseTime(el.inizio.value);
  const fine = parseTime(el.fine.value);
  if (inizio == null || el.data.value !== oggiISO()) {
    el.timerMensa.hidden = true;
    return;
  }
  const adessoSec = secondiAdesso();
  const prima = tempoMancante(inizio, adessoSec);
  if (prima.secondi > 0) {
    el.timerMensa.classList.remove('active');
    el.timerMensaTesto.textContent = `Pausa tra ${prima.testo}`;
  } else if (fine != null && fine > inizio && tempoMancante(fine, adessoSec).secondi > 0) {
    el.timerMensa.classList.add('active');
    el.timerMensaTesto.textContent = `In pausa · fine tra ${tempoMancante(fine, adessoSec).testo}`;
  } else {
    el.timerMensa.hidden = true;
    return;
  }
  el.timerMensa.hidden = false;
}

function aggiornaTempo() {
  aggiornaTimerMensa();
  const entrataMin = parseTime(el.entrata.value);
  const oggi = el.data.value === oggiISO();

  if (uscitaCorrenteMin == null || entrataMin == null || !oggi) {
    el.progress.hidden = true;
    el.tileCountdown.classList.remove('done');
    el.countdownLabel.textContent = 'Mancano';
    el.countdownValue.textContent = '—';
    return;
  }

  const adessoSec = secondiAdesso();
  const t = tempoMancante(uscitaCorrenteMin, adessoSec);
  const finito = t.secondi <= 0;
  el.tileCountdown.classList.toggle('done', finito);
  el.countdownLabel.textContent = finito ? 'Puoi uscire' : 'Mancano';
  el.countdownValue.textContent = t.testo;

  const totale = (uscitaCorrenteMin - entrataMin) * 60;
  const trascorso = adessoSec - entrataMin * 60;
  const pct = totale > 0 ? Math.min(100, Math.max(0, Math.floor((trascorso / totale) * 100))) : 0;
  el.progress.hidden = false;
  el.progressBar.style.width = `${pct}%`;
  el.progressEntrata.textContent = `${el.entrata.value} entrata`;
  el.progressPct.textContent = `${pct}%`;
}

setInterval(aggiornaTempo, 1000);

// ---------- Storico ----------

function crea(tag, className, testo) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (testo != null) n.textContent = testo;
  return n;
}

function renderStorico() {
  const records = Object.values(caricaTutti()).sort((a, b) => b.data.localeCompare(a.data));
  const oggi = oggiISO();
  el.lista.replaceChildren();
  el.vuoto.hidden = records.length > 0;
  el.esporta.disabled = records.length === 0;
  el.conteggio.textContent = records.length === 1 ? '1 giorno registrato' : `${records.length} giorni registrati`;

  for (const r of records) {
    const li = crea('li');
    const d = dataDaISO(r.data);

    const open = crea('button', 'open');
    open.type = 'button';
    open.setAttribute('aria-label', `Apri ${formatDataIt(r.data)}`);

    const badge = crea('span', r.data === oggi ? 'day-badge today' : 'day-badge');
    badge.append(
      crea('span', 'day-dow', d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')),
      crea('span', 'day-num', String(d.getDate()).padStart(2, '0')),
    );

    const info = crea('span', 'day-info');
    const outRow = crea('span', 'day-out-row');
    outRow.append(crea('span', 'day-out-label', 'Uscita'), crea('span', 'day-out', r.uscita_calcolata || '--:--'));
    if (r.minuti_extra) outRow.append(crea('span', 'day-extra', `+${r.minuti_extra} min`));
    info.append(
      outRow,
      crea('span', 'day-meta', `Entrata ${r.entrata || '--:--'} · Mensa ${r.inizio_mensa}–${r.fine_mensa}`),
    );

    open.append(badge, info);
    open.addEventListener('click', () => {
      caricaGiorno(r.data);
      mostraVista('oggi');
    });

    const del = crea('button', 'delete');
    del.type = 'button';
    del.innerHTML = ICONA_CESTINO;
    del.title = 'Elimina';
    del.setAttribute('aria-label', `Elimina ${formatDataIt(r.data)}`);
    del.addEventListener('click', () => {
      if (!confirm(`Eliminare il giorno ${formatDataIt(r.data)}?`)) return;
      const giorni = caricaTutti();
      delete giorni[r.data];
      salvaTutti(giorni);
      if (el.data.value === r.data) caricaGiorno(r.data);
      renderStorico();
    });

    li.append(open, del);
    el.lista.append(li);
  }
}

function esportaCsv() {
  const csv = generaCsv(Object.values(caricaTutti()));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'storico.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Navigazione ----------

function mostraVista(vista) {
  vistaCorrente = vista;
  const storico = vista === 'storico';
  el.viewOggi.hidden = storico;
  el.viewStorico.hidden = !storico;
  el.tabOggi.setAttribute('aria-selected', String(!storico));
  el.tabStorico.setAttribute('aria-selected', String(storico));
  if (storico) renderStorico();
  aggiornaEyebrow();
  window.scrollTo(0, 0);
}

// ---------- Eventi ----------

el.data.addEventListener('change', () => {
  if (el.data.value) caricaGiorno(el.data.value);
});
el.entrata.addEventListener('input', () => aggiorna());
el.inizio.addEventListener('input', () => {
  // Regola 2: fine mensa = inizio + 25 min
  const fine = fineMensaAutomatica(el.inizio.value);
  if (fine) el.fine.value = fine;
  aggiorna();
});
// Regola 3: la modifica manuale della fine non tocca l'inizio
el.fine.addEventListener('input', () => aggiorna());
el.ripristina.addEventListener('click', () => {
  el.inizio.value = INIZIO_MENSA_DEFAULT;
  el.fine.value = FINE_MENSA_DEFAULT;
  aggiorna();
});
el.tabOggi.addEventListener('click', () => mostraVista('oggi'));
el.tabStorico.addEventListener('click', () => mostraVista('storico'));
el.esporta.addEventListener('click', esportaCsv);

caricaGiorno(oggiISO());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
