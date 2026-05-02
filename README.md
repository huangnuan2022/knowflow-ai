# KnowFlow

KnowFlow is a visual AI learning workspace that turns linear AI chats into branching learning graphs. Users can ask AI inside a canvas node, select a confusing idea from the answer, and branch that exact source text into a connected child conversation.

## Live Demo

- Landing page: https://knowflow-ai-tan.vercel.app/
- Workspace: https://knowflow-ai-tan.vercel.app/app
- Backend health check: https://knowflow-ai-production.up.railway.app/api/health

## Core Workflow

1. Ask AI inside a visual node.
2. Select text from an AI response.
3. Branch into a focused child conversation with the selected text preserved as context.
4. Navigate back to the source highlight and follow the learning path across ancestors.
5. Connect existing conversation nodes with labeled relationship edges.

The seeded public demo starts with a system design graph for designing a URL shortener, so the workspace opens directly into a realistic learning scenario.

## Tech Stack

- Frontend: React, TypeScript, Vite, React Flow / xyflow
- Backend: NestJS, TypeScript, Prisma
- Database: PostgreSQL
- AI: provider-neutral AI adapter with local stub mode and OpenAI Responses API support
- Deployment: Vercel frontend, Railway backend, Railway PostgreSQL

## Local Development

Prerequisites:

- Node.js 22 or newer
- npm
- Docker Desktop for local PostgreSQL

Install dependencies:

```bash
npm install
npm install --prefix frontend
```

Create local environment variables:

```bash
cp .env.example .env
```

Start PostgreSQL and apply migrations:

```bash
npm run db:up
npm run db:migrate
npm run prisma:generate
```

Start the backend:

```bash
npm run start:dev
```

In another terminal, start the frontend:

```bash
npm run frontend:dev
```

Local URLs:

- Frontend: http://127.0.0.1:5173/
- Workspace: http://127.0.0.1:5173/app
- Backend health: http://127.0.0.1:3000/api/health

## AI Configuration

Local development defaults to the stub AI provider so the app can run without an API key.

To use OpenAI locally, set these values in `.env`:

```bash
AI_PROVIDER="openai"
AI_MODEL="gpt-5.4-mini"
OPENAI_MODEL="gpt-5.4-mini"
OPENAI_API_KEY="your_local_key"
```

Keep secrets in backend environment variables only. Do not expose `OPENAI_API_KEY` through `VITE_*` variables or commit it to GitHub.

## Verification

Run the standard checks before merging or deploying:

```bash
npm run frontend:build
npm run build
npm test
npm run test:integration
git diff --check
```

The browser acceptance test exists for the core branch workflow, but it is intentionally run only when needed:

```bash
npm run test:acceptance
```

## Release Safety

The submitted production URL should stay stable. For post-submission work:

1. Develop on a feature branch.
2. Run local checks.
3. Push the branch and review the Vercel Preview.
4. Smoke test the workspace manually.
5. Merge to `main` only after the preview is stable.
6. Roll back Vercel or Railway if production regresses.

See [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md) for the full rollout checklist.

## Documentation

Before implementing product or architecture changes, read:

- [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md)
- [docs/MVP_SPEC.md](docs/MVP_SPEC.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/TECH_DEBT.md](docs/TECH_DEBT.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
