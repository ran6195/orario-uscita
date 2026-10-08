// Accesso ai dati su Firestore e login Google (Firebase).
// Struttura: users/{uid}/giorni/{AAAA-MM-GG}, un documento per giorno.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocsFromServer,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Configurazione pubblica della web app: non è un segreto, l'accesso ai dati
// è protetto dalle regole in firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyDMrKxTaQTfHbKAg-pAIK_EEAyJw0K41pY',
  authDomain: 'orario-uscita.firebaseapp.com',
  projectId: 'orario-uscita',
  storageBucket: 'orario-uscita.firebasestorage.app',
  messagingSenderId: '942386771196',
  appId: '1:942386771196:web:d4973a9f2be606627d9379',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'it';

// Cache persistente (IndexedDB): l'app funziona offline e sincronizza al ritorno della rete.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const giorniRef = (uid) => collection(db, 'users', uid, 'giorni');

// ---------- Autenticazione ----------

export function osservaUtente(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Errore dell'eventuale login via redirect (null se nessuno). */
export function erroreRedirect() {
  return getRedirectResult(auth).then(() => null, (e) => e);
}

export async function accedi() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // Popup non disponibile (es. bloccato o app installata): si ripiega sul redirect.
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export function esci() {
  return signOut(auth);
}

// ---------- Giorni ----------

/**
 * Osserva tutti i giorni dell'utente.
 * callback(giorni, { remoti: string[], pendenti: boolean })
 *  - giorni: oggetto { 'AAAA-MM-GG': record }
 *  - remoti: date modificate da un altro dispositivo in questo aggiornamento
 *  - pendenti: ci sono scritture locali non ancora confermate dal server
 */
export function osservaGiorni(uid, callback, onError) {
  return onSnapshot(giorniRef(uid), { includeMetadataChanges: true }, (snap) => {
    const giorni = {};
    snap.forEach((d) => { giorni[d.id] = d.data(); });
    const remoti = snap.docChanges()
      .filter((c) => !c.doc.metadata.hasPendingWrites)
      .map((c) => c.doc.id);
    callback(giorni, { remoti, pendenti: snap.metadata.hasPendingWrites });
  }, onError);
}

export function salvaGiorno(uid, record) {
  return setDoc(doc(giorniRef(uid), record.data), record);
}

export function eliminaGiorno(uid, data) {
  return deleteDoc(doc(giorniRef(uid), data));
}

/**
 * Copia su Firestore i giorni salvati in locale (versione precedente dell'app).
 * Un giorno locale viene scritto solo se manca sul server o è più recente.
 * Richiede la rete: offline lancia un errore e la migrazione verrà ritentata.
 * @returns {Promise<number>} numero di giorni copiati
 */
export async function migraDaLocale(uid, recordsLocali) {
  if (!recordsLocali.length) return 0;
  const server = {};
  (await getDocsFromServer(giorniRef(uid))).forEach((d) => { server[d.id] = d.data(); });

  const daCopiare = recordsLocali.filter((r) => {
    const s = server[r.data];
    return !s || (r.ultimo_aggiornamento || '') > (s.ultimo_aggiornamento || '');
  });
  for (let i = 0; i < daCopiare.length; i += 400) {
    const batch = writeBatch(db);
    for (const r of daCopiare.slice(i, i + 400)) batch.set(doc(giorniRef(uid), r.data), r);
    await batch.commit();
  }
  return daCopiare.length;
}
