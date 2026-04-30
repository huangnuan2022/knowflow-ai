# KnowFlow Technical Debt

This file tracks intentional shortcuts. Future implementation tasks must add any new shortcut here with a reason, risk, refactor trigger, and future improvement.

## Confirmed Temporary Shortcuts

| Shortcut | Reason | Risk | Refactor Trigger | Future Improvement |
| --- | --- | --- | --- | --- |
| No authentication in v0 | The first proof is product workflow, not identity. | Single-user assumptions may leak into code. | Sharing, accounts, or user-specific persistence becomes necessary. | Add auth and ownership checks behind existing User/Project model. |
| Synchronous, non-streaming AI calls in v0 | Faster to build the first vertical slice while durable Run records preserve lifecycle state. | Slow requests can time out or create poor UX; no token-by-token feedback. | Runs exceed request timeouts, users need retry/cancel behavior, or the branch workflow is stable enough to add streaming. | Add queue-backed workers and async or streaming run processing. |
| Markdown-rendered messages | Selection and branching matter more than rich editing. | Rich annotations and edits are limited. | Users need robust editing, comments, or mixed media. | Adopt Tiptap, ProseMirror, or Lexical with stable highlight anchors. |
| No full rich-text editor | Avoid early editor complexity. | Highlight anchoring may need rework if editing arrives later. | Message editing becomes core to learning workflows. | Introduce versioned document model and anchor migration. |
| Immutable messages in v0 | Keeps highlight offsets, context snapshots, and AI run history trustworthy. | Users cannot fix old prompts or clean up AI output. | Users need to edit conversation content without breaking highlights. | Add versioned message edits and anchor migration. |
| Manual layout | Auto-layout can distract from the core learning flow. | Large graphs can become messy. | Users create graphs above 50-100 nodes or complain about organization. | Add simple layout suggestions, clustering, or focus-path views. |
| No collaboration | Collaboration requires conflict resolution and permissions. | Later collaboration may require model changes. | Users need shared study graphs or instructor feedback. | Add sharing, permissions, and eventually CRDT/OT only when justified. |
| No export/import until v1 | v0 should prove the branch workflow before investing in portability. | Users cannot back up or move graphs through the UI in v0. | Users ask for backup, migration, or external canvas import. | Define versioned KnowFlow export and optional JSON Canvas mapping. |
| No project-level RAG | Retrieval adds infrastructure and trust complexity. | AI may miss relevant project context. | Users upload sources or expect graph-wide context. | Add embeddings over messages, summaries, and uploaded sources. |
| Simple ContextBuilder v0 policy | Full graph context would explode token usage, so v0 uses current node messages, selected text, and a short inbound branch path. | It may miss useful neighboring nodes, and ancestor context is represented as references/snippets rather than rich summaries. | Users see irrelevant or incomplete AI answers, or graphs with deeper branch paths need better context. | Add user-controlled context selection, richer context summaries, and graph-neighborhood or retrieval context. |
| Rough token estimates | A simple character-based estimate is enough before selecting the real model/provider tokenizer. | Cost and truncation estimates may be inaccurate. | A real provider adapter is selected or token budgets start affecting user-visible behavior. | Use provider/model-specific token counting behind the context builder or provider adapter. |
| Do not store full rendered prompts by default | Reduces privacy risk while preserving references, selected text snapshots, token estimates, and policy/template versions. | Prompt debugging may require reconstruction. | Debugging AI behavior becomes too slow or audit requirements change. | Add explicit privacy-controlled prompt retention for development or opted-in projects. |
| Stub AI provider is non-production | Phase 1 needs deterministic tests and local run lifecycle checks without a real model. | Stub responses can be mistaken for product AI behavior if exposed in UI. | UI or seeded demo work makes provider selection visible to users. | Keep `stub` for tests and local development, but default product demo runs to `openai` when an API key is configured. |
| Frontend conversation panel defaults to `stub` | The local UI needs to exercise the full message and Run lifecycle without requiring a paid provider key. | Early demos may underrepresent the actual tutor quality and confuse users if stub output looks like product behavior. | Sharing the app with anyone outside local development, or adding seeded demo walkthroughs. | Add provider/model selection or backend-owned run defaults that prefer `openai` when configured and clearly fall back to `stub` only for local development. |
| Conversation panel displays plain selectable text | This keeps the first node-thread UI small while preserving selectable content for the branch workflow. | Markdown-specific formatting, code blocks, and selection offsets may need refinement before polished learning demos. | Users ask questions with code snippets, visual formatting affects selection, or branch anchors become hard to trust. | Add a Markdown renderer with stable text-selection anchoring and code-block styling. |
| Branch UI uses browser Selection API over plain text | v0 messages are immutable plain text, so DOM selection offsets can safely map back to message content for the first proof. | Markdown rendering, nested elements, or future message editing can make offsets harder to preserve. | Markdown/code rendering is added, visual highlight rendering is added, or users need editable messages. | Move selection anchoring behind a document model or Markdown AST mapping with versioned anchors. |
| Basic CRUD error handling | Phase 1 focuses on domain boundaries and schema shape. | Foreign-key and unique-constraint failures may surface as generic server errors. | API clients need polished validation errors or user-facing forms begin using these endpoints. | Add Prisma exception mapping and relation-aware validation. |
| Simple message sequence assignment | Phase 1 can assign the next message sequence from the current max sequence. | Concurrent message creation for the same node can hit the unique `(nodeId, sequence)` constraint. | Multiple clients or async AI writes can create messages for the same node concurrently. | Add transaction isolation, retry on unique conflict, or a per-node sequence allocator. |
| Minimal observability | Production monitoring is premature before the core flow exists. | Failures may be harder to diagnose. | More users, costly runs, or reliability issues appear. | Add structured logs, run metrics, SLOs, and cost dashboards. |

## Debt Rules

- A shortcut is acceptable only when it helps prove the MVP without corrupting the domain model.
- A shortcut is dangerous if it couples unrelated layers or hides important state.
- Any shortcut affecting persistence, AI run lifecycle, context construction, privacy, or export format must be recorded here.
- Refactor triggers should be observable, such as graph size, run latency, user confusion, cost, or repeated implementation friction.

## Open Debt Questions

- How long can synchronous AI calls remain acceptable?
- How much message editing can be delayed before highlight anchoring becomes expensive to retrofit?
- When should export/import become mandatory rather than optional?
- What minimum observability is needed before sharing the app with external testers?
