// Funzioni pure di calcolo orari. Internamente tutto è in minuti dalla mezzanotte.

export const MINUTI_LAVORO = 8 * 60 + 8; // 8h08
export const PAUSA_INCLUSA = 30; // minuti di pausa che non allungano la giornata
export const DURATA_MENSA_DEFAULT = 25;
export const INIZIO_MENSA_DEFAULT = '12:00';
export const FINE_MENSA_DEFAULT = '12:25';
export const USCITA_MINIMA = '16:38'; // l'uscita non può essere prima di quest'ora

const MINUTI_GIORNO = 24 * 60;

/** "HH:MM" -> minuti dalla mezzanotte, oppure null se non valido. */
export function parseTime(str) {
  if (typeof str !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minuti -> "HH:MM" a 24 ore (con riporto oltre la mezzanotte). */
export function formatTime(minuti) {
  if (minuti == null || !Number.isFinite(minuti)) return '';
  const t = ((Math.round(minuti) % MINUTI_GIORNO) + MINUTI_GIORNO) % MINUTI_GIORNO;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Fine mensa automatica dato l'inizio ("HH:MM" -> "HH:MM"). */
export function fineMensaAutomatica(inizioMensa) {
  const inizio = parseTime(inizioMensa);
  if (inizio == null) return '';
  return formatTime(inizio + DURATA_MENSA_DEFAULT);
}

/**
 * Calcola l'uscita.
 * @param {{entrata: string, inizioMensa: string, fineMensa: string}} input orari "HH:MM"
 * @returns {{uscita: string, uscitaMin: number|null, durataPausa: number|null,
 *            minutiExtra: number, minimoApplicato: boolean, errore: string|null}}
 */
export function calcolaUscita({ entrata, inizioMensa, fineMensa }) {
  const e = parseTime(entrata);
  const i = parseTime(inizioMensa);
  const f = parseTime(fineMensa);

  let durataPausa = null;
  let minutiExtra = 0;
  let errore = null;

  if (i == null || f == null) {
    errore = 'mensa_non_valida';
  } else if (f < i) {
    errore = 'fine_prima_di_inizio';
  } else {
    durataPausa = f - i;
    minutiExtra = Math.max(0, durataPausa - PAUSA_INCLUSA);
  }

  const uscitaCalcolata = e == null ? null : e + MINUTI_LAVORO + minutiExtra;
  const minima = parseTime(USCITA_MINIMA);
  const minimoApplicato = uscitaCalcolata != null && uscitaCalcolata < minima;
  const uscitaMin = minimoApplicato ? minima : uscitaCalcolata;
  return {
    uscita: formatTime(uscitaMin),
    uscitaMin,
    durataPausa,
    minutiExtra,
    minimoApplicato,
    errore,
  };
}

/**
 * Tempo mancante all'uscita.
 * @param {number} uscitaMin uscita in minuti dalla mezzanotte
 * @param {number} adessoSec ora attuale in secondi dalla mezzanotte
 * @returns {{secondi: number, testo: string}} secondi <= 0 se l'uscita è già passata
 */
export function tempoMancante(uscitaMin, adessoSec) {
  const secondi = uscitaMin * 60 - adessoSec;
  const s = Math.max(0, secondi);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return { secondi, testo: `${h}:${p(m)}:${p(sec)}` };
}

/** "AAAA-MM-GG" -> "GG/MM/AAAA" */
export function formatDataIt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Genera il CSV (con BOM UTF-8, separatore ";") da un array di record. */
export function generaCsv(records) {
  const header = ['Data', 'Entrata', 'Inizio mensa', 'Fine mensa', 'Pausa (min)', 'Extra (min)', 'Uscita'];
  const righe = [...records]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((r) => [
      formatDataIt(r.data),
      r.entrata ?? '',
      r.inizio_mensa ?? '',
      r.fine_mensa ?? '',
      r.durata_pausa_min ?? '',
      r.minuti_extra ?? '',
      r.uscita_calcolata ?? '',
    ]);
  const escape = (v) => {
    const s = String(v);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...righe].map((r) => r.map(escape).join(';')).join('\r\n') + '\r\n';
}
