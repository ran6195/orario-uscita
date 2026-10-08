# Orario Uscita

PWA mobile per calcolare l'orario di uscita dal lavoro, tenere uno storico giornaliero ed esportarlo in CSV.
Funziona offline, senza backend: i dati restano nel browser del telefono.

**App online:** https://orario-uscita.web.app

## Funzionalità

- Orario di uscita calcolato in tempo reale da entrata e pausa mensa.
- Timer a quanto manca all'uscita, con barra di avanzamento della giornata.
- Timer a quanto manca alla pausa pranzo (e alla sua fine, durante la pausa).
- Storico giornaliero: un record per data, riapribile e modificabile, eliminabile con conferma.
- Export CSV compatibile con Excel in italiano (separatore `;`, BOM UTF-8, date GG/MM/AAAA).
- Installabile come app, funziona offline, supporta la dark mode.

## Regole di calcolo

| Regola | Dettaglio |
|---|---|
| Uscita base | Entrata + 8h08 |
| Mensa di default | 12:00–12:25 |
| Fine mensa automatica | Modificando l'inizio, la fine diventa inizio + 25 min. La fine resta modificabile a mano e non altera l'inizio. |
| Pausa lunga | I minuti di pausa oltre i 30 si sommano all'uscita |
| Uscita minima | L'uscita non è mai prima delle 16:38 |
| Mensa non valida | Se la fine è prima dell'inizio compare un avviso e non si applica alcun extra |

Esempi: entrata 08:30 con mensa 13:00–13:25 → uscita 16:38; entrata 08:30 con mensa 12:00–12:45 → uscita 16:53.

Le costanti (8h08, 30 min, 25 min, 16:38) sono in cima a `calc.js`.

## Struttura

```
index.html       markup delle due schermate (Giorno, Storico)
style.css        stili, palette e dark mode
app.js           logica dell'interfaccia e salvataggio in localStorage
calc.js          funzioni pure di calcolo orari e generazione CSV
sw.js            service worker (cache per l'uso offline)
manifest.json    manifest della PWA
icons/           icone 192 e 512 px
tests/           test di calc.js con node:test
firebase.json    configurazione Firebase Hosting
```

Nessun framework e nessun build step: HTML, CSS e JavaScript (moduli ES) serviti così come sono.

## Sviluppo in locale

Serve Node.js 18 o superiore.

```bash
npm start        # avvia un server locale (npx serve) su http://localhost:3000
npm test         # esegue i test di calc.js
```

Il service worker funziona solo su `localhost` o in HTTPS: aprire `index.html` direttamente dal disco non basta.

## Pubblicazione

L'app è pubblicata su Firebase Hosting (progetto `orario-uscita`).

1. Aumenta la versione `CACHE` in `sw.js` (es. `mensa-helper-v6` → `mensa-helper-v7`), altrimenti i telefoni continuano a usare la versione in cache.
2. Pubblica:
   ```bash
   npx firebase-tools login   # solo la prima volta
   npm run deploy
   ```

Le app già installate passano alla nuova versione al secondo avvio.

## Installazione sul telefono

- **iPhone (Safari):** apri https://orario-uscita.web.app → Condividi → "Aggiungi alla schermata Home".
- **Android (Chrome):** apri il link → menu ⋮ → "Installa app".

## Dati

I giorni sono salvati in `localStorage` (chiave `mensa_helper.giorni`) solo sul dispositivo in uso: non si sincronizzano tra dispositivi e si perdono se cancelli i dati del sito. Usa "Esporta CSV" per tenerne una copia.
