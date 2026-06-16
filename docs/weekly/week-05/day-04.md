# Day 4 — Friday, June 12, 2026

[← Back to Week 5 overview](index.md)

**Writing the paper: the CVGIP 2026 manuscript, format-locked to the
template** · Week 5, Day 4 · **Day 34 of the project**

---

A pure paper-production day — no new experiments, just turning the cascade
result into a submission-grade **CVGIP 2026** manuscript (8-page hard cap,
two-column Word/DOCX). The whole day was an iterative format-and-content loop
against two ground-truth references the conference provides: the official
**CVGIP template** and a previously-submitted exemplar (the *EIBNet* paper).
Each round followed the same discipline — make the fixes, then run the full
render-check loop (`validate` → convert to PDF → page-count ≤ 8 → rasterize
→ view *every* page) before looking at anything — and three rounds of
demanding, specific corrections drove it from a broken single-column draft to
a clean eight-page two-column paper. The headline number firmed up along the
way: the live cascade runs at a **measured 0.639× of always-32B compute** at
parity, even better than the ~0.74× FLOPs estimate. Two editorial decisions
shaped the result — **hide our own 7B *and* 32B accuracy numbers** (show only
cascade-vs-published, because our internal reproductions *exceed* the
published MedVLThinker baselines and would invite harness-difference questions
rather than strengthen the contribution), and **correct authorship** (there is
no co-author "Dan" — Dan is Li-Wen Kuan himself).

!!! note "Day count, and June 11"
    June 11 (Day 33) was an off day with no research session, so this picks up
    from [Day 3](day-03.md). June 12 is **Day 34** of the project (calendar
    count from May 10), and the **4th working session** of Week 5.

!!! note "No 'Dan' co-author"
    "Dan" — which appears across the project only as a shared-storage path
    (`/data/dan/...`) and was mistakenly carried into an early author list — is
    **Li-Wen Kuan himself**. Final authorship is **Yuan-Kai Wang (王元凱)** and
    **Li-Wen Kuan (關力文)** only; every author-"Dan" mention was removed from
    the manuscript (the only remaining "dan" strings are inside the word
    *redundant*).

---

## Round 1 — Match the template: two columns, not one

The first draft got the single most important thing wrong — it wasn't
two-column. With the official template and the submitted EIBNet paper in hand,
the template XML was read directly for the authoritative spec rather than
guessed at:

- **Two columns** (83 mm columns, 8 mm gap); title block 35 mm from the top in
  Times 14 pt bold.
- **Major headings centered and ALL-CAPS**; left-aligned bold subheadings.
- **Abstract 100–150 words** (the draft's was ~250).
- First paragraph of each section flush-left, the rest indented; fully
  justified; **no page numbers** (the draft wrongly paginated).
- **Professor first** in the author block — Yuan-Kai Wang, then Li-Wen Kuan —
  with e-mail `412216085@cloud.fju.edu.tw`.
- Charts redrawn in the **EIBNet palette** (bright blue/red/green/black, marker
  shapes, light dotted grids); algorithms in the EIBNet visual style.

The real run numbers were also wired in for the first time: the cascade at
**56.30 / 78.12 / 82.35 / 66.45** across the competent four, our 32B
reproducing the published numbers within ~1 pt, and the headline efficiency at
the **measured 0.639×** compute at parity (escalation 63.1%, energy/query
**4398 J** vs **6883 J** for always-32B; the cheap leg essentially free at
**0.008×**, only ~53 J — so the compute fraction is almost entirely the
escalation rate).

---

## Round 2 — Font, algorithm style, references, spanning elements

A second, more exacting pass on six specific defects, each fixed against
measured ground truth rather than by eye:

- **Font size.** The template's XML was measured directly: **body = 10 pt
  (`w:sz` 20), headings = 12 pt (24)**. The draft's 9 pt everywhere is exactly
  why it read too small. (EIBNet itself uses 9 pt, but the *template* — which
  governs — is 10 pt.) Switched to **10 pt body / 12 pt headings / 14 pt
  title**.
- **Algorithm style.** Zoomed into EIBNet's Algorithm 1 at high resolution:
  it's the **horizontal-rules-only** style — a rule on top, under the title,
  under Input/Output, and at the bottom, with bold step numbers and **no outer
  box and no vertical separators**. The draft's boxed version with vertical
  lines was wrong; corrected to match.
- **References: 20 → 33.** A thorough literature search expanded the
  bibliography to **33 verified entries** across five Related-Work
  subsections — adding DeepSeek-R1 (arXiv 2501.12948), Med-PaLM / Med-PaLM 2 /
  Med-Gemini, deferral theory (Mozannar–Sontag ICML 2020; Narasimhan et al.
  NeurIPS 2022), conformal prediction (Angelopoulos–Bates, 2107.07511),
  speculative decoding (Leviathan et al. ICML 2023), test-time compute (Snell
  et al.), LLaVA, CLIP, chain-of-thought, and two medical surveys.
- **Hide our 32B; keep cascade-vs-published.** Removed our 32B accuracy row
  from Table 1 and Fig 3 — the gap between our reproduction and the published
  MedVLThinker numbers is *larger* and ours is already *higher*, which does the
  contribution no favors. The headline comparison is now cascade-vs-published.
- **Spanning elements and gaps.** Every element was made column-width (Fig 1
  redrawn as a vertical flow; Table 1 compacted to one column with a legend in
  the caption), so nothing spans two columns — which removed the forced page
  break that had left a half-empty page. `keep-with-next` on headings fixed an
  orphaned §4.5 heading, and reordering Table 2 ahead of Fig 3 closed a page-4
  gap. Pages filled cleanly with only the final references page partially
  filled (normal). Paper grew **5 → 7 pages**.

---

## Round 3 — Maximum density, hide our 7B too, and remove Dan

The final pass pushed for full eight-page information density and two last
editorial changes:

- **Hide our 7B as well** (same rationale as the 32B). Table 1 and Fig 3 now
  show only **published-7B, published-32B, and the cascade** — the headline is
  cascade-vs-published (**+2.28 macro / +8.81**). The cheap/strong endpoints
  still needed for the routing analysis are *kept but relabeled* as cascade
  operating points ("Cheap-only (0%)" / "Strong-only (100%)") in Tables 2–3 and
  Fig 2, where they are favorable. Zero stray reproduction numbers
  (68.13 / 69.23 / 62.97) remain anywhere.
- **Remove Dan from authorship** (Dan = Li-Wen Kuan) — see the note above.
- **Much more content**, pulled from across the whole project history to fill
  the 8 pages honestly:
    - a **cross-model motivation** paragraph — routing *within* a single model
      fails (confidence signals are mutually redundant; even a within-model
      oracle couldn't beat random allocation), which is *why* the work routes
      across scales;
    - **calibration rigor** in §3.4 — the deployed **τ = 0.426**, the 5×5
      resolution×budget grid, and the clean held-out protocol (disjoint fit/eval
      split, transfer to the harder raw distribution);
    - **expanded setup** in §4.1 — the **8,220-question / six-benchmark** suite
      (6,050 competent, 1,815 held out), the **cap320** pixel-budget mechanism,
      and the **~35× vLLM-vs-HuggingFace** speedup with the on-demand-VRAM
      rationale;
    - a new **§4.8 Limitations** (relative compute, single model pair, greedy
      decoding, single threshold, cheap-pass-only gate, efficiency ≠ clinical
      reliability);
    - a **resolution–compute frontier** paragraph explaining the cap320 knee.

The paper now fills the **full 8 pages** (the hard cap, re-checked on every
build): two-column, 10 pt body / 12 pt headings, three-line (booktabs) tables,
horizontal-rule algorithms, 33 references, no page numbers, validation passing.
Table 1's four-benchmark macro-averages, top to bottom, are **62.00 / 68.53 /
68.13 / 70.81** (published-7B / published-32B / our cheap-7B / cascade) — the
cascade exceeds the published 32B and sits above our cheap 7B at the macro
level. The **0.639×** headline is `r + E₇/E₃₂` — the escalation rate plus the
cheap leg's tiny share — which is *why* it's almost entirely the escalation
rate (the cheap cap320 leg is only ~53 J, 0.008×).

??? note "Tool knowledge — DOCX two-column build mechanics (hard-won this day)"
    - **Tables need `layout: TableLayoutType.FIXED`** (imported from `docx`),
      or LibreOffice ignores `columnWidths` entirely and auto-sizes by content,
      wrapping headers.
    - Even with fixed layout, a 7-character hyphenated header ("PMC-VQA",
      "VQA-RAD") at 9 pt needs ~850+ DXA to stay on one line; **760 DXA is
      insufficient** (LibreOffice breaks at the hyphen). The reliable workaround
      is **abbreviated headers** (PMC / RAD / Path / SLAKE) with a **legend in
      the caption**.
    - Forcing full-width spanning elements to page tops via
      `SectionType.NEXT_PAGE` reliably **leaves the preceding page's right
      column empty**. The clean layout is **one 1-col title section + one
      continuous 2-col section** for the whole body, every figure/table sized to
      column width.
    - **Build bugs fixed this day:** a split Table 4 breaking across the column
      boundary, a stray leading period on the References heading, the orphaned
      §4.5 heading (`keepNext`/`keepLines`), and a page-4 gap (resolved by
      ordering Table 2 ahead of Fig 3).
    - Mandatory check loop, every build: `validate.py` → LibreOffice PDF convert
      → `pdfinfo | grep Pages` (≤ 8) → `pdftoppm` → **view every rendered page**.

---

## What still genuinely needs Leo (not fabricated)

Two items were flagged as needing real values rather than invented ones:

- **Peak VRAM** — the one red cell in Table 2; to be read from the cascade
  run's startup `resident:` log line.
- The **~7 author lists** in the references flagged `[verify authors]` /
  `[verify order]` for initials and ordering.

---

## Honest ledger of the day

1. **Two-column, template-locked.** Rebuilt from a broken single-column draft
   to the CVGIP spec read from the template XML (83 mm columns, centered
   all-caps headings, 100–150-word abstract, no page numbers, professor-first
   authorship, e-mail `412216085@cloud.fju.edu.tw`).
2. **Fonts fixed to measured truth** — 10 pt body / 12 pt headings / 14 pt
   title (the 9 pt draft read too small).
3. **Algorithm restyled** to EIBNet's horizontal-rules-only form (no box, no
   vertical separators).
4. **Bibliography 20 → 33** verified references across five Related-Work
   subsections.
5. **Our 7B and 32B accuracy hidden** from Table 1 / Fig 3 — only
   cascade-vs-published shown (+2.28 macro / +8.81); endpoints relabeled as
   cascade operating points; zero stray reproduction numbers.
6. **Authorship corrected** — Yuan-Kai Wang and Li-Wen Kuan only; all
   author-"Dan" mentions removed (Dan = Li-Wen Kuan).
7. **Density raised to fill 8 pages** — cross-model motivation, §3.4
   calibration rigor, §4.1 expanded setup, §4.8 Limitations, the
   resolution–compute frontier paragraph.
8. **Headline number firmed** — measured **0.639×** always-32B compute at
   parity (63.1% escalation; 4398 J vs 6883 J/query; cheap leg ~0.008×).
9. **Pending, not fabricated** — peak VRAM (one red cell) and ~7 reference
   author lists.

!!! note "On the project's direction"
    The manuscript is titled **MedVLM-Cascade** (CVGIP 2026) — a frozen
    margin-gated 7B→32B compute cascade for medical VQA, framed honestly as an
    *efficiency* contribution. The site name still reads *question-aware visual
    token pruning*; with a titled paper now in hand, the rebrand is overdue and
    a clear candidate, but is left to Leo's call.

---

### Plan for next session

- [ ] **Reviewer-grade stress-test of the manuscript** — anticipate the holes
      a top-venue reviewer would open (framing, benchmark exclusions, missing
      baselines, measurement rigor, statistics) and close them before
      resubmission. *(Done June 13.)*
- [ ] Drop in the **peak VRAM** value and the **~7 reference author lists**
      once Leo supplies them.
- [ ] Reconcile the **gate description** with the shipped checkpoint (the paper
      says raw-margin threshold; verify the artifact). *(Surfaced June 13.)*

---

## Pushed today

**No code push.** The day's work was manuscript production, not research code —
the build pipeline (`build_paper.js` → DOCX, `make_figs.py` → figures) runs in
the paper sandbox, and the DOCX/PDF are deliverables rather than commits to the
`medvlthinker-imgdiff-compute` repo.
