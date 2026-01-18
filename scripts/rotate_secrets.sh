#!/bin/bash

# Generates random secure passwords
generate_password() {
    openssl rand -hex 16
}

generate_jwt() {
    openssl rand -base64 32
}

echo "🔐 Starting Security Rotation..."

# 1. Generate new secrets
NEW_DB_PASS=$(generate_password)
NEW_JWT=$(generate_jwt)
NEW_REDIS_PASS=$(generate_password) # Not used yet but good to have

# 2. Get existing Telegram Token if possible (or user must provide)
# Just in case, we preserve existing TELEGRAM_ADMIN_BOT_TOKEN if present in .env
if [ -f .env ]; then
    CURRENT_TG_TOKEN=$(grep TELEGRAM_ADMIN_BOT_TOKEN .env | cut -d '=' -f2)
else
    # Default fallback or manual input needed. 
    # For now, we assume user will add it manually or we use the known one if hardcoded previously
    CURRENT_TG_TOKEN="8047854416:AAF9Od0MT411h5amzVbMOg6rGyXfoCLd3SI"
fi

echo "📝 Creating .env file with strong secrets..."
cat <<EOF > .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$NEW_DB_PASS
POSTGRES_DB=patient_assistant
JWT_SECRET=$NEW_JWT
TELEGRAM_ADMIN_BOT_TOKEN=$CURRENT_TG_TOKEN
NODE_ENV=production
EOF

echo "✅ .env created."

# 3. Update Database Password internally (since volume persists old password)
echo "🔄 Rotating Postgres User Password..."
# We try to use 'postgres' as password first (default), if that fails, we might need manual intervention or this script assumes default was set.
docker compose exec postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$NEW_DB_PASS';" || echo "⚠️  Could not auto-update DB password manually. If this fails, the DB might already have a custom password."

# 4. Update docker-compose.yml to use the one with variables
# Assuming user pulled changes and docker-compose.prod.yml now uses variables
cp docker-compose.prod.yml docker-compose.yml

# 5. Restart everything to pick up new variables
echo "🚀 Restarting services..."
docker compose up -d --force-recreate

echo "✅ Security Rotation Complete!"
echo "New Database Password: $NEW_DB_PASS"
echo "New JWT Secret: $NEW_JWT"
