# Redesign concept: "Stimmzettel"

## 1. What made the old UI read as AI-made

The site was a near-textbook case of the default look that Claude and other models produce when nobody
specifies a style. Anthropic calls the cause *distributional convergence*: without direction, a model
drifts to the statistical middle of its training data.

| Tell (as named in the sources below) | Where it was in our UI |
| --- | --- |
| Purple/indigo accent, purple gradients | `--accent: #7c5cff`, primary button `#7c5cff → #5b3df5`, purple glow on #1 podium card, voted rows, pips |
| Five or six saturated colours competing | violet, teal `#22e1c1`, amber `#ffb627`, hot pink `#ff4f8b`, green `#4ade80`, all on screen at once |
| Aurora / radial glows on a near-black, blue-tinted background | two `radial-gradient` blobs (violet + teal) over `#07080d`, plus a 48px "cyber grid" |
| Gradient text in the hero | `.grad` teal → violet → pink on "auf der LAN?" |
| Glow on every surface | `box-shadow: 0 0 24px …` on logo, countdown, pips, buttons, vote button, rank numbers |
| Thick coloured side tab on rounded cards ("the single most recognizable signature") | `.game::before` 4px bar with a glow on every game row |
| Inter as body font; a generic "gamer" display font | Inter Variable + Chakra Petch |
| Wide-tracked uppercase eyebrow labels everywhere | `.kicker` at `letter-spacing: .22em`, same on logo, badges, countdown, auth footer |
| Same large radius on everything | 10–20px on cards, buttons, inputs, modals, chips, images |
| Row of stat cards | four `.hero-stats` tiles |
| Pulsing "live" dot, glassmorphism | `.cd-dot` pulse, `backdrop-filter: blur` on topbar and modal |
| Emoji as icons | 🔒, ⚠ in banners and badges |
| Cyber naming | "LAN**//**VOTE" |
| Copy: dash-spliced sentences, cheerleading | "… holen wir automatisch – inkl. KI-Check", "vote einen Newcomer!", "Login für die Crew", "Los geht's" |

One extra trap: the fonts Anthropic's own frontend skill recommends as alternatives (Space Grotesk,
Bricolage Grotesque, JetBrains Mono, IBM Plex, DM Sans, Playfair, Newsreader) are now *themselves* the
next Claude fingerprint. They're avoided here too.

## 2. The idea

The site is a ballot. A real one, for a real LAN in a real room in Miesbach. So it should look like
the paper things that live at a LAN: the **Stimmzettel** you cross, the **ranking sheet** taped to the
wall, the ballpoint pen you mark it with. Print, not neon.

Rules that follow from that:

- **Paper and ink, one pen colour.** Everything is ink on paper. The one accent is ballpoint blue, and
  it is reserved for *your own marks*: your votes, your remaining votes, the focused field. Red is only
  for warnings ("fraglich", delete). Nothing else gets colour, except the game art and the avatars,
  which carry real information.
- **Cross a box to vote.** The vote control becomes a row of ballot boxes (one per allowed vote per
  game). Click a box to put a cross in it, click again to take it out. Same in the header: your vote
  budget is a strip of small ballot boxes.
- **A ranking sheet, not a card stack.** The game list is a ruled table: hairline rules between rows,
  big solid rank numerals, no side tabs, no glows, no lift-on-hover.
- **Contrast through type, not effects.** A tall condensed scoreboard face for headings and numbers,
  set big and heavy; a highly legible text face for everything else.
- **Small radius.** 2px on boxes, inputs, buttons, images; nothing pill-shaped except avatars.
- **Plain German.** Short sentences, no dash splices, no exclamation marks, no emoji.

A dark variant exists ("carbon copy") for people voting at night: same rules, warm charcoal paper,
off-white ink, a lighter blue pen.

## 3. Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#f1ede4` | `#1c1b18` | page background |
| `--sheet` | `#faf8f3` | `#25231f` | raised surfaces (modal, panels, inputs) |
| `--ink` | `#1d1c19` | `#ece7dc` | text, rules at full strength, primary buttons |
| `--ink-2` | `#5c5850` | `#a39d90` | secondary text |
| `--rule` | `#d6d0c3` | `#3a3732` | hairlines |
| `--pen` | `#1f4fbf` | `#7fa2ff` | your marks only |
| `--alert` | `#c2361b` | `#ff7a5c` | fraglich, delete, errors |

Type: **Big Shoulders** (condensed, Chicago-signage / scoreboard numerals) for headings, ranks, counts;
**Atkinson Hyperlegible Next** for body text and UI. Classic vs. Newcomer is told apart by the label,
not by colour: Klassiker is a filled ink tag, Newcomer an outlined one.

## 4. Copy changes (examples)

| Before | After |
| --- | --- |
| HOUSE OF GAMING · MIESBACH (eyebrow) | dateline: "House of Gaming, Miesbach · Sa., 14. März, 18 Uhr" |
| Du hast **8 Votes** für die Spiele, die du unbedingt spielen willst – davon höchstens 5 für Klassiker, der Rest geht an Newcomer. … | Du hast 8 Votes, höchstens 2 pro Spiel. Maximal 5 davon dürfen an Klassiker gehen, der Rest an Newcomer. Auf die Liste gehört, was mindestens 10 Leute zusammen spielen können. |
| Maximal 5 Votes für Klassiker – vote einen Newcomer! | Deine 5 Klassiker-Votes sind vergeben. Der Rest geht an Newcomer. |
| 🔒 Die Abstimmung ist geschlossen – das hier ist das Endergebnis. | Abstimmung geschlossen. Das ist das Endergebnis. |
| Login für die Crew / Los geht's / Du bist eingeladen! | Anmelden / Account anlegen / Einladung |
| „X“ hinzugefügt – Bilder & Infos kommen gleich. | „X“ steht auf der Liste. Bilder und Infos laden noch. |
| LAN//VOTE | LAN-Wahl |

## Sources

- Anthropic, [Improving frontend design through Skills](https://claude.com/resources/articles/improving-frontend-design-through-skills)
- The Fountain Institute, [7 Signs a UI Has Been Vibe Coded](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui)
- Noqta, [AI design slop: overused UI patterns](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026)
- DEV, [Why every AI-built website looks the same: blame Tailwind's indigo-500](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p)
- PostHog-style UI copy rules ("not just X, it's Y", rule of three) via [mcpservers.org](https://mcpservers.org/agent-skills/posthog/writing-user-facing-copy)
