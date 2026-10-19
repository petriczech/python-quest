import type { FirebaseOptions } from 'firebase/app';

/**
 * Konfigurace web appky skutečného projektu (veřejné hodnoty, přístup hlídá `firestore.rules`).
 * Hodnoty z `npx firebase apps:sdkconfig WEB <appId> --project <id>`.
 * Dokud je tu placeholder, produkční build běží jen s `localStorage`.
 */
export const FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.web.app',
  projectId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const DEMO_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-python-quest.firebaseapp.com',
  projectId: 'demo-python-quest',
  appId: 'demo-app',
};

/** Shodné s porty ve `firebase.json` */
export const EMULATOR_HOST = '127.0.0.1';
export const AUTH_EMULATOR_PORT = 9101;
export const FIRESTORE_EMULATOR_PORT = 8091;

/** Příznak v `localStorage`, který v dev buildu na localhostu zapne emulátory */
export const EMULATOR_FLAG = 'python-quest.emulators';

export interface FirebaseSetup {
  options: FirebaseOptions;
  emulators: boolean;
}

/** Emulátory jen v dev buildu na localhostu s příznakem, jinak skutečný projekt, když je nastavený. */
export function resolveFirebaseSetup(
  devMode: boolean,
  hostname: string,
  emulatorFlag: boolean,
): FirebaseSetup | null {
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (devMode && local && emulatorFlag) {
    return { options: DEMO_FIREBASE_CONFIG, emulators: true };
  }
  const configured = Object.values(FIREBASE_CONFIG).every(
    (value) => typeof value === 'string' && !value.includes('REPLACE_ME'),
  );
  return configured ? { options: FIREBASE_CONFIG, emulators: false } : null;
}

export function readEmulatorFlag(): boolean {
  try {
    return localStorage.getItem(EMULATOR_FLAG) === '1';
  } catch {
    return false;
  }
}
