import { Component, computed, input } from '@angular/core';
import { Command, TurtleState } from '../core/program';
import { toPython } from '../core/python';

interface Token {
  text: string;
  kind: 'keyword' | 'call' | 'number' | 'string' | 'plain';
}

const TOKEN = /(\bfrom\b|\bimport\b|\bfor\b|\bin\b|\bpass\b)|([a-z_]+)(?=\()|(-?\d+(?:\.\d+)?)|("[^"]*")/g;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) {
      tokens.push({ text: line.slice(last, index), kind: 'plain' });
    }
    const kind = match[1] ? 'keyword' : match[2] ? 'call' : match[3] ? 'number' : 'string';
    tokens.push({ text: match[0], kind });
    last = index + match[0].length;
  }
  if (last < line.length) {
    tokens.push({ text: line.slice(last), kind: 'plain' });
  }
  return tokens;
}

/** Náhled Python kódu se zvýrazněním právě prováděného řádku. */
@Component({
  selector: 'app-python-panel',
  template: `
    <div class="head">
      <h2>Python</h2>
      <span>jen čtení</span>
    </div>
    <pre aria-label="Python kód programu"><code>@for (line of lines(); track $index) {<span class="line" [class.active]="$index === activeLine()">@for (token of line; track $index) {<span [class]="token.kind">{{ token.text }}</span>}</span>}</code></pre>
  `,
  styles: `
    :host {
      display: block;
      background: var(--ink);
      border-radius: var(--radius-card);
      overflow: hidden;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      border-bottom: 1px solid #253c5c;
      color: #9fb2c8;
      font-size: 12px;
    }
    h2 {
      margin: 0;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
    }
    pre {
      margin: 0;
      padding: 14px 0;
      font: 14px/1.7 var(--font-code);
      color: #d6e2f0;
      overflow-x: auto;
    }
    .line {
      display: block;
      padding: 0 16px;
      white-space: pre;
      min-height: 1.7em;
    }
    .line.active {
      background: #1f3a5e;
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .keyword {
      color: #c79bff;
    }
    .call {
      color: #7cc4ff;
    }
    .number,
    .string {
      color: #ffb27a;
    }
  `,
})
export class PythonPanel {
  readonly program = input.required<Command[]>();
  readonly start = input<Partial<TurtleState>>({});
  readonly activePath = input<string | null>(null);

  private readonly code = computed(() => toPython(this.program(), this.start()));

  protected readonly lines = computed(() => this.code().lines.map((line) => tokenize(line.text)));

  protected readonly activeLine = computed(() => {
    const path = this.activePath();
    return path === null ? -1 : (this.code().lineOf.get(path) ?? -1);
  });
}
