# syntax=docker/dockerfile:1

# ============================================================================
# Blackbeard Tavern — imagem de produção
# O container roda o backend Express + Socket.io e serve o frontend estático
# (na VM esse papel era do Nginx). O ALB encaminha o tráfego diretamente.
# ============================================================================

# --- Stage 1: dependências de produção do backend ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 2: imagem final ---
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production

# ffmpeg transcodifica os vídeos enviados no chat e no feed (ver *Controller.js).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# node_modules já resolvido no stage de deps
COPY --chown=node:node --from=deps /app/backend/node_modules ./node_modules
# Código do backend (.dockerignore exclui node_modules, .env, uploads, etc.)
COPY --chown=node:node backend/ ./
# Frontend estático servido pelo Express
COPY --chown=node:node frontend/ ../frontend/

# Roda como usuário sem privilégios
USER node

EXPOSE 3000

# Healthcheck do próprio container (o ALB também checa /api/health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
