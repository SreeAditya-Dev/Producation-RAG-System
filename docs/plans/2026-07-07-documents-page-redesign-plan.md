# Implementation Plan: Documents Page Redesign (Split Master-Detail Layout)

## Phase 1: Uploader Redesign (`DocumentUpload.tsx`)
- [ ] Clean up imports and types.
- [ ] Simplify the dropzone container border styles (`border-zinc-800` vs `border-white` on hover/drag). Remove orange borders unless specifically active.
- [ ] Refactor state layout blocks:
  - **Idle State**: A small, centered layout with a subtle upload icon, stark white main text, and grey secondary text.
  - **Uploading State**: A thin, clean horizontal progress bar (2px height) with a monospace percentage counter (`JetBrains Mono`).
  - **Success / Error States**: Minimalist text updates with compact success/failure dot indicators.
- [ ] Implement smooth framer-motion transitions for upload states.

## Phase 2: Vertical Pipeline Redesign (`PipelineVisualizer.tsx`)
- [ ] Pivot the layout from horizontal inline blocks to a vertical stepped panel.
- [ ] Create a vertical timeline line track using absolute positioning (`w-[1px] bg-zinc-800 left-[27px] top-[24px] bottom-[24px]`).
- [ ] Style each step:
  - Step icon: minimalist square background or border.
  - Step content: Title, sublabel, and tech tool tags aligned to the right of the vertical timeline.
  - Running state: Spin loader, soft pulse animations.
- [ ] Update details section at the bottom (Current step, Chunks, Progress) to use horizontal sub-grids with `font-mono` metrics.

## Phase 3: Document Table Redesign (`DocumentList.tsx`)
- [ ] Rewrite list container to support tabular metadata headers (Name, Type, Size, Chunks, Status, Created, Actions).
- [ ] Redesign item row layout:
  - Monochromatic type icons.
  - Tiny type badges (`font-mono` text, uppercase, small black-and-white pills).
  - Clean status badge pills (e.g. `border border-emerald-500/20 bg-emerald-500/5 text-emerald-400` with a pulsing inner dot).
  - Reveal actions (Delete button) only on row hover (`opacity-0 group-hover:opacity-100 transition-opacity`).
- [ ] Support client-side text searching by adding a `searchQuery` prop to filter the document list by filename or type.

## Phase 4: Grid Assembly & Search Integration (`Documents.tsx`)
- [ ] Add state for `searchQuery` in the main `Documents` page component.
- [ ] Redesign header with a top actions bar:
  - **Left**: Stark title and system status badge.
  - **Right**: An elegant search input box with `Ctrl K` keyboard styling, alongside reload and refetch buttons styled with fine, high-contrast borders.
- [ ] Assemble the page in a split layout:
  - Left column: Upload & Pipeline Visualizer.
  - Right column: Knowledge Base list (passing `searchQuery` into `DocumentList`).
- [ ] Double-check spacing, padding, and layout consistency with the dark Vercel design system.
