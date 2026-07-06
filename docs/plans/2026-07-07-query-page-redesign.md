# Design Document: Query Page Redesign (Monochromatic Border-Only Console)

## 1. Overview
The goal of this redesign is to update the `/query` page of the RAG System to follow an **Ultra-Minimalist (Linear/Vercel style)** aesthetic. We will remove all bright colors, neon glows, and gradient assets. The layout will rely on razor-thin borders, greyscale text states, and high space efficiency.

## 2. Layout Architecture (Monochromatic Split-Pane Console)
The layout maintains the two-column split structure but flattens the panels:

```
+-----------------------------------------------------------------------------------+
| Left Panel: Chat Interface (Flexible Width) | Right Panel: Telemetry (460px-500px) |
|                                            |                                      |
| +----------------------------------------+ | +----------------------------------+ |
| | Messages Stream                        | | | RAG Pipeline Visualizer         | |
| |                                        | | | [o] Query                        | |
| | User: What is chunking?                | | | [o] Embed (Active)               | |
| | Assistant:                             | | | [ ] Pinecone                     | |
| |   • Text chunks segments...            | | | [ ] Retrieve                     | |
| |                                        | | | [ ] Rerank                       | |
| |   [01] doc1.pdf · (Score: 92%)         | | | [ ] LLM                          | |
| |                                        | | |                                  | |
| +----------------------------------------+ | +----------------------------------+ |
| | Text Area              [top 5] [Send]  | | | Collapsible Event Log (Log list)| |
| +----------------------------------------+ | +----------------------------------+ |
+-----------------------------------------------------------------------------------+
```

### Components

#### 1. Chat Interface (`ChatInterface.tsx`)
*   **Message Bubbles**: Replaced with flat message containers with clean `border border-zinc-850` / `border-zinc-800` borders and subtle alignments.
*   **Typography**: Stark white (`#ffffff`) for bot answers, zinc (`#a1a1aa`) for body paragraphs, and JetBrains Mono for code text (no orange code tags).
*   **Source Citations**: Rendered as flat card rows with a simple numeric prefix `[01]` and greyscale score percentages.
*   **Input Box**: Redesigned textarea with a thin border and greyscale query settings (topK selection).

#### 2. Query Pipeline Flow (`QueryVisualizer.tsx`)
*   **No Glows / Animations**: Replaced `node-glow` and particle glow systems with crisp monochromatic states.
*   **Horizontal Stepper**: Refactored to represent stages cleanly with monochrome outlines and status indicators (simple spinning loader or check dots).
*   **Details Panel**: Styled with thin borders (`border-zinc-800`) and flat backgrounds (`bg-zinc-950`).

#### 3. Live Event Stream (`EventLog.tsx`)
*   **Collapsible State**: Enabled via a toggle button in the header that collapses the log height from `200px` to `40px` (minimized) to maximize the pipeline visualization area.
*   **Event Text**: Stark monospace console text with greyscale category markers instead of bright color tags.

## 3. Styling Token Dictionary
*   **Backgrounds**: Stark `#09090b` for layout, `#0c0c0e`/`#09090b` for panel grids.
*   **Borders**: `border-zinc-850` / `#1f1f23` (1px solid lines).
*   **Typography**: Inter for standard layout elements; JetBrains Mono for metrics, latency, data lists, and event streams.
*   **Colors**: Stark white (`#ffffff`), secondary grey (`#a1a1aa`), muted grey (`#71717a`).

## 4. Implementation Steps
1.  Update `Query.tsx` to handle the collapsible Event Log height state (`collapsed` vs `expanded`).
2.  Redesign `ChatInterface.tsx` to clean up message bubbles, markdown text styles, sources layout, and inputs.
3.  Redesign `QueryVisualizer.tsx` to strip all neon glows, gradient particles, and bright orange backgrounds, replacing them with a crisp monochromatic stepper.
4.  Redesign `EventLog.tsx` with a collapse/expand toggle button and a greyscale monospace terminal stream.
