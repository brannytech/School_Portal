# Studio next-line flow and accessibility pass — 26 October 2026

## What was tested
`npm run verify-studio-flow` (needs Playwright and a Chromium/Chrome browser, see the other `verify-*` scripts) authors **Week 13** for **Mathematics, English Language and Physics** in one workspace, using the keyboard only.
It inserts display equations, inline equations, graphs, tables, YouTube links (including `youtu.be`), headings, worked examples, objectives, real-life, hint, warning, experiment, paragraph and summary items, and checks where the caret is after each insertion and that typing continues on the next line.
It then publishes each note, confirms the three notes are stored separately, checks block order and typed text, and opens each note as a student (equations, video, tables, graphs, no blank gaps, no horizontal overflow). It also checks that undo removes an item and its new line together.

## Behaviour now
- Inserting any non-text item also creates an empty text line below it (same undo step). Unused blank lines are dropped when publishing.
- Equation: the visual editor opens with the field focused; Apply returns the caret to the next line.
- Inline equation: Apply returns the caret to the same sentence.
- Video, heading, worked example, objectives, summary, hint, warning, real-life, experiment, paragraph: the first field is focused; Enter (video, heading) or Ctrl+Enter moves to the next line.
- Table and graph: the caption / first control is focused so the item can be configured; Ctrl+Enter moves to the next line.
- Inserting in the middle of a sentence splits the text and puts the caret at the start of the second half.

## Bugs fixed
1. After inserting an equation, graph, table or video the caret was lost (focus fell to the page body) and typing went nowhere.
2. Tiptap's deferred focus swallowed the first keystrokes after pressing Continue / Apply, or stole focus from the field being typed in. Focus is now applied synchronously.
3. Loading a week announced "loaded" before it had finished, so a late re-render could wipe a topic or the first lines the teacher had just typed.
4. Text split around a mid-sentence insertion kept ProseMirror attribute objects the validator rejects ("Rich-text attributes must be an object"), which blocked publishing.
5. The equation visual field could overwrite LaTeX typed in source mode (inline equation saved empty).

## Accessibility and redesign
Axe reports no violations on the teacher, student and admin screens, the four Studio tabs, and 375px mobile. Changes: accessible names contain their visible text; unique sidebar landmark; skip-to-content link; visible focus ring; text raised to a 12px floor (11px for mobile tabs); Studio greys darkened to 7:1; buttons at least 36px (44px on touch); item controls visible on touch devices; reduced-motion support; stat labels no longer break mid-word on phones.

Older browser scripts were updated for the new flow (an item is followed by a text line; equations open automatically).
