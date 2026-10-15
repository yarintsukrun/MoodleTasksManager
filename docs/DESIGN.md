# Design direction: "יומן הסטודנט"

The current UI is clean but anonymous. It has the look of a generated dashboard: every block is the same rounded card with the same shadow, pills everywhere, indigo accent, emoji in empty states, centered everything. This document sets one shared direction so that six people (agents) redesigning six screens end up with **one product that looks like a person designed it**.

## Concept

A **printed academic planner**: the kind of diary a student buys at the start of the year. Paper, ink, a ruled grid, a few marks from a highlighter. Calm, dense where it should be dense (the timetable, the task list), generous where it should breathe (the "next thing" on Today). Information first, decoration last.

Reference points (for feel, not for copying): a Swiss railway timetable, a printed university course catalogue, a Moleskine weekly planner, the departure board at a train station.

## Rules that make it look human

Do:
- **Typographic hierarchy instead of boxes.** Separate sections with a heading and a hairline rule (`--rule`), not with yet another card. Use cards only where something is truly an object you act on (the "next deadline" on Today, the event drawer).
- **One accent colour, used sparingly**, like a red pen: for "now", for overdue, for the primary action. Everything else is ink on paper.
- **Course colours act like highlighter marks**: a thin side stripe, a dot, or a soft underline. Never a fully saturated block of colour with white text.
- **A real type scale with contrast between sizes.** Big numbers for time ("13 שעות"), small caps-like labels for metadata. Display font for headings and big numbers, body font for everything else.
- **Tabular numerals** for every time and date (`font-variant-numeric: tabular-nums`). Times right-aligned in their column like a timetable.
- **Varied rhythm.** Not every section has the same padding, radius and shadow. Lists are lists (rows separated by rules), not stacks of cards.
- **Natural Hebrew microcopy**, the way a student talks to a friend. Not marketing. "אין שיעורים היום" not "🎉 יום חופשי! תהנה!". "מה הבא" not "הדבר הבא שלך ✨".
- **Asymmetry with intent.** On desktop a main column and a narrower margin column (like the margin notes in a planner) beat two equal halves.
- **Small, deliberate details**: a date "stub" (big day number + small weekday) on list groups, a ruled-paper background only in the timetable grid, a quiet "today" marker like a ribbon bookmark.

Don't:
- No purple/indigo gradients, glassmorphism, glows, neon, blurred blobs.
- No emoji in UI chrome (headings, empty states, buttons). Icons: simple 1.5px line icons, used only where they help scanning.
- No pill-shaped badges for everything. Use plain text labels in small type; pills only for filter chips.
- No identical 16px radius + soft shadow on every element. Radius scale is small (2–8px); shadows only on floating things (drawer, toast).
- No centered hero layouts, no "Welcome back!" headers, no illustrations.
- No ALL CAPS, no bouncy animations; motion ≤150ms and only for state changes.

## Tokens (shared; implemented in `web/src/styles/tokens.css` by the design-system owner)

Existing token **names stay** (screens already use them); their **values change** to the palette below. New tokens:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` (= `--bg`) | `#F7F4EE` warm off-white | `#16150F` | page background |
| `--surface` | `#FFFDF9` | `#1E1D17` | cards, drawer |
| `--ink` (= `--text`) | `#1F1D1A` | `#ECE8DF` | main text |
| `--text-muted` | `#5B574F` | `#B4AEA2` | secondary text (≥ 4.5:1 on paper) |
| `--rule` | `#DDD6C8` | `#3A372E` | hairline section/row dividers (1px) |
| `--grid-line` | `#ECE6DA` | `#2A2822` | timetable ruled lines |
| `--accent` (= `--primary`) | `#B3261E` red-pen | `#F2766B` | now, overdue, primary action |
| `--font-display` | `"Frank Ruhl Libre", serif` | | h1/h2, big numbers |
| `--font-body` (= `--font`) | `"Assistant", system-ui, sans-serif` | | everything else |

Course palette (8): muted, ink-friendly hues (e.g. teal `#2F6F73`, ochre `#9A6B12`, olive `#5D6B2F`, plum `#7A3E6B`, slate-blue `#3E5C8A`, brick `#9C4A2F`, moss `#3F6B4F`, graphite `#55555F`), each with a `-soft` tint for highlighter backgrounds. All must keep ≥ 4.5:1 as text on `--paper` and `--surface`.

Type scale: 12 / 14 / 16 / 20 / 28 / 40px. Body 16px, line-height 1.5. Display weights 500–700.

## Accessibility is not optional

Everything from the previous pass stays: WCAG 2.1 AA contrast, `:focus-visible` rings, keyboard access, `dir="auto"`/`<bdi>` around user content, no horizontal scroll at 375px, touch targets ≥ 44px for primary controls (≥ 24px minimum for dense timetable items), `prefers-reduced-motion`, colour is never the only cue.
