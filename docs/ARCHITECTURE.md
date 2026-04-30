# KnowFlow Architecture

Initial date: 2026-04-30

## Confirmed Architecture Direction

KnowFlow should start as a modular monolith with a React + TypeScript frontend, a NestJS + TypeScript backend API, Prisma, PostgreSQL persistence, and a provider-neutral AI integration layer.

This follows a monolith-first approach: the product boundaries are not stable enough to justify microservices, but the domain boundaries should still be explicit from day one.

## High-Level System

```text
React UI
  -> Canvas Adapter
  -> API Client
  -> NestJS API
  -> Domain Modules
  -> Prisma
  -> PostgreSQL
  -> AI Provider Adapter
```

The frontend renders and edits graph state. The backend owns domain rules, persistence, AI run lifecycle, and context construction.

## Frontend Direction

Use React + TypeScript.

Use React Flow / xyflow as the MVP canvas rendering library because KnowFlow is a structured graph of nodes and edges, not a freehand whiteboard.

Frontend boundaries:

- `DomainGraph` should be independent of `ReactFlowNode` and `ReactFlowEdge`.
- React Flow should be treated as a rendering adapter.
- Canvas interactions should call domain-oriented API operations such as create node, move node, create edge, create branch, and start AI run.
- Prompt construction must not live in React components.
- Provider-specific AI logic must not live in React components.

Current frontend artifacts:

- `frontend/src/lib/domain.ts` defines frontend domain DTOs separate from React Flow types.
- `frontend/src/lib/reactFlowAdapter.ts` maps KnowFlow domain nodes and edges into React Flow nodes and edges.
- `frontend/src/lib/api.ts` calls backend domain endpoints and seeds a local demo project/graph when none exists.
- `frontend/src/components/ConversationNode.tsx` renders the React Flow node shell.
- `frontend/src/components/ConversationPanel.tsx` renders selected-node messages and starts non-streaming runs through backend APIs.
- `frontend/src/App.tsx` owns canvas state, manual node creation, manual edge creation, layout persistence, and selected-node panel wiring.

## Rich Text And Selection Direction

MVP messages should be Markdown-rendered, selectable, and immutable after creation. Only node title and node summary may be editable in v0.

Use a simple highlight model first:

- source message id,
- start offset,
- end offset,
- selected text snapshot,
- source message version or anchor version.

Avoid a full rich-text editor until editing and advanced annotations are proven necessary.

## Backend Direction

Use a NestJS + TypeScript modular monolith. Suggested modules:

- Projects
- Graphs
- Nodes
- Edges
- Messages
- Highlights
- AI Runs
- Context Builder
- Export/Import later, starting in v1

Each module should have clear ownership. The app can deploy as one backend process.

## Phase 1 API Boundary

The backend uses the `/api` global prefix.

Current Phase 1 routes:

| Resource | Routes | Notes |
| --- | --- | --- |
| Health | `GET /api/health` | Basic service smoke endpoint. |
| Users | `POST /api/users`, `GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id`, `DELETE /api/users/:id` | Supports optional placeholder user ownership for v0. |
| Projects | `POST /api/projects`, `GET /api/projects?ownerId=...`, `GET /api/projects/:id`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id` | Project container CRUD. |
| Graphs | `POST /api/graphs`, `GET /api/graphs?projectId=...`, `GET /api/graphs/:id`, `PATCH /api/graphs/:id`, `DELETE /api/graphs/:id` | Graphs stay separate from canvas renderer state. |
| Nodes | `POST /api/nodes`, `GET /api/nodes?graphId=...`, `GET /api/nodes/:id`, `PATCH /api/nodes/:id`, `DELETE /api/nodes/:id` | Node title, summary, type, and layout metadata are editable. |
| Edges | `POST /api/edges`, `GET /api/edges?graphId=...`, `GET /api/edges/:id`, `PATCH /api/edges/:id`, `DELETE /api/edges/:id` | Edge type distinguishes manual, branch, and future graph-link edges. |
| Branches | `POST /api/branches/from-selection` | Transactional command for the core branch workflow. |
| Messages | `POST /api/messages`, `GET /api/messages?nodeId=...`, `GET /api/messages/:id`, `DELETE /api/messages/:id` | Messages are immutable in v0; no update route. |
| Highlights | `POST /api/highlights`, `GET /api/highlights?messageId=...`, `GET /api/highlights/:id`, `DELETE /api/highlights/:id` | Highlights are anchored selections; no update route. |
| Runs | `POST /api/runs`, `POST /api/runs/:id/execute`, `GET /api/runs?nodeId=...&status=...`, `GET /api/runs/:id`, `PATCH /api/runs/:id`, `DELETE /api/runs/:id` | Run records and non-streaming execution through the provider-neutral adapter boundary. |
| ContextSnapshots | `POST /api/context-snapshots`, `GET /api/context-snapshots?runId=...`, `GET /api/context-snapshots/:id`, `DELETE /api/context-snapshots/:id` | Stores references and metadata, not rendered prompts by default. |

`POST /api/branches/from-selection` creates the branch operation as one backend transaction rather than a client sequence of separate CRUD calls. It creates the Highlight, child conversation Node, branch Edge, stub-backed pending Run, and ContextSnapshot together.

`POST /api/runs/:id/execute` calls ContextBuilder v0 before the provider adapter. The builder refreshes the run's `ContextSnapshot` and prepares provider messages from current node messages, selected text, and ancestor branch references.

## Database Direction

Use Prisma + PostgreSQL with normalized core tables.

Use JSONB only for:

- visual metadata,
- provider metadata,
- flexible settings,
- export payload metadata,
- temporary integration fields.

Do not use one large JSON blob for the graph as the primary persistence model. The app needs independent queries over nodes, edges, messages, highlights, and runs.

Phase 1 database artifacts:

- `prisma/schema.prisma` defines the domain schema.
- `prisma/migrations/20260430000000_init/migration.sql` contains the initial PostgreSQL migration derived from the Prisma schema.
- `.env.example` documents the expected `DATABASE_URL`.
- `docker-compose.yml` provides a local PostgreSQL container on host port `15432`.
- `docker/postgres/init/001-create-test-db.sql` creates the `knowflow_test` database on first container initialization.

## Domain Model

| Entity | MVP | Represents | Key Fields | Common Queries | Evolution Risk |
| --- | --- | --- | --- | --- | --- |
| User | Simple/later | Person or placeholder owner. | `id`, `email`, `display_name`, `settings` | Projects by owner. | Hard-coding single-user assumptions everywhere. |
| Project | Yes | Container for learning work. | `id`, `owner_id`, `title`, `description`, `created_at` | Graphs by project. | Treating projects as folders with no identity. |
| Graph | Yes | A visual learning flow. | `id`, `project_id`, `title`, `root_node_id`, `settings` | Nodes and edges by graph. | Mixing graph identity with viewport state. |
| Node | Yes | A conversation container or later graph-link. | `id`, `graph_id`, `type`, `title`, `summary`, `layout` | Nodes by graph. | Storing full conversation as node body. |
| Edge | Yes | Relationship between nodes. | `id`, `graph_id`, `source_node_id`, `target_node_id`, `type`, `label`, `source_highlight_id` | Edges by graph or endpoint. | Treating semantic and visual edges as identical. |
| Message | Yes | One user or AI turn in a node. | `id`, `node_id`, `role`, `content`, `sequence`, `run_id`, `token_count` | Ordered messages by node. | Collapsing messages into one text blob. |
| Highlight / TextSelection | Yes | Anchored selected text from a message. | `id`, `message_id`, `start_offset`, `end_offset`, `selected_text_snapshot`, `anchor_version` | Branches from selected text. | Persisting only selected text with no source anchor. |
| Run / AIRequest | Yes | Lifecycle of an AI call. | `id`, `node_id`, `status`, `provider`, `model`, `prompt_version`, `context_snapshot_id`, `error`, `latency_ms` | Runs by node and status. | Calling AI without durable state. |
| ContextSnapshot | Yes-light | What context was used for an AI run. | `id`, `run_id`, `included_message_ids`, `included_highlight_ids`, `selected_text_snapshot`, `token_estimate`, `prompt_template_version`, `context_policy_version` | Debug run behavior without storing full rendered prompts by default. | Making context invisible, or storing sensitive full prompts by default. |
| PromptTemplate | Later | Versioned prompt instruction. | `id`, `name`, `version`, `template` | Runs by prompt version. | Changing prompts with no version history. |
| GraphLink | Later | Node that links to another graph. | `node_id`, `target_graph_id`, `source_selection_id` | Split graph navigation. | Implementing graph splitting before branch workflow works. |

## AI Context Strategy

MVP context should include:

- Current node conversation thread within a token budget.
- Selected text when the run is created from a branch.
- Source message metadata for the selected text.
- Short ancestor path summary or references.

By default, `ContextSnapshot` should store references, `selectedTextSnapshot`, `tokenEstimate`, `promptTemplateVersion`, and `contextPolicyVersion`. It should not store full rendered prompts by default. Full rendered prompt storage requires a separate privacy/debugging decision.

MVP context should not automatically include:

- Entire graph.
- Project-level document retrieval.
- All neighboring nodes.
- Hidden context the user cannot inspect.

Use visible context chips in the UI so the user can understand what the AI is using.

Phase 1 ContextBuilder v0:

- Includes ordered messages from the run's current node.
- Preserves selected branch text from the existing `ContextSnapshot` or nearest branch highlight.
- Follows the inbound branch path up to a small fixed depth and stores referenced message and highlight ids.
- Writes only references, selected text snapshot, token estimate, prompt template version, and context policy version to `ContextSnapshot`.
- Produces transient provider messages at execution time without storing the full rendered prompt.

## AI Run Lifecycle

MVP AI responses are non-streaming first. Even when calls are synchronous, each AI request should create a durable run record.

Minimum statuses:

- `pending`
- `running`
- `succeeded`
- `failed`
- `cancelled` later

Each run should preserve:

- target node,
- provider,
- model,
- prompt or prompt version,
- context snapshot reference,
- error information,
- timing information when available,
- token estimate or usage when available.

Use a provider-neutral AI adapter from day one. Domain run logic should depend on an internal adapter interface, not on one provider SDK's request or response shape.

Phase 1 includes a deterministic local `stub` provider so run lifecycle behavior can be tested without connecting to a real model. The stub provider is not a product AI integration and should be replaced by a real adapter after the context builder and provider choice are confirmed.

The first real provider is an OpenAI adapter using the Responses API with default model `gpt-5.4-mini`. Runs should store `provider = openai` and the exact model id used. The adapter reads `OPENAI_API_KEY` from environment configuration, supports optional `OPENAI_MODEL` fallback when a run model is blank, and should not leak API keys, rendered prompts, or raw provider responses into logs.

Phase 1 run execution is synchronous and non-streaming, but it still follows the durable lifecycle: validate pending run, build context, mark running, call provider adapter, persist exactly one assistant message on success, then mark succeeded or failed.

Future async path:

- Move long-running AI work to a queue and worker.
- Add retries with bounded attempts.
- Add cancellation.
- Add streaming partial persistence only after the core branch workflow works.

## Consistency Boundaries

The branch operation should be transactional. It should create:

- highlight,
- child node,
- branch edge,
- selected text snapshot,
- placeholder run,
- initial child context snapshot.

If any part fails, the graph should not be left with a dangling highlight, node, or edge.

AI run completion should be consistent enough that a successful run creates exactly one final AI message for the run.

## Coupling Risks And Boundaries

| Coupling Risk | Boundary |
| --- | --- |
| Canvas rendering and graph domain logic | Keep renderer models separate from domain graph models. |
| React state and backend persistence | Treat server state as source of truth; use client state for interaction drafts. |
| Node content and message history | Node is container; messages are ordered records. |
| AI provider calls and run lifecycle | Use provider adapter behind domain run service. |
| Prompt construction and frontend components | ContextBuilder owns prompt inputs and policy. |
| Selected text UI and highlight persistence | Persist anchors, offsets, and selected text snapshot. |
| Graph rendering and domain rules | Domain validates node/edge operations before persistence. |
| Backend persistence and layout state | Store layout as metadata, not semantic graph truth. |
| Provider-specific code and workflow logic | Isolate provider request/response mapping. |
| Canvas library details and schema design | Backend schema must not be React Flow-specific. |
| Visual edge rendering and semantic relationships | Edge type must distinguish branch, manual, and future graph-link relations. |

## Reliability, Privacy, Cost, And Operations

Architecture references such as AWS Well-Architected, Google Cloud Architecture Framework, Azure cloud patterns, Google SRE, and monolith-first guidance all point to practical clarity rather than premature enterprise complexity.

For KnowFlow MVP this means:

- Reliability: store AI run status and errors from day one.
- Security/privacy: do not log prompts or user content casually; document retention choices.
- Cost: track model and token estimates per run; keep context bounded.
- Performance: do not load unnecessary full message histories for every canvas render once graphs grow.
- Maintainability: keep modules separate inside one deployable app.
- Evolution: design for future async AI work without requiring a queue in v0.

## v0 Performance Check

Use a 30-node graph as the minimum v0 performance fixture:

- 30 conversation nodes.
- About 40 edges.
- About 120 messages.
- Representative highlights, runs, context snapshots, and layout metadata.

This fixture should verify that graph loading, canvas rendering, panning, zooming, and node movement remain usable in local development. It is not a large-graph scalability guarantee. If the app struggles before 30 nodes, reduce payload coupling and rendering work before adding advanced graph features.

## v1 Export Format Direction

Use a versioned KnowFlow JSON export before interoperability formats.

Stable top-level fields:

- `format`: fixed string such as `knowflow.export`.
- `version`: export schema version, starting at `1`.
- `exportedAt`: ISO timestamp.
- `sourceAppVersion`: app version or commit when available.
- `project`: project identity, title, description, settings, and timestamps.
- `graphs`: graph identity, project reference, title, root node reference, settings, and timestamps.
- `nodes`: node identity, graph reference, type, title, summary, layout metadata, and timestamps.
- `edges`: edge identity, graph reference, source/target node references, type, label, source highlight reference, and timestamps.
- `messages`: message identity, node reference, role, content, sequence, run reference, token count, version, and timestamps.
- `highlights`: highlight identity, message reference, offsets, selected text snapshot, anchor version, and timestamps.
- `runs`: run identity, node reference, status, provider, model, prompt/context versions, timing, token usage, and error metadata.
- `contextSnapshots`: snapshot identity, run reference, included message ids, included highlight ids, selected text snapshot, token estimate, prompt template version, context policy version, and timestamp.
- `metadata`: export options, feature flags, and future extension metadata.

Do not include authentication state, API keys, raw provider request/response payloads, or full rendered prompts by default. Imports may remap ids to avoid collisions, but the export file should preserve internal references so a graph can round-trip.

## Verification Commands

Current backend verification commands:

```bash
npm run db:up
npm run db:ensure:test
npm run db:migrate
npm run db:migrate:test
npm run prisma:generate
npm run prisma:validate
npm run build
npm test
npm run test:integration
```

Current frontend verification commands:

```bash
npm install --prefix frontend
npm run frontend:build
npm run frontend:dev
```

OpenAI runtime configuration:

```bash
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-5.4-mini"
```

`OPENAI_API_KEY` is required only when executing runs with `provider = openai`. Local tests use the `stub` provider or mocked OpenAI client paths and should not call the real OpenAI API.

Frontend local development uses `http://localhost:5173` by default. The backend allows this origin through `CORS_ORIGIN`; set a comma-separated `CORS_ORIGIN` value when using another Vite port or host.

Frontend runtime configuration:

```bash
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_AI_PROVIDER="stub"
VITE_AI_MODEL="stub-tutor-v0"
```

The frontend defaults to the deterministic `stub` provider for local demos. Real provider secrets stay on the backend; the frontend must not receive or store `OPENAI_API_KEY`.

`npm run db:up` starts the local Docker PostgreSQL service. It maps container port `5432` to host port `15432` to avoid colliding with common local PostgreSQL installs.

`npm run db:ensure:test` creates `knowflow_test` if an existing Docker volume was initialized before the test database existed.

`npm run prisma:validate`, `npm run db:migrate`, `npm run db:migrate:test`, and `npm run test:integration` use local fallback database URLs if environment variables are not set. Applying migrations and running integration tests still require a reachable PostgreSQL instance.

## Open Questions

- No open architecture questions remain from the initial architecture-decision list.
