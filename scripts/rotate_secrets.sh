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

echo "📝 Creating .env file with strong secrets..."
cat <<EOF > .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$NEW_DB_PASS
POSTGRES_DB=patient_assistant
JWT_SECRET=$NEW_JWT
NODE_ENV=production
EOF

echo "✅ .env created."

# 2. Update Database Password internally (since volume persists old password)
echo "🔄 Rotating Postgres User Password..."
docker compose exec postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$NEW_DB_PASS';" || echo "⚠️  Could not auto-update DB password manually."

# 3. Restart everything to pick up new variables
echo "🚀 Restarting services..."
docker compose up -d --force-recreate

echo "✅ Security Rotation Complete!"
echo "New Database Password: $NEW_DB_PASS"
echo "New JWT Secret: $NEW_JWT"
