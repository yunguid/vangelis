# THE INTERFACE PURGE — exorcising the AI-coded UI, one iteration at a time

You are one iteration of a loop (successor to ENGINE_DESCENT, which reached its fixed
point). Your shared memory is `INTERFACE_LEDGER.md` at the repo root. **Read it before
anything else.** If it does not exist, this is iteration zero (§4).

## 1. The mandate (the user's words, compiled)

The UI is full of LLM-coded design tells and the user wants them gone:

- **Gradient light** — the weird glows and gradient washes in the sidebar and the
  pop-out page. Gone.
- **Pill borders** — the rounded-capsule chips and borders everywhere. Gone.
- **Recording symbols** — the little animated dot indicators. Killed.
- **Classification borders + tags** — the borders around song categories and the tag
  chips on the right of every song row. Removed entirely; the user clicks a song and
  decides what it is themselves.
- **"Vangelis Studio Original"** — this text, everywhere it appears. Deleted.
- **Song names** — the current names are cringe. Rename all originals to odd little
  codes with less life but a dry, weird humor: `bx-41`, `moth_22`, `DIAL 9`,
  `4AM UNIT`, `pelican-00`, `TAPE C` — machine-adjacent, lowercase-leaning, no epic
  words, no poetry. Deterministic generator (seed from the old name) so regeneration is
  stable.
- **The sidebar** — full rework of how sounds are laid out: the list structure, the
  bordering, the density.
- **The Samples page** — killed. Delete the page and all code related to it. The user
  does not want to look at it anymore.
- **A sound-designer page replaces it** — a dedicated place to *design* a sound: start
  from a waveform, shape it, test it on the keyboard, and when done, save it so it's
  playable from the sidebar's sound page. Sound design moves out of the cramped little
  panel and into a real workspace.

## 2. The replacement design language

Every purge needs a direction, or iterations wander. The target is **a tool, not a
pitch deck** — think DAW channel strip / file manager, not SaaS landing page:

- Flat surfaces. No gradients, no glows, no colored shadows.
- Hairline 1px borders or none; border-radius ≤ 6px; zero pills.
- Monochrome palette + at most one accent color, used sparingly.
- Typographic hierarchy over decoration: weight/size/spacing do the work.
- Information-dense lists; no chips, no badges, no per-row ornaments.
- Motion only where it carries information (playhead, levels), never ambience.

## 3. Gates — every iteration, all of them

| Gate | Check |
|------|-------|
| G1 | `npm test` passes (from `sound-engine/frontend/`) |
| G2 | `npm run build` passes; dev server boots; zero new console errors |
| G3 | **Engine untouched:** `npm run audit:audio` stays 225/225 bit-exact. UI iterations never edit `src/audio/` or `utils/audioEngine/` (exception: deleting samples code, staged, with the audit green after) |
| G4 | **Screenshot every visual iteration** (preview tools), saved and shown in the report. The user is the aesthetic oracle: a veto in any future message = revert that item |
| G5 | **Tell census strictly decreases** until zero: counts of `linear-gradient`/`radial-gradient`, glow `box-shadow`s, `border-radius` > 8px, tag/chip renders, animated dot indicators, and `Vangelis Studio Original` occurrences (census script from iteration zero) |

Fail a gate → revert the working tree, record why in the ledger.

## 4. Iteration zero: apparatus, no redesign

1. Build the tell census: a script (`scripts/audit_ui_tells.mjs`) that greps
   `src/**/*.{css,jsx}` and counts each tell class from G5. Record the baseline table
   in the ledger.
2. Screenshot baseline: sidebar (each tab), the pop-out page, the songs list — saved
   for before/after comparison.
3. Refine the backlog (§5) against the actual code; estimate value/effort; commit.

## 5. Seed backlog (iteration zero refines)

| id | item | notes |
|----|------|-------|
| P1 | Kill song-row tags + classification borders in the MIDI browser | pure deletion; the theme metadata may stay in data, just never rendered as chips |
| P2 | Delete "Vangelis Studio Original" text everywhere | grep-driven |
| P3 | Kill recording-dot indicators | replace with plain text state if state must show |
| P4 | Purge gradients, glows, pill borders across sidebar + pop-out; apply §2 language | the big one; may split by surface |
| P5 | Rename all originals to odd codes | deterministic generator in `scripts/generate_original_midis.mjs` + manifest; regenerate; keep file mapping documented |
| P6 | Sidebar sounds-list rework | §2 density and structure; layout, not just paint |
| P7 | Sound-designer page scaffold | new route/page: waveform picker → full AudioControls surface → live keyboard test strip |
| P8 | Designed sounds save + appear in sidebar sound page | user-preset pipeline already exists (localStorage presets); wire designer → preset shelf → sidebar |
| P9 | Kill the Samples page | staged: remove tab/route/UI first (build green), then dead-code sweep (SamplesTab, sampleStorage, sample sync scripts, sample-only tests); decide samplePool's fate by what still references it |

Order by value/effort each iteration; P7/P8 are multi-iteration; P9's sweep comes late
so nothing else still depends on the corpse.

## 6. Rules of engagement

- **Delegation protocol (mandatory):** the orchestrator (this session) writes NO
  implementation code. Each item is implemented by a Sonnet subagent (Agent tool,
  `model: "sonnet"`), briefed with: the item, the exact files, the §2 design language,
  the gates it must run, and the never-stage-other-session-files rule.
- **Adversarial review:** the orchestrator reads the subagent's full diff, re-runs the
  gates independently (never trusts the agent's claims), and screenshots the result.
  Work that is sloppy, off-language, over-scoped, or gate-failing gets sent back to the
  SAME agent (SendMessage, context preserved) with blunt, specific criticism — name
  what is bad and why; "this is awful because X, Y; redo it so that Z" is the register.
  Max 3 rework rounds; after that, revert everything, record the failure in the ledger,
  and re-brief a fresh agent next iteration.
- The ledger records review cycles honestly: rework counts, what the agent got wrong,
  what feedback fixed it.
- One item per iteration, one commit (`purge(k): ...`), push to main. The orchestrator
  commits only after its own review passes — never the agent.
- **Concurrent session warning:** another loop works this repo's UI files (mobile
  design). Start every iteration with `git pull --rebase`; if your item's files show
  uncommitted changes from the other session, pick a different item this iteration.
  Never stage files you didn't change.
- The ledger is append-honest: failures, reverts, and user vetoes are recorded.
- Scope: UI/UX + the renames + the samples deletion. The audio engine is frozen at its
  fixed point — if an item seems to need engine changes, note it in the ledger and stop
  at the boundary.

## 7. Termination

The loop halts when: backlog empty, census at zero, all gates green, and — because
aesthetics cannot self-certify — a final before/after screenshot set is posted for the
user with the loop **paused awaiting sign-off**. The user's approval (or their vetoes,
which become new items) is the fixed point.
