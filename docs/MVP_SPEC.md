# KnowFlow MVP Specification

Initial date: 2026-04-30

## Confirmed MVP Principle

Do less, but structure the core correctly.

The MVP must prove the core learning workflow without becoming throwaway code. It should be a thin vertical slice with clean boundaries around graph state, messages, highlights, AI runs, and context construction.

## MVP v0: Smallest Useful Version

### Phase 1 Backend Foundation Status

Implemented in Phase 1:

- Root-level NestJS + TypeScript backend foundation.
- Prisma + PostgreSQL schema and initial migration for User, Project, Graph, Node, Edge, Message, Highlight, Run, and ContextSnapshot.
- Basic REST CRUD boundaries for the Phase 1 domain entities.
- Message, Highlight, and ContextSnapshot create/read/delete boundaries only, preserving the v0 immutability decision.
- Durable Run records as data records only; no AI provider call is implemented yet.
- Build, Prisma validation, and module compile smoke test commands.
- Local Docker Compose PostgreSQL bootstrap for dev and test databases.
- Prisma migration application verified against local `knowflow` and `knowflow_test` databases.
- Integration test that creates User, Project, Graph, Node, Message, Highlight, Edge, Run, and ContextSnapshot through HTTP API boundaries.
- Transactional branch-from-selection backend command.
- Integration tests for branch-from-selection success and invalid-selection failure without partial branch records.
- Provider-neutral AI adapter interface with a local deterministic `stub` provider.
- Non-streaming run execution endpoint backed by durable Run status transitions.
- ContextBuilder v0 service that prepares provider messages from the current node thread, selected branch text, and ancestor branch references.
- Run execution now creates or refreshes the run's `ContextSnapshot` before calling the provider.
- OpenAI provider adapter using the Responses API, with default real model `gpt-5.4-mini` and mocked unit coverage.

Not implemented in Phase 1:

- Export/import.

### Phase 2 Frontend Foundation Status

Started in Phase 2:

- Vite React + TypeScript frontend package.
- React Flow canvas adapter for rendering domain nodes and edges.
- Frontend domain API client for projects, graphs, nodes, and edges.
- Minimal workspace manager for switching, creating, and editing projects and graphs through existing CRUD boundaries.
- Active project and graph selection persisted with URL query parameters and localStorage for local/demo use.
- Union Find / Path Compression demo seeding happens only when no project exists.
- Manual node creation.
- Manual edge creation.
- Node movement with layout persistence.

Not implemented in Phase 2:

- AI chat UI.
- Text selection and branch UI.
- Authentication.
- Collaboration.
- Export/import.

### Phase 3 Conversation UI Status

Started in Phase 3:

- Selected-node conversation panel in the React frontend.
- Message loading for the selected conversation node.
- User message creation from the frontend.
- Non-streaming Run creation and execution through the existing provider-neutral backend API.
- Local frontend defaults to `provider = stub` and `model = stub-tutor-v0` so the UI can be exercised without an API key.
- Assistant-message text selection in the conversation panel.
- Branch action that calls the transactional `POST /api/branches/from-selection` backend command.
- Graph refresh and automatic child-node selection after a branch is created.
- Context chip for a child branch showing the selected text that created the branch.
- Visual highlight rendering for persisted branch selections when viewing the source message.
- Canvas nodes show recent conversation message previews instead of title-only cards.
- Selected canvas nodes expand into an inline conversation view with ChatGPT-like user bubbles and full-width assistant responses.
- Users can ask follow-up questions directly inside the expanded canvas node.
- Users can delete nodes from the canvas through a visible node action, and keyboard deletion must call the backend delete boundary rather than only removing local React Flow state.
- Assistant-message text can be selected and branched directly inside the expanded canvas node.
- New selections are highlighted in place and show a compact Branch action beside the selected text.
- After branching, the source node remains expanded so the persisted highlight and outgoing branch edge stay visually connected.
- Branch edges anchor to inline highlight spans in expanded source nodes, with stable highlight-chip anchors as the collapsed-node fallback.
- Collapsed nodes show only the node title, node summary, and branch-points list. Conversation messages, inline highlights, edit controls, and ask/branch controls belong in the expanded node.
- Collapsed branch-point lists should keep normal chip sizing and spacing from top to bottom. If the current node size cannot fit the list, the branch-point region scrolls; resizing the node larger should reveal more chips without stretching the gaps.
- Persisted branch highlights and collapsed branch-point chips can be clicked to jump to connected child nodes. If one highlight has multiple child branches, the UI must show a compact target picker instead of silently jumping to the first child.
- Selecting or jumping to a focused node should center it in the canvas at a readable zoom level, while branch creation can still fit both source and child into view.
- Clicking a persisted inline highlight opens a compact menu with existing child branches and a "new branch from this highlight" action. Additional branches from the same selected text must reuse the existing `Highlight` record instead of duplicating it.
- Inline highlight action menus should render as floating overlays above the canvas so they are not clipped by node scroll boundaries.
- Persisted highlights use deterministic accent colors. Branch edges and child branch nodes inherit the same color so the provenance path is visually traceable without requiring a user color picker in v0. Highlights with no branch target should not render as branch highlights in v0.
- Expanded branch context is collapsed by default and opens on demand so selected source text is inspectable without dominating the node. Auto-generated selected text should not be duplicated as node summary; summary is reserved for user-authored node notes.
- Expanded node message scrolling and collapsed branch-point scrolling must refresh visible highlight state. Branch edges should render only when their source highlight or branch-point chip is visible in the node viewport; hidden-source branch edges should be temporarily omitted rather than pointing into empty scroll space.
- Dragging a node should move it without expanding it; clicking opens the expanded node.
- New nodes should be created near the current visible canvas center, not at a fixed global graph coordinate.
- Collapsed and expanded nodes can be resized from their borders, and resized dimensions are stored in node layout metadata.
- Node title and summary editing from the frontend, saved through the backend node update boundary.
- Manual edges can be created only between collapsed node-level handles and labeled as lightweight peer relationships. Collapsed nodes expose handles on all four sides so manual links are not limited to left-in/right-out placement. Manual edges are undirected by default, editable, and deletable. Branch points are reserved for branch navigation, not manual connection starts, and branch edge labels remain tied to selected source text.
- Manual edge gestures can start from any collapsed node side handle and end on any other collapsed node side handle. The frontend normalizes the gesture into a node-level peer relationship instead of treating the dragged handle direction as semantic graph direction.
- Branch edge labels inherit the source highlight color, matching the highlight and child branch node. Branch edges should target the nearest side of the child node. Edge visibility should follow a focus-plus-context rule: edges related to the currently focused node are emphasized; unrelated edges are dimmed and their labels are hidden so dense graphs remain readable. Focused branch edges may use lightweight obstacle-aware routing around other node cards when a direct curve would be hidden by overlapping nodes. Manual edges and non-focused branch edges can keep simple bezier routing in v0.
- Temporary text selections that have not been branched yet should clear when the user clicks outside the selected assistant message or inline Branch action.
- The right sidebar acts as a secondary read-only inspector instead of the primary ask/branch surface.
- Node deletion uses an in-app confirmation dialog instead of the browser's native confirm prompt.
- Expanded nodes should use readable conversation-scale typography; collapsed nodes remain compact scan cards.
- Resized collapsed nodes should let the branch-point list use the available vertical space instead of pinning all branch points to the top with excessive empty space below.

Not implemented in Phase 3:

- Markdown rendering beyond plain selectable text display.
- Run retry, cancellation, or streaming.
- Real-provider model selection UI.
- Batched highlight loading.
- Context chip controls for adding or removing graph context.
- Pixel-perfect inline edge anchors inside rich Markdown and code-block rendering.

### Included Features

- Single-user local/demo usage.
- Project and graph creation.
- One or more graphs per project.
- Conversation nodes on a visual canvas.
- Manual node movement and saved layout.
- Manual edges between nodes.
- User messages and AI responses stored as ordered messages.
- AI response displayed inside the same node by default.
- Text selection inside AI messages.
- Branch action from selected text.
- Child conversation node created from the selected text.
- Branch edge from source node to child node.
- Non-streaming AI responses first.
- Durable `Run` or `AIRequest` record for each AI call from day one.
- Provider-neutral AI adapter from day one.
- Simple context builder:
  - current node thread,
  - selected text when branching,
  - short ancestor path summary or references.
- `ContextSnapshot` stores references, `selectedTextSnapshot`, `tokenEstimate`, `promptTemplateVersion`, and `contextPolicyVersion` by default.
- Node title and summary editing.
- Basic error state for failed AI calls.

### Excluded Features

- Authentication.
- Real-time collaboration.
- CRDT or operational transform editing.
- Project-level RAG.
- File uploads.
- Graph splitting.
- Graph-link nodes.
- Export/import.
- Complex auto-layout.
- Mobile support.
- Template marketplace.
- Advanced permission system.
- Microservices.
- Production-grade observability stack.
- Streaming AI responses.
- Message editing.

### Acceptance Criteria

- A user can switch between existing projects and existing graphs from the workspace header.
- A user can create a new project and receive a blank starter graph for that project.
- A user can create a new graph inside the active project.
- A user can edit the active project title, active project description, and active graph title.
- The active project and graph survive browser refresh through URL query parameters and localStorage.
- If the requested project or graph no longer exists, the UI falls back to a valid project and graph.
- The Union Find / Path Compression demo project and graph are seeded only when the backend has no projects.
- A user can create a project and graph.
- A user can create a root conversation node.
- A user can ask AI a question inside the node.
- The AI response is saved as a message in that node.
- A user can select text in the AI response inside the canvas node and create a child node from a compact inline Branch action.
- The selected text is persisted as a `Highlight` or `TextSelection`.
- The child node is connected by a branch edge that visually originates from the persisted highlight when the source node is expanded.
- If the user creates another branch from an existing persisted highlight, the backend reuses the same `Highlight` and creates a new child node, branch edge, run, and context snapshot atomically.
- The child node shows or receives the selected text as context.
- AI runs have visible success or failure status.
- The graph remains usable for at least 30 conversation nodes in a v0 performance fixture.

### Branch-From-Selection Acceptance Test

Given a graph with a parent conversation node containing an AI message, when the user selects a text range inside that AI message and clicks Branch, then the system creates a `Highlight`, child `Node`, `Edge`, `selectedTextSnapshot`, and initial child context atomically.

All created records must persist after refresh. If any part fails, the operation must roll back.

### Allowed Shortcuts

- Single-user mode with a placeholder or local user.
- Synchronous, non-streaming AI calls if the `Run` lifecycle is still persisted.
- Markdown-rendered messages instead of full rich-text editing.
- Immutable messages in v0; only node title and summary may be edited.
- Manual node layout with simple child-node placement.
- Basic context summaries instead of retrieval.
- No export/import in v0; design the model so versioned export/import can start in v1.

### Dangerous Shortcuts

- Storing all node content as one unstructured text blob.
- Building prompts directly inside React components.
- Calling an LLM provider directly from canvas components.
- Storing highlights only as raw selected strings.
- Treating React Flow node and edge types as the backend domain model.
- Skipping durable run state for AI requests.
- Storing full rendered prompts in `ContextSnapshot` by default.
- Adding streaming before the core branch workflow works.
- Creating source folders or installing dependencies before the docs and scope are accepted.

### Refactor Triggers

- AI calls exceed normal HTTP request timeout expectations.
- Users need retries, cancellation, or queued AI runs.
- Graphs above 50-100 nodes become slow or visually confusing.
- Text highlights break after message edits.
- Users ask to include external documents as context.
- Token usage becomes unpredictable or expensive.

## MVP v1: Strong Demo Version

### Included Features

- Multiple graphs per project.
- Context chips showing what the AI is using.
- Better node collapse, expand, and focus-path behavior.
- Search across graphs, nodes, and messages.
- Versioned KnowFlow JSON export/import.
- Onboarding sample graph for learning Union Find / Path Compression for coding interviews.
- Improved AI error handling with retry.
- Token estimates or basic token usage tracking.
- Basic graph-level summaries or node summaries.

### Excluded Features

- Real-time collaboration.
- Enterprise permissions.
- Full RAG pipeline.
- Graph splitting as a primary workflow.
- Full mobile experience.
- Template marketplace.
- Complex automatic layout engine.
- Streaming AI responses unless the core branch workflow is already stable.

### Acceptance Criteria

- A demo user can understand the product in under 3 minutes.
- The Union Find / Path Compression seeded graph makes the branch-from-selection workflow obvious.
- Context chips make AI behavior understandable.
- Exported data can be imported without losing graph, node, edge, message, highlight, and run references.
- A user can recover from common AI failures without losing work.

### Allowed Shortcuts

- Internal export format before interoperability formats.
- Simple graph search before semantic search.
- Simple summaries before embedding-based retrieval.
- Basic metrics visible in development or admin views.

### Dangerous Shortcuts

- Adding RAG before the core branch workflow is validated.
- Adding collaboration before single-user persistence is reliable.
- Adding many node types before conversation nodes feel excellent.

### Refactor Triggers

- Users repeatedly ask to attach sources.
- Users create many related graphs and need graph links.
- Manual layout becomes a barrier during demos.
- Context chips are ignored or misunderstood.

## Later Advanced Scope

- Graph-link nodes.
- Split part of a graph into a new graph.
- Project-level retrieval and source grounding.
- File uploads.
- Team collaboration.
- Permissions and sharing.
- Async background AI workers.
- Streaming responses with robust partial persistence.
- Advanced layout and clustering.
- Templates for interview prep and CS topics.
- Analytics for learning progress.
- Mobile or tablet-specific experience.

## Known Risks

| Risk | MVP Mitigation |
| --- | --- |
| Canvas clutter | Keep node types few, add collapse/focus behavior in v1. |
| Rich-text selection complexity | Start with selectable rendered Markdown AI messages. |
| Context explosion | Limit automatic context to current node, selected text, and ancestor path summary. |
| User confusion | Keep branch action explicit and visually connected to selected text. |
| Provider lock-in | Use provider adapter from the first AI integration. |
| Cost growth | Track model and token estimates per run. |
| Persistence inconsistency | Use transactions for branch creation. |

## v0 Performance Fixture

The v0 graph performance check should use at least:

- 30 conversation nodes.
- About 40 branch/manual edges.
- About 120 messages total.
- Representative highlights, runs, context snapshots, and saved layout metadata.

This is intentionally above the 10-20 node product-success range but below the 50-100 node refactor trigger.

## Open Questions

- No open MVP scope questions remain from the initial architecture-decision list.
