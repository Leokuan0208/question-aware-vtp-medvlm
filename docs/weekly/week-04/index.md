# Week 4 — Direction-D feasibility (visual-grounding pivot)

<span class="pill pill--done">Done</span>

**Pivot phase** (visual-grounding / selective prediction → adaptive
compute) · **Week 4 of 12**

**Goal of the week** — pressure-test the
[Day 19 pivot](../week-03/day-05.md): now that training-free visual-token
*pruning* is closed as a method, does the repurposed direction —
a training-free **evidence-sensitivity router** for medical VQA
(Direction D) — have a real, measurable signal to build on? Establish
the per-dataset evidence-dependence gradient, the confidence→correctness
signal, and the budget-router headroom *before* committing to building
the router.

!!! note "How the week's focus evolved past its own goal"
    The goal above is where the week *started*. It didn't end there.
    Direction D was **closed** on Day 2 (no usable orthogonal signal),
    which forced a clean-slate hunt → an **image-difficulty** wedge
    (Day 3) that was itself **killed** on Day 4 → a reframe into a
    per-question **compute router** that, by Day 5, cleared its first gate
    on the 7B (routable heterogeneity exists; predictability still to be
    tested). Three direction changes in one week; the heading is kept as
    the week's *premise* rather than its conclusion.

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

### [Day 4 — Thursday, June 4, 2026](day-04.md)

The all-red day — but a disciplined one. June 3 (Day 25) was off, so this
session opened on Tuesday's overnight verdict and rebuilt from a clean
kill:

- **Lesion-aware verdict: NO-GO.** The image-difficulty wedge is dead —
  lesion features were *weaker* than the crude proxies, wrong-signed, not
  significant (lesion_area ρ=+0.043, lesion_contrast ρ=+0.012 p=0.56,
  below the 0.1 floor across all 15 strata). The
  [Day 3 REFINE](day-03.md#phase-6-the-result-refine-and-the-sign-is-the-story)
  run to its honest end.
- **The failure pattern named** — every dead method (QSim, GridPrune/FASP,
  image-complexity) bet on a *natural correlation existing in the data*.
  New rule: pick methods whose value is **constructive/learned**, not
  contingent.
- **New direction: joint perception + knowledge allocation** — per-question
  allocation of a *visual budget* and a *retrieval budget*. Robust by
  construction (both axes have net-positive always-on settings), which is
  exactly what the dead directions lacked. The novelty is the joint; the
  two literatures (visual-token pruning, medical-RAG) are separate
  communities.
- **Reasoning axis (3B): NO-GO** — think − nothink flat-to-negative across
  three of four MedXpert/PMC slices, one noise-level +0.030 on the Reasoning
  slice (multiple-comparisons trap). Corroborates **m1**.
- **Visual axis (3B): live** — vis_full − vis_low = **+0.080** on PMC-VQA,
  clears the bar.
- **Retrieval axis (3B): flat** — always-on text RAG (MedCPT + MedRAG
  Textbooks) net **+0.010**; flip analysis **15% rescue vs 37% damage**;
  near-chance (27%) base masks any selective-gate signal — the same
  no-confidence wall as the [June-1 router](day-02.md).
- **7B confound-check launched, pre-registered as the final probe** —
  reasoning + retrieval at the +0.03 bar; **both flat → direction dead,
  full stop.** Verdict pending the running 7B jobs.
- **June-8 presentation** settled on **MedVLThinker** — the paper behind the
  project's own base models.

The joint perception+knowledge direction needs two live axes and has zero
clean ones on the 3B — underwater pending the 7B. No code pushed today (gate
scripts in `medvlthinker-imgdiff-compute`; 7B verdict mid-run).

### [Day 5 — Saturday, June 6, 2026](day-05.md)

The direction came off life support — not by better numbers, but by the
right *lens*. June 5 (Day 27) was off; this session opened on the overnight
7B verdict:

- **7B verdict, reframed.** As fixed-policy aggregates it reads NO-GO (RAG
  −5pp, think helps only 2/4 subsets). But that's the wrong lens for a
  *router* — the per-question confusion on MedXpert-ALL shows **~25% of
  questions flip** between policies, with a per-question **oracle ceiling
  ~0.39–0.40 vs best fixed 0.30** (+9–10pp) on *both* the think/nothink and
  rag/norag axes. The routable heterogeneity a router needs **exists** — the
  project survives, reframed as the **evidence-&-compute router**.
- **0.30 is on-spec, not a bug.** Published MedVLThinker-7B MedXpert-MM =
  **24.43%**; our n=100 matches it. PMC-VQA **0.55** in the same run
  confirms the harness is sane (easy ≈ 2× the deliberately-brutal MedXpert).
- **Probes rebuilt** — old checkpoints stored only `idx/gold/pred/ok`; added
  `raw_output`, `parse_ok`, `opt_logprobs`, `gen_tokens`, `latency_s`. Found
  the **parse confound** (truncated `<think>…` → default `pred=A`) that can
  fake both accuracy loss *and* flips — the precondition for trusting any
  delta.
- **`gate_router.py` unified** — visual arm dropped, shared `(think,norag)`
  cell de-duplicated, `--cells`/`--full_grid` selectors, built-in
  `--shard k/N`. Confirmation run stays on **7B** (the weaker 3B would
  shrink the oracle band).
- **Second corpus + RAG-lit verdict** — added **StatPearls** alongside
  Textbooks for a corpus comparison (PubMed parked). Retriever/corpus is a
  ~1–2pt lever at 7B; the bottleneck is evidence *use* — which is the
  motivation for the router.
- **Silent-empty-context bug caught** — the Textbooks MedCPT index was never
  built in this `db_dir`; `retrieve.py` swallowed the error and wrote
  0-line files, so the earlier `think_rag_Textbooks = 0.080` ran on empty
  context and was **discarded**. Fixed by building the index over existing
  chunks (~2–4 min) and verifying non-zero retrieval.
- **n=500 sharded baseline launched** — 3 datasets × (3 cells + Textbooks
  `think_rag`), row-stride across both VMs, ~10–11 hr/VM, foreground/live;
  running clean through `MedXpert-Reasoning [nothink_norag]` at end of day.

First time in the pivot a result *survived* the gate — by changing the lens
(router heterogeneity, not fixed-policy average), not by lowering the bar.
The decisive test (is the flip *predictable*?) is next session's merge +
analysis. No code pushed today.

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
- [x] **Merge difficulty shards + lesion-aware verdict** (Day 4) —
      `complexity_lesion.py` (SLAKE masks) → `analyze.py`. **Verdict:
      NO-GO** (lesion features wrong-signed, below the 0.1 floor) — the
      image-difficulty wedge is dead.
- [ ] ~~If GO: MedVLThinker 3B inference + reproduce SLAKE/VQA-RAD
      accuracy; difficulty extraction on the 3B as training labels~~ —
      *did not fire (NO-GO).*
- [x] **Pivot: joint perception + knowledge allocation** (Day 4) — gated
      reasoning / visual / retrieval axes on MedVLThinker-3B. Reasoning
      **NO-GO**, visual **live (+0.080)**, retrieval **flat (+0.010)**.
- [x] **Read the 7B confound-check verdict** (Day 5) — aggregates read
      NO-GO, but the **per-question router lens** shows ~25% policy-flip and
      a **+9–10pp oracle ceiling** on both axes. Direction survives, reframed
      as the **evidence-&-compute router**.
- [x] **Probe rebuild + unified `gate_router.py`** (Day 5) — capture
      `raw_output`/`parse_ok`/`opt_logprobs`/`gen_tokens`/`latency_s`; found
      the parse confound; added StatPearls corpus; caught the silent-empty
      Textbooks-index bug; launched the **n=500 sharded baseline**.
- [ ] **Merge shards + confusion/oracle/confidence-pilot analysis** (next
      session) — recompute Δ/oracle after the parse fix and test whether the
      flip is *predictable* from `opt_logprobs` confidence (the decisive
      question).
- [ ] Commit the `medvlthinker-imgdiff-compute` scripts (`gate_router.py`,
      `retrieve.py`, index-build helper) once the analysis lands
- [ ] Read **ToMe** end-to-end (still pending from Week 2)

---

## Reflections (end-of-week)

Week 4 was the most turbulent of the project — and, by its end, the most
clarifying. It opened still inside Direction D and **closed it cleanly**
(Day 2): the evidence-stability premise carried no usable orthogonal signal,
and confidence-as-router only works on multiple-choice. That forced a
genuine clean-slate hunt (Day 3), which produced the
image-difficulty-driven adaptive-compute wedge — alive for 48 hours until
its lesion-aware falsification came back a clean **NO-GO** (Day 4). The same
day named the pattern behind every death in the project (each dead method
bet on a *natural correlation existing in the data*) and reframed into a
**joint perception + knowledge allocation** idea whose value is meant to be
robust by construction rather than contingent.

The week's real lesson landed on the last day. The two contested axes
(reasoning, retrieval) failed the pre-registered **+0.03 fixed-policy gate**
on both the 3B (Day 4) and the 7B (Day 5) — and yet the direction *survived*,
because the fixed-policy average was the wrong lens for a router. The
per-question confusion showed the thing that actually matters: ~25% of
questions flip between policies and a perfect router would gain ~9–10pp over
any single fixed choice. The discipline that's governed every pivot here held
— the gate wasn't lowered, the *question* was corrected (from "which policy
is best" to "do different questions want different policies"). The honest
caveat is equally clear: an oracle ceiling is necessary but not sufficient.
The decisive test — whether the flip is *predictable* from a cheap signal —
is exactly what next week's merge + confidence-pilot analysis on the n=500
records will decide. If it is, the **evidence-&-compute router** becomes
buildable; if not, the ceiling stays a ceiling and the reset discipline
applies again.

Two process wins worth banking: the probe rebuild (logging `raw_output` /
`parse_ok` / `opt_logprobs` / `gen_tokens` / `latency_s`) finally makes the
numbers trustworthy by separating reasoning from format failure, and the
silent-empty-context bug was caught *before* it cost a night — both
instances of the same principle that's saved compute all project: verify the
instrument before trusting the measurement.
