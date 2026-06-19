# Weekly Log — Overview

A bird's-eye view of the 12-week timeline. Each week gets its own page
with daily entries; this page is the table of contents.

The phases come from the [Project Overview](../project.md#12-week-plan)
page. Weeks run Sunday → Saturday.

| Week | Dates | Phase | Focus | Status |
| :--: | ----- | ----- | ----- | ------ |
| [1](week-01/index.md)  | May 10 – May 16, 2026 | 1 — Baseline & lit | LLaVA-Med setup, harness build, E00 baseline | <span class="pill pill--done">Done</span> |
| [2](week-02/index.md)  | May 17 – May 23, 2026 | 1 → 3 | Baseline closeout, first pruning method, substring bug found, **pivot to Qwen2.5-VL** | <span class="pill pill--done">Done</span> |
| [3](week-03/index.md)  | May 24 – May 30, 2026 | 1 | Qwen2.5-VL pivot validated, **second pivot to HuatuoGPT-Vision-7B**, baseline reproduced, then three pruning sweeps all lose to random — **pruning closed, pivot to visual grounding** | <span class="pill pill--done">Done</span> |
| [4](week-04/index.md)  | May 31 – Jun 6, 2026  | pivot | Direction-D **closed**, image-difficulty wedge **killed**, reframed to a per-question **compute router** — on the 7B it clears its first gate (~25% policy-flip, +9–10pp oracle ceiling); predictability still to test | <span class="pill pill--done">Done</span> |
| [5](week-05/index.md)  | Jun 7 – Jun 13, 2026  | pivot | Single-model routing **closed**, pivot to a **7B→32B cross-model cascade** — the margin-gated cascade holds **32B parity at a measured 0.639× compute** (held-out grid: 74% at cap320); accuracy headroom real but unreachable from cheap signals. Written up as the **CVGIP 2026 manuscript** and hardened by a reviewer-grade audit (six-router bake-off: nothing beats the one-line gate). | <span class="pill pill--done">Done</span> |
| [6](week-06/index.md)  | Jun 14 – Jun 20, 2026 | pivot | Gate axis **closed** as a clean negative result (rescue near-unpredictable, margin beats all gates); the real lever is the **strong leg’s compute mode** — 32B no-think *over-thinks* perception, yielding **ACC** (3-tier-from-2-models cascade) that matches always-32B-think at **−72% latency / −75% energy / ~½ FLOPs**, plus a free disagreement gate (ACC-v2). Literature-positioned (QNC, post-generation cascade). | <span class="pill pill--wip">In progress</span> |
| 7  | Jun 21 – Jun 27, 2026 | 6 — Harden ACC | Mixed-set think-threshold calibration (honest ALL-6); stand up the AutoMix baseline | <span class="pill pill--planned">Planned</span> |
| 8  | Jun 28 – Jul 4, 2026  | 6 | Runnable cascade baselines (Cascade Routing, RouteLLM); higher-tier draft around "structure + agreement gate" | <span class="pill pill--planned">Planned</span> |
| 9  | Jul 5 – Jul 11, 2026  | 6 | Full ACC ablations + swept cost–quality (AIQ/nAUC) curves | <span class="pill pill--planned">Planned</span> |
| 10 | Jul 12 – Jul 18, 2026 | 6 | Latency/energy benchmarks; qualitative escalation panels | <span class="pill pill--planned">Planned</span> |
| 11 | Jul 19 – Jul 25, 2026 | 7 — Write-up | Draft report, figures | <span class="pill pill--planned">Planned</span> |
| 12 | Jul 26 – Aug 1, 2026  | 7 — Final | Polished report, code release, demo | <span class="pill pill--planned">Planned</span> |

## How the weekly log is structured

Each week has an **overview page** (a short summary of every day, with
the day titles linking through) plus one **detail page per day** under
a `week-NN/` folder. Click a week in the sidebar to open its overview;
use the expand arrow next to it to reveal the individual day pages.

## Adding a new week

When a new week starts:

1. Create the week's overview page (e.g. `docs/weekly/week-02/index.md`) and a
   folder for its day pages (`docs/weekly/week-02/`), then add a day
   page per day (`day-01.md`, `day-02.md`, …) inside that folder. The
   easiest path is to copy the Week 1 files and edit.
2. In `mkdocs.yml`, under the `Weekly Log:` section, add the new week
   as a nested block — the week's overview file goes **first** in the
   list (that makes it the clickable section index), followed by the
   day pages:

   ```yaml
       - Week 2:
           - weekly/week-02/index.md
           - weekly/week-02/day-01.md
           - weekly/week-02/day-02.md
   ```

3. Update the row for that week in the table above (link the week
   number to its overview page, as Week 1 is).
