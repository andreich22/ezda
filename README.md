# Ezda

Cycling route planning and sharing MVP.

## Local development with Docker

Requirements: Docker Desktop.

1. Copy .env.example to .env.
2. Run docker compose up --build.
3. Open http://localhost:3000.

The MVP includes a MapLibre map, two-point route builder, routing API abstraction, PostgreSQL/PostGIS service, and Docker Compose setup.

If ORS_API_KEY is empty, the route endpoint uses a straight-line fallback so the application still runs locally. Add an OpenRouteService key to .env to get actual cycling road routing.
