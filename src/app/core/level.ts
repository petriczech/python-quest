import { Command, CommandKind, TurtleState, VarName } from './program';
import { run } from './run';

export interface Level {
  id: string;
  world: number;
  /** Pořadí ve světě od 1 */
  index: number;
  title: string;
  task: string;
  /** Referenční řešení, z něj se kreslí vzor i počítá skóre */
  reference: Command[];
  /** Povolené bloky v paletě */
  palette: CommandKind[];
  starter?: Command[];
  /** Úloha jen pro psaný kód: bloky nejsou, editor začne touto kostrou (za nastavením startu) */
  codeStarter?: string;
  stars: {
    requires?: CommandKind[];
    maxBlocks?: number;
    /** Proměnné, které se musí opravdu použít (v blocích přepínač „= delka“, v kódu `forward(delka)`) */
    usesVars?: VarName[];
    /** Psaný kód: funkce, která volá sama sebe */
    recursion?: boolean;
    /** Psaný kód: nejvýš tolik řádků (bez prázdných a komentářů) */
    maxLines?: number;
  };
  /** Stupně nápovědy: slovní tip → kostra programu */
  hints: string[];
}

export interface World {
  id: number;
  title: string;
  description: string;
}

/** Plátno ve světových souřadnicích, (0, 0) uprostřed */
export const VIEW = { width: 400, height: 300 } as const;

/** Start želvy tak, aby byl vzor vycentrovaný na plátně. */
export function levelStart(level: Pick<Level, 'reference'>): Partial<TurtleState> {
  const trace = run(level.reference);
  const points = [
    { x: 0, y: 0 },
    ...trace.segments.flatMap((segment) => [segment.from, segment.to]),
  ];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { x: Math.round(-cx), y: Math.round(-cy) };
}
