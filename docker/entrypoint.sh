#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh — Script de démarrage du container Next.js
# Exécute les migrations Prisma puis lance l'application
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 TheFairyCrocheter — Démarrage..."
echo "📅 $(date)"
echo "🌍 NODE_ENV: $NODE_ENV"

# ── Attendre que la base de données soit disponible ──────────────────────────
echo "⏳ Vérification de la connexion à la base de données..."

MAX_RETRIES=30
RETRY_COUNT=0

until echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Impossible de se connecter à la base de données après $MAX_RETRIES tentatives."
    exit 1
  fi
  echo "🔄 Tentative $RETRY_COUNT/$MAX_RETRIES — Nouvel essai dans 3s..."
  sleep 3
done

echo "✅ Base de données accessible !"

# ── Exécuter les migrations Prisma ───────────────────────────────────────────
echo "🗄️  Exécution des migrations Prisma..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "✅ Migrations appliquées avec succès !"
else
  echo "❌ Erreur lors des migrations Prisma"
  exit 1
fi

# ── Démarrer l'application ────────────────────────────────────────────────────
echo "▶️  Démarrage de Next.js sur le port $PORT..."
exec "$@"
