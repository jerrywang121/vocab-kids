import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/',              component: () => import('../views/HomeView.vue') },
  { path: '/manage',        component: () => import('../views/ManageView.vue') },
  { path: '/learn',         component: () => import('../views/LearnView.vue') },
  { path: '/quiz',          component: () => import('../views/QuizView.vue') },
  { path: '/games',         component: () => import('../views/GamesView.vue') },
  { path: '/achievements',  component: () => import('../views/AchievementsView.vue') },
  { path: '/settings',      component: () => import('../views/SettingsView.vue') },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
