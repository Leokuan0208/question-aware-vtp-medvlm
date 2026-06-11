# Week 5 — Cross-model efficiency cascade (7B→32B)

<span class="pill pill--wip">In progress</span>

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

---

## Reflections (end-of-week)

_Write this at the end of the week. The question Day 1 sets up: does the
project commit to the efficiency-cascade framing (a real, modest, defensible
contribution — 32B quality at ~60% cost on competent medical VQA), or spend
more of the week chasing a stronger escalation signal to reach the +12.5pp
accuracy headroom that the margin and layer-14 hidden states both can't
touch? Day 1 gave the project its first working method and a clean boundary
around it; the week decides how much further to push the boundary._
