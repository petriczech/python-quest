import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEVELS, WORLDS } from '../levels/levels';
import { ProgressStore } from '../progress/progress.store';
import { ShapePreview } from '../shared/shape-preview';

@Component({
  selector: 'app-map-page',
  imports: [RouterLink, ShapePreview],
  templateUrl: './map-page.html',
  styleUrl: './map-page.css',
})
export class MapPage {
  protected readonly progress = inject(ProgressStore);

  protected readonly toNextLevel = computed(
    () => this.progress.playerLevel().to - this.progress.xp(),
  );

  protected readonly worlds = computed(() =>
    WORLDS.map((world) => {
      const levels = LEVELS.filter((level) => level.world === world.id).map((level) => {
        const stars = this.progress.records()[level.id]?.stars ?? [false, false, false];
        return {
          level,
          unlocked: this.progress.isLevelUnlocked(level),
          stars,
          starCount: stars.filter(Boolean).length,
        };
      });
      const stars = this.progress.worldStars(world.id);
      const max = this.progress.worldMaxStars(world.id);
      const next = levels.find((item) => item.unlocked && !item.stars[0]) ?? levels[0];
      return {
        world,
        levels,
        stars,
        max,
        unlocked: this.progress.isWorldUnlocked(world.id),
        done: stars === max,
        next: next?.level,
      };
    }),
  );
}
