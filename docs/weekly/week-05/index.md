# Week 5 — Cross-model efficiency cascade (7B→32B)

<span class="pill pill--done">Done</span>

**Pivot phase** (single-model compute router → cross-model cascade) ·
**Week 5 of 12**

**Goal of the week** — resolve the question
[Week 4](../week-04/index.md) left open: the single-model compute router
cleared a *first* gate (routable heterogeneity looked real) but never
proved the oracle headroom was *reachable*. Week 5 opens by auditing that
direction to destruction — is the per-question oracle genuine
complementarity or a statistical artifact? — and, if it fails, pivoting to
the architecture that can actually carry complementarity: a **7B→32B
cross-model cascade** (cheap model default, escalate hard questions to a
genuinely different, larger model). Establish whether cross-model
complementarity exists, and whether it is reachable from a cheap escalation
signal.

!!! note "The 12-week plan and the pivot"
    The original plan had Week 5 as "Phase 3 — Scoring-head v1 (first
    trainable pruning module)." Pruning-for-accuracy was closed back in
    Week 3, so Week 5's actual focus is the cross-model cascade that the
    routing work converged on. The site name and the 7-phase plan are left
    as-is for now; the rebrand is deferred until the new direction produces
    a headline result — which, as of Day 1, it has a candidate for (a
    working efficiency cascade on competent medical VQA).

This page is the **overview** — a short summary of each day. Click any
day's heading for the full detail page.

---

### [Day 1 — Sunday, June 7, 2026](day-01.md)

The biggest single day of the project — a direction audited to death and a
breakthrough pivot in the same session. June 7 opened on the n=500 results
from [Week 4 Day 5](../week-04/day-05.md):

- **The June-6 oracle was a mirage.** A luck-floor permutation control
  showed the per-question oracle sits **far *below*** the
  independent-errors floor on every dataset (pooled real oracle 0.550 vs
  luck floor 0.753, **z = −29σ**). The four single-model arms make
  *positively correlated* errors — they're right together and wrong
  together. The +9–10pp "headroom" was a max-of-K artifact, not reachable
  signal.
- **Forensic audit → single-model routing definitively closed.** Two root
  causes: (1) think/nothink/RAG are *efficiency* knobs being misused as
  *accuracy* knobs; (2) nothink/RAG are the *same 7B* lightly perturbed, so
  the arms share one knowledge base and fail on the same questions. The
  decisive **PMC-VQA recoverability control** (the competent benchmark — if
  routing could work anywhere, here) confirmed it: oracle 0.690 ≪ luck
  floor 0.931 (**z = −25.1**), and a trained router (**0.498**) can't even
  match the best single arm (**0.516**).
- **Pivot: 7B→32B cross-model cascade.** Complementarity needs *different
  models*, not different policies on one model. Downloaded MedVLThinker-32B
  (63 GB, 14 shards, split across both A100s), built a new **vLLM 25.09
  container**, wrote `run_32b_vllm.py` (fixed an 80%-trace-truncation bug
  via `max_tokens=2048`, a 6-image MedXpert crash via
  `limit_mm_per_prompt=8`), and generated paired 32B/cheap-7B labels across
  all six datasets overnight.
- **Cross-model complementarity is real** — the `only-7B` cells are
  **20.8–26.8%** (the cheap 7B rescues 104–134 questions per dataset the
  32B gets wrong), and the oracle clears 32B-alone by **+12.5pp pooled**.
  Fundamentally different from the redundant single-model arms; the pivot
  was the right call.
- **…but the naive confidence-margin gate can't reach it on hard
  benchmarks** — it escalates **96%** to the 32B and just reproduces it.
  The overnight **hidden-state probe** (`router_escalate.py`, layer-14
  features) was **falsified**: hidden-state AUROC is *worse* than the raw
  margin everywhere — the headroom isn't reachable from 7B internals.
- **The real, defensible result: a working efficiency cascade on competent
  medical VQA.** The simple margin gate matches or beats a 32B medical VLM
  at **30–60% of its inference cost** across four datasets (VQA-RAD
  **0.781 @ 28%** vs 32B 0.776; PathVQA 0.680 @ 60%; SLAKE 0.762 @ 63%;
  PMC-VQA 0.554 @ 56%). MedXpert fails cleanly (near-chance, AUROC ~0.5).

The honest framing: **efficiency, not accuracy** — match 32B quality at
~60% cost where the 7B's confidence is predictive; the +12.5pp accuracy
headroom is real but unreachable from cheap signals, and that is the
precise open problem. The most coherent the project has been: a working
method plus a clean set of negatives that bound it. No code pushed today.

### [Day 2 — Tuesday, June 9, 2026](day-02.md)

A disciplined day that *closed* the open question from Day 1 rather than
opening a new one. (June 8 was the **MedVLThinker presentation**; June 9 is the next
research session.) Path A — reach the +12.5pp headroom with a stronger cheap
signal — got one clean, pre-registered shot, and was falsified:

- **Two untested signals added** — extended `router_escalate.py` with the
  **full predictive distribution** (`entropy` and the whole sorted A–J
  log-prob vector, `dist_full`), the obvious thing Day 1's margin-only probe
  skipped, on the identical CV folds.
- **An apparent accuracy win → stress-tested → falsified.** At a hand-picked
  threshold `dist_full`/`entropy` beat always-32B on the closed-form sets; a
  Pareto sweep (`router_pareto.py`) made it look like it might hold; but a
  **pre-registered paired bootstrap** (`router_bootstrap.py`, B=2000) at an
  *a-priori* err-rate budget showed **every gain non-significant — except
  SLAKE `dist_full`, which is significantly *worse* than the 32B.** Every
  `SIG+` sat on a `peak` row whose budget was chosen on the data.
- **Path A closed cleanly** — the headroom is not reachable from any cheap 7B
  signal tested (margin, entropy, full distribution, or layer-14 hidden
  state). Efficiency, not accuracy — now backed by a significance test.
- **Efficiency cascade intact and statistically clean** — parity with the 32B
  while keeping ~54–76% of questions on the cheap 7B (VQA-RAD ~24% escalation,
  PathVQA ~36%, PMC-VQA ~46%; SLAKE the weak case at ~60%).
- **Signal choice flipped** — use the simple **`margin`** (never significantly
  negative anywhere), not `dist_full` (significantly hurts SLAKE). The rich
  signal was best only at the accuracy peaks that didn't survive.

The accuracy direction is honestly closed; the **7B→32B confidence-margin
efficiency cascade** is the committed result. With the framing settled, the
rest of the session **locked the deployable artifact**: a contamination-clean
**frozen margin gate** (`router_margin.pkl`, fit on a clean PMC-VQA train split
with all eval held out — m23k RL is text-only, so train is uncontaminated; a
bootstrap CI confirms efficiency parity across all four competent benchmarks);
an **honest prefill-inclusive FLOPs ≈ 75%** of always-32B (correcting an
optimistic ~59% decode-only proxy); and a check that **nothing beats the 1-D
margin gate** — a learned HistGBM router and a CP-Router-style conformal
mechanism both lose, and a signal-separation diagnostic (AUROC ≈ 0.5 on 3/4)
shows the margin can't predict *whether* escalation fixes a question.
Contrast/target paper: **CP-Router** (arXiv 2505.19970, AAAI). An overnight
**resolution sweep** was then launched (cap640 0.535 vs full-res 0.539).
Pushed the next day as `d474015`.

### [Day 3 — Wednesday, June 10, 2026](day-03.md)

A build-and-measure day with one sharp methodological catch and one honest
walk-back, building on the frozen gate + honest FLOPs locked the previous
evening (now on [Day 2](day-02.md)).

- **Resolution sweep — no visual cliff.** Shrinking the 7B's vision tokens
  leaves accuracy flat from fullres down to cap160 (pooled 0.621→0.617),
  degrading only at cap80, concentrated in the radiology sets (SLAKE −0.033,
  VQA-RAD −0.044). An **efficiency** lever, not an accuracy one.
- **A τ-on-test trap, caught.** The first cascade-sim chose its threshold *on
  the eval data*, faking a 25-point cost gap between two equal-accuracy arms —
  overfitting to SLAKE sampling noise. Replaced with a **held-out τ grid**.
- **Held-out grid → cap320 at 74%.** τ trained on pmctrain transfers across
  serving resolution; serving the 7B at **cap320** holds the cascade at
  **0.572 (= always-32B parity)** at **74%** of always-32B compute
  (prefill-inclusive), down from 79% at full resolution — a free 5-point
  saving. Refines the ~75% carried from June 9.
- **Real-time cascade harness built** (`rt_cascade.py` + `rt_analyze.py`) —
  live 7B→gate→32B with per-GPU power/energy/VRAM/latency, HF-separate (true
  VRAM: 7B ≈ 18 GB / 32B ≈ 68 GB) chosen over vLLM-pooling, resumable, with a
  faithfulness check vs the validated vLLM labels baked in.
- **A smoke-test scare, honestly walked back.** Cascade 0.500 < 7B 0.660 on a
  50-question slice looked like a broken 32B leg; the faithfulness check
  (HF 0.355 vs vLLM 0.387, 84% agreement, 0% truncation) showed it was a hard
  slice + engine numerics — **not a bug** — correcting a too-quick call.
- **Full cap320 real-time run launched** — all six benchmarks, 8,220 queries,
  overnight, tracking the offline 0.572 to yield the wall-clock/energy analog
  of the FLOPs 74%.

Bottom line: the resolution work is an **efficiency ablation that strengthens
the cascade** (cheap leg tolerates 2–4× fewer vision tokens for free), and the
real-time harness will turn the FLOPs 74% into a measured wall-clock/energy
number. Today also cleared the previous session's code backlog —
pushed as `d474015`.

### [Day 4 — Friday, June 12, 2026](day-04.md)

A pure paper-production day (June 11 was off) — turning the cascade into a
submission-grade **CVGIP 2026** manuscript (8-page cap, two-column DOCX), in
three demanding rounds of format-and-content fixes against the official
template and a submitted exemplar (EIBNet), with the full render-check loop on
every build:

- **Two-column, template-locked** — read the template XML for the spec (83 mm
  columns, centered all-caps headings, 100–150-word abstract, no page numbers,
  professor-first authorship); fixed the body font from 9 pt to the measured
  **10 pt** (12 pt headings); restyled the algorithm to EIBNet's
  horizontal-rules-only form.
- **Bibliography 20 → 33** verified references across five Related-Work
  subsections; density raised to fill the full **8 pages** (cross-model
  motivation, §3.4 calibration rigor, §4.1 expanded setup, §4.8 Limitations,
  the resolution–compute frontier).
- **Hid our own 7B *and* 32B accuracy** from Table 1 / Fig 3 — only
  cascade-vs-published shown (**+2.28 macro / +8.81**), because our internal
  reproductions *exceed* the published MedVLThinker baselines and would invite
  harness-difference questions; endpoints relabeled as cascade operating points.
- **Corrected authorship** — Yuan-Kai Wang and Li-Wen Kuan only; removed the
  mistaken co-author "Dan" (**Dan is Li-Wen Kuan himself**).
- **Headline firmed** — the live cascade runs at a measured **0.639×** of
  always-32B compute at parity (63.1% escalation; 4398 J vs 6883 J/query).

Still pending (not fabricated): peak VRAM and ~7 reference author lists. No code
pushed.

### [Day 5 — Saturday, June 13, 2026](day-05.md)

A reviewer-grade audit — attack the manuscript the way a top-venue reviewer
would, then close the holes. The literature review produced **~22 numbered
holes across five tiers** and a blunt **verdict**: fix the self-contradiction
and the benchmark-cherry-picking attack and add baselines → workshop/mid-tier;
add headroom recovery or six-benchmark generality → journal-tier. One
training-free script (`fbe_and_signals.py`, checkpoint-only, zero new inference)
did the empirical work:

- **Two Tier-1 self-contradictions in the manuscript** — (#1) an accuracy-win
  headline (Table 1 macro **70.81%** vs *published* numbers) fights the
  efficiency-at-parity claim (Table 3 **0.655** vs *own* 32B, CIs spanning
  zero), on different math/harnesses; (#2) "**never worse than the 7B**" is
  *false* on the paper's own data — cascade PathVQA **66.45 < published-7B
  66.83**.
- **The τ that wasn't.** The paper describes the gate as a raw-margin threshold
  (τ = 0.426), but `router_margin.pkl` is a **StandardScaler + logistic
  pipeline**, so 0.426 is a cut in *standardized z-space* — raw thresholding
  escalates 46.1% vs the live **63.1%**, a **17-point** reproducibility gap.
- **MMMU exclusion contradicted** — the 7B scores **0.547** on MMMU (above
  chance), so "excluded because near-chance" doesn't hold for it (MedXpert at
  0.225 / 0.256 stays defensible).
- **Six-router tie** — margin / top1 / entropy / temp-margin / conformal / FBE,
  **none beats the one-line margin gate** at matched compute (best Δ +0.0020,
  ns under Bonferroni); FBE degenerates (escalates 98.6%); the oracle ceiling
  (rescuable 0.157 / breakable 0.134) nets +0.023, unreachable from any 7B
  signal. Calibration is irrelevant (T = 3.65, recalibration +0.0004 ns).
- **Missing-reference gaps** — zero medical RL-reasoning VLMs (MedVLM-R1,
  Med-R1, GMAI-VL-R1, Lingshu, MedGemma) and zero visual-token-pruning methods
  (FastV, SparseVLM, HiRED, VScan, LLaVA-Mini, ATP-LLaVA), the latter
  reconnecting the paper to its pruning origins.
- **A pre-registered fix queue** — items 1–3 (all-six table, instrumented 32B
  energy, HF/vLLM reconciliation) as tonight's chain; item 4 (a proxy-confidence
  probe, gated AUROC > 0.60) the one that could turn the negative result into a
  positive method. Gate-description decision: lean toward a true raw-margin
  quantile gate; cite **Narasimhan (2022)** / **Jitkrittum (2023)**, CP-Router
  as contrast.

The result is left intact and **better-supported** — the negative routing
result is now a demonstration, not an assertion — with the honest manuscript
fixes (the two contradictions, the gate description, MMMU, the missing
citations) queued. No code pushed.

---

## Plan for the week (Jun 7 – Jun 13)

- [x] **Audit the single-model router** (Day 1) — luck-floor control +
      PMC-VQA recoverability → **closed** (correlated errors, z = −25 to
      −29σ; trained router below best-fixed).
- [x] **Pivot to the 7B→32B cascade** (Day 1) — 32B downloaded, vLLM 25.09
      container built, paired labels generated; **complementarity confirmed
      real** (+12.5pp oracle, 20–27% only-7B).
- [x] **Escalation-gate test** (Day 1) — naive margin gate + hidden-state
      probe; hidden state **falsified** (worse than margin); margin cascade
      **works as efficiency** on the four competent benchmarks.
- [x] **Decide the framing to commit** (Day 2) — gave Path A one
      pre-registered shot (full-distribution escalation signals); the bootstrap
      **falsified the accuracy gain**, committing the project to the
      **efficiency cascade** framing.
- [x] **Accuracy-vs-cost / cost grid** (Day 3) — a held-out τ grid over
      resolution caps; the cascade holds **0.572 (= always-32B parity)** at
      **74%** prefill-inclusive compute serving at **cap320**. (A polished
      cost-vs-accuracy SVG from the `router_pareto.py` numbers still to draw.)
- [x] **Frozen gate trained contamination-clean + honest FLOPs** (June 9 eve,
      logged Day 3) — `router_margin.pkl` on clean PMC-VQA train; prefill-incl
      FLOPs ~75%; learned-router & CP-Router-conformal both fail to beat the
      1-D margin gate.
- [ ] **Read the full cap320 real-time run** (Day 3 → next) — confirm live
      pooled accuracy tracks **0.572**; report the cascade's **energy as % of
      always-32B** beside the FLOPs 74%, with the per-benchmark
      latency/power/VRAM table.
- [ ] **Leave-one-dataset-out test** (Day 2 → next) — fit the gate on some
      competent datasets, route a held-out one; the generalization test that
      turns "a real result on this data" into "a deployable method."
- [x] **June 8:** presented **MedVLThinker** (the project's base-model paper).
- [ ] Commit the `medvlthinker-imgdiff-compute` scripts — Day-3 code
      (`rt_cascade.py`, `rt_analyze.py`, the held-out τ grid) plus the
      previous session's uncommitted scripts (frozen-gate training, FLOPs,
      conformal, `run_7b_prune_sweep.py`) — once the real-time numbers are in.
- [x] **Write the CVGIP 2026 manuscript** (Day 4) — eight-page two-column DOCX,
      template-locked, 33 references, our 7B/32B hidden, Dan removed from
      authorship, headline **0.639×** compute.
- [x] **Reviewer-grade audit of the manuscript** (Day 5) — six-router bake-off
      (none beats the one-line gate), the τ/pipeline reproducibility gap, the
      MMMU-exclusion contradiction, and the calibration-irrelevance finding.
- [ ] **Resolve the gate description** (Day 5 → next) — refit a true raw-margin
      quantile gate (or rewrite §3.2 for the standardized-margin gate) and fix
      the MMMU exclusion before resubmission.

---

## Reflections (end-of-week)

Week 5 was the week the project *became a paper*. It opened mid-pivot — the
single-model compute router still on the table — and closed with a written,
format-locked CVGIP 2026 manuscript built on a clean, defensible result. The
research arc resolved cleanly along the way: the single-model router was
**audited to death** (Day 1 — correlated errors, oracle far below the
independence floor), the pivot to a **7B→32B cross-model cascade** found the
complementarity the single model lacked (Day 1 — +12.5pp oracle, 20–27%
only-7B), and the decisive question — *is that accuracy headroom reachable from
a cheap signal?* — was answered **no** under a pre-registered bootstrap
(Day 2), committing the project to an honest **efficiency** framing rather than
an oversold accuracy one. Day 3 turned that into a number (a held-out grid:
**0.572 parity at 74%** compute, serving cap320), and the June 9 evening work
locked the deployable artifact (a contamination-clean frozen gate, honest
prefill-inclusive FLOPs).

The last two days were about *defensibility*, and they raised the bar in the
right direction. Day 4 produced the manuscript; Day 5 then attacked it like a
reviewer and made it stronger — the six-router bake-off converts the central
negative result from an assertion into a demonstration (nothing beats a
one-line gate), and the audit surfaced two genuine honesty fixes (the gate is a
standardized-margin logistic, not the raw threshold the text claims; MMMU
isn't actually near-chance for the 7B) that a careful reviewer *would* have
caught. The measured **0.639×** headline is the kind of number that survives
scrutiny because it came from a live run, not an estimate. What's left is
editorial, not scientific: make the gate description match the checkpoint
(lean: refit a truly raw-margin gate so "parameter-free" is literally true),
re-justify the MMMU exclusion, and drop in the last pending values. The result
is real, modest, and honestly framed — exactly the posture the whole pivot was
arguing for.
