import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { ProgressSnapshot, diffSnapshots, mergeSnapshots } from '../core/sync';
import { LevelRecord, Stars, Streak } from '../core/xp';
import { ProgressStore } from '../progress/progress.store';
import { AuthService } from './auth.service';
import { EMULATOR_HOST, FIRESTORE_EMULATOR_PORT } from './firebase.config';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

interface FirestoreSdk {
  db: Firestore;
  m: typeof import('firebase/firestore');
}

/** Tvar dokumentu série ve Firestore (`lastDay` je '' místo null) */
interface StreakDoc {
  days: number;
  lastDay: string;
  best: number;
}

/** Postup přihlášeného uživatele ve Firestore: sloučení po přihlášení, pak zápis jen změn. */
@Service()
export class ProgressSync {
  private readonly auth = inject(AuthService);
  private readonly store = inject(ProgressStore);

  private readonly statusSignal = signal<SyncStatus>('off');
  readonly status = this.statusSignal.asReadonly();

  private readonly uidSignal = computed(() => this.auth.account()?.uid ?? null);
  private sdk: Promise<FirestoreSdk | null> | null = null;
  private uid: string | null = null;
  /** Postup, o kterém se ví, že je ve Firestore; null do dokončení sloučení */
  private remote: ProgressSnapshot | null = null;

  constructor() {
    effect(() => {
      const uid = this.uidSignal();
      untracked(() => void this.switchUser(uid));
    });
    effect(() => {
      const snapshot = this.store.snapshot();
      untracked(() => this.push(snapshot));
    });
  }

  start(): void {
    if (!this.auth.setup || this.sdk) {
      return;
    }
    this.sdk = this.init().catch((error: unknown) => {
      console.warn('Firestore se nenačetl:', error);
      return null;
    });
    window.addEventListener('online', () => {
      if (this.uid && !this.remote) {
        void this.switchUser(this.uid);
      }
    });
  }

  /** Odhlásí a smaže postup v zařízení; v účtu zůstane. */
  async signOut(): Promise<void> {
    const uid = this.uid;
    this.uid = null;
    this.remote = null;
    this.statusSignal.set('off');
    if (await this.auth.signOut()) {
      this.store.reset();
    } else {
      void this.switchUser(uid);
    }
  }

  private async init(): Promise<FirestoreSdk | null> {
    const [app, m] = await Promise.all([this.auth.start(), import('firebase/firestore')]);
    if (!app) {
      return null;
    }
    const db = m.getFirestore(app);
    if (this.auth.setup?.emulators) {
      m.connectFirestoreEmulator(db, EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    }
    return { db, m };
  }

  private async switchUser(uid: string | null): Promise<void> {
    this.uid = uid;
    this.remote = null;
    const sdk = await this.sdk;
    if (this.uid !== uid) {
      return;
    }
    if (!uid || !sdk) {
      this.statusSignal.set('off');
      return;
    }
    this.statusSignal.set('syncing');
    try {
      const remote = await fetchRemote(sdk, uid);
      if (this.uid !== uid) {
        return;
      }
      this.remote = remote;
      const merged = mergeSnapshots(this.store.snapshot(), remote);
      this.store.applySnapshot(merged);
      this.push(this.store.snapshot());
      if (this.statusSignal() === 'syncing') {
        this.statusSignal.set('synced');
      }
    } catch (error: unknown) {
      console.warn('Synchronizace selhala:', error);
      if (this.uid === uid) {
        this.statusSignal.set('error');
      }
    }
  }

  private push(next: ProgressSnapshot): void {
    const uid = this.uid;
    const previous = this.remote;
    if (!uid || !previous) {
      if (uid && this.statusSignal() === 'error') {
        void this.switchUser(uid);
      }
      return;
    }
    const diff = diffSnapshots(previous, next);
    if (diff.levels.length === 0 && !diff.streak) {
      return;
    }
    this.remote = next;
    const failed = (error: unknown): void => {
      console.warn('Zápis do Firestore selhal:', error);
      if (this.uid === uid) {
        // Nejisté, co se zapsalo: další sloučení pošle vše znovu
        this.remote = null;
        this.statusSignal.set('error');
      }
    };
    void this.sdk
      ?.then(async (sdk) => {
        if (!sdk) {
          return;
        }
        const { db, m } = sdk;
        const batch = m.writeBatch(db);
        for (const id of diff.levels) {
          const record = next.records[id];
          if (record) {
            batch.set(m.doc(db, 'users', uid, 'levels', id), record);
          }
        }
        if (diff.streak) {
          const streak: StreakDoc = { ...next.streak, lastDay: next.streak.lastDay ?? '' };
          batch.set(m.doc(db, 'users', uid, 'meta', 'streak'), streak);
        }
        if (this.uid === uid) {
          this.statusSignal.set('syncing');
        }
        await batch.commit();
        if (this.uid === uid) {
          this.statusSignal.set('synced');
        }
      })
      .catch(failed);
  }
}

async function fetchRemote({ db, m }: FirestoreSdk, uid: string): Promise<ProgressSnapshot> {
  const [levels, streakDoc] = await Promise.all([
    m.getDocs(m.collection(db, 'users', uid, 'levels')),
    m.getDoc(m.doc(db, 'users', uid, 'meta', 'streak')),
  ]);
  const records: Record<string, LevelRecord> = {};
  levels.forEach((snapshot) => {
    const data = snapshot.data() as LevelRecord;
    records[snapshot.id] = { ...data, stars: [...data.stars] as Stars };
  });
  const saved = streakDoc.data() as StreakDoc | undefined;
  const streak: Streak = saved
    ? { days: saved.days, lastDay: saved.lastDay || null, best: saved.best }
    : { days: 0, lastDay: null, best: 0 };
  return { records, streak };
}
