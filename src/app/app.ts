import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ProgressStore } from './progress/progress.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly progress = inject(ProgressStore);

  protected readonly levelProgress = computed(() => {
    const { from, to } = this.progress.playerLevel();
    return Math.round(((this.progress.xp() - from) / (to - from)) * 100);
  });

  protected readonly streakDays = computed(() => {
    const days = this.progress.streak();
    if (days === 1) {
      return 'den';
    }
    return days >= 2 && days <= 4 ? 'dny' : 'dní';
  });
}
