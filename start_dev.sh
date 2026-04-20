#!/bin/bash

# Ensure we're in the project root
cd "$(dirname "$0")"

# Kill any processes occupying the dev ports
echo "Freeing ports 5111 (API) and 4200 (Angular)..."
for PORT in 5111 4200; do
  PID=$(lsof -ti tcp:$PORT 2>/dev/null)
  if [ -n "$PID" ]; then
    echo "  Killing PID $PID on port $PORT"
    kill -9 $PID 2>/dev/null
  fi
done

# Start infrastructure (Docker)
echo "Starting Docker services (PostgreSQL + MailHog)..."
docker compose -f docker/docker-compose.yml up -d

# Wait for PostgreSQL to be healthy
echo "Waiting for PostgreSQL to be ready..."
until docker exec ihos_postgres pg_isready -U ihos -d ihos_dev -q 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is ready."

# Check if node_modules exists, run npm install if not
if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

echo ""
echo "Starting Backend (.NET API) and Frontend (Angular)..."
echo "Press Ctrl+C to stop both processes."
echo ""

# Use concurrently to run and prefix logs for both backend and frontend
npx -y concurrently \
  --kill-others \
  --names "API,WEB" \
  --prefix-colors "blue.bold,green.bold" \
  "cd backend/src/Ihos.API && dotnet run" \
  "cd frontend && npm start"
