import { Component, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ProgressSync, SyncStatus } from './progress-sync.service';

const STATUS_TEXT: Record<SyncStatus, string> = {
  off: 'Postup se ukládá jen v tomto zařízení.',
  syncing: 'Ukládám do účtu…',
  synced: 'Postup je uložený v účtu.',
  error: 'Uložení se nepovedlo, zkusím to znovu.',
};

/** Přihlášení Google účtem a stav ukládání postupu. */
@Component({
  selector: 'app-account-menu',
  template: `
    @if (auth.ready()) {
      @if (auth.account(); as account) {
        <button
          type="button"
          class="avatar"
          popovertarget="ucet"
          [attr.aria-label]="'Účet: ' + (account.name ?? account.email ?? 'přihlášený')"
        >
          {{ initials() }}
        </button>
        <div id="ucet" popover class="menu">
          <p class="name">{{ account.name ?? 'Přihlášený účet' }}</p>
          @if (account.email) {
            <p class="email">{{ account.email }}</p>
          }
          <p class="status" role="status">{{ statusText() }}</p>
          <button type="button" class="btn" (click)="sync.signOut()">Odhlásit</button>
        </div>
      } @else {
        <button type="button" class="sign-in" (click)="auth.signIn()">Přihlásit přes Google</button>
      }
    }
    @if (auth.error(); as error) {
      <p class="error" role="alert">{{ error }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar {
      width: var(--touch);
      height: var(--touch);
      border-radius: 50%;
      border: 2px solid #3a587f;
      background: var(--ink-2);
      color: #ffffff;
      font-weight: 600;
      cursor: pointer;
    }
    .sign-in {
      min-height: var(--touch);
      padding: 0 14px;
      border-radius: var(--radius-button);
      border: 1px solid #3a587f;
      background: var(--ink-2);
      color: #ffffff;
      font-weight: 600;
      cursor: pointer;
    }
    .menu {
      inset: 72px 16px auto auto;
      margin: 0;
      width: min(300px, calc(100vw - 32px));
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 12px 32px rgb(18 35 59 / 0.2);
    }
    .menu p {
      margin: 0 0 6px;
    }
    .name {
      font-weight: 700;
    }
    .email,
    .status {
      font-size: 14px;
      color: var(--text-2);
    }
    .menu .btn {
      margin-top: 8px;
      width: 100%;
    }
    .error {
      margin: 0;
      font-size: 13px;
      color: #ffb27a;
    }
  `,
})
export class AccountMenu {
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(ProgressSync);

  protected readonly statusText = computed(() => STATUS_TEXT[this.sync.status()]);

  protected readonly initials = computed(() => {
    const account = this.auth.account();
    const source = account?.name ?? account?.email ?? '?';
    return source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  });

  constructor() {
    this.sync.start();
  }
}
