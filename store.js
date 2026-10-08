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
  getDoc,
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
const invitiRef = () => collection(db, 'inviti');
const richiesteRef = () => collection(db, 'richieste');

// Amministratore degli inviti (stesso UID della funzione admin() in firestore.rules).
const ADMIN_UID = 'EHdWC7e44TZIzsgIuy9STAi6SuO2';

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

// ---------- Inviti ----------

export const normalizzaEmail = (email) => (email || '').trim().toLowerCase();

export function isAdmin(user) {
  return user?.uid === ADMIN_UID;
}

/**
 * true se l'utente è invitato, false se non lo è.
 * Lancia un errore se non è possibile verificarlo (es. offline al primo accesso).
 */
export async function haInvito(user) {
  if (isAdmin(user)) return true;
  if (!user.emailVerified || !user.email) return false;
  try {
    return (await getDoc(doc(invitiRef(), normalizzaEmail(user.email)))).exists();
  } catch (e) {
    if (e?.code === 'permission-denied') return false;
    throw e;
  }
}

/** Solo amministratore: callback(email[]) ordinate alfabeticamente. */
export function osservaInviti(callback, onError) {
  return onSnapshot(invitiRef(), (snap) => {
    callback(snap.docs.map((d) => d.id).sort());
  }, onError);
}

export function aggiungiInvito(email) {
  return setDoc(doc(invitiRef(), normalizzaEmail(email)), { creato: new Date().toISOString() });
}

export function rimuoviInvito(email) {
  return deleteDoc(doc(invitiRef(), email));
}

// ---------- Richieste di invito ----------

/** Data (ISO) della richiesta già inviata dall'utente, oppure null. */
export async function miaRichiesta(user) {
  const snap = await getDoc(doc(richiesteRef(), normalizzaEmail(user.email)));
  return snap.exists() ? snap.data().creato : null;
}

export async function richiediInvito(user) {
  const creato = new Date().toISOString();
  await setDoc(doc(richiesteRef(), normalizzaEmail(user.email)), {
    nome: (user.displayName || '').slice(0, 100),
    uid: user.uid,
    creato,
  });
  return creato;
}

/** Chiama callback() appena l'invito dell'utente esiste (es. richiesta approvata). */
export function osservaMioInvito(user, callback) {
  return onSnapshot(doc(invitiRef(), normalizzaEmail(user.email)), (snap) => {
    if (snap.exists()) callback();
  }, () => {});
}

/** Solo amministratore: callback([{ email, nome, creato }]) dalla più recente. */
export function osservaRichieste(callback, onError) {
  return onSnapshot(richiesteRef(), (snap) => {
    callback(snap.docs
      .map((d) => ({ email: d.id, nome: d.data().nome, creato: d.data().creato }))
      .sort((a, b) => b.creato.localeCompare(a.creato)));
  }, onError);
}

/** Crea l'invito ed elimina la richiesta in un'unica operazione. */
export function approvaRichiesta(email) {
  const batch = writeBatch(db);
  batch.set(doc(invitiRef(), email), { creato: new Date().toISOString() });
  batch.delete(doc(richiesteRef(), email));
  return batch.commit();
}

export function rifiutaRichiesta(email) {
  return deleteDoc(doc(richiesteRef(), email));
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
