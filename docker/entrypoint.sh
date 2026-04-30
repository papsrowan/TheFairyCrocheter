#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh — Script de démarrage du container Next.js
# Exécute les migrations Prisma puis lance l'application
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 TheFairyCrocheter — Démarrage..."
echo "📅 $(date)"
echo "🌍 NODE_ENV: $NODE_ENV"

# ── Attendre la DB + appliquer les migrations (retry) ────────────────────────
echo "⏳ Attente de la base et application des migrations Prisma..."

MAX_RETRIES=30
RETRY_COUNT=0

until npx prisma migrate deploy > /tmp/prisma-migrate.log 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Impossible d'appliquer les migrations apres $MAX_RETRIES tentatives."
    echo "----- prisma migrate deploy output -----"
    cat /tmp/prisma-migrate.log
    echo "---------------------------------------"
    exit 1
  fi
  echo "🔄 Tentative $RETRY_COUNT/$MAX_RETRIES — Nouvel essai dans 3s..."
  sleep 3
done

echo "✅ Migrations appliquees avec succes !"

# ── Seed automatique idempotent (optionnel) ──────────────────────────────────
# AUTO_SEED=true (defaut) -> lance l'initialisation des donnees de base.
# Le script utilise des upserts, donc il ne duplique pas les donnees.
if [ "${AUTO_SEED:-true}" = "true" ]; then
  echo "🌱 Initialisation des donnees (seed idempotent)..."
  node prisma/seed.runtime.mjs
  echo "✅ Seed execute"
else
  echo "⏭️  Seed saute (AUTO_SEED=${AUTO_SEED})"
fi

# ── Démarrer l'application ────────────────────────────────────────────────────
echo "▶️  Démarrage de Next.js sur le port $PORT..."
exec "$@"
