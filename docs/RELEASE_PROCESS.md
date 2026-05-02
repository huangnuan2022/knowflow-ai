# KnowFlow Release Process

Initial date: 2026-05-01

## Purpose

This file protects the submitted public demo while KnowFlow continues to improve. The submitted production URL should be treated as the stable judge-facing release. New landing page changes, canvas fixes, and feature work should go through a branch, preview, and smoke-test flow before production changes.

## Confirmed Production Baseline

- Baseline tag: `submission-v0`
- Production frontend: `https://knowflow-ai-tan.vercel.app/`
- Production workspace: `https://knowflow-ai-tan.vercel.app/app`
- Production backend API: `https://knowflow-ai-production.up.railway.app/api`
- Backend health check: `https://knowflow-ai-production.up.railway.app/api/health`

## Release Rules

1. Do not develop directly on `main` after the submitted baseline.
2. Create a focused feature branch for each hardening batch or feature.
3. Run the relevant local checks before pushing.
4. Push the feature branch and use the Vercel Preview URL for manual smoke testing.
5. Merge to `main` only after the preview passes smoke testing.
6. Let Vercel update production from `main`.
7. If production breaks, use Vercel Instant Rollback and Railway previous deployment rollback.
8. Do not reset the production database casually. The current app has no auth, so production data is shared demo state.

## Environment Strategy

### Production

- Vercel production should point `VITE_API_BASE_URL` to the Railway production API.
- Railway production should set `DATABASE_URL` to the Railway Postgres database.
- Railway production may use `AI_PROVIDER=openai` and `AI_MODEL=gpt-5.4-mini`.
- `OPENAI_API_KEY` must exist only in backend environment variables, never in frontend variables or source.
- `CORS_ORIGIN` should include the stable Vercel production domain and any explicitly validated preview domains.

### Preview And Staging

- Preferred preview setup: Vercel Preview frontend plus Railway staging backend and staging Postgres.
- Preview/staging should default to `AI_PROVIDER=stub` unless a real-model test is intentional.
- Do not point Vercel Preview at the production database by default. Without auth, preview testing can pollute the judge-facing demo.

## Local Test Gate

Run before merging a feature branch into `main`:

```bash
npm run frontend:build
npm run build
npm test
npm run test:integration
git diff --check
```

If the change touches the core canvas branch workflow, also run:

```bash
npm run test:acceptance
```

## Production Smoke Test

After production deploy or rollback, verify:

- `/` landing page loads.
- `/app` loads in an incognito window.
- The seeded demo appears.
- Asking AI works, or a safe fallback/error appears.
- Highlighting an AI answer and branching creates a connected child node.
- Refresh preserves the graph.
- No `Failed to fetch` toast appears.
- Railway `/api/health` returns `{"service":"knowflow-api","status":"ok"}`.

## Rollback Plan

- Frontend: use Vercel Instant Rollback to restore the previous successful production deployment.
- Backend: use Railway deployment history to redeploy the previous successful backend.
- Database: avoid destructive resets. If data is polluted, prefer a deliberate demo-copy/reset design rather than manually deleting production records.

