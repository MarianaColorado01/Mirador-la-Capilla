---
version: 1
slug: "wireframes-html"
primary_target: "wireframes.html"
related_targets: []
---

Scope: wireframes.html — every screen of Bar POS · Mirador la Capilla (Android, React Native/Expo), grouped by role, covering RF-01..RF-71. Mode: Operate. Build path: code-led (no image generation).

## Direction contract

THESIS: The bar runs like a departures board: every order, table and account is a live row whose state recolours the row without breaking the grid. Refuses the white-card Material POS with a blue button.

OWN-WORLD: Night: flap black #0D0D0F ground, flap face #1A1A1D cells split by a hairline, steel #B6BBC2 frame lines, flap white #F2F2F2 type. Day: white enamel flaps on light steel #E6E8EB, black type. State paint only: libre green, ocupada orange, por cobrar red, en preparación amber; cancelled rows drop to dim red and strike through. Barlow Condensed caps, tracked, for flap cells, table numbers, totals and labels; Roboto for body. Primary action is an inverted flap (white face, black letters at night; black face at day).

STORY: The waiter sees which tables need them, taps one, adds a round in a few taps; the bar sees it arrive as a new row; the cashier collects; the owner reads the day as a board.

FIRST VIEWPORT: Mapa de mesas: top app bar with connection lamp; a 2-column grid of table flaps, each table number in split cells at 44px, state band along the bottom of the flap, open total in tabular numerals; FAB "Abrir mesa" bottom right above the bottom navigation.

FORM: Split-flap concourse board (challenger, chosen by user over assigned "Rótulo de tienda"). seed: none (unavailable)

Signature interaction: character cascade flip when a value or state changes (90 ms steps per cell, single update under reduced motion); elapsed time drawn as a bar whose length is the wait.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
