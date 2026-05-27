# Day 4 — Wednesday, May 27, 2026

[← Back to Week 3 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) → closing out · Week 3,
Day 4 · **Day 18 of the project**

---

An analysis-and-pivot day. Came in to crunch yesterday's
[v2 sweep](day-03.md#phase-9-v2-sweep-completes-results-pushed)
into a proper table + Pareto plots, found a result that's the
*opposite* of what the central thesis predicted, ran a same-day
follow-up ablation that ruled out the obvious cause, and ended the
day with a concrete design and code for two new methods queued for
the overnight sweep. The headline finding: **mean-pooled QSim is
uniformly worse than Random pruning at every keep-ratio on
HuatuoGPT-Vision-7B**, and the gap *grows* as pruning becomes more
aggressive. The follow-up ablation that ran today (max-reduction
QSim) confirmed the failure mode is structural to text-only scoring,
not a quirk of the reduction operator. The lesson: cosine-similarity
on pre-LLM embeddings doesn't track what the LLM actually needs.

Three commits pushed today to `huatuo-llava-v15-med-pruning`. A
`.gitignore` tightening so future sweep commits don't need `-f`,
the May 27 qsim_max sweep results (4 runs), and the full analysis
pipeline (script + tables + 3 Pareto plots).

---

## Phase 1 — Morning analysis of the v2 sweep

Plan coming in (set in
[Day 3's "Plan for tomorrow"](day-03.md#plan-for-tomorrow-may-27-day-18-week-3-day-4)):
pull the 8 score files into a proper table with deltas vs the
0.6787 baseline, plot per-benchmark Pareto curves, write up E2 on
the [Experiments page](../../experiments.md).

The first task was reconciling the JSON schema. Each run produces
`__scores.json` (per-benchmark accuracy) and `__latency_summary.json`
(p50/p95/mean latency, GPU peak memory, post-prune token count).
The scores file uses slightly-different keys than display labels —
`"VQA-RAD_test"`, `"MMMU_Medical_Validation"`, `"OmniMedVQA"`, and
the total under the cheerfully verbose key
`"The total score for multiple-choice questions"`. So the analysis
script needed an alias table to resolve display labels.

??? note "Why this took three iterations to get right"
    First pass: hardcoded the keys based on what I'd seen in the
    May 25 paper-reproduction output. Second pass: discovered the
    keys had been renamed in the v2 sweep output (the eval pipeline
    sets the total key dynamically based on a config string).
    Third pass: extended the alias dict to handle both. The analysis
    script now prints the discovered keys at the top of stdout so
    any future schema drift gets surfaced loudly rather than
    silently. Lesson: schema discipline isn't optional for tools
    that have to be re-run weeks later.

### The numbers

The sweep laid out against the paper-reproduction baseline
(kr=1.0, total 0.6787), with deltas in pts vs baseline:

| K   | Method | total | VQA-RAD | SLAKE | PathVQA | PMC-VQA | OmniMed | MMMU |
|----:|:------ |------:|--------:|------:|--------:|--------:|--------:|-----:|
| 1.00 | baseline | **0.6787** | 0.6135 | 0.7644 | 0.5767 | 0.5420 | 0.7346 | 0.5034 |
| 0.75 | qsim   | 0.6662 (−1.25) | **0.6175 (+0.40)** | 0.7572 (−0.72) | 0.5720 (−0.47) | 0.4970 (−4.50) | 0.7253 (−0.93) | 0.4759 (−2.75) |
| 0.75 | random | 0.6746 (−0.41) | 0.6096 (−0.39) | 0.7716 (+0.72) | 0.5696 (−0.71) | 0.5330 (−0.90) | 0.7318 (−0.28) | 0.5034 (±0) |
| 0.50 | qsim   | 0.6538 (−2.49) | 0.5697 (−4.38) | **0.7764 (+1.20)** | 0.5595 (−1.72) | 0.4880 (−5.40) | 0.7118 (−2.28) | 0.4759 (−2.75) |
| 0.50 | random | 0.6730 (−0.57) | 0.5896 (−2.39) | 0.7572 (−0.72) | 0.5812 (+0.45) | 0.5235 (−1.85) | 0.7284 (−0.62) | 0.5103 (+0.69) |
| 0.25 | qsim   | 0.6293 (−4.94) | 0.5657 (−4.78) | 0.7572 (−0.72) | 0.5509 (−2.58) | 0.4685 (−7.35) | 0.6807 (−5.39) | 0.4621 (−4.13) |
| 0.25 | random | 0.6570 (−2.17) | 0.5697 (−4.38) | 0.7212 (−4.32) | 0.5764 (−0.03) | 0.4925 (−4.95) | 0.7122 (−2.24) | 0.5241 (+2.07) |
| 0.10 | qsim   | 0.6046 (−7.41) | 0.5498 (−6.37) | 0.7212 (−4.32) | 0.5452 (−3.15) | 0.4525 (−8.95) | 0.6485 (−8.61) | 0.4690 (−3.44) |
| 0.10 | random | 0.6357 (−4.30) | 0.5538 (−5.97) | 0.7404 (−2.40) | 0.5699 (−0.68) | 0.4595 (−8.25) | 0.6870 (−4.76) | 0.4966 (−0.68) |

## Phase 2 — Reading the result

Three observations, ordered by importance.

### Random beats QSim at every keep-ratio, and the gap grows as kr drops

The total-score gap, Random − QSim:

| K | Random − QSim |
|---:|---:|
| 0.75 | +0.84 pts |
| 0.50 | +1.92 pts |
| 0.25 | +2.77 pts |
| 0.10 | +3.11 pts |

This is the *opposite* of what the central thesis predicted. The
project's hypothesis was that question-awareness would matter
*more* as you prune more aggressively — because at high pruning
you can only afford to keep the question-relevant tokens, so a
smart selector should pull away from random. What we see instead
is QSim's *disadvantage* growing monotonically with pruning
aggressiveness. At kr=0.10, naive mean-pooled question-similarity
is 3.1 points worse than picking tokens uniformly at random. That's
a real signal, not noise.

Two plausible mechanisms, both flagged in
[yesterday's literature survey](day-03.md#phase-8-two-literature-surveys-during-the-sweep):

The first is **diversity collapse**. Random pruning preserves
spatial coverage of the image — at kr=0.10 you keep ~10% of tokens
uniformly scattered, so every region of the image is represented
somewhere. QSim with mean-pooled cosine ranks all tokens by
similarity to *one* summary vector of the question; the top-K
clusters in whatever sub-region happens to be most semantically
aligned with that vector. As K shrinks, the kept tokens become an
increasingly narrow patch. If the answer requires comparing two
regions of the image (which medical VQA frequently does — *"is
there abnormality in **both** lungs"*), QSim is structurally
incapable of doing that.

The second is **mean-pool coarseness**. Mean-pooling question
tokens throws away which words are doing the load-bearing work for
retrieval. *"Is the heart enlarged?"* mean-pooled is roughly an
embedding of *"heart-ish anatomy stuff"* — but the answer-
determining word is *"enlarged"*. A max-similarity scorer (per-token
cosine, take the max over question tokens) preserves which question
token did the matching for each visual token; that's much more
discriminative in principle.

The random-baseline experimental control is exactly what surfaced
this. Without it, the result *"QSim drops only 7.4 pts at kr=0.10"*
might have read as *"pruning works."* With Random as the floor, the
result is *"QSim doesn't help — it actively hurts."*

### Two cells where QSim does beat baseline

VQA-RAD at kr=0.75 (61.75 vs 61.35 baseline = **+0.40**) and
SLAKE at kr=0.50 (77.64 vs 76.44 = **+1.20**). The SLAKE one is
the more interesting datapoint: keeping only half the visual
tokens, QSim does +1.2 better than the unpruned model. Both are
small (close to decoding noise on stochastic generation), and
neither survives at lower keep-ratios. The right reading is that
mean-pooled QSim has *some* signal on low-pruning, anatomy-heavy
benchmarks (SLAKE is mostly clean radiology with well-localized
targets), but it can't be sustained as kr drops.

### The benchmark with the worst QSim collapse is MMMU

QSim drops MMMU more than Random at every kr. At kr=0.25, the gap
is 6.20 points (QSim 46.21 vs Random 52.41 — Random actually
*beats baseline* by 2.07 there). MMMU is the
most-diverse-image-content benchmark in the suite (general medical
images, not radiology-focused); diversity collapse should hurt
most where the image content is most heterogeneous, and that's
what we see.

## Phase 3 — Latency

| K | Method | Mean (ms) | p50 (ms) | p95 (ms) | GPU peak (MB) | Tokens kept |
|---:|:------|---------:|--------:|--------:|-------------:|---:|
| 0.75 | qsim   | 150.2 | 116.8 | 348.5 | 17,446 | 432 |
| 0.75 | random | 150.1 | 116.8 | 346.6 | 17,446 | 432 |
| 0.50 | qsim   | 135.6 | 105.7 | 309.7 | 17,312 | 288 |
| 0.50 | random | 143.7 | 109.3 | 327.8 | 17,312 | 288 |
| 0.25 | qsim   | 132.0 |  96.7 | 310.9 | 17,178 | 144 |
| 0.25 | random | 122.5 |  93.2 | 280.0 | 17,178 | 144 |
| 0.10 | qsim   | 129.5 |  96.9 | 298.2 | 17,097 |  58 |
| 0.10 | random | 125.7 |  94.8 | 282.9 | 17,097 |  58 |

Three things worth pulling out.

The `visual_post_prune` column confirms the patcher does what it
says — 58 / 144 / 288 / 432 tokens kept maps exactly to
`floor(kr × 576)` for the LLaVA-v1.5 vision tower's 576-token
output. So unlike the May 25 no-op sweep, this is real pruning.

Mean latency drops from 150ms at kr=0.75 to ~127ms at kr=0.10
(about **15% faster** end-to-end). That's the speedup envelope.
It's smaller than you'd hope for *"prune 90% of visual tokens"* —
because the visual sequence is only ~576 of a much longer total
context that also includes the question, system prompt, and the
generated answer tokens; the LLM forward cost over those non-visual
tokens isn't affected by pruning. Real speedup would scale better
on tasks with shorter text inputs.

QSim is a few ms slower than Random at most kr (the cosine-similarity
compute overhead) — at kr=0.50 the inequality flips (Random 143.7 vs
QSim 135.6), but that's almost certainly KUBERUN single-seed noise
on a shared host. **The headline: Random is Pareto-dominant.** It
already beat QSim on accuracy at every kr; it also beats QSim on
mean latency at 3 of 4 kr (and ties at kr=0.75). Naive mean-pooled
QSim is worse than random on both axes.

## Phase 4 — The qsim_max ablation

The diversity-collapse hypothesis from yesterday's literature
survey predicted that **max-similarity scoring** (per-token cosine,
max over question tokens) would beat mean-pooled QSim by preserving
which question token did the matching for each visual token.
ResPrune's published ablation found their *Setting-1* (max) winning
by ~3 pts over *Setting-3* (our mean-pool formulation).

We had compute available — the morning's analysis ran in 30
minutes; the GPU sat idle the rest of the morning. Same-day
follow-up: launched a 4-run qsim_max sweep at the same keep-ratios.
This took about 5 hours and landed in the early afternoon. **The
result:**

| K | Random | QSim mean (yesterday) | **QSim max (today)** |
|---:|---:|---:|---:|
| 0.75 | 0.6746 (−0.41) | 0.6662 (−1.25) | **0.6504 (−2.83)** |
| 0.50 | 0.6730 (−0.57) | 0.6538 (−2.49) | **0.6348 (−4.39)** |
| 0.25 | 0.6570 (−2.17) | 0.6293 (−4.94) | **0.6113 (−6.74)** |
| 0.10 | 0.6357 (−4.30) | 0.6046 (−7.41) | **0.5844 (−9.43)** |

**The third outcome.** Max-sim is uniformly worse than mean-sim,
which is uniformly worse than Random. No exceptions, no crossovers
— the ranking holds at every keep-ratio on the total score.
Max-sim is now 2.0–2.5 pts below mean-sim at every kr, and
2.4–5.1 pts below Random.

This is genuinely informative — more informative than either of
the other two possible outcomes (max ≈ mean → noise-dominated;
max > mean → diversity matters but mean-pool was the problem). The
outcome we actually got says something stronger:

### The diversity-collapse hypothesis got *stronger*, not weaker

I'd floated yesterday that max-sim might *help* by preserving
which question token did the matching for each visual token. The
opposite happened: by removing the mean-pool smoothing, every
visual token is now ranked by its single best match against *one*
question token. That makes selection even more concentrated —
every kept token "won" against the same most-discriminative
question word, so they pile up around the same image region. The
mean-pool was acting as a weak diversity regularizer. Removing
it made things worse.

### The problem isn't mean-vs-max. The problem is the scoring space.

Both reductions are doing the same thing in spirit — ranking
visual tokens by lexical-semantic similarity to question tokens in
the projected embedding space, before the LLM has seen anything.
But the LLM doesn't care which visual tokens *look like* question
words. It cares which visual tokens it would have *attended to*
when generating the answer. Those aren't the same thing — the
encoder embeddings don't know about the model's downstream
reasoning patterns, and they're brittle to question phrasing
(*"lung"* and *"pulmonary"* would project to different vectors
even though the model treats them identically). **Random selection
beats both because it doesn't try to be clever in a space that
doesn't reward cleverness.**

### Pointing the next experiment

This points hard at **two complementary directions** for tonight's
overnight:

- **Coverage-aware selection** — enforce spatial diversity in
  what we keep, instead of trusting a global ranking. The natural
  formalism is *zonal* pruning: divide the 576 patches into a 12×12
  grid of 2×2 zones (or 24×24 of 1×1, etc.), and select a
  zone-proportional budget within each zone. Published as
  **GridPrune** (Wang et al., 2025) for general VLMs.
- **Medical anatomy filtering** — exploit the high
  background-to-signal ratio of medical images. Score every token
  by L2-norm of its post-projector embedding; the lowest ~30% are
  almost always background (black borders, uniform soft tissue);
  filter those out *before* any further scoring. Inspired by
  **FASP** (Foreground-Aware Soft Pruning, Liu et al., 2024).

Combining both gives **FASP + GridPrune** — filter to anatomy
tokens, partition the remaining set into spatial zones, allocate
budget per zone by a fused (text-relevance + saliency) score, do
local top-K within each zone. The design is in
[Phase 6](#phase-6-fasp-gridprune-design) below.

## Phase 5 — Sweep results pushed (three commits)

The analysis artifacts and today's qsim_max sweep needed to land
on GitHub before any code work, so any later mistakes have a clean
restore point. Yesterday's `c216bbe`-era `.gitignore` blanket-ignored
`results/*`, which is why the May 26 sweep commit (`24ef568`)
needed `git add -f`. Three commits today:

- **[`43fca4d`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/43fca4d)** —
  Tighten `results/` gitignore: ignore only large per-run files.
  Replaces the blanket `results/*` rule with two narrow patterns
  (`results/**/*__predictions.json`,
  `results/**/*__checkpoint_partial.json`) so future sweep commits
  pick up scores/latency/eval.log without `-f`.
- **[`54121f2`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/54121f2)** —
  Add v2 pre-LLM qsim_max sweep results (2026-05-27). 4 runs:
  qsim with reduction=max × {kr=0.75, 0.5, 0.25, 0.1} across the
  same 6 benchmarks. Pruning verified via the sentinel and the
  `n_visual_post` counts in the latency summary
  (58/144/288/432 = `floor(kr × 576)`).
- **[`cd1ef3c`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/cd1ef3c)** —
  Add v2 sweep analysis script + tables/plots. `analyze_v2_sweep.py`
  produces the 12-row comparison table (4 random + 4 qsim_mean +
  4 qsim_max + baseline), the total-accuracy Pareto, the
  6-benchmark grid Pareto, and the accuracy-vs-latency Pareto.

??? note "Analysis script wrinkles I won't make again"
    Two issues needed three iterations to get right. The first was
    schema drift — the scores JSON uses keys like `"VQA-RAD_test"`
    and the full-sentence
    `"The total score for multiple-choice questions"`, not the
    display labels I'd hardcoded. Fix: an explicit `KEY_ALIASES`
    dict mapping display labels to a list of candidate JSON keys,
    plus a startup dump of the discovered keys so future drift is
    surfaced loudly.

    The second was a **discovery glob mismatch**. The script's
    `RESULTS_DIR.glob("2026-05-26_*")` line filtered out the new
    `2026-05-27_*` folders *before* the regex ever saw them.
    Symptom: the qsim_max legend entry appeared in plots, but the
    line wasn't drawn (matplotlib silently no-ops on all-None
    series, then still adds the legend label). Fix: extend the
    glob to `"2026-05-2[67]_*"` — explicit dates baked in for
    reproducibility, so re-running the analysis next week won't
    pick up a sweep we didn't intend to fold in.

## Phase 6 — FASP + GridPrune: design

The literature scan during the morning surfaced two related general-VLM
methods and one medical-imaging primitive. **GridPrune** (Wang et al.,
2025; ICCV) is the strongest published general-VLM method for
spatial-coverage pruning. **FASP** (Foreground-Aware Soft Pruning,
Liu et al., 2024) is the medical-imaging primitive for anatomy
filtering. Composing them yields a new method that addresses both
of QSim's failure modes (diversity collapse + scoring-space brittleness)
at once.

The five-stage selection pipeline:

```text
576 visual tokens (post-projector)
    │
    │ Stage 1 — FASP anatomy filter
    │   score = L2-norm of each token's projected embedding
    │   keep top (1 − bg_fraction) by norm   (bg_fraction=0.30 → ~400 anatomy tokens)
    │
    ▼
    n_anatomy tokens
    │
    │ Stage 2a — text-conditional relevance
    │   text_rel = mean over question tokens of cos(visual, text)
    │   normalize to [0, 1] via min-max
    │
    │ Stage 2b — saliency
    │   saliency = anatomy-only L2-norm,  normalized to [0, 1]
    │
    │ Stage 2c — fused score
    │   fused = α · text_rel + (1 − α) · saliency      (α=0.5)
    │
    │ Stage 3 — zoning
    │   12×12 patches → 6×6 spatial grid of 2×2 zones (36 zones, 16 patches each)
    │   per-zone budget ∝ (anatomy density) × (zone text-relevance)
    │
    │ Stage 4 — local top-K within each zone, anatomy only
    │
    ▼
    n_keep tokens (matches floor(kr × 576))
```

Why this design, in three parts:

**Why FASP first.** Background tokens dominate medical images
(black margins, uniform tissue) and dilute every downstream
ranking. The L2-norm signal is cheap (no extra compute) and
medical-imaging-tested (Liu et al. 2024 on similar single-image
medical VQA). Filtering the bottom 30% by norm typically removes
~170 background tokens before any of the more expensive scoring
happens.

**Why zoning second.** The diversity-collapse failure mode is
*structural*: a global top-K on any individual-token score will
cluster the keepers spatially if the score is even weakly correlated
within image regions (which it is, because adjacent visual tokens
encode adjacent image patches). Zone-stratified selection makes
clustering impossible by construction. The 6×6 grid of 2×2 zones
gives 36 zones × 16 patches = 576 = the full token count; the per-
zone budget is computed once and respected absolutely.

**Why the budget allocator combines anatomy density and zone
text-relevance.** The motivation comes directly from the medical-VQA
property survey on Day 17: **questions encode strong spatial
priors**. *"Is there a nodule in the lower left lung?"* should
allocate more budget to lower-left zones; *"is this CT or MRI?"*
should spread budget more uniformly. The fused score
`α · text_rel + (1 − α) · saliency` keeps QSim's question-awareness
as a *spatial guide* rather than a global selector — it influences
*where* to spend budget, not which individual tokens to keep within
a zone. Within each zone, the same fused score acts as a local
tiebreaker, but its damage is bounded — it can only pick the wrong
*K* tokens out of 16, not the wrong *region* of the image.

The composition matters because it puts each technique in the role
it's good at: FASP picks the foreground (a 1D anatomy signal), zoning
enforces coverage (a 2D structural constraint), QSim guides budget
(spatial relevance), and intra-zone fused scoring selects locally
(fine-grained, bounded risk).

??? note "GridPrune as a standalone baseline first"
    The cleanest version of the experiment is to first run
    *vanilla GridPrune* (faithful to the paper — zoning + fused
    score, no anatomy filter) on the same kr sweep, *then* add the
    FASP anatomy filter on top as a paired ablation. This lets the
    Day 19 writeup attribute any gain to the right component:
    "GridPrune − Random = the contribution of coverage"; "FASP +
    GridPrune − GridPrune = the contribution of medical-anatomy
    filtering".

    Tonight's launch is therefore *two* full 4-kr sweeps in series:
    GridPrune first, then FASP+GridPrune. Plus a third sweep —
    Random again — for reasons in the next phase.

## Phase 7 — Tonight's overnight: 12 runs, 3 methods

Three methods × 4 keep-ratios = 12 runs, ~75 min/run = ~15 hours
total. Will finish by tomorrow morning.

| Method | What it adds |
|---|---|
| **Random** | Re-run from May 26 with the new patcher infrastructure that decomposes latency into prune/prefill/decode. Yesterday's random and qsim runs only have *total* latency. Tonight's random run produces phase-decomposed numbers for fair latency comparison with GridPrune + FASP+GridPrune. |
| **GridPrune** | Vanilla zonal-budget + fused score selection. Faithful to Wang et al. 2025. Baseline for what "coverage-aware general-VLM pruning" delivers on medical benchmarks. |
| **FASP+GridPrune** | Our composed method. Anatomy filter → zonal budget → local top-K. The first medical-domain-specific entry. |

The random re-run also serves as a **drift check**: the random
*accuracy* numbers tonight should match May 26 within decoding
noise. If they diverge, that's a red flag for some other change in
the pipeline that we'd need to track down before trusting the new
methods' numbers.

The launch loop puts random first in the method loop. Reasoning:
random is the simplest method, lowest risk of bug, fastest signal
that the new patcher/latency code is firing correctly. If random's
first run produces sane numbers, the rest of the overnight can run
without babysitting.

Implementation work this afternoon — six edits across three files
and two new files (see the
[bugs page entry on shell-pipeline guards](../../bugs.md#7-monkey-patching-vendor-forked-method-renames)
for the still-active discipline of pre-creating output directories
before tee):

1. `pruning/latency.py` — adds three new fields to `SampleLatency`:
   `prune_time_s`, `prefill_time_s`, `decode_time_s`.
2. `pruning/patcher.py` — brackets prune, prefill, and decode
   timing automatically for *any* method that runs through this
   patcher infrastructure (no method-specific instrumentation).
3. `scripts/patch_and_eval.py` — argparse `--pruner` choices
   extended with `gridprune` and `fasp_gridprune`; three new flags
   (`--block_size`, `--alpha`, `--bg_fraction`); `build_pruner`
   dispatches to the new pruner classes.
4. `pruning/gridprune_pruner.py` — new. Implements the zonal
   budget + fused score selection.
5. `pruning/fasp_gridprune_pruner.py` — new. Adds the FASP anatomy
   pre-filter and capped per-zone budget allocation.

Each new method has a once-per-run sentinel in the same style as
v2's `[PATCHER v2] first prune confirmed: ...` line, so silent-
attachment-success remains distinguishable from silent-execution-
failure. The lesson from
[Bug #9](../../bugs.md#9-verification-at-no-op-smoke-test-antipattern)
is still active discipline.

??? note "FASP + GridPrune Stage 2c — capped per-zone budget allocator"
    The naive allocator (just proportional to `zone_joint`) can
    request more tokens than a zone has anatomy in it (after FASP
    filtering removes background, low-density zones may only
    contain 3-4 anatomy tokens, but the proportion would allocate
    8). The capped allocator clips each zone's budget to its
    anatomy count, then redistributes the shortfall to zones with
    remaining capacity. Code lives in `_allocate_budget_capped`.

    ```python
    def _allocate_budget_capped(zone_scores, target_K, zone_capacity):
        """Allocate target_K tokens across zones, weighted by zone_scores
        but capped at zone_capacity. Returns long tensor [n_zones]
        summing to exactly target_K (or as close as possible given caps)."""
        proportions = torch.clamp(zone_scores, min=0.0)
        proportions = proportions / proportions.sum()
        raw = proportions * target_K
        budgets = torch.floor(raw).long()
        # Distribute shortfall by largest remainder, respecting caps
        remainders = raw - budgets.float()
        shortfall = target_K - budgets.sum().item()
        if shortfall > 0:
            for _ in range(shortfall):
                eligible = (budgets < zone_capacity).nonzero(as_tuple=True)[0]
                if eligible.numel() == 0:
                    break
                idx = eligible[torch.argmax(remainders[eligible])]
                budgets[idx] += 1
                remainders[idx] = -1.0  # exclude from next pick
        return budgets
    ```

## Phase 8 — MedPruner: the other paper

While the implementation work was going, took an hour to read
**MedPruner** (Liu et al., March 2026 — the same paper banked
during Week 2 Day 4 reading). The question worth answering:
*is this paper competing with our project?*

Short answer: **no, they're orthogonal**. MedPruner targets **3D
medical volumes** (CT series, MRI series — a stack of 2D slices)
through a two-stage hierarchical pipeline:

1. **Inter-slice Anchor-based Filtering.** Their 3D-specific
   primitive. Picks "anchor" slices through clustering, filters
   slices whose similarity to anchors exceeds a threshold (the
   slice-axis redundancy of CT/MRI volumes is extreme — adjacent
   slices are 95% identical). The output is a smaller set of
   informative slices.
2. **Dynamic Information Nucleus Selection.** Within retained
   slices, selects tokens via cumulative attention weights from an
   early LLM layer. Conceptually similar to FastV/SparseVLM in the
   general-VLM literature, adapted to operate per-slice.

The novelty argument they make is the inter-slice filtering — no
prior medical work explicitly addresses temporal redundancy along
the slice axis. The within-slice nucleus selection is closer to
prior art (attention-based scoring is a well-trodden pattern in
the general-VLM token-pruning literature; they've cited FastV and
SparseVLM in related work). Their twist is applying it *per-slice*
and using *cumulative attention* across layers as the budget driver.

**Relation to our project — the useful framing:**

MedPruner is *not competing with us*. We're 2D medical VQA
(single-image input through HuatuoGPT-Vision). They're 3D medical
(volumetric input through MedGemma-style models). Their inter-slice
filtering primitive doesn't apply to our setup at all — we have no
slice axis to filter. Their dynamic-nucleus piece *would* translate
but only as a within-image scoring method (which is what GridPrune
and our FASP+GridPrune already address differently).

This gives us a clean positioning argument for the writeup:

> *"For 3D medical volumes, MedPruner (Liu et al. 2026) addresses
> inter-slice temporal redundancy through anchor-based filtering.
> Our work focuses on within-slice 2D spatial heterogeneity in
> single-image medical VQA. The two approaches are complementary:
> a future 3D medical VLM could compose MedPruner's inter-slice
> stage with our FASP+GridPrune within-slice stage."*

Their code says *"will be released"* but as of today (May 27),
nothing is available. If we need to compare quantitatively later,
we'd need to implement from the paper or wait for the release.

## Honest ledger of the day

1. **The central thesis took a hit.** Question-aware pruning, in
   its naive cosine-similarity form, doesn't beat random pruning
   on HuatuoGPT-Vision-7B. The gap is monotonic in pruning
   aggressiveness — opposite of what the thesis predicted.
2. **The qsim_max ablation ruled out a reduction-operator quirk.**
   Max-sim is uniformly *worse* than mean-sim. The failure mode is
   structural to text-only scoring on pre-LLM embeddings, not
   specific to how question tokens get aggregated.
3. **The diagnosis points at coverage + scoring space.** Diversity
   collapse + brittle scoring space, both fixable with techniques
   from the published literature.
4. **GridPrune + FASP+GridPrune designed and coded.** Two new
   methods that address both failure modes; queued for tonight's
   overnight.
5. **Latency now decomposed.** Prune / prefill / decode timing
   brackets land in tonight's runs. The accuracy-vs-latency Pareto
   plot will be 3-method × 4-kr (random, gridprune, fasp_gridprune)
   with phase-decomposed bars per kr.
6. **MedPruner is orthogonal.** Their 3D-volume target doesn't
   overlap with our 2D-single-image target. Two complementary
   approaches; clean positioning for the writeup.
7. **Three commits captured the day's analysis state** before any
   code work. Clean restore point if anything goes sideways
   tonight.

---

### Plan for tomorrow (May 28, Day 19 / Week 3 Day 5)

- [ ] **Smell-test the overnight sweep results.** 12 score files,
      12 latency summaries. The discipline from Day 17 still
      applies: confirm pruning actually fires before celebrating
      any numbers.
- [ ] **Extend `analyze_v2_sweep.py` to include gridprune +
      fasp_gridprune.** The regex for run-name parsing needs two
      more alternatives; the methods-in-plot-order needs two more
      entries.
- [ ] **Pareto plots for the 5-method comparison.** Random,
      QSim_mean, QSim_max, GridPrune, FASP+GridPrune × 4 kr × 6
      benchmarks. The interesting question is whether FASP+GridPrune
      is the first method to actually beat Random consistently.
- [ ] **Latency decomposition figure.** Stacked-bar of prune /
      prefill / decode time per kr for each method. Sanity check
      that FASP's L2-norm filter cost is negligible (should be a
      single tensor op per sample).
- [ ] **Update the [Experiments page](../../experiments.md) E2
      writeup with the qsim_max results.** The "analysis pending"
      placeholder finally gets numbers.
- [ ] **Begin drafting an E3 entry** for tonight's sweep
      (GridPrune + FASP+GridPrune) — table + Pareto plots +
      headline.
- [ ] **Read ToMe end-to-end.** Still pending; the literature
      reading slot was eaten by today's analysis.

---

## Pushed today

Three commits to
**[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)**:

**[`43fca4d`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/43fca4d)**
— *Tighten `results/` gitignore: ignore only large per-run files.*
Replaces the blanket `results/*` rule with two narrow patterns
(`results/**/*__predictions.json`,
`results/**/*__checkpoint_partial.json`) so future sweep commits
pick up scores/latency/eval.log files automatically without `git
add -f`. Keeps the 10+ MB predictions and partial-checkpoint files
out of git history; everything small enough to be useful for
reproducibility gets included.

**[`54121f2`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/54121f2)**
— *Add v2 pre-LLM qsim_max sweep results (2026-05-27).* 4 runs:
qsim with reduction=max × {kr=0.75, 0.5, 0.25, 0.1} on
HuatuoGPT-Vision-7B across VQA-RAD, SLAKE, PathVQA, PMC-VQA,
OmniMedVQA, MMMU-Medical. Paired ablation against the May 26
qsim_mean sweep. Pruning verified via the once-per-run sentinel
and the `n_visual_post` counts in the latency summary
(58/144/288/432 tokens for kr=0.10/0.25/0.50/0.75). Headline
finding: max-reduction QSim is uniformly worse than mean-reduction
QSim, which is itself uniformly worse than random pruning. The
diversity-collapse hypothesis strengthened — the failure mode is
structural to text-only scoring on pre-LLM embeddings, not specific
to the reduction operator.

**[`cd1ef3c`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/cd1ef3c)**
— *Add v2 sweep analysis script + tables/plots (Day 18,
2026-05-27).* `analysis/analyze_v2_sweep.py` does discovery +
table + 3 Pareto plots. Reads scores.json and latency_summary.json
from each run, computes deltas vs the kr=1.0 baseline (0.6787),
and generates `2026-05-26_v2_sweep_table.md` / `.csv` (12 rows × 7
columns), `pareto_total.png` (3-method total-accuracy Pareto),
`pareto_panels.png` (6-benchmark grid), and `latency.png`
(accuracy vs latency, kr-annotated). The script took three
iterations to land cleanly — schema-discovery dump at the top
surfaces future drift loudly.
