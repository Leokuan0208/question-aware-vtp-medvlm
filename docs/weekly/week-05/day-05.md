# Day 5 — Saturday, June 13, 2026

[← Back to Week 5 overview](index.md)

**Reviewer-grade audit: a router bake-off, and the τ that wasn't what the
paper said** · Week 5, Day 5 · **Day 35 of the project**

---

A stress-test day: take the [June 12 manuscript](day-04.md) and attack it the
way a top-venue reviewer would, then close every hole that survives. A
literature review produced a tiered list of attack vectors; one training-free
script (`fbe_and_signals.py`) — running entirely on already-saved checkpoints,
zero new inference — then converted the paper's central *negative* result from
an assertion into a demonstration: a **six-router bake-off in which nothing
beats the one-line margin gate** at matched compute. But the day's most
important find wasn't the table — it was a **reproducibility gap between the
manuscript and the shipped checkpoint**: the paper describes the gate as a raw
threshold on the margin (τ = 0.426), while `router_margin.pkl` is actually a
**StandardScaler + logistic pipeline**, so 0.426 is a cut in *standardized
z-space*, not in raw-margin space — a difference worth **17 points of
escalation** (46.1% vs the live 63.1%). Plus a second contradiction caught:
the paper excludes MMMU as "near-chance," but the 7B scores **0.547** on it.
The day ends on the decision of how to make the paper's gate description honest
— and which deferral-theory papers to cite for it.

!!! note "Day count — closing Week 5"
    June 13 is **Day 35** of the project, the **5th working session** of Week 5
    and its **last calendar day** (Week 5 = Jun 7 – Jun 13). The week is closed
    out below.

---

## Phase 1 — The reviewer attack surface: verdict, and the numbered holes

A focused literature review of medical VLMs, visual-token pruning, and
model-cascade/routing produced a prioritized, **numbered** list of where the
paper is most exposed — graded the way a hostile top-venue reviewer would.

**The honest verdict.** A domain transfer + a negative result + measured
energy *is* a real paper, but at the top tier reviewers will ask *"what is new
beyond a known theory landing where it predicts it should?"* Three things have
to be answered: (1) that novelty question; (2) **the paper contradicts itself
on its own thesis** (an accuracy-win headline vs. an efficiency-at-parity
claim); and (3) it **exposes a benchmark-cherry-picking attack** a hostile
reviewer will use to reject outright. Fix (2) and (3) and add the missing
baselines → a **solid workshop/mid-tier** paper. Add headroom recovery *or*
airtight six-benchmark generality → a **journal (IEEE-Transactions-tier)**
target is reachable. (For scale: the draft is ~3,000 words / 6 tables / 3
figures; a journal version is ~8,000–12,000 words, ~8–11 tables, ~6–8 figures —
mostly *write-up of analysis already run*, not new compute.)

??? note "Tier 1 — the holes that get you rejected (fix first)"
    - **#1 — The headline contradicts the thesis.** The abstract/§4.2 frame
      the cascade as an *accuracy win* ("exceeds published MedVLThinker-32B
      68.53% by 2.28 pts," Table 1 macro = **70.81%**), but §4.3/Table 3 argue
      *efficiency at parity* (cascade **0.655** vs always-32B **0.645**, CIs
      spanning zero). They even use different math — Table 1 is a **macro**
      over four benchmarks vs **published** numbers (a different harness),
      Table 3 is **pooled/micro** on the held-out half (n=1815) vs **our own**
      always-32B. Reads as "the author picked whichever comparison looked
      best." **Fix:** pick *efficiency at parity*; make every accuracy
      comparison cascade-vs-our-own-always-32B; demote "vs published" to one
      validation sentence.
    - **#2 — "Never worse than the 7B" is false on our own data.** Table 1:
      cascade PathVQA **66.45 < published-7B 66.83**, yet the abstract says
      "never worse than the 7B" and Fig 3's caption claims "exceeds the
      published 7B on all four." **Fix:** state the monotonicity guarantee only
      at the pooled/same-harness level (Table 3: cascade 0.655 ≥ cheap-only
      0.633) and flag PathVQA as the case where *broken > rescued*.
    - **#3 — Benchmark-exclusion credibility.** The "excluded because
      near-chance" story must hold *per benchmark* — and MMMU breaks it (see
      Phase 3). **Fix:** report the full six-benchmark table.

??? note "Tier 2 — missing baselines"
    - **#6 — Proxy-confidence baseline (the highest-value *scientific* test).**
      Train a small head on the 7B's hidden states / cheap features to predict
      the rescue event *without running the 32B*. If it fails, the negative
      result becomes near-bulletproof; if it succeeds, there's a positive
      method.
    - **#7 — Cheap-model calibration is never addressed.** A reviewer asks "the
      deferral signal is bad because the 7B is miscalibrated — did you fix
      that?" **Fix:** temperature/Platt-scale the margin and show it doesn't
      move the gate (it doesn't — see Phase 4), or scope it as future work.
    - **#8 — "Learned router fails" is in tension with the paper it anchors
      on.** Jitkrittum (2023) shows *post-hoc estimators beat confidence
      deferral*; our learned router *is* a post-hoc estimator and *fails*.
      **Fix:** explain head-on — the rescue event is near-unpredictable from 7B
      signals *in this domain* (the AUROC≈0.65 probe is exactly this argument).
    - **#9 — The "CP-Router-style" baseline omits CP-Router's core (FBE).**
      Either implement Full-and-Binary-Entropy faithfully or rename the
      baseline "split-conformal set-size router" and stop attributing it to
      CP-Router.
    - **#10 — Best-of-n on the cheap model (BEST-Route [22]) is an unrun
      baseline.** Sampling the 7B a few times before deciding is a known way to
      sharpen the deferral signal. Justify out-of-scope (it changes the cost
      model) or run a small version.

??? note "Tier 3 — measurement rigor (where the paper can actually shine)"
    - **#11 — Energy attribution is under-specified.** 53 J for the 7B pass
      implies ~0.1–0.2 s at A100 power — plausible, but does it include
      idle/baseline power, preprocessing, tokenization? How was per-leg energy
      isolated with both models co-resident on separate GPUs? **Fix:** specify
      NVML sampling rate, integration window, idle-baseline subtraction, and
      report **mean ± std over repeated runs** — match the kJ rigor of the Yang
      paper being emulated.
    - **#12 — The always-32B baseline must be *measured* natively**, not
      estimated, with full power logging repeated for variance (the 0.639×
      headline rides on it).
    - **#13 — HF-vs-vLLM faithfulness at the *cascade* level**, not just the
      32B leg — compute the cascade accuracy natively under HF and reconcile
      against the vLLM-labeled version.

??? note "Tier 4 — statistics & evaluation hygiene"
    - **#16 — Multiple comparisons.** Many pairwise parity claims; the
      Bonferroni discipline (PathVQA's +0.010 doesn't survive it) must be *in
      the paper*, with corrected intervals.
    - **#17 — n=272 (VQA-RAD) is too small to carry 82.35%.** Don't headline
      it; lead with pooled parity and add bootstrap CIs to *every* per-benchmark
      cell of Table 1.
    - **#18 — Single seed / greedy only.** Add at least one sampled-decoding
      robustness run, or state it as a bounded limitation.
    - **#19 — Define the four escalation buckets formally** (rescued / broken /
      wasted / redundant) in terms of (ŷ₇, ŷ₃₂, y).

??? note "Tier 5 — related work & novelty positioning (thin where it matters most)"
    - **#20 — Zero medical RL-reasoning VLMs cited**, despite building *on* one.
      Add and position as *complementary*: **MedVLM-R1** (Pan et al., MICCAI
      2025, 2502.19634), **Med-R1** (Lai et al., 2503.13939), **GMAI-VL-R1**
      (2504.01886), **Lingshu** (2506.07044), **MedGemma** (Google, 2025).
    - **#21 — Zero visual-token-pruning methods cited**, despite the project's
      origin. Engage the real literature — **FastV** (ECCV 2024), **SparseVLM**
      (ICML 2025), **PruMerge**, **HiRED** (AAAI 2025), **VScan** (2505.22654),
      **LLaVA-Mini** (ICLR 2025), **ATP-LLaVA** (CVPR 2025) — as the orthogonal
      *"make each leg cheaper"* axis that composes with the cascade (and
      reconnects the paper to its question-aware-pruning origins).

Two of these were the highest-priority reference-level problems and were
**confirmed empirically in Phase 3**: the MMMU exclusion (#3) and the
gate-description mismatch (the artifact is a `StandardScaler`+logistic
pipeline, not the raw-margin threshold the text claims).

---

## Phase 2 — A training-free router bake-off (`fbe_and_signals.py`)

To answer Tiers 2 and 4 without spending any GPU, the bake-off runs entirely on
**saved checkpoint data** — no new inference. The schema (confirmed from
inspection) is shared across files: `idx`, `gold`, `pred`, `ok`, `parse_ok`,
`opt_logprobs` (letter→logprob dict, sorted by confidence), `gen_tokens`,
`latency_s`, `raw_output`. The inputs:

- **calibration** — `ckpts/gate_7b_pmctrain/ckpt_nothink.jsonl` (3,000 rows,
  PMC-VQA train);
- **cheap leg** — `ckpts/gate_7b_prune/cap320/ckpt_*_nothink_norag_s0of1.jsonl`
  (seven benchmarks, 8,220 rows);
- **strong model** — `ckpts/gate_32b/ckpt_*_think_norag_s0of1.jsonl` (8,220,
  joined on `idx`; the 32B's `opt_logprobs` is empty `{}` since it's a
  reasoning model);
- **live cascade** — `rt_cascade_cap320.jsonl`;
- **gate** — `ckpts/router_margin.pkl` (keys `gate`, `tau`, `signal`,
  `trained_on`).

Each candidate router is **frontier-matched** — compared to the deployed margin
gate escalating the *same* number of queries — so each Δ isolates whether a
method picks a *better* escalation set at identical compute.

---

## Phase 3 — Part A: the τ that wasn't, and the MMMU contradiction

```text
PART A — 7B-only diagnostics        calibration: 3000 rows   eval: 8220 rows
benchmark                  n   7B acc
MMMU                     170   0.5471   (excluded)
MedXpert-Reasoning      1446   0.2254   (excluded)
MedXpert-Understanding   554   0.2563   (excluded)
PMC-VQA                 2000   0.5430
PathVQA                 3362   0.6407
SLAKE                    416   0.7620
VQA-RAD                  272   0.7610
competent-4 micro acc = 0.6221   macro = 0.6767
margin on competent-4: mean=0.502   63rd pct = 0.635
fitted temperature T = 3.65  (over-confident)
frozen gate: signal='margin' trained_on='pmc_vqa_train' gate=Pipeline(StandardScaler, ...)
frozen gate (tau=0.426, AS RAW-MARGIN threshold): escalates 0.461 of competent-4  | 0.505 of all-8220
LIVE run (rt_cascade_cap320.jsonl): overall escalation = 0.662 ; competent-4 = 0.631 (ground truth)
   per-benchmark escalation (live):
     MMMU 0.624 · MedXpert-R 0.768 · MedXpert-U 0.729 · PMC-VQA 0.597
     PathVQA 0.664 · SLAKE 0.529 · VQA-RAD 0.636
```

Three findings, each a hole closed:

**The headline reconciles — but the gate is not what the paper says.** The
live competent-four escalation is **0.631** (and that *is* the headline number
— the competent-four figure, not the all-8,220 overall of 0.662). But
thresholding a *raw* top-2 margin at τ = 0.426 escalates only **0.461** of the
competent four — a **17-point gap**. The cause is in the pickle:
`gate = Pipeline(StandardScaler, …)`. The gate **standardizes** the margin
(subtract the PMC-train mean μ, divide by the train std σ) and thresholds in
that transformed space, so **τ = 0.426 is a cut in standardized z-space, not in
[0,1]-margin space**. The two are different thresholds, and **Eq. 2 as written
would not reproduce the 63.1% / 0.639× headline**. (The "…" is almost certainly
a `LogisticRegression` — i.e. a *trained* one-feature logistic gate: still very
simple, but not "parameter-free" and not "untrained" as the manuscript says.)

**MMMU exclusion is contradicted by the data.** The 7B scores **0.5471** on
MMMU — well above chance — so the paper's "excluded because near-chance"
rationale does not hold for MMMU. (It *does* hold for MedXpert: 0.2254 / 0.2563
are genuinely near-chance, so that exclusion is defensible.) The MMMU exclusion
needs a different justification.

**The 7B is severely over-confident** (fitted **T = 3.65**) — set up for the
calibration test in Part B.

---

## Phase 4 — Part B: six routers, none beats a one-line gate

```text
PART B — routed bake-off, competent-4, n=6050
cheap-only acc=0.6221   strong-only acc=0.6451
rescuable=0.1574  breakable=0.1344   (escalate-all net = +0.0230; oracle escalates only the 0.157)
method                       esc%      acc   Δ vs margin@esc            95% CI   verdict
margin (deployed @63%)      63.1%   0.6512        reference
top1                        63.1%   0.6519        +0.0007   [-0.0010, +0.0025]   tie
entropy                     63.1%   0.6526        +0.0013   [-0.0013, +0.0040]   tie
temp_margin(T=3.6)          63.1%   0.6516        +0.0004   [-0.0015, +0.0021]   tie
conformal@budget α=0.33     62.6%   0.6534        +0.0020   [-0.0002, +0.0041]   tie
CP-Router/FBE α*=0.02       98.6%   0.6453        +0.0002   [+0.0000, +0.0005]   tie
Bonferroni @ 5 comparisons -> demand ~0.0100 per test before a WIN.
```

The table converts the paper's negative result from assertion to
demonstration — **six routers, none beats the one-line margin gate at matched
compute** — and closes two reviewer holes outright:

- **Calibration is irrelevant to routing (closes the miscalibration hole).**
  The 7B is badly miscalibrated (T = 3.65), yet the temperature-recalibrated
  margin moves accuracy by **+0.0004** (CI spanning zero). So the paper can
  state plainly: *the cheap model is severely over-confident, and fixing it
  does not improve routing* — because the bottleneck is **rescue-event
  unpredictability, not calibration**. A stronger, more defensible claim than
  ignoring calibration.
- **FBE, done faithfully, degenerates.** The faithful CP-Router/FBE escalates
  **98.6%** at its calibrated α* = 0.02 — it routes essentially everything,
  confirming it's not a competitive gate here.
- **The one to watch, not believe:** `conformal@budget` at **+0.0020**, CI
  [−0.0002, +0.0041] — the closest to a win (upper CI comfortably positive,
  lower just kissing zero), and not significant (dies under Bonferroni at
  0.01). It's the higher-order-spread sliver: on PMC-VQA's 4-option questions
  the full prediction set can catch multi-way ties the top-2 margin misses.
  Worth a per-benchmark look to see if it lives entirely in PMC-VQA — one
  sentence if so, never oversold.

**The oracle ceiling, confirmed from a fresh angle.** rescuable = **0.157**,
breakable = **0.134**, so escalate-everything nets only **+0.023** — the oracle
headroom is real but **unreachable from any 7B-visible signal**, exactly as the
paper's Table 4 already shows.

**Why the cascade is "never worse than 7B," mechanistically.** The
per-benchmark escalation rates adapt compute to difficulty — the gate escalates
*more* on the hard sets (MedXpert-R 0.768, MedXpert-U 0.729, PathVQA 0.664) and
*less* on the easy ones (SLAKE 0.529, PMC-VQA 0.597) — which is a genuinely
nice result to surface rather than hide.

---

## Phase 5 — Making the gate description honest, and what to cite

The open decision: the paper's "parameter-free one-line raw-margin threshold"
does not match the shipped `StandardScaler`+logistic artifact. Two clean fixes:

- **(a) Describe it accurately.** Rewrite the rule as two steps — *standardize
  the margin on calibration statistics (μ, σ), then threshold* — and report τ
  in z-units (plus the logistic's coefficient/intercept). Faithful to what
  produced every number; the cost is losing the "parameter-free" phrasing,
  becoming "a logistic post-hoc deferral rule on a single **standardized**
  confidence feature" — still a strong simplicity story.
- **(b) Refit a genuinely raw-margin gate.** Drop the scaler and logistic; pick
  τ as the budget-quantile of raw calibration margins (the paper's Eq. 5
  already says exactly this), and re-run the live cascade. Then "τ = ⟨value⟩,
  one comparison, parameter-free" becomes literally true. **Leaning (b)** —
  because the paper's entire thesis is *the simplest thing wins*, and a
  raw-margin quantile threshold is maximally simple with zero learned
  parameters.

**References for the router design** (the question that closed the day):

- The gate is precisely a **post-hoc confidence-deferral rule on a frozen
  model's scores**, so the most direct methodological citations are
  **Narasimhan et al. (2022)** (post-hoc deferral rules for a fixed predictor)
  and **Jitkrittum et al. (2023)** (when confidence-based deferral suffices).
  Keep **CP-Router** (Su et al.) as the *contrast/baseline*, not the design
  ancestor.
- If keeping option (a): frame as "a logistic post-hoc deferral rule on a
  single standardized feature, in the style of Narasimhan et al. (2022)," and
  cite **Guo et al. (2017)** (calibration) in passing — the T = 3.65 result
  lets the paper say calibration doesn't change routing.
- If going option (b): cite **Geifman & El-Yaniv (2017)** (the
  confidence-threshold selective rule), **Scheffer et al. (2001)** (margin as
  confidence), and **Jitkrittum et al. (2023)** — that trio fully grounds a
  raw-margin gate with no learned-router paper needed.

---

## Phase 6 — The prioritized fix plan (pre-registered gates)

The audit closes with a fix queue ordered by **impact-per-GPU-hour**, each with
a falsification gate registered *before* spending compute — the discipline
that's served every prior dead end:

1. **All-six-benchmark accuracy + full cascade on all six** (closes #3) — pure
   inference on the existing harness. *Gate:* if the cascade is ever worse than
   always-7B on any benchmark, the monotonicity claim must soften. **Highest
   impact, lowest cost — run first.**
2. **Directly-instrumented always-32B energy/latency** (closes #11, #12, #5) —
   full power logging, repeated for variance. *Gate:* the measured ratio must
   land near **0.639×** or the headline changes.
3. **HF-vs-vLLM cascade reconciliation** (closes #13) — cascade accuracy
   natively under HF vs the vLLM-labeled version. *Gate:* agreement at the
   *cascade* level, not just the 32B leg.
4. **Proxy-confidence baseline** (closes #6 — *the* category-changing
   experiment) — a small head on the 7B's hidden states to predict the rescue
   event without running the 32B. *Gate:* held-out rescue-AUROC must beat the
   0.60 bar **and** lift matched-budget accuracy with a CI clear of zero. Fail
   → the negative result is near-bulletproof; succeed → there's a positive
   method.
5. **Cheap-model calibration check** (closes #7) — temperature/Platt-scale the
   margin, re-evaluate the gate.
6. **Faithful FBE conformal baseline** (closes #9).
7. **Multiple-comparison correction + per-cell bootstrap CIs everywhere**
   (closes #16, #17) — analysis only.

Items **1–3 are a single sequential overnight chain** on the idle GPUs (they
close the three Tier-1/Tier-3 holes that most threaten acceptance for the least
compute); **item 4 is the one that can move the paper from "negative result" to
"method."**

---

## Honest ledger of the day

1. **Reviewer attack surface mapped** as ~22 numbered holes across five tiers,
   with the **verdict** stated plainly: fix the self-contradiction and the
   cherry-picking attack and add baselines → workshop/mid-tier; add headroom
   recovery or six-benchmark generality → journal-tier.
2. **Two Tier-1 self-contradictions caught in the manuscript** — (#1) an
   accuracy-win headline (Table 1 macro **70.81%** vs published) fights the
   efficiency-at-parity claim (Table 3 **0.655** vs own 32B, CIs spanning
   zero), on *different math/harnesses*; (#2) "**never worse than the 7B**" is
   false on the paper's own data (cascade PathVQA **66.45 < published-7B
   66.83**).
3. **`fbe_and_signals.py`** — a training-free, checkpoint-only router bake-off,
   frontier-matched to the deployed gate.
4. **The τ reproducibility gap** — the gate is a `StandardScaler`+logistic
   pipeline, so τ = 0.426 is a cut in **z-space**, not raw-margin space; raw
   thresholding gives 46.1% escalation vs the live **63.1%** (a 17-point swing,
   and Eq. 2 wouldn't reproduce the headline).
5. **MMMU exclusion contradicted** — 7B = **0.5471** on MMMU (above chance);
   MedXpert exclusion stays defensible (0.2254 / 0.2563).
6. **Six-router tie** — margin / top1 / entropy / temp-margin / conformal /
   FBE, none beats the one-line gate at matched compute (Bonferroni demands
   ~0.0100; best Δ is +0.0020, ns).
7. **Calibration is irrelevant to routing** — T = 3.65 over-confidence, but
   recalibration moves accuracy +0.0004 (ns); the bottleneck is rescue
   unpredictability. **FBE degenerates** (escalates 98.6%); **oracle ceiling**
   rescuable 0.157 / breakable 0.134 → escalate-all nets +0.023, unreachable
   from 7B signals.
8. **Missing-reference gaps named** — zero medical RL-reasoning VLMs (MedVLM-R1,
   Med-R1, GMAI-VL-R1, Lingshu, MedGemma) and zero visual-token-pruning methods
   (FastV, SparseVLM, HiRED, VScan, LLaVA-Mini, ATP-LLaVA), the latter
   reconnecting the paper to its pruning origins.
9. **Headline confirmed** — competent-four escalation **0.631** is the correct
   headline (overall 0.662).
10. **Gate-description decision + a pre-registered fix queue** — lean option (b)
    (true raw-margin quantile gate; cite Narasimhan 2022 / Jitkrittum 2023,
    CP-Router as contrast); items 1–3 (all-six table, instrumented 32B energy,
    HF/vLLM reconciliation) are tonight's chain, item 4 (proxy-confidence
    probe) the one that could turn the negative result into a method.

!!! note "On the project's direction"
    The audit leaves the cascade's *result* intact and **better-supported** —
    the negative routing result is now demonstrated, not asserted — while
    surfacing two honest manuscript fixes (the gate description and the MMMU
    exclusion) that strengthen it against a careful reviewer. The paper
    (**MedVLM-Cascade**, CVGIP 2026) is the project's headline deliverable; the
    site rebrand remains Leo's call.

---

### Plan for next session

- [ ] **Run tonight's chain — fix-plan items 1–3** (see Phase 6): the
      all-six-benchmark accuracy + full cascade (closes #3), the
      directly-instrumented always-32B energy/latency (closes #11/#12/#5), and
      the HF-vs-vLLM cascade reconciliation (closes #13) — one sequential
      overnight `nohup` batch, the cheapest fixes for the holes that most
      threaten acceptance.
- [ ] **The category-changer — fix-plan item 4:** the proxy-confidence probe
      (small head on 7B features predicting the rescue event without the 32B),
      pre-registered gate AUROC > 0.60 + CI clear of zero. Fail → bulletproof
      negative; succeed → a positive method.
- [ ] **Settle the gate description** — refit the raw-margin quantile gate
      (option b) and re-run the live cascade so "parameter-free one-line
      threshold" is literally true, or rewrite §3.2 for the standardized-margin
      gate; report τ accordingly.
- [ ] **Fix the two Tier-1 contradictions** — make every accuracy comparison
      cascade-vs-own-32B (demote "vs published" to one validation sentence), and
      state monotonicity only at the pooled level (flagging PathVQA); re-justify
      or fold back the **MMMU** exclusion.
- [ ] **Statistics + related work** — Bonferroni-corrected intervals and
      per-cell bootstrap CIs in Table 1 (items 6–7); add the missing medical
      RL-reasoning and visual-token-pruning citations (#20/#21).
- [ ] Drop in the **peak VRAM** and the **~7 reference author lists** still
      pending from [Day 4](day-04.md).

---

## Pushed today

**No code push.** The audit script (`scripts/fbe_and_signals.py`) is
checkpoint-only analysis in the `medvlthinker-imgdiff-compute` repo and was run
in place; no commit was made this session.
