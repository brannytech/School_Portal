# Phase 3 — Interactive Mathematics plan

23 October 2026. Complete within the [reported scope](PHASE_3_REPORT.md); Phase 4 is not started. Uncommitted Phase 2 work was preserved. The user's blank-template requirement was added: a private empty template, empty new subtopics, custom question addition/deletion, and fresh-database end-to-end browser acceptance.

1. Add shared bounded math/graph definitions, safe arithmetic AST, matrix operations and geometry calculations in `public/math-engine.js`. Keep official grading unchanged.
2. Add lazy local SVG interactions and toolkit controls in `public/math-interactives.js/.css`: fifteen graph families, analytical polynomial features, sliders, viewport controls, tables and informal construction feedback; matrix operations and geometry primitives.
3. Extend strict shared block validation, student rendering and studio properties. Reuse existing scoped drafts/publication/history/backup. No SQL migration or new private endpoint.
4. Verify independent numerical/domain cases, injection/size limits, persistence/restart/backup, teacher/student browser workflows and 360px layouts. Run all regressions/maths checks and document actual results before closing the gate.

Renderer evaluation: existing `app.js:plot()` uses small SVG but lacks editable definitions and controls. JSXGraph offers broad geometry (MIT/LGPL); Function Plot uses D3; Plotly offers broader charts. Choose a small local SVG renderer for these bounded educational primitives, without another runtime dependency. Do not claim arbitrary symbolic solving or guaranteed sampling of every discontinuity/oscillation. Re-evaluate established libraries for advanced constructions.

Official sources checked: https://www.jsxgraph.org/home/ ; https://mauriciopoppe.github.io/function-plot/docs/modules.html ; https://plotly.com/javascript/is-plotly-free/ .
