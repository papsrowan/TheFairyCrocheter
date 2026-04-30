# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — TheFairyCrocheter (Next.js 14 + Prisma)
# Build multi-stage : deps → builder → runner
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1 : Dépendances ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Installer les libs natives nécessaires (Prisma, sharp, bcrypt)
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copier uniquement les fichiers de dépendances pour profiter du cache Docker
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Installer toutes les dépendances (prod + dev nécessaires au build)
RUN npm ci --frozen-lockfile

# Générer le client Prisma
RUN npx prisma generate

# ── Stage 2 : Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copier les dépendances depuis l'étape précédente
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copier le code source
COPY . .

# Variables d'environnement nécessaires au build Next.js
# (valeurs factices — les vraies sont injectées au runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

# Build de l'application
RUN npm run build

# ── Stage 3 : Runner (image finale légère) ───────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copier les fichiers publics
COPY --from=builder /app/public ./public

# Créer le dossier .next/cache avec les bonnes permissions
RUN mkdir -p .next/cache && chown nextjs:nodejs .next/cache

# Copier le build Next.js (mode standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copier Prisma (client généré + schema pour les migrations)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps    --chown=nextjs:nodejs /app/prisma ./prisma
# CLI prisma (nécessaire pour `prisma migrate deploy` au démarrage)
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Copier le script d'entrée
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Dossier de stockage des documents PDF générés
RUN mkdir -p /app/documents && chown nextjs:nodejs /app/documents

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
