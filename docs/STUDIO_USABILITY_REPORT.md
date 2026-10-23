# Studio usability review — 23 October 2026

The studio now follows four numbered stages: choose the week/subtopic, build the lesson, add questions, and review/publish. Selected items contain their own editor. Quick-add buttons, persistent question panels, plain-language answer labels and answer selectors reduce repeated navigation. Publication guidance links to incomplete fields; preview includes questions while withholding private answers and feedback.

Graph presets offer ordinary number inputs, labelled chart rows and coordinate fields with add/delete controls. Advanced expressions are optional. Invalid histogram intervals show local feedback. New video items start empty and must be configured before publication. Item selection survives editor refreshes, and live rich-text changes are correctly checked for publication.

## Examples tested

- English: descriptive writing with formatted text, objectives, a worked example, written answers, multiple choice and true/false questions.
- Science: changes of state with an editable table, two subtopics, separate practice banks and a shared weekly quiz.
- Mathematics: quadratic and straight-line coefficients, bar-chart rows, coordinate points and invalid histogram intervals.

All three weeks were authored, published and read through an authorised student session using isolated fictional data. Desktop, 768px tablet and 360px mobile browser layouts were checked. No external nontechnical participant or physical phone took part; this is a task-based usability inspection and automated workflow review.

## Verification

- Build and regression suite: 90 passing, zero failing (`test-results/studio-usability-tests-final.log`).
- Maths audits: 392 preserved assessment/example checks, 2,600 curriculum instances, 900 log-table cells and 1,000 antilog-table cells (`test-results/studio-usability-maths-final.log`).
- Usability workflows: 8 passing (`test-results/studio-usability-final.log`).
- Studio regression: 14 passing (`test-results/studio-layout-regression-resume.log`).
- Interactive mathematics: 11 passing (`test-results/studio-math-regression-final.log`).
- Structured lesson foundation: 8 passing (`test-results/studio-foundation-regression-final.log`).

The initial studio regression timed out attempting a long drag across a scrolled inline editor. The check now drags adjacent visible items and verifies the resulting order, then tests a keyboard-activated move control. This passes; long-distance drag autoscrolling is not certified by that check. Offline-save checks deliberately generate disconnected requests; all completed browser suites report no uncaught page errors.

The earlier Phase 3 scope remains in effect. Advanced question authoring (Phase 4) has not begun.
