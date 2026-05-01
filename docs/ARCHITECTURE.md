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
- `frontend/src/lib/reactFlowAdapter.ts` maps KnowFlow domain nodes and edges into React Flow nodes, edge handles, and edges.
- `frontend/src/lib/api.ts` calls backend domain endpoints and asks the backend demo-seed endpoint to create a persisted local demo when no project exists.
- `frontend/src/lib/textSelection.ts` reads plain-text DOM selection offsets for v0 branch creation.
- `frontend/src/components/ConversationNode.tsx` renders the React Flow node shell, editable title and summary fields, collapsed branch-point previews, expanded inline conversation threads, node-local ask controls, inline text selection, branch actions, resize controls, branch highlight handles, and branch-highlight jump actions.
- `frontend/src/components/EditableEdge.tsx` renders graph edges and supports lightweight label editing for manual relationship edges.
- `frontend/src/components/ConversationPanel.tsx` is no longer mounted in v0. The expanded canvas node is the primary reader, ask surface, and branch surface.
- `frontend/src/App.tsx` owns canvas state, manual node creation, manual edge creation, layout persistence, and selected-node panel wiring.

Canvas-first interaction rule:

- The topbar owns the minimal v0 workspace manager: switch project, switch graph, create project, create graph, and edit the active project/graph metadata through existing backend CRUD boundaries.
- Active project and graph selection is frontend navigation state, not authorization state. For v0 it can be persisted in URL query parameters plus localStorage so refreshes and shared local URLs reopen the same graph.
- The System Design Prep / Design a URL Shortener seeded demo should be created only when the backend has no projects. It is backend-owned deterministic fixture data with persisted nodes, messages, highlights, branch edges, pending branch-context runs, and context snapshots. New user-created projects may get a blank starter graph, but should not receive demo content.
- Switching projects or graphs should clear node focus and fit the whole graph into view with a readable maximum zoom, rather than opening on a single oversized node.
- The expanded canvas node is the primary place to read, ask, select AI response text, and branch.
- The right sidebar inspector is removed from v0. It duplicated the expanded node, created layout pressure, and made scroll/state coordination more fragile. The expanded canvas node now owns reading, asking, highlighting, branching, and branch-context navigation.
- Expanded nodes should be large enough to read directly and can be maximized/restored like a lightweight window. Keep explicit navigation actions, such as branch context jumping back to the source highlight, instead of live scroll synchronization.
- The collapsed canvas node should be a compact navigation object: title, summary, and branch points only. Message text, inline highlights, ask controls, and title/summary editing are reserved for the expanded/focused node so collapsed cards remain easy to drag and scan.
- Collapsed branch-point lists should keep normal chip sizing and spacing. The list should scroll only when the current node size cannot fit its branch points, and resizing a collapsed node larger should reveal more chips without stretching the gaps.
- Expanded/focused state should be driven by KnowFlow's `selectedNodeId`, not by transient React Flow selection changes. This prevents drag, resize, or internal selection events from accidentally rendering expanded conversation controls inside a collapsed node.
- User messages should appear as compact right-aligned bubbles, while assistant responses should read as broader prose inside the node.
- Persisted highlights should render in place when possible, and branch edges should use source handles attached to those highlights. Highlights without branch targets are orphaned branch artifacts in v0 and should be hidden from the branch UI until backend cleanup exists. A collapsed node may fall back to stable highlight chips so existing edges still have visible handles.
- Expanded nodes may scroll their message thread, so scroll events must refresh React Flow node internals for the selected node. Collapsed branch-point lists may also scroll. Collapsed nodes may render edges for visible branch-point chips to support graph overview. Expanded nodes should hide branch edges by default and render only the active highlight's branch edge while a persisted highlight menu is open or a source highlight is being revealed. Hidden-source branch edges should be temporarily omitted so edges do not appear to originate from empty scroll space.
- Persisted branch highlights should open a compact local menu with existing child branches and a "new branch from this highlight" action. Additional branches from the same selected text should reuse the same `Highlight` record and add a new child node and branch edge.
- Highlight action menus should be rendered as canvas-level floating overlays, not clipped inside scrollable node content. They may visually overflow the node boundary because they are transient controls.
- Persisted branch highlights and collapsed branch-point chips should jump to connected child nodes. If a single highlight has multiple child branches, the UI should show a compact branch target picker rather than choosing the first child implicitly. This keeps repeated branching from the same highlight understandable.
- Focus navigation should center the selected target node at a readable zoom level. Branch creation is the exception: after creating a child branch, the source and child should both be fit into view so the new provenance relation is obvious.
- Child branch context should be collapsed by default inside expanded nodes, with a one-click reveal. It is important context, but it should not compete with the active conversation. The selected source text that created a branch is branch context, not node summary; node summary is reserved for user-authored notes.
- Branch context chips may act as provenance navigation back to the source highlight that created the branch. This should use stored branch edge and highlight metadata rather than re-searching by selected text.
- Highlights should use deterministic accent colors in v0. Branch edges, branch edge labels, and child branch nodes inherit the source highlight color so the visual path stays traceable without adding a color-picker workflow yet.
- Any future secondary reader should reuse the same deterministic highlight colors as the canvas so the user can recognize the same source selection across reading surfaces.
- After creating a branch, keep the source node selected and expanded, then fit the source and child node into view. Selecting the child immediately hides the source highlight and makes the branch feel disconnected.
- Manual edges are allowed for non-branch peer relationships between node-level side handles and may have editable labels and delete controls. Nodes expose manual handles on all four sides in both collapsed and expanded states, and a manual edge gesture may start from any side and finish on any other node side. The frontend normalizes that gesture into an undirected node-level relationship; the backend should not infer semantic direction from which side the user dragged from. Persisted manual edges are rendered from the closest source/target sides based on node positions. They should remain visually and semantically separate from branch edges. Branch points should not be manual connection handles. Branch edge labels represent selected source text and should not be freely edited in v0. Failed manual-edge gestures should show a clear local error instead of silently disappearing.
- MVP branch and manual edges use simple bezier curves rather than orthogonal smooth-step routing by default. This keeps lines feeling less snapped together without adding custom bend-point editing or a full edge router. Branch edges should attach to the source highlight when visible and target the nearest side of the child branch node. Edge visibility should use a focus-plus-context rule: edges related to the currently focused node are emphasized and may use a higher edge layer; unrelated branch and manual edges are dimmed and should not show labels while a node is focused. Focused branch edges may use a lightweight obstacle-aware route around unrelated node rectangles when a direct curve would be hidden by overlapping nodes. This avoids both extremes: all lines hidden behind cards, or all lines cutting through readable node content.
- Node deletion must be a domain API operation. React Flow delete/remove events should call the backend delete boundary and refresh server state; removing nodes only from local canvas state causes deleted nodes to reappear on the next refresh.
- Dragging a node should not expand it; expansion is a click/focus action. This keeps basic canvas movement predictable.
- Resizing is allowed on collapsed and expanded nodes and persists to node layout metadata through the backend node update boundary.
- Resized collapsed nodes should allow the branch-point region to grow into available space. A fixed small list height creates confusing empty cards when users manually enlarge a node.
- Expanded nodes are a reading and asking surface, so their message typography should be larger than collapsed card typography.
- Node creation should use the current viewport center converted to graph coordinates. Fixed default graph coordinates make nodes appear in surprising off-screen or bottom-of-view positions after the user pans or zooms.
- Node cards should generally render above graph edges, especially when expanded, so unrelated relationship lines do not cut through readable conversation content. The exception is an outgoing branch edge from the currently expanded source node, which may render above that source node so the line visibly originates from the selected highlight. Use the persisted highlight and branch-point jump action as the main provenance cue rather than letting unrelated edges dominate node text.
- Destructive actions should use KnowFlow-styled in-app confirmation dialogs rather than browser-native prompts.
- A temporary selected-text draft is only an interaction draft. If the user clicks away before choosing Branch, the draft highlight and inline Branch action should disappear without persistence.

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
- Demo Seed
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
| Demo Seed | `POST /api/demo-seed/system-design` | Idempotently creates the persisted System Design Prep / Design a URL Shortener demo graph for empty local/demo databases. |
| Messages | `POST /api/messages`, `GET /api/messages?nodeId=...`, `GET /api/messages/:id`, `DELETE /api/messages/:id` | Messages are immutable in v0; no update route. |
| Highlights | `POST /api/highlights`, `GET /api/highlights?messageId=...`, `GET /api/highlights/:id`, `DELETE /api/highlights/:id` | Highlights are anchored selections; no update route. |
| Runs | `POST /api/runs`, `POST /api/runs/:id/execute`, `GET /api/runs/defaults`, `GET /api/runs?nodeId=...&status=...`, `GET /api/runs/:id`, `PATCH /api/runs/:id`, `DELETE /api/runs/:id` | Run records and non-streaming execution through the provider-neutral adapter boundary. `GET /api/runs/defaults` exposes only the backend-selected provider/model for read-only UI status. |
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

The first real provider is an OpenAI adapter using the Responses API with default model `gpt-5.4-mini`. The backend owns provider/model defaults through `AI_PROVIDER` and `AI_MODEL`; the frontend must not decide whether a run uses a real provider. Runs should store the exact `provider` and `model` used. The adapter reads `OPENAI_API_KEY` from environment configuration and should not leak API keys, rendered prompts, or raw provider responses into logs or API errors.

Allowed v0 provider/model pairs:

- `stub` with `stub-tutor-v0` for deterministic local development and tests.
- `openai` with `gpt-5.4-mini` for the first real tutor model.
- `openai` with `gpt-5.4-nano` only as a manual lower-cost test option, not an automatic fallback.

`POST /api/runs` may omit provider and model. The backend resolves defaults, validates provider/model allowlists, and persists the chosen pair on the Run. Explicit client-provided provider/model values are accepted only if they match the backend allowlist. This keeps the API flexible for tests and future admin tooling without letting the browser become the trust boundary.

`POST /api/runs/:id/execute` has a simple v0 in-memory rate limit controlled by `AI_RUN_RATE_LIMIT_MAX` and `AI_RUN_RATE_LIMIT_WINDOW_MS`. It is intended to prevent accidental local cost spikes, not to replace production auth, quotas, or gateway controls.

The frontend may display the current backend-selected provider/model from `GET /api/runs/defaults`, but it must not treat the browser as the authority for paid provider selection. Editable model selection remains a later authenticated/settings workflow.

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
npx playwright install chromium
npm run test:acceptance
```

Current frontend verification commands:

```bash
npm install --prefix frontend
npm run frontend:build
npm run frontend:dev
```

OpenAI runtime configuration:

```bash
AI_PROVIDER="stub"
AI_MODEL="stub-tutor-v0"
AI_RUN_RATE_LIMIT_MAX="10"
AI_RUN_RATE_LIMIT_WINDOW_MS="60000"
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-5.4-mini"
```

Use `AI_PROVIDER="openai"` and `AI_MODEL="gpt-5.4-mini"` to enable the real provider locally. `OPENAI_API_KEY` is required only when executing runs with `provider = openai`. `OPENAI_MODEL` is a compatibility fallback for OpenAI runs, but `AI_MODEL` is the primary backend-owned switch. Local tests use the `stub` provider or mocked OpenAI client paths and should not call the real OpenAI API.

OpenAI setup for local development:

1. Open `https://platform.openai.com/` and sign in.
2. Create or select a Project in the API dashboard.
3. Set a project budget or usage limit before testing real runs.
4. Create a new project API key.
5. Store the key only in local `.env` as `OPENAI_API_KEY`; do not paste it into frontend code, screenshots, commits, docs, or chat.
6. Start the backend with `AI_PROVIDER="openai"` and `AI_MODEL="gpt-5.4-mini"`, then ask inside a node and inspect the Run record if needed.

Frontend local development may use `http://localhost:5173` or `http://127.0.0.1:5173`. The backend allows both origins by default; set a comma-separated `CORS_ORIGIN` value when using another Vite port or host.

Frontend runtime configuration:

```bash
VITE_API_BASE_URL="http://localhost:3000/api"
```

Frontend runtime config only points the browser at the backend API. Real provider secrets and real provider/model selection stay on the backend; the frontend must not receive or store `OPENAI_API_KEY`, and `VITE_*` values must not be used as a trust boundary for paid model execution.

`npm run db:up` starts the local Docker PostgreSQL service. It maps container port `5432` to host port `15432` to avoid colliding with common local PostgreSQL installs.

`npm run db:ensure:test` creates `knowflow_test` if an existing Docker volume was initialized before the test database existed.

`npm run prisma:validate`, `npm run db:migrate`, `npm run db:migrate:test`, and `npm run test:integration` use local fallback database URLs if environment variables are not set. Applying migrations and running integration tests still require a reachable PostgreSQL instance.

`npm run test:acceptance` starts the local PostgreSQL service, applies test migrations, and runs the Playwright v0 core workflow acceptance test against isolated backend and frontend ports. Run `npx playwright install chromium` once before the first local acceptance test run.

## Open Questions

- No open architecture questions remain from the initial architecture-decision list.
