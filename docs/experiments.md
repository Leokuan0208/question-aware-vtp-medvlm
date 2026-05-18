# Experiments

Running log of pruning experiments. Each experiment gets a short ID
(e.g. `E01`, `E02`) and follows the same template so they're easy to
compare.

!!! note "When to log an experiment"
    Anything you train, fine-tune, or benchmark gets an entry — even
    failed runs. Especially failed runs. The first ablation you'll wish
    you'd documented is the one you didn't.

## Evaluation harness

All experiments are run through a shared harness at
`~/llava-med-pruning/` (separate repo from LLaVA-Med itself, to keep
the pruning work cleanly isolated). The code is on GitHub at
[Leokuan0208/llava-med-pruning](https://github.com/Leokuan0208/llava-med-pruning).
Design decisions:

- **CLI** — `argparse` (over Hydra). Hydra is more powerful but adds a
  config-system learning curve I don't need for a 12-week project.
- **Output format** — JSON for the summary metrics of each run, plus
  JSONL with one line per sample (for error analysis and re-aggregation
  later).
- **Pruning interface** — `PruningMethod` with `attach(model)` and
  `detach(model)` lifecycle hooks, so a single evaluation run can swap
  pruning strategies without reloading the 15 GB model.
- **Datasets handled** — VQA-RAD, SLAKE (English-only), PathVQA.

Status (May 17, 2026): **Baseline phase complete and first pruning
ablation in hand.** The v1.5 baseline row is banked, the v1.0
stage-2 zero-shot baseline is verified (and cross-validated against
Baron-GG's independently-merged stage-2), and **the first
question-aware pruning result is in: qsim beats baseline by +2.57
pts at kr=0.75 on VQA-RAD**. Single-datapoint, needs the rest of the
Pareto curve to confirm. The sibling harness
[`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
is now the active development repo for v1.0 + pruning work.

## Summary table

Closed-ended accuracy across the experimental sequence. Open metrics
and full per-experiment writeups live in the sections below.

| ID  | Date | Model · Strategy | K (kept) | VQA-RAD | SLAKE | PathVQA | Notes |
| --- | ---- | ---------------- | -------- | ------- | ----- | ------- | ----- |
| E00       | May 14–15 | v1.5 · baseline      | 100% | 0.537 | 0.587 | 0.587 | v1.5 zero-shot reference row |
| E0_v1.0   | May 16    | v1.0 stage-2 · baseline | 100% | 0.580 | — | — | First paper-comparable v1.0 number |
| E0_v1.0_b | May 17    | v1.0 Baron-GG stage-2 · baseline | 100% | 0.577 | 0.488 | 0.556 | Cross-validation; agrees with ours within 0.5pt |
| E0_v1.0_ft | May 17   | v1.0 · 5-epoch full FT | 100% | 0.570 | — | — | FT didn't beat zero-shot — memorization |
| E0_pathvqa_merged | May 17 | v1.0 · published PathVQA delta | 100% | — | — | 0.601 | Degraded vs paper's 0.91 but functional |
| **E1_random_kr0p75** | May 17 | v1.0 stage-2 · random pruning | 75% | 56.99 closed / 30.37 open | — | — | Sanity floor — within noise of baseline |
| **E1_qsim_kr0p75**   | May 17 | v1.0 stage-2 · question-similarity | 75% | **60.29** closed / 28.53 open | — | — | **+2.57 over baseline, +3.30 over random** |
| E1_*_kr0p50 → kr0p10 | _Day 9_  | v1.0 stage-2 · random / qsim | 50%, 25%, 10% | _TBD_ | _TBD_ | _TBD_ | Pareto curve, ~60 min total |

The decisive comparison is **at each keep-ratio K, does qsim beat
random?** That's the project's central research thesis in numerical
form. The Day-1-of-Week-2 sweep is the first real datapoint.

---

## E00 — Baseline (no pruning, v1.5)

<span class="pill pill--done">Complete</span>

**Goal** — establish the reference accuracy and latency numbers we'll
compare every pruning experiment against. No model changes.

**Setup**
- Model: LLaVA-Med v1.5 (Mistral-7B), off-the-shelf weights, frozen
- Datasets: VQA-RAD test (451 samples), SLAKE English test (1,061),
  PathVQA test (6,719) — total 8,231 test questions across the row
- Hardware: see [Baseline (LLaVA-Med)](setup.md#hardware)
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
  motivates the v1.0 reproduction track below.
- **On the closed-ended numbers specifically.** VQA-RAD is computed
  over the corrected 272 closed questions (after [Bug #3](bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions)
  fixed the `answer_type` labels); SLAKE and PathVQA use those
  datasets' real `answer_type` fields (no heuristic needed).
- **Known open issue.** `closed_ended_accuracy` uses lenient
  whole-word matching, which may over- or under-credit verbose
  answers. This will likely be supplanted by the candidate-set argmax
  scoring coming from the v1.0 reproduction work, not patched in
  place.

---

## On the v1.0 reproduction track

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

### Paper Table 4 vs ours — unified comparison

The single unified table below collapses all of the project's
reproduction data and the kr=0.75 pruning result into one place.
The three configs at the top compare against paper Table 4 directly:
stage-2 zero-shot is the paper's "60K-IM, stage-1 × 1, stage-2 × 3,
FT × 0" row, and the two FT-merged rows compare against the FT=15
columns. The two pruning rows underneath compare against *our*
stage-2 baseline (not paper), since pruning is built on top of that
and the relevant comparison is "did pruning hurt accuracy relative
to no pruning."

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

<div class="comparison-table-wrapper" markdown="0">
<table class="comparison-table" markdown="0">
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
Both pruned rows are currently slower than baseline due to hook
overhead dominating at low pruning ratios; speedup is expected to
emerge at kr ≤ 0.5.*

**Reading the table:**

- ✅ **Stage-2 row is all green** — open-recall reproduces paper to
  within ±1.3 pts across all three datasets, closed-accuracy within
  ±4 pts. Independent cross-validation against Baron-GG's
  community-mirror stage-2 produced identical numbers, closing off
  "your merge is subtly wrong" as an explanation.
- ✅ **FT-merged open-recall is green** — VQA-RAD-merged matches
  paper within 1.5 pts; PathVQA-merged within 0.8 pts. Both fine-tuned
  weights reproduce the paper's free-form behaviour.
- ❌ **FT-merged closed-accuracy is red** — VQA-RAD-merged 63 pts
  below paper, PathVQA-merged 31 pts. But the open-recall agreement
  on the *same models* makes "the deltas are broken" impossible as an
  explanation. Almost certainly a measurement-recipe issue (probably
  `--answer-prompter`, a v1.0 inference flag we don't currently
  apply), not corrupted weights.
- 🟣 **kr=0.75 pruning: qsim beats baseline.** Question-aware
  selection at 25% pruning scores 60.29 closed against the unpruned
  baseline's 57.72 (+2.57 pts) and random pruning's 56.99 (+3.30 pts).
  A small first signal that question-conditioning carries useful
  information about which visual tokens to keep. Whether it survives
  at higher pruning ratios is Day 9's question.

The Day 7 conclusion was "the deltas are broken upstream and the
recipe to reproduce Table 4 is gone." The May 17 evidence in this
table substantially revises that:

1. **The deltas are not random noise.** VQA-RAD-merged matches paper
   to within 1.5 pts on open-recall; PathVQA-merged reproduces a
   ~15× lift over zero-shot on open quality (Baron-GG PathVQA F1
   0.024 → PathVQA-merged 0.37). They're real fine-tuned models.
2. **The closed-set gap is a measurement issue, not a weights issue.**
   The same weights match paper on one metric and disagree on
   another. The conclusion has to be that *we are computing the
   closed metric differently from how the paper does* — most likely
   missing the answer-prompter flag in our inference recipe.

Action items for Week 2:

- [ ] **Diagnose the closed-set measurement gap.** Search the v1.0
      reference code for `--answer-prompter`; apply it to our runner;
      re-eval VQA-RAD-merged. If closed jumps from 21 → 80s, the
      measurement-recipe hypothesis is confirmed and the
      [Bug #5](bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible)
      narrative gets rewritten substantially.
- [ ] Update Bug #5 with the Day 8 findings regardless of whether
      `--answer-prompter` works — the "all deltas broken" framing is
      definitely wrong.
- [ ] Once closed-set is reproducing, decide whether to train SLAKE
      from stage-2 (no public delta to merge) or treat SLAKE as a
      zero-shot-only dataset for pruning experiments.

Full Day 8 writeup: [Week 2, Day 1](weekly/week-02/day-01.md).

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
transfer to test images. **Note the asterisk:** this comparison may
itself be subject to the same closed-set measurement gap the table
above identifies. If `--answer-prompter` lifts FT-model closed
numbers as expected, this row gets re-evaluated. As of Day 8 the
honest reading is "5 epochs at this recipe didn't improve over
zero-shot under the metric we currently compute."

---

## E1 — First ablation sweep (random vs question-similarity pruning)

<span class="pill pill--wip">kr=0.75 in · kr ∈ 0.50, 0.25, 0.10 pending</span>

**Goal** — first test of the project's central research thesis:
**does question-aware visual-token pruning beat random pruning at
the same keep-ratio?**

**Setup**

- Model: LLaVA-Med v1.0 stage-2 merged (the canonical baseline
  established Day 8 — closed 0.577 on VQA-RAD via Baron-GG)
- Dataset: VQA-RAD test (451 samples) — primary benchmark for the
  ablation; SLAKE + PathVQA repeats follow if Day-9 results are
  encouraging
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

Per the literature scan (FastV, FasterVLM, ATP-LLaVA, FitPrune,
HoloV, etc.), the expected pattern is small accuracy cost at low K
(say 0.75 = 25% pruned) growing to substantial drops at high K
(0.10 = 90% pruned). At the high-K stress regime, the gap between
qsim and random should be most pronounced.

**Results — VQA-RAD test (451 samples)**

| K | Method | Closed acc | Open recall | Avg latency | Δ closed vs baseline |
|---|---|---:|---:|---:|---:|
| 1.00 (baseline) | — | 57.72 | 29.52 | 1266 ms | — |
| **0.75** | **random** | **56.99** | **30.37** | **1335 ms** | **−0.73** |
| **0.75** | **qsim**   | **60.29** | **28.53** | **1467 ms** | **+2.57** |
| 0.50 | random | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 0.50 | qsim   | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 0.25 | random | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 0.25 | qsim   | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 0.10 | random | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| 0.10 | qsim   | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

**Findings at kr=0.75 (one ratio, one seed)**

- **QSim beats random by +3.30 closed-accuracy points**
  (60.29 vs 56.99) at the same keep ratio — first positive
  datapoint on the project's thesis.
- **QSim also beats the unpruned baseline by +2.57 pts**
  (60.29 vs 57.72) while removing 25% of visual tokens — the
  "improvement *and* speedup" framing the literature considers a
  surprise outcome.
- **Random pruning is statistically indistinguishable from
  baseline** (56.99 vs 57.72, within `temperature=0.7` decoding
  noise). The 25% drop is small enough that random retention still
  preserves the information the model needs.
- **Both pruning methods are slightly slower than baseline at this
  ratio.** Random +69 ms/sample (+5.5%), qsim +201 ms/sample
  (+15.9%). Hook overhead (32 pre-forward hooks + the
  `prepare_inputs_for_generation` patch) dominates the small compute
  savings from dropping 64 visual tokens. Speedup is expected to
  emerge at kr=0.50 or below where the token reduction is more
  substantial. The qsim-vs-random 132 ms gap is the scoring cost
  specifically.
- **Open recall**: qsim −1.0 vs baseline, −1.8 vs random. Within
  noise, but worth watching across the rest of the curve in case
  qsim systematically trades open-set quality for closed-set gains.

**Conclusion (partial)**

One ratio is one datapoint, not a research result — the rest of the
Pareto curve (kr ∈ 0.50, 0.25, 0.10) is what tests whether the
+3.3 pt qsim-over-random signal at kr=0.75 holds, grows, or
disappears. The literature-scan prediction was that qsim's edge over
random should *grow* at higher pruning ratios; kr=0.75 is the regime
where the gap should be smallest. Seeing 3.3 pts here is encouraging.

The latency-overhead surprise also reframes the speedup story:
pruning has to clear a fixed-cost hurdle (~70-200 ms of hook
overhead) before compute savings dominate. The crossover ratio is
the second number Day 9 produces.

---

## Template for new experiments

Copy this block, paste it above the previous experiment, and bump the ID.

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
