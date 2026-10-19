import { Service, isDevMode, signal } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import {
  AUTH_EMULATOR_PORT,
  EMULATOR_HOST,
  readEmulatorFlag,
  resolveFirebaseSetup,
} from './firebase.config';

export interface Account {
  uid: string;
  name: string | null;
  email: string | null;
}

interface AuthSdk {
  app: FirebaseApp;
  auth: Auth;
  m: typeof import('firebase/auth');
}

/** Kódy, kdy uživatel jen zavřel okno Googlu */
const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

const MESSAGES: Readonly<Record<string, string>> = {
  'auth/network-request-failed': 'Přihlášení se nepovedlo, chybí připojení k internetu.',
  'auth/unauthorized-domain': 'Na této adrese přihlášení není povolené.',
};

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}

/**
 * Přihlášení Google účtem. SDK se načte líně a jen když je Firebase nastavený,
 * bez něj appka běží s `localStorage`.
 */
@Service()
export class AuthService {
  readonly setup = resolveFirebaseSetup(isDevMode(), location.hostname, readEmulatorFlag());

  private readonly accountSignal = signal<Account | null>(null);
  private readonly readySignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  readonly account = this.accountSignal.asReadonly();
  /** Stav přihlášení je známý */
  readonly ready = this.readySignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  private sdk: Promise<AuthSdk | null> | null = null;

  /** Načte Firebase a obnoví uloženou relaci. Bez nastaveného projektu nic nedělá. */
  start(): Promise<FirebaseApp | null> {
    if (!this.setup) {
      return Promise.resolve(null);
    }
    this.sdk ??= this.init().catch((error: unknown) => {
      console.warn('Firebase Auth se nenačetl:', error);
      this.errorSignal.set('Přihlášení teď není dostupné.');
      return null;
    });
    return this.sdk.then((sdk) => sdk?.app ?? null);
  }

  async signIn(): Promise<void> {
    const sdk = await this.start().then(() => this.sdk);
    if (!sdk) {
      return;
    }
    const { auth, m } = sdk;
    const provider = new m.GoogleAuthProvider();
    this.errorSignal.set(null);
    try {
      if (isStandalone()) {
        await m.signInWithRedirect(auth, provider);
        return;
      }
      await m.signInWithPopup(auth, provider);
    } catch (error: unknown) {
      const code = errorCode(error);
      if (code === 'auth/popup-blocked') {
        await m.signInWithRedirect(auth, provider).catch((e: unknown) => this.fail(e));
      } else if (!CANCELLED.includes(code)) {
        this.fail(error);
      }
    }
  }

  async signOut(): Promise<boolean> {
    const sdk = await this.sdk;
    if (!sdk) {
      return true;
    }
    try {
      await sdk.m.signOut(sdk.auth);
      return true;
    } catch (error: unknown) {
      this.fail(error);
      return false;
    }
  }

  private async init(): Promise<AuthSdk | null> {
    const setup = this.setup;
    if (!setup) {
      return null;
    }
    const [{ initializeApp }, m] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const app = initializeApp(setup.options);
    const auth = m.getAuth(app);
    if (setup.emulators) {
      m.connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
        disableWarnings: true,
      });
    }
    m.onAuthStateChanged(auth, (user) => {
      this.accountSignal.set(
        user ? { uid: user.uid, name: user.displayName, email: user.email } : null,
      );
      this.readySignal.set(true);
    });
    return { app, auth, m };
  }

  private fail(error: unknown): void {
    const code = errorCode(error);
    console.warn('Přihlášení selhalo:', code || error);
    this.errorSignal.set(MESSAGES[code] ?? 'Přihlášení se nepovedlo. Zkus to znovu.');
  }
}
