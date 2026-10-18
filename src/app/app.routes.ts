import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mapa' },
  {
    path: 'mapa',
    title: 'Mapa světů · Turtle Academy',
    loadComponent: () => import('./map/map-page').then((m) => m.MapPage),
  },
  {
    path: 'uloha/:id',
    title: 'Úloha · Turtle Academy',
    loadComponent: () => import('./task/task-page').then((m) => m.TaskPage),
  },
  { path: '**', redirectTo: 'mapa' },
];
