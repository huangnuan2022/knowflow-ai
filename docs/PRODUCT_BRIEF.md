# KnowFlow Product Brief

Initial date: 2026-04-30

## Product Summary

KnowFlow is a graph-based AI tutor workspace for learning complex topics. It turns a linear AI conversation into a persistent visual learning flow where each node is a local conversation thread and each branch represents a focused sub-question.

The core MVP behavior is:

1. Ask AI a question inside a conversation node.
2. Read the AI response inside that same node.
3. Select confusing or important text in the response.
4. Branch that selection into a connected child conversation node.
5. Continue learning with the selected text as explicit context.

KnowFlow should not be positioned as a chatbot with a whiteboard skin. The graph is part of the learning memory and context model.

## Confirmed Decisions

- Product category: graph-based AI tutor workspace.
- First target user: CS learners, software engineers, and technical interview-prep users.
- Strongest wedge: branch from selected AI response text into a contextual child conversation.
- First learning domains: computer science, system design, software engineering, interview preparation, and technical concepts.
- First seeded demo topic: a system design interview graph for designing a URL shortener.
- MVP AI responses: non-streaming first.
- MVP should prove learning-path value before expanding into collaboration, source libraries, or general knowledge management.

## Positioning

KnowFlow is:

- A visual learning workspace.
- A graph of local AI conversation threads.
- A persistent record of how a learner explored a topic.
- A context-aware AI interface where graph structure can influence future responses.

KnowFlow is not:

- A generic chatbot.
- A generic whiteboard.
- A generic mind-map generator.
- A full Miro, FigJam, Obsidian, Heptabase, Scrintal, Logseq, or AFFiNE replacement.
- A source-grounded research assistant as the first wedge.
- A collaboration-first canvas.

## Value Proposition

When an AI answer contains something the user does not understand, the user can select the exact text and branch into a focused child conversation. The original path remains visible, so the learner can see how their understanding evolved.

This is stronger than "AI canvas" because it gives the canvas a specific job: preserving and guiding the learning path.

## First Target User

Primary user:

- A student or early-career engineer learning CS, software engineering, algorithms, system design, cloud concepts, AI concepts, or interview topics.

Why this user:

- They often ask follow-up questions.
- They encounter nested explanations.
- They benefit from seeing prerequisite chains and conceptual branches.
- They can tolerate a structured interface if it helps them learn.
- They provide clear demo scenarios such as "learn database indexes" or "prepare a URL shortener system design."

Secondary later users:

- Researchers exploring technical papers.
- Technical writers mapping complex explanations.
- Educators building guided learning graphs.
- Product or engineering teams exploring unfamiliar domains.

## Core User Journey

1. The user creates a project such as "System Design Interview Prep."
2. The user opens a graph such as "Design a URL Shortener."
3. The user creates or starts from a root conversation node.
4. The user asks, "Explain the URL shortener architecture."
5. AI responds inside the root node.
6. The user selects "consistent hashing" in the response.
7. KnowFlow creates a child node connected to the selected text.
8. The child node includes the selected text as visible context.
9. The user asks follow-up questions in that child node.
10. The graph becomes a visible learning trail.

## Product Success Criteria

MVP success means:

- Users naturally branch from selected AI response text.
- A graph with 10-20 nodes remains understandable.
- Users understand what context the AI used.
- The branching workflow feels faster than opening a new chat.
- The graph helps users return to prior learning paths.
- Users can explain why KnowFlow is different from ChatGPT, NotebookLM, or a whiteboard.

## Non-Goals For MVP

- Real-time collaboration.
- Full project-level RAG.
- File upload workflows.
- Mobile-first experience.
- Complex auto-layout.
- CRDT or operational-transform editing.
- Advanced permission system.
- Template marketplace.
- Graph splitting.
- Enterprise authentication.
- Full source-grounded notebook behavior.

## Product Risks

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| Graph clutter | A messy graph can become worse than chat history. | Start with simple node types, collapse states, focus path, and manual layout. |
| User confusion | Users may not understand when to create a node versus continue a node. | AI responses stay in the same node by default; branching happens only from explicit selected text. |
| Weak differentiation | Many tools already offer AI, canvas, notes, or mind maps. | Keep the branch-from-selection workflow as the center of the MVP. |
| Context unpredictability | Hidden graph context can make AI behavior hard to trust. | Show context chips and save context snapshots for debugging. |
| Overbuilding | Competing with Miro or Obsidian would dilute the first proof. | Keep v0 narrow and document excluded features. |

## Open Questions

- What is the first measurable learning outcome: faster review, better recall, clearer concept map, or more completed study sessions?
- How much manual canvas editing should v0 allow beyond moving nodes and adding manual edges?
