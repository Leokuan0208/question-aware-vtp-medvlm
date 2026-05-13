# Weekly Log — Overview

A bird's-eye view of the 12-week timeline. Each week gets its own page
with daily entries; this page is the table of contents.

The phases come from the [Project Overview](../project.md#12-week-plan)
page. Weeks run Sunday → Saturday.

| Week | Dates | Phase | Focus | Status |
| :--: | ----- | ----- | ----- | ------ |
| 1  | May 10 – May 16, 2026 | 1 — Baseline & lit | LLaVA-Med setup, first inference, CLI bug fix | <span class="pill pill--wip">In progress</span> |
| 2  | May 17 – May 23, 2026 | 1 | Baseline profiling, literature notes | <span class="pill pill--planned">Planned</span> |
| 3  | May 24 – May 30, 2026 | 2 — Codebase deep-dive | Trace LLaVA-Med forward pass | <span class="pill pill--planned">Planned</span> |
| 4  | May 31 – Jun 6, 2026  | 2 | Identify pruning insertion points | <span class="pill pill--planned">Planned</span> |
| 5  | Jun 7 – Jun 13, 2026  | 3 — Scoring-head v1 | First trainable pruning module | <span class="pill pill--planned">Planned</span> |
| 6  | Jun 14 – Jun 20, 2026 | 3 | Sanity-check results, debugging | <span class="pill pill--planned">Planned</span> |
| 7  | Jun 21 – Jun 27, 2026 | 4 — Training & ablations | K-sweep | <span class="pill pill--planned">Planned</span> |
| 8  | Jun 28 – Jul 4, 2026  | 4 | Head-architecture ablations | <span class="pill pill--planned">Planned</span> |
| 9  | Jul 5 – Jul 11, 2026  | 5 — Full evaluation | VQA-RAD / SLAKE benchmarks | <span class="pill pill--planned">Planned</span> |
| 10 | Jul 12 – Jul 18, 2026 | 5 | Latency benchmarks, qualitative analysis | <span class="pill pill--planned">Planned</span> |
| 11 | Jul 19 – Jul 25, 2026 | 6 — Write-up | Draft report, figures | <span class="pill pill--planned">Planned</span> |
| 12 | Jul 26 – Aug 1, 2026  | 7 — Final | Polished report, code release, demo | <span class="pill pill--planned">Planned</span> |

## Adding a new week

When a new week starts:

1. Copy `docs/weekly/week-01.md` and rename it (e.g. `week-02.md`).
2. Add it to the navigation in `mkdocs.yml` under the `Weekly Log:`
   section.
3. Update the row for that week in the table above.
