# Orario Uscita

PWA mobile per calcolare l'orario di uscita dal lavoro, tenere uno storico giornaliero ed esportarlo in CSV.
Accesso con Google, storico salvato su Firestore e sincronizzato tra dispositivi. Funziona anche offline.

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
app.js           logica dell'interfaccia, login e sincronizzazione
calc.js          funzioni pure di calcolo orari e generazione CSV
store.js         login Google e accesso a Firestore (SDK Firebase da CDN)
firestore.rules  regole di sicurezza di Firestore
sw.js            service worker (cache per l'uso offline)
manifest.json    manifest della PWA
icons/           icone 192 e 512 px
tests/           test di calc.js con node:test
firebase.json    configurazione Firebase (Hosting e regole Firestore)
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

1. Aumenta la versione `CACHE` in `sw.js` (es. `mensa-helper-v12` → `mensa-helper-v13`), altrimenti i telefoni continuano a usare la versione in cache.
2. Pubblica:
   ```bash
   npx firebase-tools login   # solo la prima volta
   npm run deploy             # app (Hosting) + regole Firestore
   ```

Le app già installate passano alla nuova versione al secondo avvio.

## Installazione sul telefono

- **iPhone (Safari):** apri https://orario-uscita.web.app → Condividi → "Aggiungi alla schermata Home".
- **Android (Chrome):** apri il link → menu ⋮ → "Installa app".

## Dati

- Al primo avvio si accede con Google. I giorni sono salvati su Firestore in `users/{uid}/giorni/{AAAA-MM-GG}`.
- Le regole in `firestore.rules` permettono a ogni utente di leggere e scrivere solo i propri giorni.
- L'accesso è solo su invito: la lista è nella raccolta `inviti` (ID documento = email in minuscolo). L'amministratore (UID in `firestore.rules` e `store.js`) gestisce gli inviti dalla sezione **Inviti** nello Storico. Chi non è invitato può fare login ma non accede a nessun dato.
- Chi non è invitato può inviare una **richiesta di invito** (raccolta `richieste`, una per email). L'amministratore la vede nella sezione Inviti, con un badge sulla scheda Storico, e può approvarla o rifiutarla. Dopo l'approvazione l'app del richiedente si apre da sola.
- Firestore tiene una copia locale (IndexedDB): l'app funziona offline e sincronizza al ritorno della rete.
- Le modifiche vengono scritte circa un secondo dopo l'ultima modifica, oppure subito se l'app va in background.
- Al primo login i giorni salvati in `localStorage` dalla versione precedente vengono copiati su Firestore (solo se mancano o sono più recenti). La copia locale non viene cancellata.
- La configurazione Firebase in `store.js` è pubblica per natura: la protezione dei dati è affidata alle regole.
