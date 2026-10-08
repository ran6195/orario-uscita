import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcolaUscita,
  fineMensaAutomatica,
  formatTime,
  parseTime,
  formatDataIt,
  generaCsv,
  tempoMancante,
} from '../calc.js';

test('08:00, mensa 12:00–12:25 → 16:08 calcolata, alzata al minimo 16:38', () => {
  const r = calcolaUscita({ entrata: '08:00', inizioMensa: '12:00', fineMensa: '12:25' });
  assert.equal(r.uscita, '16:38');
  assert.equal(r.minimoApplicato, true);
  assert.equal(r.durataPausa, 25);
  assert.equal(r.minutiExtra, 0);
  assert.equal(r.errore, null);
});

test('08:00, mensa 12:00–12:30 → 16:08 calcolata, alzata al minimo 16:38', () => {
  const r = calcolaUscita({ entrata: '08:00', inizioMensa: '12:00', fineMensa: '12:30' });
  assert.equal(r.uscita, '16:38');
  assert.equal(r.minutiExtra, 0);
});

test('08:00, mensa 12:00–12:45 → 16:23 calcolata, alzata al minimo 16:38', () => {
  const r = calcolaUscita({ entrata: '08:00', inizioMensa: '12:00', fineMensa: '12:45' });
  assert.equal(r.uscita, '16:38');
  assert.equal(r.durataPausa, 45);
  assert.equal(r.minutiExtra, 15);
});

test('08:30, mensa 13:00–13:25 → uscita 16:38', () => {
  const r = calcolaUscita({ entrata: '08:30', inizioMensa: '13:00', fineMensa: '13:25' });
  assert.equal(r.uscita, '16:38');
  assert.equal(r.minimoApplicato, false);
});

test('08:30, mensa 12:00–12:45 → uscita 16:53 (sopra il minimo, extra applicato)', () => {
  const r = calcolaUscita({ entrata: '08:30', inizioMensa: '12:00', fineMensa: '12:45' });
  assert.equal(r.uscita, '16:53');
  assert.equal(r.minutiExtra, 15);
  assert.equal(r.minimoApplicato, false);
});

test('09:00, mensa 12:00–12:25 → uscita 17:08', () => {
  const r = calcolaUscita({ entrata: '09:00', inizioMensa: '12:00', fineMensa: '12:25' });
  assert.equal(r.uscita, '17:08');
});

test('tempoMancante', () => {
  const uscita = 16 * 60 + 38;
  assert.deepEqual(tempoMancante(uscita, 15 * 3600 + 7 * 60 + 30), { secondi: 5430, testo: '1:30:30' });
  assert.equal(tempoMancante(uscita, uscita * 60).secondi, 0);
  const passato = tempoMancante(uscita, uscita * 60 + 90);
  assert.equal(passato.secondi, -90);
  assert.equal(passato.testo, '0:00:00');
});

test('inizio mensa 12:40 → fine mensa automatica 13:05', () => {
  assert.equal(fineMensaAutomatica('12:40'), '13:05');
});

test('fine mensa prima dell\'inizio → nessun extra + flag di errore', () => {
  const r = calcolaUscita({ entrata: '09:00', inizioMensa: '12:30', fineMensa: '12:00' });
  assert.equal(r.errore, 'fine_prima_di_inizio');
  assert.equal(r.minutiExtra, 0);
  assert.equal(r.durataPausa, null);
  assert.equal(r.uscita, '17:08');
});

test('entrata mancante → nessuna uscita', () => {
  const r = calcolaUscita({ entrata: '', inizioMensa: '12:00', fineMensa: '12:25' });
  assert.equal(r.uscita, '');
  assert.equal(r.uscitaMin, null);
});

test('parseTime / formatTime', () => {
  assert.equal(parseTime('07:05'), 425);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(formatTime(425), '07:05');
  assert.equal(formatTime(24 * 60 + 15), '00:15');
});

test('formatDataIt', () => {
  assert.equal(formatDataIt('2026-10-08'), '08/10/2026');
});

test('generaCsv: BOM, separatore ";", intestazioni e ordine', () => {
  const csv = generaCsv([
    { data: '2026-10-08', entrata: '08:00', inizio_mensa: '12:00', fine_mensa: '12:45', durata_pausa_min: 45, minuti_extra: 15, uscita_calcolata: '16:23' },
    { data: '2026-10-07', entrata: '08:30', inizio_mensa: '13:00', fine_mensa: '13:25', durata_pausa_min: 25, minuti_extra: 0, uscita_calcolata: '16:38' },
  ]);
  assert.ok(csv.startsWith('﻿'));
  const righe = csv.slice(1).trim().split('\r\n');
  assert.equal(righe[0], 'Data;Entrata;Inizio mensa;Fine mensa;Pausa (min);Extra (min);Uscita');
  assert.equal(righe[1], '07/10/2026;08:30;13:00;13:25;25;0;16:38');
  assert.equal(righe[2], '08/10/2026;08:00;12:00;12:45;45;15;16:23');
});
