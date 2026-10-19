# python-quest (Turtle Academy) – plán tvorby

Angular aplikace na učení Python turtle kreslení pro studenty gymnázia. Klikací bloky, živý Python a hodnocení podle shody se vzorem v % (styl CSS Battle).

## Odkazy

- **Design (plátno, 3 obrazovky):** https://claude.ai/artifact/H8HDR5AW5qcP22u1ah3bTv
  - Úloha (klikací režim): zadání se vzorem a kótami, plátno, bloky a Python
  - Mapa světů: XP, úroveň, série dní, světy, úloha dne, odznaky, žebříček třídy (úloha dne a žebříček jsou až po MVP, v MVP se skryjí)
  - Úloha splněna (mobil): hvězdy, XP, nový odznak
- **Plán (editovatelný dokument):** https://claude.ai/code/artifact/267cfe9d-9472-4daa-ac1b-5cb8a88705e7

Oba odkazy jsou soukromé a otevře je jen přihlášený vlastník.

## Design tokeny (z návrhu)

| Token | Hodnota | Použití |
| --- | --- | --- |
| ink | `#12233B` | text, hlavička, tmavé panely, Python panel |
| paper | `#EEF2F6` + mřížka `#DCE4EC` po 24 px | pozadí stránky (rýsovací papír) |
| surface | `#FFFFFF`, okraj `#D3DCE6` | karty |
| text-secondary | `#33445A` / `#4A5B70` | popisky |
| accent (želva) | `#E8632B`, tlačítka `#C2470F` | primární akce, želva, XP lišta |
| blok pohyb | bg `#E8F0FB`, okraj `#B9CDEB`, text `#123F85` | dopředu / dozadu |
| blok otáčení | bg `#FFF1E8`, okraj `#F3C7A8`, text `#8C3410` | vlevo / vpravo |
| blok opakuj | bg `#F2EDFB`, okraj `#DCD1F2`, text `#4A2F96` | repeat |
| blok pero | bg `#E9F6F3`, okraj `#BFE0DA`, text `#0B5C51` | pero, barva |
| hvězda | `#F2A33A` | hvězdy |
| font UI | Bricolage Grotesque (400/600/800) | |
| font kód | JetBrains Mono (400/600) | Python, kóty, čísla |
| radius | karty 16–20 px, tlačítka 10 px | |
| touch target | min. 44 px | |

## Cíl a rozsah MVP

MVP obsahuje hratelné světy 1–5 (43 úloh): 1–4 v klikacím režimu i v psaném Pythonu, 5 jen v Pythonu: živý Python náhled, hvězdy, XP a uložený postup. Cílovka jsou studenti gymnázia, matika nejvýš sin/cos.

**V MVP:**

- klikací bloky (fáze 1–2) a interpret v TS, bez Pyodide
- vzor s kótami, plátno s krokováním, porovnání vzor ↔ výstup a shoda v %
- 3 hvězdy, XP, úrovně, série dní
- mapa světů, obrazovka „Úloha splněna“
- přihlášení Google, postup ve Firestore
- PWA, desktop i mobil

**Až po MVP:**

- psaní kódu (Pyodide, fáze 3–4)
- třídní režim pro učitele
- úloha dne se žebříčkem
- galerie
- další odznaky nad základní sadu

## Technické rozhodnutí a stack

Klíčové rozhodnutí: bloky drží vlastní AST a interpretují se v TS. Python je jen generovaný text, dokud nepřijde fáze psaní kódu. Start je díky tomu rychlý a hodnocení deterministické.

| Oblast | Volba | Proč |
| --- | --- | --- |
| Framework | Angular, standalone, signals, zoneless | jednoduchý stav |
| Interpret bloků | vlastní TS interpret nad `Command[]` | bez WASM, okamžitý běh, plná kontrola nad trace |
| Python (později) | Pyodide ve Web Workeru + vlastní modul `turtle` emitující příkazy | plný CPython včetně `math`; shim vrací stejný trace jako bloky |
| Plátno | SVG (vzor, kóty) + Canvas 2D (animace želvy) | ostré kóty, plynulé kreslení |
| Drag & drop | Angular CDK DragDrop | stačí na ~10 bloků, Blockly je zbytečně těžké |
| Editor (fáze 3–4) | CodeMirror 6, lazy loaded | lehký, dobrý na mobilu |
| Backend | Firebase Auth (Google) + Firestore | školní Google účty, offline cache |
| Hosting | Firebase Hosting | |
| PWA | @angular/pwa | offline úlohy, instalace na mobil |
| Testy | Vitest (unit), Playwright (E2E + screenshot) | interpret a skóre jsou čisté funkce |

## Architektura a datový model

Všechno se točí kolem dvou struktur: `Command[]` (program) a `Trace` (co želva udělala). Renderer i hodnocení pracují jen s trace. Je jim tedy jedno, jestli program vznikl z bloků, nebo z Pythonu.

```
Bloky (fáze 1–2) ──► Command[] AST ──► Generátor Pythonu ──► náhled kódu
                          │
                          ▼
                     TS interpret ──────────┐
                                            ▼
Python editor (po MVP) ─► Pyodide worker ─► Trace (segmenty, výplně, kroky)
                                            │
                          ┌─────────────────┴─────────────────┐
                          ▼                                   ▼
                 Renderer (canvas, krokování)       Hodnocení vs. referenční trace
                                                              │
                                                              ▼
                                                  % shody, hvězdy, XP → Firestore
```

Pyodide cesta musí vracet přesně stejný `Trace` jako TS interpret, jinak se rozjede hodnocení.

```ts
type Command =
  | { kind: 'forward' | 'backward'; value: number }
  | { kind: 'left' | 'right'; angle: number }
  | { kind: 'penUp' | 'penDown' }
  | { kind: 'goto'; x: number; y: number }
  | { kind: 'color'; value: string }
  | { kind: 'fill'; color: string; body: Command[] }
  | { kind: 'repeat'; times: number; body: Command[] };

interface TraceStep {
  path: number[];        // index bloku v AST → zvýraznění bloku i řádku Pythonu
  x: number; y: number; heading: number; penDown: boolean;
}

interface Trace {
  steps: TraceStep[];
  segments: { from: Point; to: Point; color: string }[];
  fills: { polygon: Point[]; color: string }[];
}

interface Level {
  id: string;
  world: number;
  title: string;
  task: string;
  dimensions: Dimension[];       // kóty pro vykreslení vzoru
  reference: Command[];          // referenční řešení → referenční trace
  palette: Command['kind'][];    // povolené bloky
  starter?: Command[];
  stars: { requires?: Command['kind'][]; maxBlocks?: number };
  hints: string[];
}
```

### Hodnocení (styl CSS Battle)

Vedle sebe je **vzor** a **výstup**, nad nimi číslo shody v procentech.

- **Shoda v %:** referenční a studentův trace se rasterizují do dvou masek stejné velikosti (např. 400 × 300, pevná tloušťka čáry). Pixely se porovnají s malou tolerancí barvy.
- **Vlastní rasterizace:** masky kreslí čistá TS funkce `rasterize(trace)` do `Uint8Array` (tlustá úsečka + vyplnění polygonu), ne canvas. Výsledek je bez antialiasingu, ve všech prohlížečích stejný a běží i ve Vitestu v Node, kde `OffscreenCanvas` není. Canvas slouží jen k zobrazení.
- **Výplně zvlášť:** obrysy a výplně se porovnají jako dvě masky a skóre je jejich vážený průměr. Velká plocha výplně by jinak přebila chybějící čáru. Váha se ladí v pilotu.
- **Jmenovatel:** sjednocení nakreslených pixelů obou obrázků, ne celé plátno. Jinak by prázdné pozadí dávalo i špatné kresbě 90 %.
- **Tolerance polohy:** obě masky se před porovnáním rozšíří o 1–2 px (dilatace).
- **Režimy porovnání:**
  - posuvník vzor ↔ výstup
  - překrytí s průhledností
  - diff: zelená = shoda, červená = chybí, modrá = navíc
- **Živé skóre:** přepočet po každém spuštění ve Web Workeru přes `rasterize`.
- **Textová nápověda z trace:** chybějící a přebývající segmenty se převedou na větu („chybí poslední strana“). Procento říká *kolik*, trace *co*.
- **Hvězdy 2 a 3:** počítají se nad AST (`requires`, počet bloků), ne nad obrázkem.

## Fáze vývoje

Postup je zevnitř ven: nejdřív čisté jádro (interpret, trace, skóre) s testy, pak UI a nakonec backend. Každá fáze končí hratelným stavem.

### Fáze 0 – základ projektu

- [ ] `git init` a repo na GitHubu (preview kanály Firebase Hosting jedou přes GitHub Actions). Lokální git je, repo na GitHubu zatím ne.
- [x] Angular workspace: standalone, zoneless, strict TS, ESLint, routy `/mapa`, `/uloha/:id`
- [x] design tokeny (viz tabulka výše), fonty, mřížka papíru
- [ ] Vitest a Playwright v CI, deploy na Firebase Hosting z `main`. Workflow `.github/workflows/ci.yml` je hotový (lint, unit, build, E2E bez screenshotů, protože baseline jsou z Windows). Do skutečného Firebase projektu se nasazuje na GitHub Pages: job `deploy` po zelené kontrole na `main`, build s `--base-href /<repo>/`, `404.html` pro přímé odkazy, postup jen v `localStorage`.

### Fáze 1 – jádro: interpret a trace

- [x] typy `Command`, `Trace`, `Level`, interpret jako čistá funkce `run(program): Trace`
- [x] unit testy: čtverec, trojúhelník, vnořené `repeat`, `goto`, `penUp`, `fill`
- [x] generátor Pythonu s mapou `path → řádek`

### Fáze 2 – plátno a porovnání

- [x] vzor jako SVG s kótami, výstup jako canvas s animací želvy a nastavitelnou rychlostí
- [x] krokovací slider nad `trace.steps`, zvýraznění bloku i řádku
- [x] `rasterize(trace)` v čistém TS, pixel match, skóre v %, režimy posuvník / překrytí / diff. **Odchylka:** výpočet běží v hlavním vlákně, ne ve workeru (trvá jednotky ms).
- [x] test: shodný program dá 100 %, trojúhelník s chybějící stranou méně než 75 %

### Fáze 3 – klikací editor

- [x] paleta podle `level.palette`, přidávání bloků klikem, steppery hodnot
- [x] CDK drag & drop, mazání, undo/redo. **Omezení:** tažení do vnořeného `repeat` je v CDK nespolehlivé (seznam si pamatuje polohy ze začátku tažení), hlavní vstup je klik: vybraný `opakuj` přijme nový blok dovnitř. Spolehlivě funguje změna pořadí a vytažení z `repeat` ven.
- [x] ovládání klávesnicí (tlačítka, Ctrl+Z / Ctrl+Y), cíle ≥ 44 px

### Fáze 4 – úlohy a hodnocení

- [x] úlohy a validace při buildu. **Odchylka:** úlohy jsou typovaná TS data (`src/app/levels/levels.ts`), ne JSON. Validaci dělá kompilátor a test, že reference dá 100 % a vejde se na plátno.
- [x] hodnocení: % shody + textová nápověda + hvězdy z AST
- [x] obrazovka „Úloha splněna“, 24 úloh pro světy 1–2

### Fáze 5 – postup a gamifikace

- [ ] Google přihlášení, postup ve Firestore (záznam na úlohu, XP se odvozuje), offline cache. Hotovo a ověřené proti emulátorům (přihlášení, sloučení, zápis změn, rules s 22 testy). Chybí skutečný Firebase projekt: do té doby produkční build běží jen s `localStorage`.
- [x] XP, úrovně, série dní, mapa s odemykáním světů, základní odznaky

### Fáze 6 – PWA a pilot

- [x] service worker, offline úlohy, mobilní layout
- [x] E2E happy path a screenshot testy plátna
- [ ] pilot s jednou třídou

### Fáze 7 – po MVP

- [x] Pyodide worker + turtle shim, CodeMirror, psaní kódu (×2 XP). Odchylky:
  - shim nekreslí, jen zapisuje příkazy želvy; `opsToProgram` z nich udělá program pro TS interpret, takže trace je shodný z konstrukce (test: Python z referencí všech úloh dá v Pyodide stejné segmenty);
  - Pyodide z npm, kopíruje se do `pyodide/` vedle aplikace, service worker ho cachuje líně (offline po prvním použití);
  - hvězdy v kódu: tvar a struktura (konstrukce v kódu, např. `for`, `begin_fill`), úspornost jen v blocích; záznam úlohy má `code: true` a XP úlohy se násobí 2;
  - nekonečná smyčka: limit 5000 příkazů želvy v shimu, bez kreslení ukončí worker po 5 s.
- [ ] třídní režim, úloha dne se žebříčkem (% → počet bloků → čas)

## Obsah: světy a úlohy pro MVP

| Svět | # | Úloha (vzor s kótami) | Co procvičí |
| --- | --- | --- | --- |
| 1 Základy | 1 | Úsečka 100 | `forward` |
| 1 | 2 | Pravý úhel 100 × 60 | `left 90` |
| 1 | 3 | Čtverec 100 | sekvence 8 bloků |
| 1 | 4 | Obdélník 160 × 80 | různé délky stran |
| 1 | 5 | Schody, 3 stupně | střídání vlevo / vpravo |
| 1 | 6 | Písmeno L | návrat na start |
| 1 | 7 | Písmeno T | `backward` |
| 1 | 8 | Písmeno E | `backward` + otočky |
| 1 | 9 | Dva čtverce s mezerou | `penUp` / `penDown` |
| 1 | 10 | Plus (kříž) | symetrie |
| 1 | 11 | Okno: čtverec dělený křížem | plánování trasy; jedním tahem to nejde (4 liché uzly), část čar se projde dvakrát přes `backward` |
| 1 | 12 | Čtverec znovu, max 3 bloky | první `repeat` |
| 2 Mnohoúhelníky | 1 | Obdélník 160 × 80 s `repeat` | `repeat 2` s tělem o 4 blocích |
| 2 | 2 | Rovnostranný trojúhelník 150 | vnější úhel 120° |
| 2 | 3 | Šestiúhelník | 360 / 6 = 60° |
| 2 | 4 | Pětiúhelník | 360 / 5 = 72° |
| 2 | 5 | Osmiúhelník | 360 / 8 = 45° |
| 2 | 6 | Kosočtverec | úhly 60° a 120° |
| 2 | 7 | Pěticípá hvězda | úhel 144° |
| 2 | 8 | Barevný trojúhelník | `fill` |
| 2 | 9 | Plástev: 3 šestiúhelníky | `repeat` uvnitř `repeat` |
| 2 | 10 | Květ: 6 čtverců otočených o 60° | vnořené opakování + otočka |
| 2 | 11 | „Kruh“ ze 36 kroků po 10° | aproximace kružnice |
| 2 | 12 | Finále: větrník ze 4 trojúhelníků | vše z obou světů |
| 2 | 13 | Kolo s 12 ostny o straně 40 | osten jako odbočka z mnohoúhelníku |
| 3 | 1 | Čtvercová spirála 10 … 190 | blok `cyklus for`, délka `= i` |
| 3 | 2 | Trojúhelníková spirála 10 … 240 | `range(od, do, krok)`, horní mez se neprovede |
| 3 | 3 | Vír: čáry 4 … 136, otočka 61° | úhel o stupeň vedle mnohoúhelníku |
| 3 | 4 | Spirála s proměnnou délka (3, +3, 60°) | bloky `nastav` a `změň`, `forward(delka)` |
| 3 | 5 | Vějíř: úhel 10, +5 | proměnná `uhel` v otočce |
| 3 | 6 | Tři mnohoúhelníky jedním opakuj | `pocet` a `uhel`, mění se jen nastavení |
| 4 | 1 | Osmicípá hvězda k = 3 | otočka k · 360 / n |
| 4 | 2 | Devíticípá hvězda k = 4 | totéž s jinými čísly |
| 4 | 3 | Falešné kolo 36 × (120, vlevo 70) | kolik otáček, než se obrazec uzavře |
| 4 | 4 | Špičky hvězdy | pero nahoru/dolů uvnitř opakuj |
| 4 | 5 | Hvězda bez špiček | opak předchozí |
| 4 | 6 | Šachovnice: sloupec 8 čtverců | výplně dvou barev, posun bez pera |
| 4 | 7 | Hvězda ze čtverců | přesun na protější roh, otočka 90 + 360 / n |
| 4 | 8 | Stínovaná hvězda | barvy pera, posun dozadu |

Svět 4 vychází ze cvičení studentů (`hvezdy.py`, `cviceni_sedm.py`, `sachovnice.py`, `cviceni_osm.py`, `stiny.py`). Funkce s parametry z originálů zatím bloky neumí, úloha je vždy jedna konkrétní instance.

| svět | # | úloha | učí |
|---|---|---|---|
| 5 | 1 | Kochova křivka koch(270, 3) | rekurze se zmenšením d / 3 |
| 5 | 2 | Kochova vločka ze 3 křivek koch(162, 3) | opakované volání rekurzivní funkce |
| 5 | 3 | Strom: kmen 72, větve o 12 kratší, 30° | dvě rekurzivní volání a návrat na start |
| 5 | 4 | Sierpinského trojúhelník (240, 3) | tři volání a přesuny mezi nimi |

Svět 5 je jen pro psaný kód (`codeStarter`: editor začne nastavením startu a kostrou funkce). Hvězdy: tvar, rekurze (funkce volá sama sebe), nejvýš `maxLines` řádků kódu. Reference se skládají stejnou rekurzí v TS a test v Pyodide ověřuje, že vzorová řešení dají 100 % a tři hvězdy.

Další světy přijdou po pilotu: souřadnice, vlajky, Pythagoras, sin/cos. Vzor se vykresluje z `reference`, takže kóta a hodnocení nemůžou nesouhlasit.

## Gamifikace: pravidla

Úloha je splněná od 98 % shody. Prahy se budou ladit v pilotu.

XP se neukládá jako číslo. Pro každou úlohu se ukládá záznam `{ stars, bestMatch, perfect, hintsUsed }` a XP se z něj počítá čistou funkcí `xp(records)`. Bonus za 100 % i srážka za nápovědu se tak dají odvodit a XP nejde rozbít souběžným zápisem. Klient je v MVP důvěryhodný. Proti podvádění (žebříček po MVP) pomůže až přepočet v Cloud Functions.

| Prvek | Pravidlo | Odměna |
| --- | --- | --- |
| Splnění | shoda ≥ 98 % | 1. hvězda, +20 XP |
| Přesnost | shoda 100 % (po toleranci) | bonus +10 XP |
| Struktura | použité bloky z `stars.requires`; úloha bez `requires` dává 2. hvězdu se splněním | 2. hvězda, +20 XP |
| Úspornost | počet bloků ≤ `stars.maxBlocks`; počítá se každý blok včetně vnořených, `repeat` je 1 blok | 3. hvězda, +20 XP |
| Nápověda | slovní tip → kostra programu | −10 XP za každý stupeň, XP za úlohu nejde pod 0 |
| Opakování úlohy | XP jen za nově získané hvězdy | bez farmení |
| Úroveň | 0, 200, 450, 750, … (každý další krok o 50 větší) | hlavička |
| Série | aspoň 1 splněná úloha denně | odznak za 7 a 30 dní |
| Odemknutí světa | 2/3 hvězd předchozího světa | další svět |
| Psaní kódu (po MVP) | stejná úloha v Pythonu | ×2 XP |

**Základní odznaky:**

- **První krok:** první splněná úloha
- **Smyčkař:** 10× `repeat`
- **Úhlomistr:** 5 úloh s vnějším úhlem napoprvé
- **Stovkař:** 10× 100 %
- **Bez nápovědy:** celý svět bez nápovědy
- **Série 7:** 7 dní v řadě

## Testování a nasazení

- **Unit (Vitest):**
  - interpret
  - normalizace segmentů
  - rasterizace a pixel match na syntetických maskách
  - generátor Pythonu
  - výpočet hvězd a XP ze záznamů úloh
- **Úlohy jako testy:** každá `reference` musí dát 100 % a prázdný program méně než 5 %, jinak build neprojde.
- **E2E (Playwright):**
  - mapa → úloha → splnění → XP v hlavičce
  - drag & drop do `repeat`
- **Screenshot testy:** plátno, vzor s kótami, diff režim.
- **CI:**
  - lint, unit a E2E na každém PR
  - preview kanál Firebase Hosting na PR
  - produkce z `main`
- **Firestore rules:** student čte a zapisuje jen svůj postup. Rules hlídají jen tvar a rozsahy hodnot (hvězdy 0–3, shoda 0–100), výpočet XP v nich udělat nejde.

## Rizika a otevřené otázky

| Riziko | Opatření |
| --- | --- |
| % neodpovídá pocitu („mám to skoro, a ukazuje 70 %“) | jmenovatel = sjednocení kresby, dilatace, ladění prahů v pilotu |
| Pyodide trace se liší od TS interpretu | společná sada testovacích programů pro obě cesty |
| Pyodide je velký (desítky MB) | lazy load až ve fázi psaní kódu, cache v service workeru |
| Drag & drop na mobilu | klik jako primární vstup |
| Školní Google účty můžou blokovat přihlášení třetích stran | ověřit u správce, fallback přes e-mailový odkaz |
| Osobní údaje nezletilých (GDPR) | ukládat jen UID a postup, jméno nezobrazovat mimo třídu; před pilotem souhlas školy |
| Podvádění zápisem do Firestore | v MVP se toleruje; před žebříčkem přepočet v Cloud Functions |

- [x] Souřadnice jako Python turtle (0, 0 uprostřed, y nahoru, úhel 0 = východ, `left` = kladný směr). Rozhodnuto ano; SVG i canvas mají y dolů, takže se osa y při vykreslení převrací.
- [ ] Animovat kreslení i při hodnocení, nebo jen výsledek?
- [ ] Pilotní třída a termín?
- [ ] Ukládat kresby pro budoucí galerii už v MVP?
- [ ] Ukládat rozpracovaný program úlohy (návrat k nedokončené úloze)?

## Postup v Claude Code

Každý krok je jeden prompt a končí zelenými testy. Do `CLAUDE.md` patří konvence a odkaz na tento soubor: strict TS, žádné `any` (místo něj `unknown`), signals, zoneless, UI česky.

1. **Scaffold:** Angular projekt (standalone, zoneless, strict), routy mapa a úloha, design tokeny z tabulky, Vitest, Playwright, CI s deployem na Firebase Hosting.
2. **Jádro:** typy `Command` / `Trace` / `Level`, čistá funkce `run(program)`, unit testy. Souřadnice jako Python turtle.
3. **Python generátor:** `toPython(program)` vrací text a mapu `path → řádek`, snapshot testy.
4. **Renderer:** plátno s animací, krokovací slider, vzor jako SVG s kótami z `level.dimensions`.
5. **Pixel match:** `rasterize(trace)` v čistém TS, worker se skóre v %, obrysy a výplně zvlášť, režimy posuvník / překrytí / diff, testy na syntetických maskách.
6. **Klikací editor:** paleta, steppery, CDK drag & drop s vnořením, undo/redo, klávesnice.
7. **Úlohy:** JSON schéma, loader, build test (`reference` = 100 %), 24 úloh podle tabulky.
8. **Hodnocení a gamifikace:** hvězdy, XP, obrazovka „Úloha splněna“, nápovědy.
9. **Firebase:** přihlášení, Firestore se security rules, mapa s odemykáním, série dní, odznaky. Nastavení projektu podle skillu `firebase-setup`.
10. **PWA a E2E:** service worker, offline, mobil, Playwright.

Kroky 5 a 6 jsou nejsložitější. U nich nejdřív plan mode, pak implementace.
