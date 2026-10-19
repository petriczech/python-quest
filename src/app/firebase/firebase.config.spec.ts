import { DEMO_FIREBASE_CONFIG, resolveFirebaseSetup } from './firebase.config';

describe('resolveFirebaseSetup', () => {
  it('dev build na localhostu s příznakem použije emulátory', () => {
    expect(resolveFirebaseSetup(true, 'localhost', true)).toEqual({
      options: DEMO_FIREBASE_CONFIG,
      emulators: true,
    });
  });

  it('produkční build emulátory nikdy nezapne', () => {
    expect(resolveFirebaseSetup(false, 'localhost', true)).toBeNull();
  });

  it('cizí host emulátory nezapne', () => {
    expect(resolveFirebaseSetup(true, 'example.web.app', true)).toBeNull();
  });

  it('bez nastaveného projektu je Firebase vypnutý', () => {
    expect(resolveFirebaseSetup(true, 'localhost', false)).toBeNull();
  });
});
