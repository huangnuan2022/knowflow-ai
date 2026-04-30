# KnowFlow Decisions

This file records major product and architecture decisions. Update it whenever a decision changes or a new decision would affect product direction, domain model, architecture, data consistency, privacy, cost, or future implementation.

## Confirmed Decisions

### 2026-04-30: Position KnowFlow As A Graph-Based AI Tutor Workspace

- Decision: KnowFlow is a graph-based AI tutor workspace, not a chatbot with a graph UI.
- Reason: The graph structure should preserve the user's learning path and influence context.
- Tradeoff: This narrows the product and avoids generic whiteboard scope, but it excludes some broader productivity use cases.
- Simpler MVP alternative: A visual chat history.
- Future scalable alternative: Full learning workspace with sources, graph links, retrieval, and progress analytics.
- Revisit trigger: Users do not understand or value branching as part of learning.

### 2026-04-30: Target CS And Technical Learning First

- Decision: The first target users are CS learners, software engineers, and interview-prep users.
- Reason: These users have nested questions, complex concepts, and clear demo workflows.
- Tradeoff: The product may feel less relevant to general note-taking users at first.
- Simpler MVP alternative: Generic "learn anything" positioning.
- Future scalable alternative: Expand to research, education, and professional knowledge work.
- Revisit trigger: User testing shows stronger adoption in a different learning segment.

### 2026-04-30: Make Branch From Selected AI Text The Core Wedge

- Decision: The core MVP workflow is selecting text inside an AI response and branching into a contextual child node.
- Reason: This is the clearest differentiation from chat timelines, whiteboards, mind maps, and note apps.
- Tradeoff: It makes text selection and highlight anchoring technically important early.
- Simpler MVP alternative: Manual child-node creation with copied text.
- Future scalable alternative: Branching from messages, source documents, images, diagrams, and generated summaries.
- Revisit trigger: Users branch rarely or prefer manual graph organization.

### 2026-04-30: AI Responses Stay In The Same Node By Default

- Decision: AI responses should render inside the current node unless the user explicitly branches.
- Reason: A node represents a local conversation thread; automatic new nodes for every AI response would clutter the graph.
- Tradeoff: Nodes can become long and need collapse or summary behavior later.
- Simpler MVP alternative: One node per prompt/response pair.
- Future scalable alternative: Node-level summaries, collapsed threads, and thread navigation inside nodes.
- Revisit trigger: Users cannot scan or manage long node threads.

### 2026-04-30: Use React Flow / xyflow For MVP Canvas Rendering

- Decision: Use React Flow / xyflow as the initial canvas rendering library.
- Reason: KnowFlow is a structured node-and-edge application, which React Flow supports directly.
- Tradeoff: It is less freeform than tldraw or Excalidraw.
- Simpler MVP alternative: Custom absolute-positioned nodes with SVG edges.
- Future scalable alternative: Move to a richer canvas SDK if interaction needs exceed React Flow.
- Revisit trigger: MVP canvas requirements require freehand drawing, complex selection, or richer canvas primitives.

### 2026-04-30: Start With Markdown-Rendered Messages

- Decision: Use Markdown-rendered messages for MVP rather than a full rich-text editor.
- Reason: The MVP already has selection, highlighting, branching, and AI context complexity.
- Tradeoff: Inline editing and complex annotations are limited.
- Simpler MVP alternative: Plain text only.
- Future scalable alternative: Tiptap, ProseMirror, or Lexical if rich editing becomes necessary.
- Revisit trigger: Users need robust editing, annotations, or mixed media inside messages.

### 2026-04-30: Use A Modular Monolith

- Decision: Build the backend as a NestJS + TypeScript modular monolith.
- Reason: Product boundaries are still evolving; microservices would add operational cost before they create value.
- Tradeoff: Modules must be disciplined inside one codebase, and NestJS structure adds some ceremony compared with a minimal server.
- Simpler MVP alternative: One flat backend module or a lighter TypeScript HTTP framework.
- Future scalable alternative: Extract background workers or services when operational pressure justifies it.
- Revisit trigger: AI runs, retrieval, collaboration, or exports require independently scalable processes.

### 2026-04-30: Use Prisma And PostgreSQL With Normalized Core Domain Tables

- Decision: Use Prisma + PostgreSQL and model Project, Graph, Node, Edge, Message, Highlight, Run, and ContextSnapshot as first-class records.
- Reason: These concepts need independent queries, transactions, and future evolution.
- Tradeoff: More upfront schema design than a single JSON graph blob, plus Prisma migration discipline.
- Simpler MVP alternative: Store the whole graph as JSON or use a lighter query builder.
- Future scalable alternative: Add derived indexes, search, embeddings, and event logs around the normalized model.
- Revisit trigger: Query patterns show the schema is too rigid or export/import dominates persistence needs.

### 2026-04-30: Persist Durable AI Run Records From Day One

- Decision: Every AI call should have a Run or AIRequest record, and MVP AI responses are non-streaming first.
- Reason: AI calls can fail, be slow, cost money, and need debugging.
- Tradeoff: More backend lifecycle work before the first AI response appears, and no token-by-token response UX in v0.
- Simpler MVP alternative: Direct request/response with no stored run.
- Future scalable alternative: Queue-backed async jobs with retries, cancellation, and streaming persistence after the core branch workflow works.
- Revisit trigger: Run lifecycle becomes too complex for synchronous request handling, or users need streaming feedback.

### 2026-04-30: MVP Context Builder Uses Current Node, Selection, And Ancestor Path

- Decision: MVP context should include current node messages, selected text, and short ancestor path summary or references. `ContextSnapshot` should store references, `selectedTextSnapshot`, `tokenEstimate`, `promptTemplateVersion`, and `contextPolicyVersion` by default, not full rendered prompts.
- Reason: This makes the graph useful without full project-level retrieval.
- Tradeoff: It may miss useful neighboring nodes, and debugging prompts may require reconstruction from references.
- Simpler MVP alternative: Current node only.
- Future scalable alternative: User-controlled context picker, graph-neighborhood context, summaries, project-level retrieval, and explicit privacy-controlled rendered prompt retention.
- Revisit trigger: Users expect AI to use nearby graph context or uploaded sources, or debugging needs require more context traceability.

### 2026-04-30: Put Export/Import In MVP v1

- Decision: Export/import belongs in MVP v1, not v0. When added, use a versioned KnowFlow export format before attempting JSON Canvas or other interoperability.
- Reason: KnowFlow must preserve messages, highlights, runs, and context metadata that generic canvas formats do not cover.
- Tradeoff: v0 will not have backup/migration workflows beyond the database.
- Simpler MVP alternative: No export in v0.
- Future scalable alternative: Export layout subsets to JSON Canvas while preserving KnowFlow-specific data separately.
- Revisit trigger: Users need migration, backups, or interoperability early.

### 2026-04-30: Use Provider-Neutral AI Adapter From Day One

- Decision: AI run logic depends on a provider-neutral adapter interface from day one.
- Reason: LLM providers differ in request shape, response shape, errors, token accounting, and future streaming support.
- Tradeoff: Adds a small abstraction before multiple providers exist.
- Simpler MVP alternative: Call one provider SDK directly.
- Future scalable alternative: Multiple providers, model routing, fallbacks, and streaming adapters.
- Revisit trigger: Adapter hides provider capabilities the product needs or becomes too generic to debug.

### 2026-04-30: Messages Are Immutable In v0

- Decision: Messages are not editable in v0; only node title and summary may be editable.
- Reason: Immutable messages make highlight offsets, run history, and context snapshots easier to trust.
- Tradeoff: Users cannot correct or reshape old conversation turns.
- Simpler MVP alternative: Editable node title only.
- Future scalable alternative: Versioned message editing with highlight-anchor migration.
- Revisit trigger: Users need message editing to clean up learning nodes or correct AI outputs.

### 2026-04-30: Seed First Demo With Union Find And Path Compression

- Decision: The first seeded demo topic is learning Union Find / Path Compression for coding interviews.
- Reason: It is technical, compact, interview-relevant, and naturally produces branchable subtopics.
- Tradeoff: The demo emphasizes algorithm learning more than system design or research workflows.
- Simpler MVP alternative: No seeded demo.
- Future scalable alternative: Multiple seeded graphs for algorithms, databases, system design, and AI concepts.
- Revisit trigger: User testing shows a different topic explains the product faster.

### 2026-04-30: Branch-From-Selection Must Be Atomic

- Decision: The branch-from-selection acceptance test is: given a graph with a parent conversation node containing an AI message, when the user selects a text range inside that AI message and clicks Branch, then the system creates a Highlight, child Node, Edge, selectedTextSnapshot, and initial child context atomically; all records persist after refresh; if any part fails, the operation rolls back.
- Reason: The branch operation is the core product moment and must not leave dangling graph records.
- Tradeoff: Requires transaction-aware backend design for the first branch implementation.
- Simpler MVP alternative: Create records one at a time from the client.
- Future scalable alternative: Transactional command handler plus audit/event records for graph operations.
- Revisit trigger: Branch operations become multi-step, async, or cross-graph.

## Open Questions

- Which AI provider and model should be used for the first adapter implementation?
- What minimum graph size should be used as the v0 performance check?
- What exact fields should the v1 export format guarantee as stable?
