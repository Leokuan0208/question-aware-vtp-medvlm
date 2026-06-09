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
- [ ] **Decide the framing to commit:** efficiency cascade (Path B, the
      defensible result now) vs. a further hunt for a stronger escalation
      signal to reach the accuracy headroom (Path A, a real experiment that
      could fail).
- [ ] If efficiency framing: build clean **accuracy-vs-cost curves** across
      the four competent benchmarks (VQA-RAD / SLAKE / PathVQA / PMC-VQA);
      decide cost metric (escalation % → FLOPs / latency).
- [ ] **June 8:** present **m1** (deck ready).
- [ ] Commit the `medvlthinker-imgdiff-compute` scripts
      (`pmcvqa_recoverability.py`, `run_32b_vllm.py`, `router_escalate.py`,
      cascade analysis, the vLLM 25.09 Dockerfile) once the framing is set.

---

## Reflections (end-of-week)

_Write this at the end of the week. The question Day 1 sets up: does the
project commit to the efficiency-cascade framing (a real, modest, defensible
contribution — 32B quality at ~60% cost on competent medical VQA), or spend
more of the week chasing a stronger escalation signal to reach the +12.5pp
accuracy headroom that the margin and layer-14 hidden states both can't
touch? Day 1 gave the project its first working method and a clean boundary
around it; the week decides how much further to push the boundary._
