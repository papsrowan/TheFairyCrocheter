# Deploiement VPS (Docker Compose simple)

Ce document explique comment deployer l'application sur un VPS avec `docker compose`, sans Traefik et sans script de deploiement.

## 1) Prerequis VPS

- Un VPS Linux (Ubuntu/Debian recommande)
- Docker et Docker Compose installes
- Git installe
- Ports ouverts:
  - `22` (SSH)
  - `3001` (application) si tu exposes l'app directement

## 2) Installer Docker (si besoin)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 3) Recuperer le projet

```bash
sudo mkdir -p /opt/fairy-crocheter
sudo chown $USER:$USER /opt/fairy-crocheter
cd /opt/fairy-crocheter
git clone <URL_DU_REPO> .
```

## 4) Variables d'environnement

Le `docker-compose.yml` cree une base PostgreSQL interne (`service db`) et injecte `DATABASE_URL` automatiquement dans `app`.

Tu peux ne rien definir (valeurs par defaut), ou personnaliser:

```env
POSTGRES_DB=fairycrocheter
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me_strong_password
APP_PORT=3001
AUTH_SECRET=genere_un_secret_fort
AUTH_URL=http://IP_DU_VPS:3001
NEXT_PUBLIC_APP_URL=http://IP_DU_VPS:3001
SSE_SECRET=genere_un_secret_fort
```

Le mapping port est configure comme suit dans `docker-compose.yml`:

```yaml
ports:
  - "${APP_PORT:-3001}:3000"
```

Creer un fichier `.env.production` a la racine:

```bash
cp .env.example .env.production
nano .env.production
```

## 5) Premier demarrage

```bash
cd /opt/fairy-crocheter
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Verification sante:

```bash
curl -f http://localhost:${APP_PORT:-3001}/api/health
```

## 6) Mise a jour applicative

```bash
cd /opt/fairy-crocheter
git pull
docker compose up -d --build
docker image prune -f
```

## 7) Commandes utiles

```bash
# Etat des services
docker compose ps

# Logs application
docker compose logs -f app

# Logs base de donnees
docker compose logs -f db

# Redemarrer uniquement l'app
docker compose restart app

# Arreter
docker compose down

# Arreter sans supprimer les donnees
docker compose down
```

Note: les donnees PostgreSQL sont conservees dans le volume `db-data`.

## 8) Sauvegarde et restauration de la base

### Sauvegarde

```bash
mkdir -p /opt/backups
docker compose exec -T db pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-fairycrocheter} > /opt/backups/fairycrocheter_$(date +%F_%H-%M).sql
```

### Restauration

```bash
cat /opt/backups/backup.sql | docker compose exec -T db psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-fairycrocheter}
```

## 9) Probleme frequents

- **`app` redemarre en boucle**: verifier `docker compose logs -f app` (souvent variables manquantes).
- **Erreur DB**: verifier `docker compose logs -f db` et mot de passe PostgreSQL.
- **Port 3001 occupe**: changer `APP_PORT` dans `.env.production` (ex: `APP_PORT=3010`).
- **Changement des credentials DB apres premier lancement**:
  - si volume deja initialise, les nouvelles variables ne recreent pas l'utilisateur automatiquement.
  - soit tu gardes les anciens credentials, soit tu recrees la base (suppression volume).

## 10) Reset complet (attention: supprime les donnees)

```bash
docker compose down -v
docker volume ls
docker compose up -d --build
```

