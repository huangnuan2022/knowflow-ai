# KnowFlow

KnowFlow is a graph-based AI tutor workspace. Its MVP should prove one core workflow: a learner selects text inside an AI response and branches that exact selection into a connected child conversation node.

## Required Reading

Before implementing features, read:

- `docs/PRODUCT_BRIEF.md`
- `docs/MVP_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/TECH_DEBT.md`
- `docs/RELEASE_PROCESS.md` before deployment, rollout, or post-submission production changes

Use `docs/COMPETITIVE_REVIEW.md` when changing product positioning, canvas behavior, note-taking behavior, AI learning flows, or competitor-inspired features.

## Development Flow

1. Read the relevant docs.
2. Restate the implementation goal and acceptance criteria.
3. Plan first.
4. Implement second.
5. Test third.
6. Summarize changes, verification, and any remaining risk.

## Documentation Maintenance

After implementation, update documentation only when the change affects:

- product behavior
- MVP scope
- architecture boundaries
- domain model
- API contract
- database schema
- AI context strategy
- testing commands
- known technical debt

Do not rewrite docs unnecessarily. If no documentation update is needed, explicitly say: "No documentation update needed."

## Git workflow

- Before making changes, check the current git status.
- Keep changes focused and scoped to the requested task.
- For multi-step work, state the recommended git grouping and commit message for each step.
- After the public submission, use feature branches and preview deployments for changes before merging to production.
- Commit completed implementation/documentation work by default unless the user asks not to commit.
- Push completed commits by default unless the user asks not to push.
- Before suggesting a commit, run the relevant checks.
- Summarize modified files and test results.

## Project Rules

- Do not overbuild beyond the current MVP scope in `docs/MVP_SPEC.md`.
- Keep the MVP modular; avoid tight coupling between canvas rendering, domain logic, persistence, and AI provider code.
- Define acceptance criteria before implementing each feature.
- Update `docs/DECISIONS.md` when major product or architecture decisions change.
- Update `docs/TECH_DEBT.md` whenever a temporary shortcut is introduced.
- Do not add application source folders, dependencies, or generated code unless the active task explicitly asks for implementation.
