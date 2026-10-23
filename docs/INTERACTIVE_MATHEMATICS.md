# Blank templates and interactive mathematics

23 October 2026 (Africa/Lagos).

## Build a lesson from scratch

1. Sign in as an assigned teacher or administrator. Open **Teaching workspace → Open Content Studio**.
2. Select the intended week and press **Load week**, then **Start blank template**. This creates a private draft with one untitled subtopic, no content blocks, no practice questions and no weekly quiz questions. Existing publications remain available until you publish. **Undo** reverses the replacement while this editor remains open. Saved publications can also be restored through **Version history**.
3. Enter the weekly topic and subtopic title. Insert any supported blocks in your preferred order. **Add subtopic** also starts empty.
4. Expand **Subtopic practice** and **End-of-week quiz**. Use **Add question**, choose the answer type, and enter your own prompt, correct answer and explanation. Multiple-choice answers must match one of your options. **Delete selected question** removes an unwanted question from the draft. Existing hidden quiz questions are preserved when editing an existing lesson; starting a blank template creates new lesson identities.
5. Use **Student preview**, **Save draft**, then **Publish**. An unfinished blank draft can be saved and reopened. The existing publication rules require a weekly topic, titled lessons with content, at least one valid practice question per subtopic and one valid weekly quiz question. Assessment grading and mastery rules are unchanged.

Starting blank replaces the content of the selected week's draft. Existing assignment settings remain attached to the week; manage assignments through the existing weekly form. Historical student assessment records are retained. Review the week and draft before publishing replacements.

## Interactive graph

Insert **Interactive graph**. Its properties provide fifteen presets: linear, quadratic, cubic, reciprocal, exponential, logarithmic, trigonometric, simultaneous curves, linear and quadratic inequalities, coordinate points, connected tables, bars, histograms and pies.

Edit expressions, the viewing range, coefficients and display options. Use `x`, configured parameters, `*`, `/`, `^`, parentheses, `sqrt`, `log` (base 10), `ln`, `exp`, `abs`, `sin`, `cos` and `tan`. Simple implicit multiplication such as `2x` is supported; explicit `2*x` is clearest. Select radians or degrees. Presets are starting definitions; edited expressions determine the actual curve. Inequalities use solid inclusive or dashed strict boundaries and shade the appropriate side. Histogram heights are frequency density, including unequal bin widths.

Enable the student sliders you want. Students can change coefficients, zoom, pan, inspect coordinates, toggle markers/grid and open a value table. Recognised linear/quadratic expressions show exact numerical roots and intercepts; quadratics also show the vertex, symmetry axis and opening direction. The displayed polynomial equation updates with the coefficients. Two recognised polynomial curves can display their intersections.

**Reuse this block → Save private template** saves the mathematical definition and controls, rather than a screenshot. Definitions also survive draft saves, publication history, restart and backup restoration. A student's exploration does not overwrite the teacher's saved settings.

Expand **Informal graph construction activity** for a single function. Choose x values and a coordinate tolerance. Students complete table entries, place points by tapping or by entering coordinates, and identify roots and the vertex. The ordered guide joins their points. Feedback distinguishes incorrect table entries from misplaced points. The model is initially hidden and can be revealed. Feedback stays on the device and does not submit official marks or alter mastery.

## Mathematics toolkit

Insert **Mathematics toolkit** and select:

- **Matrix:** editable 1×1 to 3×3 matrices; addition, subtraction, scalar/matrix multiplication, transpose, determinant, inverse and Cramer's rule. Resize preserves retained cells. Cramer's B must be a single column. Singular, unsuitable dimensions and numerically unreliable inverses give errors.
- **Geometry:** segments, angles, triangles, circles and polygons; editable coordinates and draggable points, lengths, area, angle ABC, midpoint AB, translations, rotation about the origin, reflection in the y-axis and a perpendicular bisector construction. Polygon area assumes a simple, noncrossing polygon.
- **Bases:** exact signed whole-number conversions between bases 2–16 with positional expansion and digit validation.
- **Indices:** adjustable base and two powers, showing the product law and real-domain errors.
- **Variation:** direct, inverse and joint variation; a graph with z held fixed for joint variation.
- **Formula:** guided rearrangement of `v = u + at` for t, with step ordering and the nonzero-acceleration condition. This is one teaching example, not a general algebra solver.
- **Calculator:** safe bounded arithmetic, fractions, powers, roots, factorials, logarithms, trigonometry, angle units and local memory.

Teacher property edits save valid settings with the lesson. Students' changes reset when the lesson is reopened. **Existing topic tool** remains available for the established contextual activities, including logarithm and antilogarithm tables. Calculator permission controls for formal assessments remain later assessment-authoring work.

## Practical limits

Graphs use local SVG and bounded sampling. Very rapid oscillation, narrow features and every possible discontinuity are not guaranteed to be detected. Exact feature analysis covers recognised linear/quadratic polynomials; arbitrary symbolic algebra, advanced geometry constraints and official graph grading are not implemented. Geometry dragging has coordinate-field alternatives. Desktop Chrome and a simulated 360px mobile viewport are tested; physical Android and low-end-device performance are still unverified. No new external graph service or runtime dependency is required.
