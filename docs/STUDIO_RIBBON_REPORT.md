# Word-style studio redesign — 23 October 2026

The studio now opens to a document page beneath a compact menu and ribbon. The permanent setup panel, question sidebar and repeated block action bars have been removed from the writing view.

- **Home:** text styles, bold/italic/underline, lists, alignment, undo/redo and selected-item arrangement.
- **Insert:** text, equations, graphs, tables, video, links, additional lesson items and saved private items.
- **File:** week/topic/subtopic settings, blank templates, history and reload.
- **Questions:** subtopic practice and weekly quiz authoring.
- **Review:** publication checklist and release settings.

Save draft, Preview and Publish remain at the top; save status appears at the bottom. Empty weeks have a Create a lesson action. Empty subtopics offer a writing surface. Existing lesson items render in document order; selecting an item opens its editor on the page. Switching ribbon tabs preserves the live text editor and selection. A deleted or undone selected item now falls back to the nearest remaining item. Titles wrap on narrow screens.

Draft/publication APIs, authorisation scope, question grading and database schema are unchanged.

## Verification

- Build and regression: 90 passing (`test-results/studio-ribbon-tests.log`).
- Ribbon workflows: 6 passing (`test-results/studio-ribbon-browser.log`), including remote text formatting, keyboard tabs, insert/reorder/undo, publication, hidden-answer preview, checklist navigation and 360px/768px editing.
- Studio/history/offline/conflict workflows: 14 passing (`test-results/studio-ribbon-history-final.log`).
- Mathematics: 11 passing (`test-results/studio-ribbon-math.log`).
- English/science/mathematics examples: 9 passing (`test-results/studio-ribbon-examples-final.log`).

Browser tests use isolated fictional databases. Expected disconnected requests occur in the offline-save check. Old workflow tests were updated to navigate ribbon tabs, select the target item before using ribbon actions and use visible mobile navigation. Earlier failed runs exposed outdated selectors and an item-selection fallback issue, which were corrected. Desktop/mobile screenshots are stored alongside each browser report under `test-results/`.

Physical-device and nontechnical-teacher trials remain unperformed. Phase 4 advanced question authoring is still outside this redesign.
