// Firebase Realtime Database connector. Lazy-imports the firebase package so
// the bundle still builds (and the editor still runs solo) when firebase isn't
// installed or configured. Config is sourced from VITE_FIREBASE_* env vars.
//
// PRD §Sync protocol: a single rooms/<roomId> ref with patch-writes via
// update(). Trusted clients; anonymous; room ID is the secret.

let _appPromise = null;

function readConfig() {
  // Vite exposes import.meta.env.VITE_*
  const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
  // Allow window.__firebaseConfig override for runtime injection.
  const win = (typeof window !== 'undefined' && window.__firebaseConfig) || null;
  if (win && typeof win === 'object') return win;
  const c = {
    apiKey:        env.VITE_FIREBASE_API_KEY,
    authDomain:    env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL:   env.VITE_FIREBASE_DATABASE_URL,
    projectId:     env.VITE_FIREBASE_PROJECT_ID,
    appId:         env.VITE_FIREBASE_APP_ID,
  };
  // Required minimum for RTDB: databaseURL.
  if (!c.databaseURL) return null;
  return c;
}

export function isFirebaseConfigured() {
  return !!readConfig();
}

async function getFirebase() {
  if (_appPromise) return _appPromise;
  const cfg = readConfig();
  if (!cfg) return null;
  _appPromise = (async () => {
    try {
      const [{ initializeApp }, db] = await Promise.all([
        import('firebase/app'),
        import('firebase/database'),
      ]);
      const app = initializeApp(cfg);
      const database = db.getDatabase(app);
      return { app, database, db };
    } catch (e) {
      console.warn('[net] firebase unavailable — running offline.', e?.message || e);
      return null;
    }
  })();
  return _appPromise;
}

export async function subscribeRoom(roomId, onPatch, onError) {
  const fb = await getFirebase();
  if (!fb) return () => {};
  const { db, database } = fb;
  const ref = db.ref(database, `rooms/${roomId}`);
  const unsub = db.onValue(
    ref,
    (snap) => onPatch?.(snap.val() || {}),
    (err) => onError?.(err),
  );
  return () => db.off(ref, 'value', unsub);
}

// Patch-write a partial object under rooms/<roomId>. Keys are dot-paths.
export async function writePatch(roomId, patch) {
  const fb = await getFirebase();
  if (!fb) return;
  const { db, database } = fb;
  const ref = db.ref(database, `rooms/${roomId}`);
  await db.update(ref, patch);
}

// Atomic claim: set rooms/<roomId>/players/<slot> only if currently empty.
export async function claimSlot(roomId, slot, payload) {
  const fb = await getFirebase();
  if (!fb) return { ok: true, payload };
  const { db, database } = fb;
  const ref = db.ref(database, `rooms/${roomId}/players/${slot}`);
  const result = await db.runTransaction(ref, (cur) => {
    if (cur && cur.clientId) return; // abort
    return payload;
  });
  return { ok: !!result.committed, payload: result.snapshot?.val?.() };
}

export async function readOnce(roomId) {
  const fb = await getFirebase();
  if (!fb) return null;
  const { db, database } = fb;
  const ref = db.ref(database, `rooms/${roomId}`);
  const snap = await db.get(ref);
  return snap.exists() ? snap.val() : null;
}
