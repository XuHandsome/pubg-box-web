import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/player/:name',
    name: 'PlayerDetail',
    component: () => import('../views/PlayerDetail.vue'),
    props: true,
  },
  {
    path: '/replay/:id',
    name: 'MatchReplay',
    component: () => import('../views/Replay.vue'),
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
