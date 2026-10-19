import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AccountMenu } from './firebase/account-menu';
import { AuthService } from './firebase/auth.service';
import { ProgressStore } from './progress/progress.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AccountMenu],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly progress = inject(ProgressStore);
  protected readonly firebaseEnabled = inject(AuthService).setup !== null;

  protected readonly levelProgress = computed(() => {
    const { from, to } = this.progress.playerLevel();
    return Math.round(((this.progress.xp() - from) / (to - from)) * 100);
  });
}
