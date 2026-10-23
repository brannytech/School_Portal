# Content architecture after Phase 3

Phase 3 adds shared bounded mathematical definitions in `public/math-engine.js`, strict `graph`/`math-tool` lesson blocks, lazy local SVG controls in `public/math-interactives.js`, and graph/tool property editors in `public/math-authoring.js`. The existing JSON lesson/draft/history/template and authorisation paths are reused. Mathematical expressions are parsed as arithmetic, never evaluated as JavaScript. Official assessment paths are unchanged. Blank templates replace only the selected private content draft; publication remains explicit. [Current Phase 3 evidence](PHASE_3_REPORT.md); the Phase 2 foundation details follow.

23 October 2026. The existing Node HTTP server, relational SQLite/PostgreSQL adapter, single-process domain cache, private storage, academic scope and vanilla JavaScript UI remain in place. Phase 0 details remain in [the baseline audit](CURRENT_SYSTEM_AUDIT.md); current changes are in [the Phase 2 report](PHASE_2_REPORT.md).

Lesson content is additive:

```text
Existing lessons.content JSON
  ├── legacy fields and unrecognised metadata retained
  ├── optional document { schemaVersion: 1, blocks: [...] }
  └── existing questions remain relational question_items

weekly-template / legacy course publication
  → academic role/scope/CSRF checks
  → shared schema validation + revision conflict checks
  → ID-based preservation merge
  → existing week snapshot archive + relational save

authorised lesson read
  → term/day/week release checks
  → strict student presentation projection
  → validated document OR non-persisting legacy adapter
  → shared browser renderer
  → existing practice/discussion/weekly closing activities
```

`public/lesson-document.js` is the pure shared content contract. `lesson-document.mjs` re-exports it and provides server-only revision/merge/ID helpers and independent equation validation through `math-content.mjs`. `public/lesson-renderer.js` renders safe markup from canonical blocks; studio student previews call this same component. Trusted existing widget code is injected through an application callback, never teacher JavaScript. Studio previews show a widget slot; live activities run in their authorised learning context.

Plain-text markup is escaped. The additive `rich-text` block carries a bounded TipTap JSON subset with declared nodes/marks, safe links and inline math. Schema objects reject unknown fields and unsupported versions/types. Equation source has length, brace nesting and command bounds and server KaTeX parsing. Local KaTeX renders HTML/MathML with trust disabled and isolated macros. Media blocks remain restricted to a validated YouTube identifier; private uploads remain in the existing authorised storage workflow.

Drafts retain an opaque UUID revision and their base published revision. Published revisions use canonical SHA-256 fingerprints of content. Reconstructed object property order and question-bank order do not create false restart conflicts; document block order remains significant. Publication IDs ensure successive publishes invalidate open older editors. The existing server request queue serialises comparison and save in one process; this is not a distributed concurrency solution.

No eager migration is run at startup. Legacy reading creates a display adapter only; it neither rewrites the bank nor embeds its answers in a document. Published version snapshots continue to contain full original content; student APIs expose only presentation fields and stripped question definitions. Worked-example answers are deliberately public teaching material.

Frontend boot remains in the last classic weekly-course script, which imports the shared renderer before calling `boot()`. Cache v13 retains public shell modules and excludes API responses. `scripts/build-editor.mjs` generates local ESM bundles, fonts, styles and licences in ignored `public/vendor/`. TipTap and MathLive load for authoring; students load equation display code as needed. No frontend framework replacement or external rendering service was introduced.

The studio queues debounced saves, preserving unsaved edit generations and separate revision tokens. Offline edits stay in memory; no private drafts are written to localStorage/IndexedDB. Scoped history/restore endpoints return staff-only snapshots and restore into a new draft. Author-private `blockTemplates` live in existing `app_settings` JSON alongside drafts/history and participate in ordinary backups. Phase 3 will extend this insertion surface for graph authoring; it has not started.
