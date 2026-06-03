# Week 4 — Direction-D feasibility (visual-grounding pivot)

<span class="pill pill--wip">In progress</span>

**Pivot phase** (visual-grounding / selective prediction) ·
**Week 4 of 12**

**Goal of the week** — pressure-test the
[Day 19 pivot](../week-03/day-05.md): now that training-free visual-token
*pruning* is closed as a method, does the repurposed direction —
a training-free **evidence-sensitivity router** for medical VQA
(Direction D) — have a real, measurable signal to build on? Establish
the per-dataset evidence-dependence gradient, the confidence→correctness
signal, and the budget-router headroom *before* committing to building
the router.

!!! note "The 12-week plan and the pivot"
    The original plan had Week 4 as "Phase 2 — identify pruning
    insertion points." The Day 19 negative result closed pruning as a
    method, so Week 4's actual focus is the visual-grounding
    feasibility work instead. The site name and the 7-phase plan are
    left as-is for now; the rebrand is deferred until the new
    direction produces a headline result.

This page is the **overview** — a short summary of each day. Click any
day's heading for the full detail page.

---

### [Day 1 — Sunday, May 31, 2026](day-01.md)

The first full day on the new direction. Days 20–21 (May 29–30) were
off while the
[18-run scored sweep](../week-03/day-05.md#phase-7-instrumentation-built-overnight-sweep-launched)
ran. The nested arm had failed overnight on an argparse bug; fixed it,
rebalanced a 4+4 two-VM relaunch, and the 18/18 gate passed (nesting
verified offline). The afternoon was a four-way Direction-D feasibility
study, and the verdict is **go, with the thesis sharpened**:

- **Robustness curve** reproduces Day 19 on clean instrumentation —
  halving visual tokens costs ~0.6–0.8 pts, 90% removal ~4 pts.
- **Per-dataset evidence-dependence gradient** (the gold), triangulated
  across accuracy drop *and* flip rate: PMC-VQA most evidence-dependent
  (−7.0 pt, 30.5% flips), **PathVQA least** (−0.3 pt, 11.0% flips) —
  confirming Day 19's locked-in-wrong observation.
- **Flip direction** (GT recovered exactly): evidence-loss rate per
  dataset is the router target — PMC-VQA 10.7% → PathVQA 4.4%.
- **Router signal real** — confidence predicts correctness at
  **AUROC ≈ 0.74**; offline budget-router headroom positive at every
  budget pair (peak ~1.6 pt).
- **Approach 2 (width router) is a clean negative on compute** —
  double-pass overhead exceeds fixed-high; documented, not hidden.
- **Grid probe launched** (budget×layer logit-lens, 5 budgets × 28
  layers × 17.3k samples) to locate the cheapest early signal; results
  land next session.

Two methodology traps logged: the aggregate nested-vs-independent
agreement is a consistency check not a result, and the identical
flip-direction counts are a shared-seed artifact
([Bug #11](../../bugs.md#11-nested-vs-independent-random-pruning-cannot-be-an-independent-check)).
Committed the fix and the whole feasibility suite at
[`df0a3c4`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/df0a3c4).

### [Day 2 — Monday, June 1, 2026](day-02.md)

The day Direction-D's router met its own bar — and, on the signals
tested so far, doesn't clear it. Two offline analyses, no GPU:

- **Grid probe analyzed** (lens gate passed, 0.2213 = 0.2213). The
  routable signal is **real but late and modest** — `lens_entropy`
  peaks at **AUROC 0.756 at layer 28**, confirming (not beating)
  Day 22's ~0.74. AUROC is near-chance through layers 1–20 and only
  ramps in the last few, so **there is no cheap early-layer signal**;
  the one compute lever is the budget axis (0.748 at kr=0.5).
- **`cos_final` early-layer cell is a trap** — it needs all 28 layers
  to compute, so it's a post-hoc convergence diagnostic, not an
  early-exit router (logged as a methodology note).
- **Two-feature probe: no lift.** Combining entropy + margin +
  option-logprob (0.758) does **not** beat the best single feature
  (0.762). This overturns Day 22's hypothesis that option-logprob was
  the missing second feature — the confidence features are mutually
  redundant. The **multi-option subset** (≥3 options) is the stronger
  regime at **0.814**.
- **Verdict: partial.** The confidence-only path to Direction D is a
  clean negative (a single-point confidence router won't close
  Approach 2's realized-cost math). But D's defining axis —
  **evidence-stability**, orthogonal to confidence — hasn't been
  tested as a router feature yet — but it was run that same evening
  (Phase 6) and came back flat: cross-budget evidence-flip AUROC 0.548
  alone, +0.466 correlated with confidence, +0.001 combined, −0.002 on
  PathVQA. **Direction D is closed** — both the confidence path and the
  evidence-dial premise carry no usable orthogonal signal. What
  survives: answer confidence predicts correctness, but only on
  multiple-choice (0.72–0.81; open-ended ~0.57).

Committed both probes at
[`04ef73c`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/04ef73c).

### [Day 3 — Tuesday, June 2, 2026](day-03.md)

A clean-slate reset. With Direction D closed and every prior path
dead-ended, the brief was deliberately radical: *if we forgot
everything, what would the direction be?* — same constraints (3
months, medical VLM, 2×A100), one rule: a **method**, not an analysis
paper. The day:

- **Literature hunt** ruled out the crowded RL/GRPO space and left two
  candidates: **Direction B** (question-aware MedPruner-style token
  scoring on lesion benchmarks) and **the lead** (question-conditioned
  *adaptive compute*).
- **B torn down** — it re-enters the saturated token-scoring arena
  where random already won; viable only in a narrow
  cross-attention-on-lesion form, and even then a coin-flip.
- **The wedge** — a difficulty signal derived from the **visual
  content** (lesion subtlety / image complexity), computed **before
  generation**, used to **allocate reasoning compute**, in medical
  VLMs. The mechanism is commoditized; novelty lives in the *signal*.
- **The method** — externalize difficulty by sampling (pass-count),
  then route each `(image, question)` to a reasoning-budget bucket
  {answer-now / short-CoT / long-CoT} via an input-side predictor
  (start) or difficulty-aware GRPO. The Direction-D "no readable
  internal signal" result *is* the motivation for externalizing.
- **Falsification test** (zero new models, on HuatuoGPT,
  `difficulty_medvlthinker.py` + the `exp_*` cross-check): does
  image-complexity predict per-case difficulty with question type held
  fixed? **VERDICT: REFINE** on 2,394 cases — real and highly
  significant (entropy partial ρ=−0.113, p=3e-8) but weak (|ρ|≤0.11)
  and *negative* (busier = easier). Reading: whole-image texture
  measures evidence-richness, not lesion subtlety → refine with
  lesion-aware complexity (SLAKE organ masks).
- **New base model: MedVLThinker** (UCSC-VLAA, Qwen2.5-VL, Apache-2.0)
  — open code + difficulty-filtered data + eval harness +
  `<think>`/`<answer>` checkpoints. New **training-capable Docker
  image** (Qwen2.5-VL base + `trl`/`peft`/`vllm`, flash-attn
  verify-first, HF caches on `/data`); transformers 4.37 vs ≥4.49
  conflict keeps the HuatuoGPT env untouched. New repo
  `medvlthinker-imgdiff-compute`; 3B downloaded.

The definitive 3B gate — after a caught `--limit` sampling trap
(stratum-sorted subset → fixed by seed-shuffling `build_subset.py`) —
was sharded (`difficulty_medvlthinker.py --num_shards 2 --shard 0/1`)
and left **running inference across both VMs** overnight; next session
merges by qid and runs the lesion-aware verdict. No code pushed today.

---

## Plan for the week (May 31 – Jun 6)

- [x] Fix the failed nested arm and re-run; pass the 18/18 gate
      (Day 1)
- [x] Robustness curve on the scored harness (Day 1)
- [x] Per-dataset evidence-dependence gradient — accuracy + flip
      rate (Day 1)
- [x] Router feasibility probe — confidence AUROC ≈ 0.74 (Day 1)
- [x] Budget-router headroom + Approach 2 width router (negative)
      (Day 1)
- [x] Grid probe + `grid_analysis.py` — signal late (L28), modest
      (0.756), no early-layer cell (Day 2)
- [x] Two-feature confidence probe — no lift (0.762 → 0.758) (Day 2)
- [x] **Decisive evidence-stability test — Direction D closed**
      (Day 2 evening). Stability 0.548 alone, +0.001 combined, −0.002
      on PathVQA. What survives: confidence works on MC only.
- [x] **Clean-slate direction hunt** — landed on image-difficulty-
      driven adaptive compute; tore down Direction B (Day 3)
- [x] **Falsification test of the new wedge** — REFINE (image→difficulty
      real but weak & negative; whole-image texture ≠ lesion subtlety)
      (Day 3)
- [x] **New base model + environment** — MedVLThinker (Qwen2.5-VL),
      isolated venv, repo `medvlthinker-imgdiff-compute`, 3B downloaded
      (Day 3)
- [ ] **Merge difficulty shards + lesion-aware verdict** (Day 4) —
      `complexity_lesion.py` (SLAKE masks) → `analyze.py`; GO vs.
      stop-and-reconsider
- [ ] If GO: MedVLThinker 3B inference + reproduce SLAKE/VQA-RAD
      accuracy; difficulty extraction on the 3B as training labels
- [ ] Commit the `medvlthinker-imgdiff-compute` scaffold once the gate
      verdict is in
- [ ] Read **ToMe** end-to-end (still pending from Week 2)

---

## Reflections (end-of-week)

_Write this at the end of the week. The question: does the
Direction-D router clear its own bar — a routable signal that beats
fixed budgets on realized cost, not just on an offline upper bound?
Day 1 says the signal exists (AUROC 0.74, positive headroom) and
Approach 2 says the naive width-router doesn't pay for itself; the
week decides whether routing down (cheap-when-confident) does._
