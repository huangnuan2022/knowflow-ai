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

Not implemented in Phase 1:

- Frontend canvas.
- Real AI provider integration.
- Export/import.

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

- A user can create a project and graph.
- A user can create a root conversation node.
- A user can ask AI a question inside the node.
- The AI response is saved as a message in that node.
- A user can select text in the AI response and create a child node.
- The selected text is persisted as a `Highlight` or `TextSelection`.
- The child node is connected by a branch edge.
- The child node shows or receives the selected text as context.
- AI runs have visible success or failure status.
- The graph remains usable for at least 10-20 nodes.

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

## Open Questions

- What minimum graph size should be used as the v0 performance check?
- Which AI provider and model should be used for the first provider-neutral adapter implementation?
