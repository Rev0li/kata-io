# Serveur de jeu de Kata.io. À construire depuis la racine du dépôt (voir server/compose.yml et docs/BACKEND.md) :
# le serveur rejoue les combats avec la simulation du jeu, il lui faut donc src/sim à la même version que le jeu en ligne.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# toutes les dépendances : tsx (qui lance le TypeScript du serveur) est dans celles de développement
RUN npm ci --include=dev --no-audit --no-fund
COPY tsconfig.json ./
COPY src/sim ./src/sim
COPY server ./server
USER node
EXPOSE 8787
CMD ["node", "--import", "tsx", "server/index.ts"]
