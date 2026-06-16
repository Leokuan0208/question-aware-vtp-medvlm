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

## Phase 1 — The reviewer attack surface, in five tiers

A focused literature review of medical VLMs, visual-token pruning, and
model-cascade/routing produced a prioritized list of where the paper is most
exposed:

- **Tier 1 — framing & exclusions.** Framing contradictions and the
  credibility of the benchmark exclusions (does the "excluded because
  near-chance" story actually hold per benchmark?).
- **Tier 2 — missing baselines.** CP-Router/**FBE** (and the fact the paper's
  CP-Router treatment omits **FBE**, its core mechanism), proxy-confidence
  signals, and calibration methods.
- **Tier 3 — measurement rigor.** Energy-attribution and engine-faithfulness
  gaps.
- **Tier 4 — statistics.** Multiple-comparison correction (Bonferroni) on the
  router comparisons.
- **Tier 5 — related work.** RL-reasoning medical VLMs and the token-pruning
  literature.

Two reference-level problems were flagged immediately: the **MMMU-Health
exclusion rationale is contradicted by the paper's own cited benchmark study**,
and the **manuscript describes the gate as a raw-margin threshold while the
shipped artifact is a StandardScaler+logistic pipeline** — both confirmed
empirically in Phase 3.

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

## Honest ledger of the day

1. **Reviewer attack surface mapped** in five tiers (framing/exclusions,
   baselines, measurement rigor, statistics, related work), with the
   CP-Router-omits-FBE, MMMU-exclusion, and gate-description issues flagged up
   front.
2. **`fbe_and_signals.py`** — a training-free, checkpoint-only router bake-off,
   frontier-matched to the deployed gate.
3. **The τ reproducibility gap** — the gate is a `StandardScaler`+logistic
   pipeline, so τ = 0.426 is a cut in **z-space**, not raw-margin space; raw
   thresholding gives 46.1% escalation vs the live **63.1%** (a 17-point swing,
   and Eq. 2 wouldn't reproduce the headline).
4. **MMMU exclusion contradicted** — 7B = **0.5471** on MMMU (above chance);
   MedXpert exclusion stays defensible (0.2254 / 0.2563).
5. **Six-router tie** — margin / top1 / entropy / temp-margin / conformal /
   FBE, none beats the one-line gate at matched compute (Bonferroni demands
   ~0.0100; best Δ is +0.0020, ns).
6. **Calibration is irrelevant to routing** — T = 3.65 over-confidence, but
   recalibration moves accuracy +0.0004 (ns); the bottleneck is rescue
   unpredictability.
7. **FBE degenerates** (escalates 98.6%); **oracle ceiling** rescuable 0.157 /
   breakable 0.134 → escalate-all nets +0.023, unreachable from 7B signals.
8. **Headline confirmed** — competent-four escalation **0.631** is the correct
   headline (overall 0.662).
9. **Gate-description decision** — lean option (b), a true raw-margin quantile
   gate; cite Narasimhan (2022) / Jitkrittum (2023) for the deferral rule,
   CP-Router as contrast.

!!! note "On the project's direction"
    The audit leaves the cascade's *result* intact and **better-supported** —
    the negative routing result is now demonstrated, not asserted — while
    surfacing two honest manuscript fixes (the gate description and the MMMU
    exclusion) that strengthen it against a careful reviewer. The paper
    (**MedVLM-Cascade**, CVGIP 2026) is the project's headline deliverable; the
    site rebrand remains Leo's call.

---

### Plan for next session

- [ ] **Settle the gate description** — refit the raw-margin quantile gate
      (option b) and re-run the live cascade so "parameter-free one-line
      threshold" is literally true, or rewrite §3.2 for the standardized-margin
      gate; report τ accordingly.
- [ ] **Fix the MMMU exclusion** — re-justify (it's not near-chance for the 7B)
      or fold MMMU back in.
- [ ] **Fold the bake-off into Table 3** and add the two new sentences
      (FBE-degeneration, calibration-irrelevance); check whether the conformal
      +0.0020 sliver lives in PMC-VQA before giving it a sentence.
- [ ] Add the **FBE mechanism** to the CP-Router baseline; drop in **peak VRAM**
      and the **~7 reference author lists** still pending from Day 4.

---

## Pushed today

**No code push.** The audit script (`scripts/fbe_and_signals.py`) is
checkpoint-only analysis in the `medvlthinker-imgdiff-compute` repo and was run
in place; no commit was made this session.
