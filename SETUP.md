# Setup Instructions

## Prerequisites

- Docker and Docker Compose installed
- Git (for cloning)

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd cpg-test-release
```

2. Ensure the `cpg.db` file is in the root directory (or update the path in `docker-compose.yml`)

3. Start the application:
```bash
docker compose up
```

4. Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

## Manual Setup (Development)

### Backend

```bash
cd client/server
npm install
npx ts-node index.ts
```

Backend will run on http://localhost:3001

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend will run on http://localhost:5173

## Project Structure

```
cpg-test-release/
├── client/
│   ├── src/              # React frontend
│   ├── server/           # Fastify backend
│   └── Dockerfile        # Frontend Docker image
├── docker-compose.yml    # Docker orchestration
└── cpg.db               # SQLite database (not in repo)
```

## Environment Variables

- `VITE_API_URL` - Frontend API URL (default: http://localhost:3001)
- `DB_PATH` - Database path for backend (default: ../../cpg.db)
- `NODE_ENV` - Node environment (production/development)

## Troubleshooting

- If port 3001 or 5173 is already in use, change ports in `docker-compose.yml`
- Ensure `cpg.db` file exists and is readable
- Check Docker logs: `docker compose logs`
