# Implementation Plan: Query Page Redesign (Monochromatic Border-Only Console)

## Phase 1: Collapsible Logs Layout Setup (`Query.tsx`)
- [ ] Add state `eventLogCollapsed` to the main `Query` component.
- [ ] Render the side panel layout cleanly:
  - Header actions: Add a layout status indicator.
  - QueryVisualizer wrapper: Takes remaining vertical space.
  - EventLog wrapper: Adjust height dynamically: `h-[40px]` if collapsed, `h-[220px]` if expanded.
- [ ] Pass the collapse toggle callbacks down to the `EventLog` component.

## Phase 2: Stark Chat Interface (`ChatInterface.tsx`)
- [ ] Refactor imports and remove colors.
- [ ] Redesign chat body empty state:
  - Stark border container, thin grey text, white typography.
  - Greyscale icon or logo.
- [ ] Redesign chat message nodes:
  - Left / right alignment using crisp `border border-zinc-850` containers.
  - User messages: Stark dark grey backgrounds (`bg-zinc-900/40`), white text, no color tags.
  - Assistant messages: Clean `bg-transparent` layouts, white text, markdown styling using monochrome text sizes, and code text blocks using `text-zinc-300 bg-zinc-900 px-1 border border-zinc-800` (removing orange highlights).
  - Streaming cursor: A thin, solid white blinking cursor line instead of orange pulses.
- [ ] Redesign sources listing:
  - Compact row layouts with `[01]` index numbers.
  - Greyscale text for score indicator.
- [ ] Redesign query input panel:
  - Flat bottom container (`bg-[#09090b] border-t border-zinc-850`).
  - Textarea: sleek boundary, thin focus border.
  - Selector/Button: monochrome controls (grey select container, black-on-white active button).

## Phase 3: Monochromatic Pipeline (`QueryVisualizer.tsx`)
- [ ] Strip all color-filled circles, neon glowing highlights (`node-glow`), ring expansions, and delayed gradient particles.
- [ ] Redesign the horizontal pipeline stepper:
  - Node bubbles: Stark outline circles (`border-zinc-800` for idle, `border-white` for active, `border-zinc-500` for complete) with standard greyscale status indicators (thin white spin loaders, check icons, or warning indicators).
  - Connections: Plain solid lines (`h-[1px] bg-zinc-800`).
- [ ] Refactor stage detail callout boxes:
  - Plain flat grey frames (`border-zinc-850 bg-zinc-950/50`) with white text.
- [ ] Update latency metrics row to use JetBrains Mono metrics.
- [ ] Rework source citations to follow the new greyscale details.

## Phase 4: Event Stream Collapse & Clean Stream (`EventLog.tsx`)
- [ ] Update props to support `collapsed` and `onToggleCollapse` callback.
- [ ] Redesign header toolbar:
  - Add a collapse button (chevron or arrow icons).
  - Monochrome indicator stream count and live connection indicators.
- [ ] Redesign terminal console logs:
  - Clean monospace text with greyscale dots for levels (info, success, warning, error) rather than bright neon fills.
  - Hide scroll overflow cleanly if collapsed.
