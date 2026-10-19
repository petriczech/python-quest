import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';

/** Editor Pythonu (CodeMirror 6). Tab odsazuje, Esc a pak Tab z editoru odejde. */
@Component({
  selector: 'app-code-editor',
  template: `<div class="editor" #host></div>
    <p class="keys">Tab odsadí řádek. Z editoru odejdeš klávesou Esc a pak Tab.</p>`,
  // Prvky CodeMirror vznikají mimo Angular, zapouzdřené styly by na ně nedosáhly
  encapsulation: ViewEncapsulation.None,
  styles: `
    app-code-editor {
      display: block;
    }
    app-code-editor .editor {
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      overflow: hidden;
      background: var(--surface);
    }
    app-code-editor .cm-editor {
      min-height: 260px;
      max-height: 60vh;
      font-size: 15px;
    }
    .code-wide app-code-editor .cm-editor {
      min-height: 60vh;
      max-height: 80vh;
    }
    app-code-editor .cm-editor .cm-scroller {
      font-family: var(--font-code);
    }
    app-code-editor .cm-editor.cm-focused {
      outline: 3px solid var(--link);
      outline-offset: -3px;
    }
    app-code-editor .keys {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--text-3);
    }
  `,
  host: { class: 'code-editor' },
})
export class CodeEditor {
  readonly code = model.required<string>();
  /** Řádek s chybou, editor na něj skočí */
  readonly errorLine = input<number | null>(null);
  readonly changed = output<string>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private view: EditorView | null = null;

  constructor() {
    afterNextRender(() => {
      const parent = (this.host.nativeElement as HTMLElement).querySelector('.editor');
      if (!parent) {
        return;
      }
      this.view = new EditorView({
        doc: this.code(),
        parent,
        extensions: [
          basicSetup,
          python(),
          keymap.of([indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': 'Python kód', spellcheck: 'false' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const text = update.state.doc.toString();
              this.code.set(text);
              this.changed.emit(text);
            }
          }),
        ],
      });
    });

    // Kód nastavený zvenku (např. převzetí z bloků) se propíše do editoru
    effect(() => {
      const code = this.code();
      const view = this.view;
      if (view && view.state.doc.toString() !== code) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
      }
    });

    effect(() => {
      const line = this.errorLine();
      const view = this.view;
      if (view && line !== null && line >= 1 && line <= view.state.doc.lines) {
        const position = view.state.doc.line(line).from;
        view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
      }
    });

    inject(DestroyRef).onDestroy(() => this.view?.destroy());
  }
}
