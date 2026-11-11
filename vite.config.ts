import { defineConfig } from 'vite';
import { versionSim } from './server/version';

export default defineConfig({
  base: '/',
  // version de la simulation, comparée à celle du serveur de jeu avant d'ouvrir une montée classée
  define: { __VERSION_SIM__: JSON.stringify(versionSim()) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  // en développement, /api/jeu va au serveur de jeu local (npm run serveur), WebSocket du duel compris
  server: { host: true, proxy: { '/api/jeu': { target: 'http://localhost:8787', ws: true } } },
});
