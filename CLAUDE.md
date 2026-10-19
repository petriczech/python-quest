# python-quest (Turtle Academy)

Angular aplikace na učení Python turtle kreslení pro studenty gymnázia. Plán, datový model a fáze: [PLAN.md](PLAN.md).

## Konvence projektu

- Strict TS, `noUncheckedIndexedAccess`, žádné `any` (místo něj `unknown`).
- Standalone komponenty, signals, zoneless, OnPush je výchozí.
- UI texty česky.
- Jádro (`src/app/core/`) jsou čisté funkce bez Angularu: interpret, trace, rasterizace, skóre, generátor Pythonu. Testují se ve Vitestu.
- Souřadnice jako Python turtle: (0, 0) uprostřed, y nahoru, úhel 0 = východ, `left` je kladný směr. Při vykreslení se osa y převrací.
- Commity anglicky ve stylu `feat:` / `fix:` / `docs:` / `chore:` / `test:`.
- Claude je v repu contributor: commit končí prázdným řádkem a `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (má přednost před globálním zákazem tohoto řádku).

## Ověření

```bash
npx ng lint
npx ng build
npx ng test --watch=false
npx playwright test
```

Rules testy a E2E synchronizace potřebují emulátory (JDK ≥ 21, např. `JAVA_HOME=$HOME/.jdks/temurin-25.0.4.1`):

```bash
npm run test:rules
npm run e2e:sync
```

## Firebase a porty

- Emulátory pod `demo-python-quest` (`.firebaserc`), skutečný projekt zatím není: `FIREBASE_CONFIG` v `src/app/firebase/firebase.config.ts` má placeholdery, produkční build běží jen s `localStorage`.
- Emulátory v dev buildu zapne `localStorage['python-quest.emulators'] = '1'` (jen localhost).
- Porty: dev server 4300, E2E server 4318, auth 9101, firestore 8091, hub 4408, logging 4508, UI vypnuté.
- Data: `users/{uid}/levels/{levelId}` (záznam úlohy) a `users/{uid}/meta/streak`; rozpracované programy zůstávají jen v zařízení.

## Psaní kódu (Python)

- Pyodide běží ve Web Workeru (`src/app/code/`), soubory se kopírují z `node_modules/pyodide` do `pyodide/` (assets v `angular.json`). Po změně `angular.json` se musí restartovat dev server.
- Modul `turtle` je shim v `src/app/core/turtle-shim.ts`: jen zapisuje příkazy, `opsToProgram` z nich dělá program pro TS interpret. Testy shody s bloky běží ve Vitestu přímo v Pyodide.

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection
