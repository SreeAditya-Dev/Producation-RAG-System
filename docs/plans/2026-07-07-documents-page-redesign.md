# Design Document: Documents Page Redesign (Split Master-Detail Layout)

## 1. Overview
The goal of this redesign is to update the `/documents` page of the RAG System to follow an **Ultra-Minimalist (Linear/Vercel style)** aesthetic. The interface will prioritize layout precision, clean typography (stark white on dark backgrounds), razor-thin borders, and high space efficiency.

## 2. Layout Architecture (Split Master-Detail)
The layout will use a split grid on desktop screens to balance control elements with the document inventory list:

```
+-------------------------------------------------------------------------------+
| Header: Document Control                   [ Search Input ] [Refresh] [Reset] |
+---------------------------------------------------+---------------------------+
| Control Center (35% width)                        | Inventory (65% width)     |
|                                                   |                           |
| +-----------------------------------------------+ | +-----------------------+ |
| | [Drag & Drop Dropzone]                        | | | Documents Table       | |
| | PDF, DOCX, TXT, MD                            | | |                       | |
| +-----------------------------------------------+ | | Name  Size  Status    | |
|                                                   | | --------------------- | |
| +-----------------------------------------------+ | | doc1  12KB  [Ready]   | |
| | Ingestion Pipeline (Vertical)                 | | | doc2  44KB  [Parsing] | |
| | [o] Upload (Complete)                         | | +-----------------------+ |
| | [o] Parsing (Active)                          | |                           |
| | [ ] Chunking (Pending)                        | |                           |
| | [ ] Embedding (Pending)                       | |                           |
| | [ ] Storage (Pending)                         | |                           |
| +-----------------------------------------------+ |                           |
+---------------------------------------------------+---------------------------+
```

### Components

#### 1. Page Header Toolbar
*   **Search Bar**: A sleek input field with a fine `border-zinc-800` border, a search icon, and a keyboard shortcut hint (`Ctrl K` style).
*   **Controls**: Monochromatic buttons for query refetching and UI reloading.

#### 2. Drag & Drop Dropzone (`DocumentUpload.tsx`)
*   Stark dashed boundary (`border-dashed border-zinc-800` changing to `border-white` on hover/drag).
*   Upload progress depicted as a thin 2px progress bar that animates from left to right.
*   Minimalistic status badges instead of large colorful callout boxes.

#### 3. Vertical Pipeline Visualizer (`PipelineVisualizer.tsx`)
*   A clean vertical step layout replacing the wide horizontal timeline.
*   Connecting tracks styled as `w-[1px] bg-zinc-800` lines.
*   Active state will have an elegant spinning loader and a glowing line indicator.
*   Step badges are simple numbered labels (`01`, `02`, etc.) in JetBrains Mono.

#### 4. Document List / Table (`DocumentList.tsx`)
*   Formatted as a structured table with high-contrast rows.
*   Row hovers use `bg-zinc-900/40` and transition borders smoothly.
*   Status badges:
    *   `Ready`: A solid emerald dot with a dark green border pill.
    *   `Processing`: An amber spinner dot with an amber border pill.
    *   `Error`: A solid red dot with a red border pill.
*   Actions (such as deleting) fade in on hover to reduce visual clutter.

## 3. Styling Token Dictionary
*   **Backgrounds**: Stark `#09090b` for layout, `#09090b` (flat panels) with `#18181b`/`#27272a` borders.
*   **Borders**: `border-zinc-800` (1px, high contrast).
*   **Colors**: 
    *   Text: Stark White (`#ffffff`), secondary grey (`#a1a1aa`), muted grey (`#71717a`).
    *   Accent: Amber/Orange (`#F4831F`) reserved strictly for active processing states.
*   **Typography**: Inter for standard elements; JetBrains Mono for counts, sizes, status tags, and telemetry metrics.

## 4. Implementation Steps
1.  Update `Documents.tsx` to handle the grid layout, search filtering state, and layout wrappers.
2.  Redesign `DocumentUpload.tsx` with clean dropzone styles, progress trackers, and minimalist upload alerts.
3.  Redesign `PipelineVisualizer.tsx` to support a vertical flow, complete with vertical connector tracks and animated progress states.
4.  Redesign `DocumentList.tsx` as a sleek document table, incorporating inline search filtering and hover action triggers.
