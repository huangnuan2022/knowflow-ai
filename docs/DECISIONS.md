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

### 2026-04-30: Make Canvas Nodes The Primary Conversation Surface

- Decision: Selected canvas nodes should expand into an inline conversation surface where users can read messages, ask follow-up questions, highlight assistant text, and branch from that selection. Remove the right sidebar inspector from v0 and let the expanded node act as the focused reader, with a lightweight maximize/restore control.
- Reason: KnowFlow's product wedge is visual learning flow. If the user must leave the canvas to ask, branch, or read comfortably, the app feels like a chatbot with a decorative graph rather than a graph-based tutor workspace. The sidebar also duplicated node rendering and introduced fragile scroll synchronization.
- Tradeoff: Expanded nodes need more careful size, focus, and canvas-overlap behavior, and users lose a secondary reading pane in v0.
- Simpler MVP alternative: Keep all conversation and branching actions in a right-side panel.
- Future scalable alternative: Multiple node display modes, focus-path reading, progressive message virtualization, and an optional secondary reader that does not require live bidirectional scroll sync.
- Revisit trigger: Users find expanded nodes too cluttered, need side-by-side reading, or canvas performance suffers before the 30-node v0 fixture.

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

### 2026-04-30: Seed First Demo With A URL Shortener System Design Scenario

- Decision: The first seeded demo topic is designing a URL shortener for a system design interview. The backend creates a deterministic persisted demo with a `System Design Prep` project, `Design a URL Shortener` graph, a fixed root prompt and assistant answer, and branchable highlights for short-code generation, database schema, cache-aside strategy, redirect latency, rate limiting, and analytics.
- Reason: The URL shortener scenario is interview-relevant, naturally graph-shaped, and better demonstrates KnowFlow's learning-path value across multiple architecture subtopics than a single algorithm walkthrough.
- Tradeoff: The demo is hand-authored rather than generated live by AI, so it is less spontaneous but far more stable for local setup, testing, and reviewer demos.
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

### 2026-04-30: Reuse A Highlight For Multiple Branches From The Same Text

- Decision: If the user branches again from an existing persisted highlight, reuse the same `Highlight` record and create another child node, branch edge, run, and context snapshot.
- Reason: The highlighted text is the provenance anchor. Reusing it keeps the data model clean and makes it clear that multiple child conversations came from the same source selection.
- Tradeoff: The UI needs a small highlight menu with existing branches and a new-branch action instead of a single click-to-jump behavior.
- Simpler MVP alternative: Duplicate the highlight each time the user branches from the same text.
- Future scalable alternative: A richer per-highlight branch list with branch names, summaries, ordering, and optional grouping.
- Revisit trigger: Users expect different branches from the same text to have independent anchors or per-branch highlight metadata.

### 2026-04-30: Use Deterministic Branch Colors Before User Color Controls

- Decision: Persisted highlights get deterministic accent colors, and branch edges plus child branch nodes inherit the source highlight color. Do not add a user color picker or generic highlight-only tool in v0.
- Reason: Color makes provenance easier to scan, but manual color tools would expand KnowFlow toward generic annotation and note-taking before the branch workflow is stable.
- Tradeoff: Users cannot assign semantic colors manually yet, and repeated colors can appear once the palette is exhausted.
- Simpler MVP alternative: Use one yellow highlight color for all branch points.
- Future scalable alternative: Add user-selectable highlight colors, named categories, and palette controls if users use colors to organize learning concepts.
- Revisit trigger: Users confuse branches with the same color, request semantic color coding, or a graph has enough highlights that deterministic palette reuse becomes noisy.

### 2026-04-30: Keep Manual Edges Separate From Branch Edges

- Decision: Manual node-to-node edges are lightweight peer relationships between node-level handles in either collapsed or expanded node states. They may have editable labels and delete controls. They should not originate from branch highlights or branch-point chips.
- Reason: Manual relationships and branch provenance mean different things. Mixing them would make it unclear whether an edge represents a selected-text learning fork or a user-authored association.
- Tradeoff: Manual linking is less expressive than freeform edge drawing from arbitrary text spans.
- Simpler MVP alternative: Disable manual edges until branching is polished.
- Future scalable alternative: Add richer relationship types, line styles, and explicit semantic edge categories after the graph model proves useful.
- Revisit trigger: Users need more explicit relationship modeling, or manual edges create confusion with branch edges during user testing.

### 2026-04-30: Use Backend-Owned OpenAI Responses API Defaults With GPT-5.4 Mini

- Decision: The first real AI adapter should be `provider = openai` using the OpenAI Responses API with default `model = gpt-5.4-mini`. Backend environment variables own provider/model defaults through `AI_PROVIDER` and `AI_MODEL`; the frontend does not decide whether paid provider execution is enabled. Keep the existing `stub` provider with `stub-tutor-v0` for deterministic local tests. Allow `gpt-5.4-nano` only as a manual lower-cost OpenAI setting, not an automatic fallback.
- Reason: KnowFlow's v0 needs many short tutor turns, branch follow-ups, and bounded graph context. OpenAI's model docs identify `gpt-5.4-mini` as a smaller model suitable for lower-latency, lower-cost workloads, while `gpt-5.4-nano` is better suited to simpler classification, extraction, or routing-style tasks. Source checked 2026-04-30: https://developers.openai.com/api/docs/models/gpt-5.4-mini and https://developers.openai.com/api/docs/models/gpt-5.4-nano/.
- Tradeoff: Backend-owned defaults are less flexible than a visible model picker, and `gpt-5.4-mini` is not the highest-quality model for every difficult CS/system-design explanation.
- Simpler MVP alternative: Keep only the local `stub` provider or call one OpenAI model directly from `RunsService`.
- Future scalable alternative: Per-project or per-run model routing with stronger models for harder explanations, fallback providers, eval-based model selection, and async streaming after the core workflow works.
- Revisit trigger: User testing shows weak explanations, token costs exceed expectations, OpenAI pricing/availability changes, users need visible model controls, or provider-neutral adapter behavior becomes too constrained.

### 2026-04-30: Use 30 Nodes As The v0 Graph Performance Check

- Decision: v0 should pass a minimum performance fixture of 30 conversation nodes, about 40 edges, about 120 messages, and representative highlights, runs, context snapshots, and layout metadata.
- Reason: Product success starts around 10-20 nodes, but engineering should test above that range to leave margin without optimizing prematurely for 100+ node graphs.
- Tradeoff: This does not prove large-graph scalability; it only proves the MVP remains usable for realistic early learning sessions.
- Simpler MVP alternative: Test only the 10-20 node demo graph.
- Future scalable alternative: Add generated 100+ node benchmarks, graph virtualization, selective message loading, summary-first node rendering, and backend aggregate graph-loading endpoints.
- Revisit trigger: A 30-node graph feels cluttered or slow, users create 50-100 node graphs, or canvas/API loading becomes a visible demo problem.

### 2026-04-30: Define A Versioned KnowFlow v1 Export Format

- Decision: v1 export/import should use an internal, versioned KnowFlow JSON format before attempting JSON Canvas compatibility. Stable top-level fields should include `format`, `version`, `exportedAt`, `sourceAppVersion`, `project`, `graphs`, `nodes`, `edges`, `messages`, `highlights`, `runs`, `contextSnapshots`, and `metadata`.
- Reason: KnowFlow must preserve conversation threads, branch highlights, AI run state, context references, and layout metadata. Generic canvas formats cannot represent that full learning memory safely.
- Tradeoff: The export is more verbose and less interoperable than a generic canvas export.
- Simpler MVP alternative: No export/import in v0, or a database dump for local development only.
- Future scalable alternative: Add partial graph export, JSON Canvas layout export, encrypted exports, import conflict resolution, and migration scripts between export versions.
- Revisit trigger: Users need interoperability with Obsidian Canvas, exports leak too much sensitive content, or v1 import cannot round-trip graph, message, highlight, run, and context references.

## Open Questions

- No open questions remain from the initial architecture-decision list.
- Product research questions remain in `docs/PRODUCT_BRIEF.md` and competitive direction questions remain in `docs/COMPETITIVE_REVIEW.md`.
