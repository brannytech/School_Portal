# Content architecture after Phase 1

21 October 2026. The existing Node HTTP server, relational SQLite/PostgreSQL adapter, single-process domain cache, private storage, academic scope and vanilla JavaScript UI remain in place. Phase 0 details remain in [the baseline audit](CURRENT_SYSTEM_AUDIT.md); current changes are in [the Phase 1 report](PHASE_1_REPORT.md).

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

`public/lesson-document.js` is the pure shared content contract. `lesson-document.mjs` re-exports it and provides server-only revision/merge/ID helpers. `public/lesson-renderer.js` renders safe markup from canonical blocks; preview tooling in Phase 2 should call this same component. Trusted existing widget code is injected through an application callback, never teacher JavaScript.

Content uses plain text; markup in text is escaped. Schema objects reject unknown fields and unsupported versions/types. Equation source is stored as text with bounded length, brace nesting and command checks; it is not executed or professionally typeset yet. Media blocks are restricted to a validated YouTube identifier; private uploads remain in the existing authorised storage workflow.

Drafts retain an opaque UUID revision and their base published revision. Published revisions use canonical SHA-256 fingerprints of content. Reconstructed object property order and question-bank order do not create false restart conflicts; document block order remains significant. Publication IDs ensure successive publishes invalidate open older editors. The existing server request queue serialises comparison and save in one process; this is not a distributed concurrency solution.

No eager migration is run at startup. Legacy reading creates a display adapter only; it neither rewrites the bank nor embeds its answers in a document. Published version snapshots continue to contain full original content; student APIs expose only presentation fields and stripped question definitions. Worked-example answers are deliberately public teaching material.

Frontend boot remains in the last classic weekly-course script, which imports the shared renderer before calling `boot()`. Cache v12 includes the two public modules and continues to exclude API responses. No new framework, runtime dependency or external rendering service was introduced.
