# Design Document: RAG Studio Redesign (Swiss Modernist 2.0)

**Date:** 2026-07-07  
**Topic:** Redesign of RAG Query Workspace  
**Status:** Approved  

---

## 1. Overview
The `/query` page of the RAG system will be redesigned to transition from a generic, colored dark-theme dashboard to a highly refined **Swiss Modernist 2.0** developer interface. 

### Key Design Pillars
- **Strict Color Control:** Absolute black (`#000000`) and deep charcoal (`#09090b` / `#0c0c0e`) backgrounds, ultra-thin zinc borders (`border-zinc-800`), crisp white text, and a single solid emerald dot (`#10b981`) for connection status. No gradients or cyber neon styling.
- **Vertical Pipeline Telemetry:** Redesign the right-hand panel from a cramped horizontal stepper into a vertical progress timeline with inline node telemetry. This prevents horizontal overflow and scrolling, presenting system logs and telemetry directly under each step.
- **Sleek, Clean Typography:** Utilize standard geometric sans-serif (`Inter`) for readability and monospace (`JetBrains Mono`) for metrics, system logs, code snippets, and active variables.
- **Responsive Workspace Integration:** Proper spacing and fluid layouts that feel integrated, stable, and highly professional.

---

## 2. Layout Architecture
The screen is divided into two primary zones within a full-height container:

```
┌─────────────────────────────────────────────────────────┬────────────────────────────┐
│  RAG Answer Studio (Left Panel: 60-65% width)           │  Telemetry (Right Panel)   │
│  ├─ Grounding Header (Active model & config specs)      │  ├─ Live execution stats   │
│  │                                                      │  │                          │
│  ├─ Chat Scroll Stream (Editorial style, no bubbles)    │  ├─ Vertical timeline nodes│
│  │  ├─ [User] Query                                     │  │  ├─ (Query Input)        │
│  │  └─ [Assistant] Answer & Citation Grid               │  │  ├─ (Embedding)          │
│  │                                                      │  │  ├─ (Pinecone DB)        │
│  │                                                      │  │  ├─ (LLM Generation)     │
│  ├─ Centered Float Input Card                           │  │  └─ (Response Ready)     │
│  │  └─ Character counter, top-K selection, send button  │  └─ live event log stream  │
└─────────────────────────────────────────────────────────┴────────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Chat Interface (`ChatInterface.tsx`)
- **Developer Empty State:** 
  - Centered info panel displaying active pipeline parameters (e.g. `Embedding: NV-EmbedQA-E5-v5`, `Retrieval Strategy: Vector similarity Top-K`, `Re-ranker: NIM Llama-Rerank`, `LLM: Llama-3.3-70B`).
- **Editorial Message Stream:**
  - Messages will not use colored speech bubbles.
  - User query has a bold monospace prefix `[USER]` and a clean, high-contrast white text layout.
  - Assistant response has a bold monospace prefix `[ASSISTANT]`, displaying markdown-rendered text beautifully.
  - Citations (Sources) will be rendered as sleek cards below the answer, with a solid `#09090b` background, `border-zinc-850`, and a simple Cosine Similarity percentage metric.
- **Floating Input Panel:**
  - A clean textarea with a thin border (`border-zinc-800`).
  - Simple controls: `Top-K` selector (as a clean borderless text selector) and a solid white action button with a standard send icon.

### 3.2 Vertical Pipeline Visualizer (`QueryVisualizer.tsx`)
- **Vertical Steps:**
  - Instead of horizontal boxes, steps run vertically down the screen.
  - Each step contains:
    - Left side: A clean, rounded icon box. Idle steps have dark borders; active steps have a solid white border and a simple loading spinner; completed steps have a dark border with a solid checkmark.
    - Right side: Step title, active status description, and real-time inline metadata (e.g. latency, token usage, Pinecone similarity score ranges).
  - Solid vertical line connects the steps, filling from top to bottom as the stages progress.

### 3.3 Event Log (`EventLog.tsx`)
- **Sleek Logs Console:**
  - Placed at the bottom right.
  - Features an expandable/collapsible bar with a simple Chevron.
  - Log entries are presented as high-contrast green/zinc text lines in `JetBrains Mono` with timestamp prefixes.

---

## 4. Next Steps
1. Create a detailed implementation plan.
2. Refactor components in order:
   - `EventLog.tsx`
   - `QueryVisualizer.tsx`
   - `ChatInterface.tsx`
   - `Query.tsx`
3. Verify styles in tailwind config and check layout responsiveness.
