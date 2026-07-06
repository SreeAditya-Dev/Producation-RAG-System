# Implementation Plan: RAG Studio Redesign (Swiss Modernist 2.0)

**Date:** 2026-07-07  
**Topic:** Redesign of RAG Query Workspace  
**Status:** Ready to Implement  

This plan outlines the specific code changes required to implement the approved Swiss Modernist 2.0 design for the `/query` workspace.

---

## Phase 1: Event Log Redesign (`EventLog.tsx`)
- **File:** `frontend/src/components/visualizer/EventLog.tsx`
- **Changes:**
  - Remove borders with color variables.
  - Simplify backgrounds to flat solid colors matching absolute black or dark slate.
  - Use `border-zinc-800` for borders and simple icons.
  - Retain the clean, solid green indicator (`bg-emerald-400`) for the live stream connection.
  - Simplify styles to be clean, monochrome, and compact.

---

## Phase 2: Vertical Pipeline Telemetry (`QueryVisualizer.tsx`)
- **File:** `frontend/src/components/visualizer/QueryVisualizer.tsx`
- **Changes:**
  - Change layout from horizontal stepper row to vertical step sequence.
  - Define a beautiful vertical step layout:
    - Left side: Solid vertical line indicating pipeline progress, and circular or square step nodes.
    - Right side: Step labels, detailed sublabels, and real-time execution telemetry values (e.g. latency, token stats, similarity scores) presented inline.
  - Remove all bright glows, shadows, and gradients.
  - Active stages will show a clean, solid white border and a simple loading spinner.
  - Completed stages will display a simple checkmark with clean slate text.
  - Idle states will stay clean and dark zinc.

---

## Phase 3: Chat Interface Redesign (`ChatInterface.tsx`)
- **File:** `frontend/src/components/query/ChatInterface.tsx`
- **Changes:**
  - Redesign the empty state to show active pipeline information in a structured, clean technical grid.
  - Change the message layout to avoid generic chat bubbles. Make it look like a transcription stream where entries are labelled:
    - `[USER]` in bold monospace for user messages.
    - `[ASSISTANT]` in bold monospace for LLM responses.
  - Format source cards as clean, solid blocks below responses, showing file names and score percentages cleanly.
  - Align text styles with high contrast, and ensure spacing looks spacious and mathematical.
  - Center and clean up the input textarea, adjusting the top-K selection dropdown to look like a clean, minimal text parameter rather than a generic HTML select.

---

## Phase 4: Query Studio Container (`Query.tsx`)
- **File:** `frontend/src/pages/Query.tsx`
- **Changes:**
  - Adjust panel container styling to match the Swiss Modernism colors.
  - Left panel: Solid black background (`bg-black`).
  - Right panel: Deep dark grey background (`bg-[#09090b]`) with a thin left boundary line (`border-l border-zinc-800`).
  - Align the panel header designs to use sharp, uppercase typography in monospace.

---

## Phase 5: Verification & Verification Testing
- Run Vite local compilation.
- Ensure TypeScript compiles successfully with no lint or build errors.
