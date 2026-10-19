import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

const OWNER = 'student-a';
const OTHER = 'student-b';
const LEVEL = { stars: [true, true, false], bestMatch: 98.5, perfect: false, hintsUsed: 1, firstTry: true };
const STREAK = { days: 3, lastDay: '2026-10-18', best: 7 };

describe('firestore.rules – postup studenta', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-python-quest-rules',
      firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    });
  });

  afterEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const db = (uid: string | null) =>
    uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

  describe('úlohy', () => {
    it('vlastník zapíše a přečte záznam úlohy', async () => {
      await assertSucceeds(setDoc(doc(db(OWNER), 'users', OWNER, 'levels', '2-12'), LEVEL));
      await assertSucceeds(getDoc(doc(db(OWNER), 'users', OWNER, 'levels', '2-12')));
    });

    it('záznam s příznakem splnění v kódu projde', async () => {
      await assertSucceeds(setDoc(doc(db(OWNER), 'users', OWNER, 'levels', '4-1'), { ...LEVEL, code: true }));
    });

    it('cizí ani nepřihlášený nečte ani nezapisuje', async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        setDoc(doc(ctx.firestore(), 'users', OWNER, 'levels', '1-1'), LEVEL),
      );
      await assertFails(getDoc(doc(db(OTHER), 'users', OWNER, 'levels', '1-1')));
      await assertFails(getDoc(doc(db(null), 'users', OWNER, 'levels', '1-1')));
      await assertFails(setDoc(doc(db(OTHER), 'users', OWNER, 'levels', '1-2'), LEVEL));
      await assertFails(setDoc(doc(db(null), 'users', OWNER, 'levels', '1-2'), LEVEL));
    });

    it('záznam nejde smazat', async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        setDoc(doc(ctx.firestore(), 'users', OWNER, 'levels', '1-1'), LEVEL),
      );
      await assertFails(deleteDoc(doc(db(OWNER), 'users', OWNER, 'levels', '1-1')));
    });

    it.each([
      ['chybějící pole', { stars: LEVEL.stars, bestMatch: 98, perfect: false, hintsUsed: 0 }],
      ['pole navíc', { ...LEVEL, xp: 9999 }],
      ['null místo hodnoty', { ...LEVEL, firstTry: null }],
      ['shoda nad 100', { ...LEVEL, bestMatch: 101 }],
      ['záporná shoda', { ...LEVEL, bestMatch: -1 }],
      ['shoda jako text', { ...LEVEL, bestMatch: '98' }],
      ['dvě hvězdy', { ...LEVEL, stars: [true, true] }],
      ['hvězda jako číslo', { ...LEVEL, stars: [1, 0, 0] }],
      ['desetinná nápověda', { ...LEVEL, hintsUsed: 1.5 }],
      ['příliš nápověd', { ...LEVEL, hintsUsed: 11 }],
      ['kód jako text', { ...LEVEL, code: 'ano' }],
    ])('odmítne tvar: %s', async (_name, data) => {
      await assertFails(setDoc(doc(db(OWNER), 'users', OWNER, 'levels', '1-1'), data));
    });

    it('odmítne neplatné id úlohy', async () => {
      await assertFails(setDoc(doc(db(OWNER), 'users', OWNER, 'levels', 'admin'), LEVEL));
    });

    it('jiná kolekce pod uživatelem je zavřená', async () => {
      await assertFails(setDoc(doc(db(OWNER), 'users', OWNER, 'xp', 'total'), { xp: 9999 }));
    });
  });

  describe('série', () => {
    it('vlastník zapíše sérii i prázdný den', async () => {
      await assertSucceeds(setDoc(doc(db(OWNER), 'users', OWNER, 'meta', 'streak'), STREAK));
      await assertSucceeds(
        setDoc(doc(db(OWNER), 'users', OWNER, 'meta', 'streak'), { days: 0, lastDay: '', best: 0 }),
      );
    });

    it.each([
      ['jiný dokument', 'settings', STREAK],
      ['špatný formát dne', 'streak', { ...STREAK, lastDay: '18. 10. 2026' }],
      ['null den', 'streak', { ...STREAK, lastDay: null }],
      ['záporná série', 'streak', { ...STREAK, days: -1 }],
      ['pole navíc', 'streak', { ...STREAK, xp: 1 }],
    ])('odmítne: %s', async (_name, id, data) => {
      await assertFails(setDoc(doc(db(OWNER), 'users', OWNER, 'meta', id), data));
    });

    it('cizí sérii nezapíše', async () => {
      await assertFails(setDoc(doc(db(OTHER), 'users', OWNER, 'meta', 'streak'), STREAK));
    });
  });
});
