# Experiments

Running log of pruning experiments. Each experiment gets a short ID
(e.g. `E01`, `E02`) and follows the same template so they're easy to
compare. The project went through multiple base-model pivots in
Weeks 1-3; the work splits naturally into **phases**, each on its own
codebase and base model. The phases below are organized chronologically.

!!! note "When to log an experiment"
    Anything you train, fine-tune, or benchmark gets an entry — even
    failed runs. Especially failed runs. The first ablation you'll wish
    you'd documented is the one you didn't.

## Phases at a glance

| Phase | Dates | Base model · harness | Headline result | Status |
|:--:|---|---|---|---|
| [1](#phase-1-llava-med-v15-zero-shot-baseline-may-14-15) | May 14-15 | LLaVA-Med v1.5 · [`llava-med-pruning`](https://github.com/Leokuan0208/llava-med-pruning) | E00 baseline row across VQA-RAD / SLAKE / PathVQA | <span class="pill pill--done">Retired</span> |
| [2](#phase-2-llava-med-v10-reproduction-first-pruning-attempt-may-16-21) | May 16-21 | LLaVA-Med v1.0 stage-2 · [`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1) | E1 kr=0.75 qsim beat random by +3.30 pts — **invalidated** by substring bug in v1.0 closed-set scorer | <span class="pill pill--done">Retired</span> |
| [3](#phase-3-huatuogpt-vision-7b-baseline-may-25) | May 25 | HuatuoGPT-Vision-7B · [`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning) | E0_huatuo — paper Table 4 reproduced, 5/6 benchmarks within 0.55 pts | <span class="pill pill--done">Complete</span> |
| [4](#phase-4-huatuogpt-pruning-v1-v2-patcher-may-25-27) | May 25-27 | HuatuoGPT-Vision-7B · v2 patcher (pre-LLM) | **Random beats QSim at every keep-ratio.** Gap grows from +0.84 (kr=0.75) to +3.11 (kr=0.10) pts on total. qsim_max ablation made it worse, not better. | <span class="pill pill--done">Complete (negative result)</span> |
| [5](#phase-5-gridprune-family-may-28) | May 28 | HuatuoGPT-Vision-7B · v2 patcher | **Random Pareto-dominates GridPrune and FASP+GridPrune on accuracy *and* latency at every kr.** Third sweep where structured pruning loses to random. Pruning-as-method closed; project pivots to visual-grounding. | <span class="pill pill--done">Complete (negative result)</span> |

**Active codebase as of May 27, 2026:**
[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning).
All Phase 3-5 experiments share this harness; Phases 1-2 are frozen
on their respective archived harnesses.

## Evaluation harness

All experiments are run through a shared harness whose structure
hasn't fundamentally changed across phases — what changed is the
base model and the integration point of pruning. Design decisions
(stable across phases):

- **CLI** — `argparse` (over Hydra). Hydra is more powerful but adds
  a config-system learning curve I don't need for a 12-week project.
- **Output format** — JSON for the summary metrics of each run, plus
  JSONL with one line per sample (for error analysis and re-aggregation
  later).
- **Pruning interface** — `PruningMethod` with `attach(model)` and
  `detach(model)` lifecycle hooks, so a single evaluation run can swap
  pruning strategies without reloading the 15 GB model.
- **Datasets handled** — Phase 1-2: VQA-RAD, SLAKE (English-only),
  PathVQA. Phase 3+: the **six-benchmark HuatuoGPT-Vision suite**
  (VQA-RAD, SLAKE, PathVQA, PMC-VQA, OmniMedVQA, MMMU H&M).

---

## Phase 1 — LLaVA-Med v1.5 zero-shot baseline (May 14-15)

<span class="pill pill--done">Retired</span>

The original baseline. Three benchmarks, one experiment.

### E00 — Baseline (no pruning, v1.5)

**Goal** — establish the reference accuracy and latency numbers we'll
compare every pruning experiment against. No model changes.

**Setup**

- Model: LLaVA-Med v1.5 (Mistral-7B), off-the-shelf weights, frozen
- Datasets: VQA-RAD test (451 samples), SLAKE English test (1,061),
  PathVQA test (6,719) — total 8,231 test questions across the row
- Hardware: see [Baseline (LLaVA-Med)](baseline/llava-med.md#hardware)
- Pruning method: `BaselineMethod` (no-op — runs the model unmodified)
- Decoding: single-turn, greedy (`temperature = 0.0`)

**Results**

| Dataset | Closed acc | Open recall | Overall | Mean latency | Peak GPU |
| --- | --- | --- | --- | --- | --- |
| VQA-RAD | 0.537 | 0.340 | 0.459 | 842.5 ms | 14.86 GiB |
| SLAKE (English) | 0.587 | 0.395 | 0.470 | 787.9 ms | 14.86 GiB |
| PathVQA | 0.587 | 0.106 | 0.347 | 1072.9 ms | 14.86 GiB |

**Notes**

- **Closed-accuracy clustering at 0.587 (SLAKE and PathVQA).** Both
  datasets' closed questions are almost entirely yes/no, so they
  produce essentially the same yes/no performance on this model —
  not a coincidence, but a structural signal that the model isn't
  doing anything dataset-specific for closed questions.
- **Open recall drops sharply on PathVQA** (0.106 vs. 0.340 / 0.395).
  PathVQA's open answers are long descriptive phrases
  (`'thick with abundance of eosinophilic cytoplasm'`) where
  multi-word token recall is intrinsically harder — same metric, very
  different dataset difficulty. Not an indictment of the model.
- **Latency varies with image size, not benchmark.** PathVQA's
  heterogeneous and larger images add ~36% to the mean latency vs.
  SLAKE's uniform 512×512. The image processor's resize step is the
  bottleneck.
- **Peak GPU memory identical across all three** (14.86 GiB) —
  memory is dominated by model weights, not data. Useful to know:
  the memory savings from pruning experiments will come from
  sequence-length reduction, not data loading.
- **On the literature gap.** Published figures for LLaVA-Med v1.0
  (fine-tuned per dataset) sit at ~0.84 closed for VQA-RAD,
  ~0.83 for SLAKE, ~0.91 for PathVQA — 24-32 points above the v1.5
  zero-shot numbers above. The harness inference path is verified
  correct against the reference `model_vqa.py` (see
  [Week 1, Day 5](weekly/week-01/day-05.md#the-baseline-underperformance-investigation));
  the gap is the difference between **v1.5 zero-shot** and **v1.0
  per-dataset fine-tuned**, not a code bug. That gap is exactly what
  motivated Phase 2 below.
- **On the closed-ended numbers specifically.** VQA-RAD is computed
  over the corrected 272 closed questions (after [Bug #3](bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions)
  fixed the `answer_type` labels); SLAKE and PathVQA use those
  datasets' real `answer_type` fields (no heuristic needed).
- **Known open issue (Phase 1).** `closed_ended_accuracy` uses lenient
  whole-word matching, which may over- or under-credit verbose
  answers. **This is the same lenient-scoring issue that Phase 2's
  substring bug would surface as an inflated qsim result.**

---

## Phase 2 — LLaVA-Med v1.0 reproduction + first pruning attempt (May 16-21)

<span class="pill pill--done">Retired — invalidated by substring bug in v1.0 closed-set scorer</span>

**Why this phase happened.** The 24-32 point gap between Phase 1's
v1.5 zero-shot row and the published v1.0 per-dataset fine-tuned
numbers made fine-tuning v1.5 ourselves clearly slower than just
running v1.0 with its published delta weights. A forked harness
([`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1))
handled the v1.0 reproduction track end-to-end.

**Why it was retired.** On May 21, after compiling the full
{0.75, 0.50, 0.25, 0.10} Pareto curve, closed-accuracy was
**rising monotonically with pruning aggressiveness** (up to +7.35 pts
at kr=0.10 qsim). Investigation found a **substring-matching bug in
the LLaVA-Med v1.0 closed-set scorer** that inflates every published
v1.0 closed-accuracy number by 9-12 pts uniformly, and inflates
verbose pruned-model outputs even more. The Phase 2 qsim result is
not invalid in the sense of "the experiment ran wrong" — the runs
themselves are reproducible — but the *signal* in the closed
metric isn't measuring what the project's research question asks.
**The v1.0 harness and all Phase 2 results are preserved frozen at
[`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
for reference.** A subsequent MCQ-letter compliance smoke test
returned 0/11 lead-with-letter responses, confirming that v1.0's
instruction-following is fundamentally incompatible with the field's
standardized evaluation format. That second finding closed off
"just fix the scorer" as a path forward and motivated the
HuatuoGPT-Vision pivot in Phase 3.

### Summary table — Phase 2

| ID  | Date | Model · Strategy | K (kept) | VQA-RAD | SLAKE | PathVQA | Notes |
| --- | ---- | ---------------- | -------- | ------- | ----- | ------- | ----- |
| E0_v1.0   | May 16    | v1.0 stage-2 · baseline | 100% | 0.580 | — | — | First paper-comparable v1.0 number |
| E0_v1.0_b | May 17    | v1.0 Baron-GG stage-2 · baseline | 100% | 0.577 | 0.488 | 0.556 | Cross-validation; agrees with ours within 0.5pt |
| E0_v1.0_ft | May 17   | v1.0 · 5-epoch full FT | 100% | 0.570 | — | — | FT didn't beat zero-shot — memorization |
| E0_pathvqa_merged | May 17 | v1.0 · published PathVQA delta | 100% | — | — | 0.601 | Degraded vs paper's 0.91 but functional |
| **E1_random_kr0p75** | May 17 | v1.0 stage-2 · random pruning | 75% | 56.99 closed / 30.37 open | — | — | Sanity floor — within noise of baseline |
| **E1_qsim_kr0p75**   | May 17 | v1.0 stage-2 · question-similarity | 75% | **60.29** closed / 28.53 open | — | — | **+2.57 over baseline, +3.30 over random** (invalidated by substring bug, May 21) |

### On the v1.0 reproduction track

As of May 17, the v1.0 evaluation harness is complete (pushed to
[Leokuan0208/llava-med-pruning-v1](https://github.com/Leokuan0208/llava-med-pruning-v1))
and has produced a complete reproduction snapshot across three
configurations: our independently-merged stage-2, two of the
published per-dataset fine-tuned deltas, and Baron-GG's
community-mirror stage-2 as a cross-validation.

The headline finding from Day 8 is: **our open-recall reproduces the
paper to within ~1 point across every dataset and every configuration
tested**. Closed-accuracy reproduces paper *on stage-2* but has a
large gap *on the FT models* — which is now isolated as a
measurement-recipe issue (almost certainly `--answer-prompter` or
equivalent closed-set inference logic), not a corrupted-weights issue
as Day 7 initially claimed.

#### Paper Table 4 vs ours — unified comparison

The single unified table below collapses all of the project's
Phase 2 reproduction data and the kr=0.75 pruning result into one
place. The three configs at the top compare against paper Table 4
directly: stage-2 zero-shot is the paper's "60K-IM, stage-1 × 1,
stage-2 × 3, FT × 0" row, and the two FT-merged rows compare against
the FT=15 columns. The two pruning rows underneath compare against
*our* stage-2 baseline (not paper), since pruning is built on top of
that and the relevant comparison is "did pruning hurt accuracy
relative to no pruning."

Per the paper's Table 4 caption: *"For open-set questions, we report
the recall for our free-form text generation method in column Open.
For closed-set questions, we report the accuracy in column Closed."*
The "Open" metric is **bag-of-words token recall** — our
`open_recall`, not `open_appearance_accuracy`. This metric-definition
discovery was a Day 8 finding in itself; without it, the comparison
would have shown the wrong number and looked like a much larger gap.

<div class="legend">
  <span><span class="legend-dot legend-dot--good"></span>within 3 pts of comparator</span>
  <span><span class="legend-dot legend-dot--warn"></span>3-10 pts</span>
  <span><span class="legend-dot legend-dot--bad"></span>over 10 pts</span>
  <span><span class="legend-dot legend-dot--beats"></span>beats stage-2 baseline</span>
</div>

<div class="comparison-table-wrapper">
<table class="comparison-table">
  <thead>
    <tr>
      <th class="config-header" rowspan="2">Config</th>
      <th colspan="2">VQA-RAD closed</th>
      <th colspan="2">VQA-RAD open</th>
      <th colspan="2">SLAKE closed</th>
      <th colspan="2">SLAKE open</th>
      <th colspan="2">PathVQA closed</th>
      <th colspan="2">PathVQA open</th>
    </tr>
    <tr>
      <th>Ours</th><th>Paper</th>
      <th>Ours</th><th>Paper</th>
      <th>Ours</th><th>Paper</th>
      <th>Ours</th><th>Paper</th>
      <th>Ours</th><th>Paper</th>
      <th>Ours</th><th>Paper</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="config-cell">Stage-2 zero-shot</td>
      <td class="cell-good">57.72</td><td>61.40</td>
      <td class="cell-good">29.52</td><td>28.23</td>
      <td class="cell-good">48.80</td><td>52.16</td>
      <td class="cell-good">38.28</td><td>39.17</td>
      <td class="cell-good">55.56</td><td>54.05</td>
      <td class="cell-good">11.67</td><td>12.30</td>
    </tr>
    <tr>
      <td class="config-cell">VQA-RAD-merged (FT)</td>
      <td class="cell-bad">20.96</td><td>84.19</td>
      <td class="cell-good">60.05</td><td>61.53</td>
      <td class="na-cell" colspan="8">dataset-specific FT — not applicable</td>
    </tr>
    <tr>
      <td class="config-cell">PathVQA-merged (FT)</td>
      <td class="na-cell" colspan="8">dataset-specific FT — not applicable</td>
      <td class="cell-bad">60.05</td><td>91.21</td>
      <td class="cell-good">37.13</td><td>37.95</td>
    </tr>
    <tr class="section-break">
      <td colspan="13">Pruning ablation (applied to stage-2 zero-shot, VQA-RAD only)</td>
    </tr>
    <tr>
      <td class="config-cell">Random pruning, kr=0.75</td>
      <td class="cell-good">56.99</td><td>—</td>
      <td class="cell-good">30.37</td><td>—</td>
      <td class="na-cell" colspan="8">VQA-RAD only this run</td>
    </tr>
    <tr>
      <td class="config-cell">Question-aware pruning, kr=0.75</td>
      <td class="cell-beats">60.29</td><td>—</td>
      <td class="cell-good">28.53</td><td>—</td>
      <td class="na-cell" colspan="8">VQA-RAD only this run</td>
    </tr>
  </tbody>
</table>
</div>

*Pruning row colors compare against our stage-2 baseline (57.72
closed), not the paper. The question-aware row at kr=0.75 beats
baseline on closed accuracy (+2.6 pts) while removing 25% of visual
tokens — a small positive signal that question-aware selection helps.
**This +2.6 pt headline is what the May 21 substring-bug investigation
later invalidated** — the closed-set scorer inflates verbose pruned
outputs more than it inflates baseline outputs, accounting for most
of the gap.*

### Bonus: our 5-epoch FT-from-stage-2 attempt

Independent of the reproduction question, Week 2 Day 1 also tried
the most ambitious path: **training per-dataset fine-tunes ourselves**
from stage-2 using the paper's documented recipe (full FT, `lr=2e-5`,
cosine schedule, bf16). A 5-epoch full fine-tune of stage-2 → VQA-RAD
train completed cleanly overnight (loss 1.13 → 0.004). Top-3
checkpoint eval:

| Checkpoint | Epoch | Closed acc | Open recall |
|---|---|---|---|
| checkpoint-675 | 3 | **56.99** ← best | _not recorded_ |
| checkpoint-900 | 4 | 53.31 | _not recorded_ |
| checkpoint-1125 | 5 | 56.62 | _not recorded_ |

The best FT checkpoint (56.99) is **statistically indistinguishable
from stage-2 zero-shot (57.72)** within stochastic-decoding noise.
Prediction inspection confirmed sensible English with a mild "no"
bias — the FT memorized the training set (loss 0.004) but didn't
transfer to test images.

### E1 — First ablation sweep (random vs question-similarity pruning)

The Phase 2 ablation that produced the headline +3.30 pt qsim-over-random
result on May 17. **This result was invalidated by the May 21 substring
bug investigation** but the experimental setup, methodology, and design
rationale are preserved here in full because they're directly inherited
by Phase 4's design.

**Goal** — first test of the project's central research thesis:
**does question-aware visual-token pruning beat random pruning at
the same keep-ratio?**

**Setup**

- Model: LLaVA-Med v1.0 stage-2 merged (the canonical baseline
  established Day 8 — closed 0.577 on VQA-RAD via Baron-GG)
- Dataset: VQA-RAD test (451 samples) — primary benchmark for the
  ablation
- Pruning location: **in-LLM**, pre-forward hooks on all 32
  `LlamaDecoderLayer` instances; scoring happens at layer 0,
  selection-and-slicing propagates through the remaining 31 layers
- Methods compared:
    - `random` — keep `floor(256 × K)` visual tokens, uniform random,
      per-sample-deterministic via question_id hash seed
    - `qsim` — same keep count, cosine similarity to pooled question
      embedding (mean of question text tokens' layer-0 hidden states)
- Keep ratios: K ∈ {0.75, 0.50, 0.25, 0.10}
- Decoding: stochastic, `temperature=0.7` (matches v1.0 paper recipe)

**Why this design**

The "qsim vs random" framing is the cheapest decisive test of the
project's thesis. If qsim consistently beats random by 2-5 pts at
matched K, **question-awareness adds signal for medical VQA
pruning** — the project's central claim is supported. If qsim ≈
random, simpler question-awareness isn't enough and the method
needs refinement (e.g. attention-based scoring à la FastV, or
learned scoring). If qsim is *worse* than random, that's the most
informative outcome — naive question-similarity actively misleads,
forcing a deeper investigation.

**Results — VQA-RAD test (451 samples)**

| K | Method | Closed acc | Open recall | Avg latency | Δ closed vs baseline |
|---|---|---:|---:|---:|---:|
| 1.00 (baseline) | — | 57.72 | 29.52 | 1266 ms | — |
| **0.75** | **random** | **56.99** | **30.37** | **1335 ms** | **−0.73** |
| **0.75** | **qsim**   | **60.29** | **28.53** | **1467 ms** | **+2.57** |

**Findings at kr=0.75 (as reported May 17, invalidated May 21)**

- QSim beats random by +3.30 closed-accuracy points (60.29 vs
  56.99) at the same keep ratio.
- QSim also beats the unpruned baseline by +2.57 pts (60.29 vs
  57.72) while removing 25% of visual tokens.
- Both pruning methods are slightly slower than baseline at this
  ratio. Random +69 ms/sample (+5.5%), qsim +201 ms/sample (+15.9%).
  Hook overhead (32 pre-forward hooks + the
  `prepare_inputs_for_generation` patch) dominates the small compute
  savings from dropping 64 visual tokens.

**The May 21 retraction.** The kr ∈ {0.50, 0.25, 0.10} sweep produced
closed-accuracy rising monotonically with pruning aggressiveness —
up to +7.35 pts at kr=0.10 qsim. This is structurally implausible:
real signal from question-awareness shouldn't *grow* under more
aggressive pruning at a fixed metric. The investigation found that
v1.0's `closed_ended_accuracy` uses **substring matching** (the
ground-truth string appearing anywhere in the model output counts
as correct), which inflates verbose pruned-model outputs more than
it inflates baseline outputs. Under the strictest possible scorer
(lead with yes/no), pruning does *not* improve closed accuracy at
all. Combined with the MCQ-letter compliance smoke test (0/11
responses started with a letter), this confirmed v1.0 is fundamentally
incompatible with the field's standardized evaluation methodology
and triggered the Phase 3 pivot.

Full May 21 writeup: [Week 2, Day 5](weekly/week-02/day-05.md).

---

## Phase 3 — HuatuoGPT-Vision-7B baseline (May 25)

<span class="pill pill--done">Complete</span>

**Why HuatuoGPT-Vision-7B.** Reproducibility first. The authors
publish merged weights, bundled evaluation data, a one-command
`accelerate launch eval.py` pipeline, and a Table of headline numbers
across six benchmarks. The first deliverable on this stack is paper
reproduction, not from-scratch pipeline construction. Full reasoning
on [Baseline (HuatuoGPT-Vision)](baseline/huatuo-vision.md#why-huatuogpt-vision-7b).

### Summary table — Phase 3

| ID  | Date | Model · Strategy | K (kept) | Total (6-bench avg) | Notes |
| --- | ---- | ---------------- | -------- | ---: | ----- |
| **E0_huatuo** | May 25 | HuatuoGPT-Vision-7B · baseline | 100% | **0.6787** | Paper Table 4 reproduction — 5/6 benchmarks within 0.55 pts ([details](baseline/huatuo-vision.md#baseline-metrics)) |

### E0_huatuo — Baseline (no pruning, HuatuoGPT-Vision-7B)

**Goal** — reproduce HuatuoGPT-Vision's published Table 4 numbers
end-to-end on our infrastructure, validating the pipeline before
any pruning experiments are run.

**Setup**

- Model: HuatuoGPT-Vision-7B (LLaVA-v1.5 arch, Qwen2-7B backbone),
  off-the-shelf merged weights from
  [`FreedomIntelligence/HuatuoGPT-Vision-7B`](https://huggingface.co/FreedomIntelligence/HuatuoGPT-Vision-7B)
- Datasets: the bundled six-benchmark
  [`Medical_Multimodal_Evaluation_Data`](https://huggingface.co/datasets/FreedomIntelligence/Medical_Multimodal_Evaluation_Data)
  release — VQA-RAD, SLAKE, PathVQA, PMC-VQA, OmniMedVQA, MMMU H&M.
- Hardware / Dockerfile: see
  [Baseline (HuatuoGPT-Vision)](baseline/huatuo-vision.md#the-dockerfile)
- Pruning method: none (no-op)
- Pipeline: `accelerate launch eval.py` from upstream HuatuoGPT-Vision
  repo, against the bundled JSON eval data.

**Results — six benchmarks**

| Benchmark | Paper | Our reproduction | Δ |
| --- | ---: | ---: | ---: |
| VQA-RAD | 63.7 | 61.35 | −2.35 |
| SLAKE | 76.2 | 76.44 | +0.24 |
| PathVQA | 57.9 | 57.67 | −0.23 |
| PMC-VQA | 54.3 | 54.20 | −0.10 |
| OmniMedVQA | 74.0 | 73.46 | −0.54 |
| MMMU H&M | 50.6 | 50.34 | −0.26 |
| **Total (mean)** | — | **0.6787** | — |

**5 of 6 within 0.55 pts of paper.** The VQA-RAD outlier at −2.35 sits
just outside the 2-pt tolerance defined for this baseline, but VQA-RAD
is the smallest test split (251 samples; one sample ≈ 0.4 pts) and the
run log contained some "wrong image" warnings that may explain the
gap. **The pipeline is verified end-to-end**: every accuracy number
produced with pruning hooks attached is now directly comparable to
these six numbers.

Full Phase 3 writeup:
[Week 3, Day 2, Phase 13](weekly/week-03/day-02.md#phase-13-baseline-reproduction-56-benchmarks-within-055-pts).

---

## Phase 4 — HuatuoGPT pruning, v1 + v2 patcher (May 25-27)

<span class="pill pill--done">Complete (negative result)</span>

**The headline result.** Mean-pooled and max-similarity QSim are
uniformly worse than Random pruning at every keep-ratio on
HuatuoGPT-Vision-7B. The total-score gap (Random − QSim_mean) grows
monotonically with pruning aggressiveness: +0.84 at kr=0.75 → +3.11
at kr=0.10. The Tier-1 follow-up (qsim_max instead of qsim_mean)
made things *worse*, not better. Diagnosis: **diversity collapse +
scoring-space brittleness** — the cosine-similarity-on-pre-LLM-
embeddings signal doesn't track what the LLM actually needs.

This phase has three experiments after the v1 patcher no-op was
caught and the v2 patcher rewrite was shipped.

### Summary table — Phase 4

| ID  | Date | Strategy | K (kept) | Total | VQA-RAD | SLAKE | PathVQA | PMC-VQA | OmniMed | MMMU |
| --- | ---- | -------- | -------- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | May 25 | (none) | 100% | **0.6787** | 0.6135 | 0.7644 | 0.5767 | 0.5420 | 0.7346 | 0.5034 |
| ~~E1_huatuo_sweep_c216bbe~~ | May 25 | v1 patcher | various | _**no-op (bug)**_ | _no-op_ | _no-op_ | _no-op_ | _no-op_ | _no-op_ | _no-op_ |
| **E2_random** | May 26 | v2 · Random | 75% | 0.6746 (−0.41) | 0.6096 | 0.7716 | 0.5696 | 0.5330 | 0.7318 | 0.5034 |
| **E2_qsim_mean** | May 26 | v2 · QSim_mean | 75% | 0.6662 (−1.25) | 0.6175 | 0.7572 | 0.5720 | 0.4970 | 0.7253 | 0.4759 |
| **E2_qsim_max**  | May 27 | v2 · QSim_max  | 75% | 0.6504 (−2.83) | _(see day-04)_ | | | | | |
| **E2_random** | May 26 | v2 · Random | 50% | 0.6730 (−0.57) | 0.5896 | 0.7572 | 0.5812 | 0.5235 | 0.7284 | 0.5103 |
| **E2_qsim_mean** | May 26 | v2 · QSim_mean | 50% | 0.6538 (−2.49) | 0.5697 | 0.7764 | 0.5595 | 0.4880 | 0.7118 | 0.4759 |
| **E2_qsim_max**  | May 27 | v2 · QSim_max  | 50% | 0.6348 (−4.39) | _(see day-04)_ | | | | | |
| **E2_random** | May 26 | v2 · Random | 25% | 0.6570 (−2.17) | 0.5697 | 0.7212 | 0.5764 | 0.4925 | 0.7122 | 0.5241 |
| **E2_qsim_mean** | May 26 | v2 · QSim_mean | 25% | 0.6293 (−4.94) | 0.5657 | 0.7572 | 0.5509 | 0.4685 | 0.6807 | 0.4621 |
| **E2_qsim_max**  | May 27 | v2 · QSim_max  | 25% | 0.6113 (−6.74) | _(see day-04)_ | | | | | |
| **E2_random** | May 26 | v2 · Random | 10% | 0.6357 (−4.30) | 0.5538 | 0.7404 | 0.5699 | 0.4595 | 0.6870 | 0.4966 |
| **E2_qsim_mean** | May 26 | v2 · QSim_mean | 10% | 0.6046 (−7.41) | 0.5498 | 0.7212 | 0.5452 | 0.4525 | 0.6485 | 0.4690 |
| **E2_qsim_max**  | May 27 | v2 · QSim_max  | 10% | 0.5844 (−9.43) | _(see day-04)_ | | | | | |

The Total − Random ranking is consistent at every kr:
**Random > QSim_mean > QSim_max**, with the gap widening as pruning
deepens. Random Pareto-dominates QSim_mean on both accuracy and (3/4
kr) latency.

### ~~E1_huatuo_sweep_c216bbe~~ — v1 patcher (retroactively diagnosed no-op)

**Date:** May 25, 2026 (overnight) · **Commit:** [`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe)

The first overnight sweep on HuatuoGPT-Vision (8 runs: 4 keep_ratios
× 2 methods) completed cleanly in tmux. May 26's morning smell-test
caught the bug: **all 8 configurations produced bit-identical
scores.** Root cause: HuatuoGPT-Vision forks LLaVA's
`prepare_inputs_labels_for_multimodal` into a `_new`-suffixed variant
and routes everything through it; our patcher wrapped the *original*,
which exists on the class but is dead code in HuatuoGPT's path. The
hooks never fired. See [Bug #7](bugs.md#7-monkey-patching-vendor-forked-method-renames).

The one-line fix (target the `_new` variant) exposed two more
issues in sequence — **the v1 fix cascade**: attention-mask frame
reconciliation between HF generate's unpruned-frame state and our
pruned-frame KV cache, then position_ids RoPE index-out-of-bounds
from HF passing unpruned-frame indices into our pruned-frame
rotary tables. All three fixed; v1 ran 545+ samples cleanly,
archived as `pruning/archive/patcher_v1_post_layer0.py` at
[`72bdd28`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/72bdd28).

### v1 → v2 architectural rewrite

After the v1 fix cascade landed, the architectural lesson surfaced:
**trunk-modification has a fragile integration tax that doesn't
actually buy anything for QSim under causal attention** (visual
tokens can't attend forward to question tokens at any layer; the
question-aware scoring signal exists *before* the LLM trunk too).
Rewrote as **v2: prune visual tokens BEFORE the LLM trunk runs**,
dropping code from 280 → 130 lines and ~30% of inference latency at
kr=0.5. Commit [`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249).

### E2 — v2 patcher first sweep (qsim_mean + random + qsim_max)

**Date:** May 26-27, 2026 · **Commits:**
[`24ef568`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/24ef568)
(qsim_mean + random) ·
[`54121f2`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/54121f2)
(qsim_max) ·
[`cd1ef3c`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/cd1ef3c)
(analysis pipeline)

**Goal** — first test of the project's central thesis on a
verified-reproducible base model: does question-aware visual-token
pruning beat random pruning at the same keep-ratio? After the v1
no-op was diagnosed, the v2 patcher reset the experimental clock.

**Setup**

- Model: HuatuoGPT-Vision-7B (frozen, from
  [`huggingface.co/FreedomIntelligence/HuatuoGPT-Vision-7B`](https://huggingface.co/FreedomIntelligence/HuatuoGPT-Vision-7B))
- Datasets: the bundled six-benchmark suite (VQA-RAD, SLAKE, PathVQA,
  PMC-VQA, OmniMedVQA, MMMU H&M)
- Pruning location: **pre-LLM**, between the projector output and
  the LLM trunk's first layer. v2 architecture (commit `85cb249`).
- Methods compared:
    - `random` — keep `floor(N_visual × K)` visual tokens uniformly
      at random, per-sample-deterministic
    - `qsim_mean` — mean-pool the question's projected embeddings to
      a single vector, rank visual tokens by cosine similarity, keep
      top-K
    - `qsim_max` (May 27 ablation) — for each visual token, take the
      max cosine similarity over all question tokens; keep top-K.
      Motivated by **ResPrune** (Setting-1 max formulation beating
      Setting-3 mean-pool by ~3 pts in their published ablation).
- Keep ratios: K ∈ {0.75, 0.50, 0.25, 0.10}
- Decoding: per HuatuoGPT eval default (stochastic, temperature 0.7)

**Headline findings**

1. **Random beats QSim_mean at every keep-ratio.** The total-score
   gap is monotone in pruning aggressiveness:

   | K | Random − QSim_mean |
   |---:|---:|
   | 0.75 | +0.84 pts |
   | 0.50 | +1.92 pts |
   | 0.25 | +2.77 pts |
   | 0.10 | +3.11 pts |

   This is the **opposite** of what the central thesis predicted —
   the hypothesis was that question-awareness should matter *more*
   under aggressive pruning, not less. The random-baseline
   experimental control is exactly what surfaced this; without it,
   QSim's modest drops would have read as "pruning works." With
   Random as the floor, the reading is "QSim doesn't help — it
   actively hurts."

2. **Two cells where QSim beats baseline.** VQA-RAD at kr=0.75
   (61.75 vs 61.35 = +0.40) and SLAKE at kr=0.50 (77.64 vs 76.44 =
   +1.20). The SLAKE one is the more interesting datapoint: keeping
   only half the visual tokens, QSim does +1.2 better than the
   unpruned model on a clean-radiology benchmark with well-localized
   targets. Both are small (close to decoding noise on stochastic
   generation) and neither survives at lower keep-ratios.

3. **The benchmark with the worst QSim collapse is MMMU.** QSim
   drops MMMU more than Random at every kr; at kr=0.25 the gap is
   6.20 points (QSim 46.21 vs Random 52.41). MMMU is the most
   text-heavy of the six benchmarks; QSim is selecting tokens that
   look like the question text, but those aren't the tokens needed
   to *answer* the question.

4. **qsim_max is uniformly worse than qsim_mean.** Same-day
   max-similarity ablation went the wrong direction at every kr:

   | K | Random | QSim mean | **QSim max** |
   |---:|---:|---:|---:|
   | 0.75 | 0.6746 | 0.6662 | **0.6504** |
   | 0.50 | 0.6730 | 0.6538 | **0.6348** |
   | 0.25 | 0.6570 | 0.6293 | **0.6113** |
   | 0.10 | 0.6357 | 0.6046 | **0.5844** |

   Max-sim is now 2.0-2.5 pts below mean-sim at every kr, and
   2.4-5.1 pts below Random. The mean-pool was acting as a weak
   diversity regularizer; removing it concentrated all the kept
   tokens around whichever question word "won" the matching, making
   diversity collapse worse.

**Diagnosis — structural, not parametric**

The failure mode isn't mean-vs-max. The failure mode is the *scoring
space*. Both reductions rank visual tokens by lexical-semantic
similarity to question tokens in the projected embedding space,
*before* the LLM has seen anything. But the LLM doesn't care which
visual tokens *look like* question words; it cares which visual
tokens it would have *attended to* when generating the answer.
Those aren't the same thing — the encoder embeddings don't know
about the model's downstream reasoning patterns, and they're
brittle to question phrasing (*"lung"* and *"pulmonary"* would
project to different vectors even though the model treats them
identically). **Random selection beats both because it doesn't try
to be clever in a space that doesn't reward cleverness.**

This points hard at two complementary directions, both implemented
and queued for Phase 5:

- **Coverage-aware selection** — enforce spatial diversity in what
  we keep instead of trusting a global ranking. Published as
  **GridPrune** (Duan et al., arXiv:2511.10081) for general VLMs.
- **Medical anatomy filtering** — exploit the high background-to-
  signal ratio of medical images. Score every token by L2-norm of
  its post-projector embedding; the lowest ~30% are almost always
  background. We call this filter **FASP** (foreground-aware soft
  pruning) inside our codebase; no external paper is cited because
  the "FASP / Liu et al. 2024" entry earlier referenced here was
  found on May 28 audit not to exist.

Full Phase 4 writeup:
[Week 3, Day 4](weekly/week-03/day-04.md#phase-2-reading-the-result)
(qsim_mean analysis) ·
[Phase 4](weekly/week-03/day-04.md#phase-4-the-qsim_max-ablation)
(qsim_max ablation).

---

## Phase 5 — GridPrune family (May 28)

<span class="pill pill--done">Complete (negative result)</span>

The direct response to Phase 4's diversity-collapse diagnosis: if
"look like the question text" is the wrong scoring space, does
"spread the budget evenly across the image" (GridPrune) or "across
*anatomy* tokens only" (FASP+GridPrune) do better? Three methods on
the same v2 patcher, full four-kr Pareto curve, with the patcher's
new latency-decomposition instrumentation recording phase-by-phase
cost for the first time. **Answer: no.** Random Pareto-dominates
both structured methods on accuracy *and* latency at every
keep-ratio. This is the third consecutive sweep (after qsim_mean and
qsim_max) where structured pre-LLM pruning loses to random selection
on HuatuoGPT-Vision-7B, and it closes training-free visual-token
pruning as a *method* for this model.

### Summary table — Phase 5

| ID  | Date | Strategy | K (kept) | Total score | Notes |
| --- | ---- | -------- | -------- | ----------- | ----- |
| E3_random | May 28 | v2 · Random | 75 / 50 / 25 / 10% | 0.6746 / 0.6730 / 0.6570 / 0.6357 | Best at every kr; doubles as drift check vs E2_random |
| E3_gridprune | May 28 | v2 · GridPrune | 75 / 50 / 25 / 10% | 0.6680 / 0.6573 / 0.6409 / 0.6102 | Faithful Duan et al. arXiv:2511.10081; loses to Random everywhere |
| E3_fasp_gridprune | May 28 | v2 · FASP+GridPrune | 75 / 50 / 25 / 10% | 0.6759 † / 0.6625 / 0.6430 / 0.6119 | Edges GridPrune at every real kr; still loses to Random |

Baseline (kr=1.0, no pruning) = **0.6787**. † The kr=0.75
FASP+GridPrune cell is a degenerate artifact — see
[Bug #10](bugs.md#10-degenerate-faspgridprune-branch-at-kr075-inflated-the-e3-table).

### E3 — Random + GridPrune + FASP+GridPrune

**Goal** — test whether coverage-aware (GridPrune) and
coverage + anatomy (FASP+GridPrune) selection clear Phase 4's Random
floor.

**Setup**

- Model: HuatuoGPT-Vision-7B (unchanged from Phase 3-4)
- Datasets: the bundled six-benchmark suite
- Patcher: v2 (commit `85cb249`) with the Day 4 latency-decomposition
  rewrite — `prune_time_s` / `prefill_time_s` / `decode_time_s`
  bracketed automatically
- Methods:
    - `random` — re-run with phase-decomposed latency; doubles as a
      drift check against E2_random's accuracy numbers
    - `gridprune` — faithful Duan et al., arXiv:2511.10081. Divide
      visual tokens into a grid of zones; per-zone budget proportional
      to a fused (text-relevance + saliency) score; local top-K within
      each zone.
    - `fasp_gridprune` — composed method. First, FASP filter: drop the
      lowest ~30% by L2-norm of post-projector embedding (reliably
      background). Then GridPrune on the survivors.
- Keep ratios: K ∈ {0.75, 0.50, 0.25, 0.10}
- Decoding: per HuatuoGPT eval default (greedy)

**Results — accuracy**

Gap to Random (positive = beats Random):

| kr | GridPrune | FASP+GridPrune |
|---|---|---|
| 0.75 | −0.66 | +0.13 † |
| 0.50 | −1.57 | −1.05 |
| 0.25 | −1.61 | −1.40 |
| 0.10 | −2.55 | −2.38 |

Three readings:

1. **Random wins at every keep-ratio**, with the same monotone
   gap-growth signature as the QSim sweeps — smallest at kr=0.75,
   largest at kr=0.10. The penalty for being clever grows as pruning
   gets aggressive.
2. **FASP+GridPrune > GridPrune at every real kr** (+0.52, +0.21,
   +0.17 pts through kr=0.5 / 0.25 / 0.1). FASP's anatomy filter adds
   a sliver of real signal on top of coverage — just not enough to
   reach Random. After removing the degenerate kr=0.75 cell,
   FASP+GridPrune beats Random in **1 of 18** benchmark×kr
   comparisons (VQA-RAD kr=0.25, likely noise).
3. **Random is extraordinarily strong** — only −0.57 pts vs baseline
   at kr=0.5, −2.17 at kr=0.25. The model is far more robust to
   random token dropping than expected for a medical VLM. This is the
   finding that reframes the project: not "how do we prune well" but
   "why doesn't the model need the visual tokens."

**Results — latency** (mean per-sample ms; prune / prefill / decode)

At a fixed keep-ratio prefill and decode are determined by token
count, so they're identical across methods. The only lever is prune
overhead: Random ~0.22 ms, structured methods 9–31 ms. So Random is
both more accurate *and* faster — e.g. GridPrune at kr=0.5 is 157.95
ms vs Random's 139.88 ms, 18 ms slower for worse accuracy. **Random
Pareto-dominates on both axes simultaneously.** One useful byproduct:
decode time barely moves with token count (~46 → ~40 ms) while
prefill nearly halves (50 → 26 ms), so almost all pruning savings
live in prefill — modest on short-answer medical VQA.

**Conclusion**

Neither coverage-aware nor anatomy-filtered selection beats Random.
Combined with E2 (qsim_mean, qsim_max), that's three sweeps and five
methods all losing to random selection — the failure is structural,
not method-specific. **Training-free visual-token pruning is closed
as a method for HuatuoGPT-Vision.** But the *reason* — the model
barely needs the fine-grained visual evidence — is a visual-grounding
finding, and the project pivots there
([Week 3, Day 5](weekly/week-03/day-05.md#phase-5-the-strategic-pivot-four-directions)).
The pruning infrastructure is repurposed into an evidence-dial probe;
a zero-GPU feasibility probe established that answer-stability under
visual-evidence removal tracks correctness (81.7% stable when correct
vs 64.3% when wrong), green-lighting a training-free
evidence-router direction.

Full analysis:
[Week 3, Day 5](weekly/week-03/day-05.md). Design background:
[Week 3, Day 4, Phase 6](weekly/week-03/day-04.md#phase-6-fasp-gridprune-design).

---

## Template for new experiments

Copy this block, paste it into the active phase, and bump the ID.

```markdown
## EN — Short descriptive name

<span class="pill pill--planned">Planned</span>

**Goal** — one sentence.

**Setup**
- Model:
- Dataset:
- Pruning strategy:
- K:
- Training config (if applicable):

**Results**
- Metric 1:
- Metric 2:
- Latency:

**Conclusion**
- What did this tell us?
- What's the next experiment?
```
