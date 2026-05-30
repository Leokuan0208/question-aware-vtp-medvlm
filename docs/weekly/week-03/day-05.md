# Day 5 — Thursday, May 28, 2026

[← Back to Week 3 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) → closing out · Week 3,
Day 5 · **Day 19 of the project**

---

The day the pruning thesis closed and a new direction opened. Came
in to analyze last night's
[E3 sweep](day-04.md#phase-6-fasp-gridprune-design) — the
coverage-aware methods (GridPrune, FASP+GridPrune) that were
supposed to clear Phase 4's Random floor. They didn't. **Random
Pareto-dominates every structured method on both accuracy and
latency, at every keep-ratio** — the third consecutive sweep where
being clever about *which* visual tokens to keep loses to picking
at random. That closes training-free visual-token pruning as a
*method* for this model.

But the same negative result pointed at something live. The reason
Random does so well is that **HuatuoGPT-Vision barely needs the
fine-grained visual evidence** — it answers most questions the same
way whether it sees 100% or 10% of the image tokens. That's not a
pruning story; it's a *visual-grounding* story. The afternoon was
spent mining the literature for a defensible, training-free novel
direction built on that observation, scoping four candidates, and
running a zero-GPU feasibility probe on data already on disk that
**green-lit an evidence-router direction** and specified the next
feature to build. The day ended with the instrumentation for that
direction committed and an 18-run scored sweep launched overnight.

---

## Phase 1 — Smell-test the E3 sweep

Same discipline as Day 3: **confirm pruning actually fired before
trusting any number.** Twelve runs (3 methods × 4 keep-ratios),
each checked for token count hitting its target, the patcher
sentinel (`config.pruner`) correctly populated, and the latency
fields present.

```text
=== Smell test: token count + method sentinel from config + total score ===
  pruner              kr   n_post  target  ok    total
  ----------------------------------------------------------------
  fasp_gridprune     0.1     58.0      58   ✓   0.6119
  fasp_gridprune    0.25    144.0     144   ✓   0.6430
  fasp_gridprune     0.5    288.0     288   ✓   0.6625
  fasp_gridprune    0.75    432.0     432   ✓   0.6759
  gridprune          0.1     58.0      58   ✓   0.6102
  gridprune         0.25    144.0     144   ✓   0.6409
  gridprune          0.5    288.0     288   ✓   0.6573
  gridprune         0.75   431.58     432   ✓   0.6680
  random             0.1     58.0      58   ✓   0.6357
  random            0.25    144.0     144   ✓   0.6570
  random             0.5    288.0     288   ✓   0.6730
  random            0.75    432.0     432   ✓   0.6746
```

12/12 clean. The one non-integer (`gridprune kr=0.75 → 431.58`) is
per-sample averaging: GridPrune allocates an integer budget per
zone, and at kr=0.75 with the zone count in play the arithmetic
occasionally rounds down by one token. 431 vs 432 across the sample
set is rounding noise, not a bug.

---

## Phase 2 — E3 results: Random wins again

Baseline (kr=1.0, no pruning) = **0.6787**.

| kr | Random | GridPrune | FASP+GridPrune |
|---|---|---|---|
| 0.75 | **0.6746** | 0.6680 | 0.6759 † |
| 0.50 | **0.6730** | 0.6573 | 0.6625 |
| 0.25 | **0.6570** | 0.6409 | 0.6430 |
| 0.10 | **0.6357** | 0.6102 | 0.6119 |

Bold = best at that keep-ratio. **Random is best at every one.**
† The FASP+GridPrune kr=0.75 cell is a degenerate artifact — see
[Phase 3](#phase-3-the-kr075-anomaly-bug-10).

Gap to Random (positive = beats Random):

| kr | GridPrune | FASP+GridPrune |
|---|---|---|
| 0.75 | −0.66 | +0.13 † |
| 0.50 | −1.57 | −1.05 |
| 0.25 | −1.61 | −1.40 |
| 0.10 | −2.55 | −2.38 |

Three readings, in decreasing order of confidence:

1. **Random wins at every keep-ratio — third sweep running.** Same
   monotone gap-growth signature as the QSim sweeps: the gap is
   smallest at kr=0.75 and largest at kr=0.10. Every method we test
   makes pruning *hurt more* than random does, and the penalty for
   being clever grows as pruning gets aggressive.
2. **FASP+GridPrune > GridPrune at every real kr, consistently.**
   The deltas are small but they don't flip: +0.52, +0.21, +0.17
   pts as kr drops through 0.5 / 0.25 / 0.1. So FASP's anatomy
   filter *does* add a sliver of real signal on top of GridPrune's
   coverage logic — it's just nowhere near enough to reach Random.
3. **Random itself is extraordinarily strong.** At kr=0.50 (half
   the visual tokens dropped) Random loses only **0.57 pts** vs the
   unpruned baseline; at kr=0.25 (75% dropped), only 2.17 pts. The
   model is far more robust to random token dropping than you'd
   expect for a medical VLM. **This is the most important number in
   the table** — it reframes the whole problem from "how do we prune
   well" to "why doesn't the model need the visual tokens."

---

## Phase 3 — The kr=0.75 anomaly (Bug #10)

The latency table (Phase 4) showed FASP+GridPrune costing **0.58 ms**
of prune time at kr=0.75 — essentially Random's "do-nothing" cost,
and *cheaper* than GridPrune, when it should always cost more (it
runs FASP's filter on top of GridPrune's logic). At the other three
keep-ratios it does cost more. Only kr=0.75 inverts.

The cause is a code branch, diagnosable from the config. The run
used `bg_fraction = 0.3`: FASP designates 30% of tokens as
background and filters them, leaving ~404 of 576 as foreground
candidates. But **at kr=0.75 the keep target is 432 tokens — more
than the 404 the filter leaves.** When the keep target exceeds the
foreground budget, the zonal GridPrune stage has nothing to select
among (you're forced to keep all foreground), so the method
short-circuits to a cheap "keep all foreground, backfill the rest
from background" branch that skips the expensive zonal allocation.
That bypass is the 0.58 ms.

The trigger is exactly `keep_ratio > 1 − bg_fraction = 0.70`. Of the
four swept values only kr=0.75 sits above 0.70, which is exactly
where the anomaly appears.

**Why it matters beyond latency:** the kr=0.75 FASP+GridPrune
*accuracy* cell (0.6759, the one "+0.13 win" over Random) was not
produced by the real algorithm — it came from the degenerate
backfill branch. Removing it makes the negative result *cleaner*:

- The total-level kr=0.75 "win" → **artifact, dropped.**
- 3 of the 4 per-benchmark cells where FASP+GridPrune beat Random
  were at kr=0.75 (all degenerate, all dropped).
- That leaves **exactly one** real-path win: VQA-RAD at kr=0.25
  (+3.59 pts), a single cell already flagged as likely
  high-variance noise.

So on the valid (non-degenerate) cells, FASP+GridPrune beats Random
in **1 of 18** benchmark×kr comparisons and loses on the total at
every real keep-ratio. Logged as
[Bug #10](../../bugs.md#10-degenerate-faspgridprune-branch-at-kr075-inflated-the-e3-table)
— a data-integrity note, not a crash. The kr=0.75 cell stays in the
table with the † footnote rather than being silently deleted;
transparency, and a tidy illustration of why the smell-test reflex
keeps paying off.

---

## Phase 4 — The latency verdict: efficiency story dies too

The new patcher instrumentation produced phase-decomposed latency
(prune / prefill / decode) for the first time. Mean per-sample
milliseconds:

| method | kr | prune | prefill | decode | total |
|---|---|---|---|---|---|
| random | 0.75 | 0.22 | 49.98 | 46.11 | 154.96 |
| gridprune | 0.75 | 20.47 | 49.64 | 45.10 | 172.28 |
| fasp_gridprune | 0.75 | 0.58 † | 49.84 | 44.19 | 151.88 |
| random | 0.50 | 0.22 | 40.03 | 42.19 | **139.88** |
| gridprune | 0.50 | 20.52 | 40.03 | 41.71 | 157.95 |
| fasp_gridprune | 0.50 | 31.55 | 40.04 | 41.21 | 169.56 |
| random | 0.25 | 0.22 | 29.20 | 41.84 | 127.87 |
| gridprune | 0.25 | 18.58 | 28.91 | 40.18 | 142.46 |
| fasp_gridprune | 0.25 | 27.46 | 28.87 | 39.26 | 150.40 |
| random | 0.10 | 0.22 | 26.06 | 40.47 | 122.29 |
| gridprune | 0.10 | 9.58 | 26.11 | 40.56 | 131.88 |
| fasp_gridprune | 0.10 | 20.57 | 26.23 | 39.78 | 142.05 |

† degenerate branch — see [Phase 3](#phase-3-the-kr075-anomaly-bug-10).

At a *fixed* keep-ratio, prefill and decode are determined by token
count, so they're effectively identical across methods. **The only
latency lever between methods is prune overhead** — and Random's is
~0.22 ms while the structured methods add 9–31 ms. So Random is both
more accurate *and* faster at every keep-ratio. GridPrune at kr=0.5
is 157.95 ms vs Random's 139.88 ms — 18 ms slower for worse
accuracy. There is no latency angle that rescues structured pre-LLM
pruning here; **Random Pareto-dominates on both axes simultaneously.**

One genuinely useful number falls out of the decomposition: **decode
time barely moves with token count** (~46 ms at kr=0.75 down to ~40
ms at kr=0.1) while prefill nearly halves (50 → 26 ms). So almost all
the compute savings from pruning live in *prefill*, and on
short-answer medical VQA where decode is brief, the realizable
savings are modest. Worth keeping in the back pocket.

---

## Phase 5 — The strategic pivot: four directions

The pruning thesis is a confirmed dead end, but the *infrastructure*
— the pre-LLM patcher that can arbitrarily manipulate visual tokens,
the 6-benchmark harness, the latency instrumentation — is exactly
what a visual-grounding study needs. A literature scan first ruled
out the obvious moves: the visual-substitution / contrastive-decoding
space for medical VLMs got crowded in late 2025–early 2026
(VGS-Decoding, Med-VCD, and others already do training-free
grounding-score and contrastive-decoding work), and a pure
"medical VLMs lean on language priors" *analysis* paper would not
clear the bar for genuine novelty.

Four training-free directions were scoped, all reusing the existing
assets:

??? note "Direction A — Evidence-graded risk control (selective prediction)"
    Use the pruning hook as an *evidence dial*: feed the model
    controlled amounts of visual evidence (token budget 1.0 → 0.1)
    and characterize each prediction by its *evidence curve* — how
    the answer and its probability behave as evidence shrinks. Turn
    that into a non-conformity score, wrap it in conformal risk
    control, and produce a guarantee like "≤5% error among the cases
    the model chooses to answer"; abstain on the rest.
    **Novelty:** high (graded evidence curve vs existing binary
    original-vs-distorted contrast; first conformal risk control for
    medical image VQA). **Risk:** abstention reads as less flashy to
    some venues.

??? note "Direction B — Visual-evidence-adaptive contrastive decoding"
    Contrast a full-evidence forward pass against a reduced-evidence
    one (using the *pruned* forward pass as the contrast branch) to
    amplify the image-dependent part of the answer and suppress the
    language prior. **Novelty:** weakest — the surrounding space is
    crowded and already has a "why contrastive decoding fails"
    critique. **Risk:** can *hurt* when the language prior is
    actually helpful.

??? note "Direction C — Per-question test-time compute allocation"
    Decide per question how much visual evidence and how many
    self-consistency samples to spend; easy questions get few
    tokens and one pass, hard ones get full tokens and a majority
    vote. **Novelty:** modest but clean (efficiency-under-a-
    reliability-constraint). **Risk:** the accuracy ceiling is just
    the baseline — the contribution is compute saved, not points
    gained.

??? note "Direction D — Combination with an evidence-router (the lead)"
    A test-time pipeline combining *proven* training-free components
    — self-consistency voting + a medical-adapted grounding reweight
    — glued by a **visual-evidence-sensitivity router** that decides,
    per question, whether the model is genuinely reading the image
    (trust the answer), guessing from language priors (apply
    grounding correction), or truly uncertain (escalate samples or
    abstain). **Novelty:** the components are off-the-shelf; the
    *router* is the contribution — a medical-evidence signal nobody
    has wired into the "adaptively combine by confidence" pattern.
    **Build speed:** fastest — only the router is new. D is partly an
    umbrella: its "correct" branch is a slice of B, its "escalate"
    branch a slice of C, its "abstain" branch a slice of A.

| | Core signal | Novelty | Build speed | Main risk |
|---|---|---|---|---|
| **A** | Evidence-curve → conformal guarantee | High | Medium | "Abstention" less flashy |
| **B** | Full vs pruned forward-pass contrast | Low (crowded) | Medium | Can hurt; crowded field |
| **C** | Per-question compute routing | Modest | Medium-fast | Ceiling = baseline accuracy |
| **D** | Evidence-router over proven components | Med-High | Fastest | Components may degrade on medical |

---

## Phase 6 — The feasibility probe (zero GPU, decisive)

Before committing to any direction, one capability audit and one
free probe. The capability audit on `cli.py` / `eval.py` /
`scorer.py` found:

- **Multi-budget predictions already on disk** — the Random sweep's
  per-sample `predictions.json` exist at every keep-ratio, so the
  core hypothesis is testable *today* with zero new inference.
- **Sampling supported but not wired into eval** — `cli.py` calls
  `generate()` with `do_sample=True, temperature=0.2`, but `eval.py`
  runs greedy. So C/D need a modest plumbing edit, not a new build.
- **MCQ logprob absent but cheap** — one option-token logprob is
  easy to add.

The probe joins the Random predictions across all five budgets
(kr=1.0 baseline + 0.75 / 0.5 / 0.25 / 0.1) by composite key
(`dataset`, `subset`, `test_id`) — a clean **17,303 / 17,303**
overlap — and asks: **does answer-stability under visual-evidence
removal predict correctness?** (The baseline per-sample file lives
under a non-standard name in `results/archive/` — noted so future-me
doesn't lose it.)

```text
common samples across all 5 budgets: 17303

Flip-count distribution (0 = answer identical across all budgets)
  0 flips:  13165  (76.1%)
  1 flips:   2033  (11.7%)
  2 flips:   1390  ( 8.0%)
  3 flips:    581  ( 3.4%)
  4 flips:    134  ( 0.8%)

Correctness vs stability
  baseline CORRECT: n=11739 | 81.7% perfectly stable (0 flips)
  baseline WRONG  : n= 5564 | 64.3% perfectly stable (0 flips)

Stable-but-wrong (answer never moved through 90% token removal, yet wrong)
  stable (0-flip) samples: 13165
  of those WRONG:          3579  (27.2% of stable)
  stable-wrong as % of ALL: 20.7%

  per-dataset stable-wrong rate:
    MMMU_Medical_Validation     36 /   150  (24.0%)
    OmniMedVQA                1934 / 11124  (17.4%)
    PMC-VQA_test               480 /  2000  (24.0%)
    PathVQA_test              1010 /  3362  (30.0%)
    SLAKE_test                  56 /   416  (13.5%)
    VQA-RAD_test                63 /   251  (25.1%)
```

How to read it:

- **Stability tracks correctness, in the favorable direction.**
  Correct answers are 81.7% stable; wrong answers only 64.3% — a
  17.4-point separation. Wrong answers flip *more* as you starve the
  visual budget, so being correct coincides with being robust. A
  router watching flip behavior has a genuine signal.
- **One floated hypothesis was partly contradicted, usefully.** We'd
  guessed "stable-but-wrong" would be the *dominant* language-prior
  signature. Instead wrong answers are on average *wobblier*, not
  more stable — a wrong answer at full evidence is often one the
  model was already shaky on, so perturbing the budget pushes it
  around. The clean split: wrong answers are ~64% locked-in-wrong
  (prior-driven candidates) and ~36% evidence-sensitive-wrong.
- **The stable-but-wrong bucket is still large and meaningful:**
  3,579 samples (20.7% of everything) answered identically through
  90% visual-token removal yet wrong — locked-in regardless of
  evidence. **Concentrated by modality:** PathVQA worst at 30.0%
  (pathology/microscopy, where the model most often locks onto an
  unsupported answer), SLAKE lowest at 13.5%. That spread is itself
  a finding — the language-prior failure mode is modality-dependent.

**Go / no-go: Go**, with the thesis sharpened. The naive "stable =
prior, detect and abstain" is too simple — flips alone are a
weak-to-moderate correctness signal, not a clean prior-detector
(plenty of correct answers are also stable). The defensible version:

> Answer-stability under graded visual-evidence removal is a
> training-free signal that (a) correlates with correctness and
> (b) isolates a large locked-in-wrong population concentrated in
> specific modalities. A per-question policy can exploit *both*
> directions — escalate/abstain on the evidence-sensitive-wrong,
> flag the locked-in-wrong as prior-driven.

The probe did its job twice over: it green-lit Direction D's router
*and* told us the single flip-trajectory feature isn't sufficient
alone — the router needs a second feature, the option-token logprob
that was already flagged as cheap to add. Stability + confidence
together should separate the regimes far better than stability alone.
That's a concrete, evidence-based spec for what to build, not a guess.

---

## Phase 7 — Instrumentation built, overnight sweep launched

With the direction green-lit, the evening built and smoke-tested the
machinery the scored sweep needs, then launched it. Six files, all
committed in one push:

- `pruning/scored_chatbot.py` — `ScoredHuatuoChatbot` subclass:
  first-token logprob distribution, option entropy, k-sample
  self-consistency. Modular so a non-Huatuo backend (e.g. MedGemma)
  can slot in later.
- `pruning/nested_random_pruner.py` — nested-budget random pruning,
  where a lower keep-ratio is a strict *subset* of a higher one, for
  clean evidence-quantity curves (the same token set shrinks
  monotonically rather than re-sampling at each budget).
- `scripts/scored_sweep.py` — eval driver with scored / sampled
  modes (latency tracked only in scored mode, since
  `num_return_sequences` inflates per-forward timing).
- `scripts/run_sweep_vmA.sh`, `run_sweep_vmB.sh` — the 18-run,
  two-GPU split: greedy+logprobs and k=5 self-consistency (T=0.7),
  at 5 budgets, in both independent and nested pruning variants.
- `analysis/probe_answer_stability.py` — today's probe, saved next
  to `analyze_v2_sweep.py`.
- `.gitignore` — finally stops tracking `results/` and Python cruft.

**Tonight's sweep:** 18 runs across 2 A100s — greedy+logprobs and
k=5 self-consistency, at 5 budgets, independent and nested pruning
variants. ~12.5 hr ETA. This produces the per-sample logprob /
entropy / self-consistency data that Direction D's router needs as
its second feature, so tomorrow's work can start on real numbers
rather than a re-run.

---

## Honest ledger of the day

1. **E3 fully analyzed; pruning-as-method closed.** Random
   Pareto-dominates structured pruning on accuracy *and* latency at
   every keep-ratio — three sweeps running. Confirmed dead end.
2. **Random's robustness is the real finding.** Only −0.57 pts at
   kr=0.5; the model barely needs the fine-grained visual evidence.
   That reframes the project.
3. **kr=0.75 anomaly diagnosed to its exact branch** (`kr > 1 −
   bg_fraction`); the negative result came out cleaner once the
   artifact was removed. Logged as Bug #10.
4. **Pivot scoped, not flailed.** Four training-free directions
   compared against a real literature scan; D (evidence-router) the
   lead, A and C live fallbacks, B the riskiest.
5. **Feasibility probe green-lit D on existing data, no GPU** —
   stability tracks correctness (81.7 vs 64.3%), with a 20.7%
   locked-in-wrong population concentrated in PathVQA. *And* it
   specified the missing second feature (logprob).
6. **Instrumentation built and pushed; 18-run scored sweep
   launched.** Tomorrow starts on real logprob/self-consistency
   data.

The dead end turned out to be the doorway. The infrastructure built
for an efficiency method became the probe for a grounding study —
and the negative result is now Figure 1 of a different paper, not a
failure.

!!! note "On the project's direction"
    The site name and framing still say *question-aware visual token
    pruning*. The work has pivoted toward training-free
    visual-grounding / selective-prediction for medical VLMs, but
    the rebrand is deliberately deferred until the new direction is
    committed to and producing results. Today's page is the hinge;
    expect the headline framing to shift over the coming days.

---

### Plan for tomorrow (May 29, Day 20 / Week 3 Day 6)

- [ ] **Check the overnight scored sweep landed cleanly** — 18 runs,
      both VMs; confirm START (not all-SKIP) and smell-test the
      logprob / self-consistency fields before trusting anything.
- [ ] **Build the two-feature router probe** — join answer-stability
      (today) with the new option-token logprob; test whether
      stability + confidence separates the regimes better than
      stability alone (the spec the probe handed us).
- [ ] **Verify the proven components don't degrade on medical VQA**
      *before* composing — plain self-consistency, no router, on the
      6 benchmarks. Same smell-test reflex that caught Bug #7.
- [ ] Draft a week-by-week plan for Direction D once the router
      probe confirms the second feature helps.
- [ ] Read **ToMe** end-to-end (still pending from Week 2).

---

## Pushed today

One commit to
**[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)**:

**[`dbe8daa`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/dbe8daa)**
— *Add scored-sweep instrumentation: logprob capture +
self-consistency + nested-budget pruning.* 7 files, +622 lines.
`scored_chatbot.py` (first-token logprob distribution, option
entropy, k-sample self-consistency; modular for future non-Huatuo
backends), `nested_random_pruner.py` (nested-budget random pruning —
lower kr is a strict subset of higher kr, for clean evidence-quantity
curves), `scored_sweep.py` (eval driver with scored/sampled modes;
latency tracked only in scored mode since `num_return_sequences`
inflates per-forward timing), `run_sweep_vmA.sh` / `run_sweep_vmB.sh`
(18-run two-GPU split: independent + nested × 5 kr), and
`probe_answer_stability.py` (today's answer-stability-vs-correctness
probe). The `.gitignore` finally stops tracking `results/` and Python
cruft, so future sweep commits no longer need `git add -f`.
