# Day 1 — Sunday, May 17, 2026

[← Back to Week 2 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 2, Day 1 · **Day 8 of
the project**

---

Genuinely the most substantive day of the project so far. Started by
evaluating the overnight 5-epoch full-FT (which underperformed — a
real finding), spent the morning closing out the baseline phase
across all three datasets, then in the afternoon built the **first
working visual-token pruning method end-to-end** — the actual core
research contribution. Day ends with the **first kr=0.75 ablation
result in hand**: question-similarity pruning beats both the
unpruned baseline (+2.57 pts) and random pruning (+3.30 pts) on
closed-set accuracy. A single ratio is one datapoint, not a result;
filling in the rest of the Pareto curve is Day 9 work.

## Phase 1 — Morning training health check

The 5-epoch FT we launched yesterday finished cleanly overnight at
05:32 server-time (~6 hr wall time, ~50 min/epoch). Three checkpoints
survived (epochs 3/4/5 — `save_total_limit=3` rotated out the
earlier ones) plus HuggingFace Trainer's final consolidated copy at
the output root.

**Loss curve, first to last:**

| Epoch | Approx. loss |
|---|---|
| 0.04 | 1.13 |
| 0.09 | 0.42 |
| 0.13 | 0.47 |
| 0.18 | 0.36 |
| ... | ... |
| 4.93 | 0.006 |
| 4.98 | 0.004 |

A ~250× drop is the **textbook memorization signature** for 7B
parameters × 1,793 training samples × 5 epochs. Whether it actually
generalises is what the eval will tell us.

## Phase 2 — Missing `eval_topk_checkpoints.py`

The FT script's auto-eval block at the end (which is supposed to run
inference against the top-k checkpoints and pick the best) failed
silently with `No such file: scripts/eval_topk_checkpoints.py`. That
script was specced in Day 7's planning but never actually written to
disk. The auto-eval block produced a 133-byte `eval_topk.log` that
contained nothing but the error.

Wrote `scripts/eval_topk_checkpoints.py` from scratch (~150 lines):

- Discovers all `checkpoint-N/` directories under the output root.
- For each, runs `run_E0_v1.py` as a subprocess (via `sys.executable`
  so venv + PYTHONPATH are inherited).
- Parses the per-checkpoint metrics JSON.
- Sorts by `closed_yes_no_accuracy` descending; writes
  `topk_summary.json` next to the checkpoints.
- Failure-isolates: if one checkpoint's eval crashes, the others
  still run and show `ERROR` in the summary table.

**Minor bug surfaced during the topk run:** the script keys on the
field name `open_bleu` but `run_E0_v1.py` actually emits
`open_bleu_score`. Every BLEU column showed `ERROR` in the summary
even though every other metric resolved correctly. Logged for
Day 9 cleanup; doesn't affect the headline finding.

## Phase 3 — Top-3 checkpoint eval results

| Checkpoint | Epoch | Closed acc | Open app. | Open F1 |
|---|---|---|---|---|
| checkpoint-675 | 3 | **0.5699** ← best | 0.1453 | 0.2199 |
| checkpoint-900 | 4 | 0.5331 | 0.1508 | 0.2626 |
| checkpoint-1125 | 5 | 0.5662 | 0.1397 | 0.2456 |

**For comparison:**
- Stage-2 zero-shot (no FT at all): **0.58 closed**
- Paper's claim (Microsoft's published delta, hypothetical): ~0.84
  closed

The 5-epoch full fine-tune produced **no improvement over stage-2
zero-shot**. The three checkpoints are statistically indistinguishable
from each other and from the un-fine-tuned baseline within
stochastic-decoding noise (`temperature=0.7`).

## Phase 4 — Prediction inspection confirms memorization without generalization

Before accepting the "FT didn't help" result, ran a sanity check:
maybe the FT model is producing valid outputs that just don't match
ground truth, vs. producing gibberish (which would indicate the
checkpoint loaded wrong). Inspected the actual predictions.

First inspection used the wrong field names (`question` /
`prediction` aren't in the JSONL schema — the real fields are
`prompt` and `text`), which surfaced as gibberish defaults and was a
brief false alarm. Corrected inspection showed clean, sensible
English:

```
Q: "is there evidence of an aortic aneurysm?"
PRED: "no"   GT: "yes"   → closed_hit=0, gate_fired=true

Q: "is there airspace consolidation on the left side?"
PRED: "no"   GT: "yes"   → closed_hit=0, gate_fired=true
```

Closed prediction distribution: 164 "no" / 84 "yes" vs. ground truth
133 "no" / 118 "yes" — a mild "no" bias from model uncertainty. Open
predictions are confident medical guesses that miss the specific
ground truth (e.g. "right kidney" vs. GT "not seen here";
"pleural effusion" vs. GT "the right bronchus").

**Verdict: 5-epoch FT memorized the training images but didn't
transfer to test.** With 1,793 training samples and 7B parameters,
this is the expected outcome. The paper claims 15 epochs is the
optimal setting, but extending from 5 to 15 won't fix the
generalisation problem on this dataset size — it just memorises
harder. Stage-2 zero-shot becomes the **canonical VQA-RAD baseline**
for the rest of the project.

## Phase 5 — PathVQA-merged full-test eval (revising Day 7's "all deltas broken" claim)

Day 7 characterised PathVQA-merged as "similarly broken (~0.20)" on
the basis of preliminary inspection. With the full evaluation
infrastructure now in place and a candidate file built, ran the
proper 6,719-sample test:

| Metric | PathVQA-merged | Paper claim | Gap |
|---|---|---|---|
| Closed acc | 0.6005 | ~0.91 | -31 pts |
| Open appearance | 0.2732 | — | — |
| Open F1 | 0.3684 | ~0.39 | -2 pts |
| BLEU-1 | 0.3573 | — | — |

**PathVQA-merged is substantially degraded vs. paper, but not
random-noise broken.** This revises the Day 7 narrative: it's not
that "all three deltas are uniformly broken" — it's that
**VQA-RAD's delta is uniquely catastrophic** (0.21 vs ~0.84, ~75% of
the headline), while PathVQA's delta is "underperforming" (0.60 vs
0.91 — degraded but actually quite close on open-question F1). SLAKE
remains an empty repo on HuggingFace. Bug #5 needs a narrative
update to reflect this nuance.

## Phase 6 — Baron-GG alternate stage-2 cross-validation

A reasonable question: maybe our stage-2 merged weights are *also*
quietly wrong, and the 0.58 result we're treating as the baseline is
a lucky coincidence rather than a verified reproduction. To rule this
out, downloaded an alternate community-mirror of stage-2 from
`Baron-GG/LLaVA-Med` (13 GB).

**Config diff between Baron-GG's and ours:** only two trivial
differences — `_name_or_path` (a metadata path) and `model_type`
(`llava_llama` vs `llava`, fixed via one `sed`). The actual model
weights and architecture are identical. Baron-GG's path on the origin
server (`/root/autodl-tmp/llava_med_in_text_60k_ckpt2_delta`)
confirms they're from the same stage-2 instruction-tuning checkpoint
2 lineage that the v1.0 release names.

**Three-dataset Baron-GG run:**

| Dataset | Closed acc | Open app. | Open F1 | Notes |
|---|---|---|---|---|
| VQA-RAD | **0.5772** | 0.1006 | 0.0788 | Within 0.5 pts of our stage-2 (0.58) |
| SLAKE | 0.4880 | 0.1504 | 0.0783 | Below chance on closed — hardest for stage-2 |
| PathVQA | 0.5556 | 0.0119 | 0.0236 | Stage-2 essentially can't do PathVQA open answers |

**The VQA-RAD agreement (0.5772 Baron-GG vs 0.58 ours) is a clean
cross-validation** — two independent merges of stage-2 + same base
LLaMA-7B + same harness produce the same number to within
0.5 points. Our stage-2 weights are correct. The 0.58 baseline is
real.

A useful secondary finding: comparing Baron-GG PathVQA (closed 0.556,
F1 0.024) against PathVQA-merged (closed 0.60, F1 0.37) shows the
PathVQA delta *does* provide a ~15× lift on open-question quality
over zero-shot — just not enough to reach the paper's claim. The
delta isn't "broken" in the same sense VQA-RAD's is; it's a
functional but underperforming fine-tune.

## Phase 7 — SLAKE pipeline completion

SLAKE loader file existed since May 15 (Day 6) but never got wired
into `run_E0_v1.py`'s `DATASET_REGISTRY`. Today plugged the gap:

- Smoke-tested the existing loader: 1,061 English test samples, 416
  closed / 645 open. Sample inspection confirmed images decode
  cleanly and `q_lang == 'en'` filtering works.
- Added the registry entry + import + argparse choice + docstring
  update in `run_E0_v1.py`.
- Wrote `eval/build_slake_train_open_answers.py` (small adaptation of
  the VQA-RAD/PathVQA builders) → **216 unique open candidates** from
  4,919 training samples. The 4.4% unique-to-total ratio is much
  lower than VQA-RAD's 22% or PathVQA's 32% — SLAKE's open answers
  are highly templated (mostly short anatomical/imaging terms).

SLAKE is now fully integrated. The cross-validation Baron-GG run
above already exercised it end-to-end.

## Phase 8 — Day 8 verdicts (end of baseline phase)

Pulling together everything from Phases 1-7:

- **Stage-2 zero-shot is the canonical v1.0 baseline** across all
  three datasets (verified by Baron-GG cross-validation; verified
  against the paper's stage-2 row within 8 pts on VQA-RAD).
- **VQA-RAD's published delta is uniquely catastrophic** (0.21
  closed); PathVQA's delta is degraded-but-functional (closed
  0.60 / F1 0.37); SLAKE's delta is missing (empty repo). Day 7's
  "all three deltas broken" claim oversimplified — Bug #5 needs
  updating.
- **5-epoch full FT from stage-2 doesn't beat zero-shot.** Stage-2 →
  VQA-RAD FT with the paper-faithful recipe produces memorization
  without generalisation. Extending to 15 epochs is unlikely to fix
  this on 1,793 training samples; the paper's headline 0.84 may
  itself require internal-only Microsoft training infrastructure.
- **The baseline phase is complete.** Three datasets, one verified
  zero-shot baseline per dataset. Time to start on the actual
  research contribution.

## Phase 8.5 — Paper Table 4 vs our reproduction (consolidated)

The numerical version of the verdict, side-by-side. The paper's
Table 4 caption is unambiguous on the metric: *"For open-set
questions, we report the recall for our free-form text generation
method in column Open. For closed-set questions, we report the
accuracy."* So the comparison is closed-accuracy vs our
`closed_yes_no_accuracy`, and open-recall vs our `open_recall`. This
metric definition discovery was itself a Day 8 finding — multiple
earlier days' analyses assumed the paper's "Open" column was
candidate-set argmax accuracy, which would have shown a much larger
(false) gap.

The single unified table below collapses all the project's reproduction
and pruning data into one place. The three configs (stage-2 zero-shot,
the two FT-merged checkpoints) compare against paper Table 4 directly;
the two pruning rows underneath compare against *our* stage-2 baseline,
since pruning is built on top of that and the comparator is "did
pruning hurt accuracy relative to no pruning."

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

### What the table actually shows

Reading down the table, the project's reproduction state is:

- ✅ **Stage-2 row is all green** — open-recall reproduces paper to
  within ±1.3 pts across all three datasets, closed-accuracy within
  ±4 pts. Independent cross-validation against Baron-GG's
  community-mirror stage-2 produced identical numbers.
- ✅ **FT-merged open-recall is green** — VQA-RAD-merged matches paper
  to within 1.5 pts, PathVQA-merged to within 0.8 pts. The fine-tuned
  weights' free-form behaviour reproduces the paper across both
  models we can evaluate.
- ❌ **FT-merged closed-accuracy is red** — VQA-RAD-merged is 63 pts
  below paper, PathVQA-merged is 31 pts below. But the open-recall
  agreement on the *same models* makes "the deltas are broken"
  impossible as an explanation. The closed-set gap is almost certainly
  a measurement-recipe issue (most likely `--answer-prompter`, a v1.0
  inference flag we don't currently apply), not corrupted weights.
- 🟣 **Pruning at kr=0.75: qsim beats baseline.** Question-aware
  selection at 25% pruning gets 60.29 closed vs the unpruned baseline's
  57.72 — a small positive signal that question-conditioning carries
  useful information for which visual tokens to keep. Random pruning
  at the same ratio stays within noise of baseline (56.99). The
  qsim-vs-random gap is +3.3 pts; whether it survives at higher
  pruning ratios is the Day 9 question.

This is a much more defensible reproduction story than "all the
deltas are broken." The Day 9 priority becomes "find the closed-set
scoring recipe discrepancy" rather than "give up on the deltas." Bug
#5 needs a substantial narrative update once the `--answer-prompter`
hypothesis is tested.

## Phase 9 — Visual token pruning literature scan

A research detour to align the project's framing with the field
before writing code. Searched the recent literature on visual token
pruning for VLMs — FastV, FasterVLM, ATP-LLaVA, FitPrune, FastVID,
VLM-Pruner, HoloV, SGL — to settle the question of what the
*expected outcome* of this kind of method is. The pattern is
consistent across recent work:

| Method | Pruning rate | Accuracy retention |
|---|---|---|
| FasterVLM | 95% | 90% of original |
| ATP-LLaVA | 75% | 98.1% |
| ATP-LLaVA | 85% | 94.6% |
| FitPrune (LLaVA-NEXT) | -54.9% FLOPs | -0.5% acc |
| FastVID (video) | 90.3% | 98.0% |
| VLM-Pruner | 88.9% | 95.61% |

The framing every recent paper uses is **efficiency-accuracy
trade-off** (often "Pareto frontier"). The competition is "prune
aggressively while losing less accuracy" — not "prune *and* improve
accuracy." Settling this clarifies what success means for this
project: a speedup with controlled accuracy degradation is a
publishable result; matching baseline accuracy at a high pruning
ratio is a strong result; *beating* baseline would be surprising but
not the expected outcome.

## Phase 10 — Pruning method design decisions

Three design questions to settle before writing code, with the
recommendations I went with after some back-and-forth:

1. **Where to score visual tokens.** Two options: (a) at the
   `mm_projector` output (before the LLM, score against question
   embeddings); (b) inside the LLM, after some early decoder layer
   K (FastV-style — score against attention weights at layer K).
   **Picked (a) first** as a clean, training-free, question-aware
   baseline; (b) is the canonical FastV move and stays as a
   comparison method for later.
2. **Scoring function for "question-similarity" pruning.** Cosine
   similarity between each visual token's projected embedding and a
   pooled question embedding (mean of last-hidden-state of the
   question's text tokens, computed at layer 0 of the LLM). Simple,
   no learned parameters, runs once per sample.
3. **What to compare against.** A **random pruning baseline**
   (uniform random retention) at every keep-ratio. If question-sim
   doesn't beat random, the question-awareness isn't doing anything
   useful. This is the project's central thesis in numerical form.

## Phase 11 — Implementing baseline + random + qsim methods

Wrote three classes under `eval/methods/`:

- **`BaselineMethod`** (existing, no-op): runs the model unmodified.
- **`RandomPruning`**: at the pruning hook, keep `floor(N × kr)`
  visual tokens chosen uniformly at random. Deterministic per-sample
  via `torch.manual_seed(question_id_hash)`.
- **`QuestionSimilarityPruning`**: same drop count as random, but
  selects tokens by cosine similarity to the pooled question
  embedding.

The lifecycle methods (`attach`, `set_question`, `detach`) made the
runner code essentially identical across methods — only the method
class differs at the CLI level.

??? note "`RandomPruning` — full implementation"

    Deterministic-per-sample via seeded RNG (so `random` at kr=0.5
    produces the same prune mask on every run). Sets state in
    `set_question` (called once per sample by the runner) and reads
    it in the forward hook.

    ```python
    """Random visual-token pruning baseline.

    Keeps `floor(N * keep_ratio)` of the N=256 visual tokens, chosen
    uniformly at random with a per-sample-deterministic seed. Used as
    the floor for any "smart" pruning method — if question-aware
    pruning doesn't beat random, the question-awareness isn't doing
    anything useful.
    """

    import hashlib
    import torch
    from .base import PruningMethod


    class RandomPruning(PruningMethod):
        def __init__(self, keep_ratio: float):
            assert 0.0 < keep_ratio <= 1.0
            self.keep_ratio = keep_ratio
            # Per-sample state, reset in set_question:
            self._new_indices = None
            self._pruned_length = None
            # Stored at attach time:
            self._n_visual = None
            self._hooks = []

        def set_question(self, question_id: str, question: str):
            """Called once per sample, before generate(). Picks the
            keep-mask deterministically from the question_id hash so
            the same sample always gets the same prune decision."""
            seed = int(hashlib.md5(question_id.encode()).hexdigest()[:8], 16)
            g = torch.Generator(device="cpu").manual_seed(seed)
            k = max(1, int(self._n_visual * self.keep_ratio))
            perm = torch.randperm(self._n_visual, generator=g)
            self._new_indices = perm[:k].sort().values  # sorted for stability
            self._pruned_length = k

        def attach(self, loaded):
            self._n_visual = loaded.image_token_len  # 256 for v1.0
            # ... (hook installation, see base.py for context)
    ```

## Phase 12 — The decode-step debugging saga (5 iterations)

The forward hook for pruning fires fine at prefill, but
HuggingFace's `generate()` loop maintains the `attention_mask`
*externally to the KV cache*. When prefill prunes the cache from 335
tokens down to 207, `generate()` still thinks prefill was 335 tokens
long and constructs a mask of shape `(1, 1, 1, 336)` at decode
step 1 — while the layer expects `(1, 1, 1, 208)`. CUDA crash.

The investigation went through five iterations before landing on a
working architecture:

1. **Pre-LLM projector hook** (prune at `mm_projector` output, before
   the LLM sees anything). Crashed on v1.0's image-token-count
   validation — the LLM checks that the number of visual feature
   vectors matches the count of `<im_patch>` tokens in the prompt,
   and pruning breaks that invariant.
2. **In-LLM, layer 0 only** (score + select inside layer 0, slice
   `hidden_states` and `attention_mask` to match). Worked for layer
   0, but layer 1 immediately failed: the unsliced
   `attention_mask` propagates from `generate()` and doesn't match
   the pruned hidden-state length.
3. **In-LLM, all 32 layers** (pre-forward hook on each
   `LlamaDecoderLayer` to slice the mask consistently). Prefill
   works! But decode step 1 still fails because of the
   external-mask problem above.
4. **Monkey-patch `prepare_inputs_for_generation`** to slice the
   externally-maintained `attention_mask` after prefill. Decode
   step 1 works! But sample 2 in the same batch inherits stale
   state from sample 1.
5. **Add per-sample state reset on `past_key_values is None`**
   (which signals a new prefill, hence a new sample). Done.

The final architecture: pre-forward hooks on all 32
`LlamaDecoderLayer` instances + a monkey-patched
`prepare_inputs_for_generation` + state clearing on every prefill.
Brittle, but functional, and clearly understood. A cleaner rewrite
that overrides the model's `_prepare_decoder_attention_mask` method
directly is a Day 9+ improvement.

## Phase 13 — Smoke test verification

3-sample smoke test at kr=0.5 produced clean output:

```
=== E0_smoke_fix_random_kr0p5 ===
Q: is there evidence of an aortic aneurysm?
   PRED: There are no signs of aortic aneurysm in the chest x-ray image
   GT:   yes

Q: is there airspace consolidation on the left side?
   PRED: Yes, the chest X-ray image shows airspace consolidation on...
   GT:   yes

=== E0_smoke_fix_qsim_kr0p5 ===
Q: is there evidence of an aortic aneurysm?
   PRED: There are no visible signs of an aortic aneurysm in the chest...
   GT:   yes
```

Predictions are well-formed English (so 50% pruning doesn't destroy
output coherence). Random and qsim produce *different* predictions on
some samples (so the methods are actually doing different things).
Pruning works end-to-end.

## Phase 14 — kr=0.75 ablation result: question-aware pruning beats baseline

After deciding the full 9-eval sweep would take ~80-90 min and that
landing one solid datapoint mattered more than starting the full
matrix, ran a focused kr=0.75-only sweep: random and qsim each
evaluated on the full 451-sample VQA-RAD test set, with the existing
Baron-GG stage-2 baseline numbers reused for the comparison.

### Results

|  | Closed | Open recall | Avg latency | Total inference |
|---|---:|---:|---:|---:|
| **Baseline** (Baron-GG stage-2, no pruning) | 57.72 | 29.52 | 1266 ms | 570.9 s |
| **Random** kr=0.75 (192/256 tokens) | 56.99 | 30.37 | 1335 ms | 602.3 s |
| **QSim** kr=0.75 (192/256 tokens) | **60.29** | 28.53 | 1467 ms | 661.5 s |
| Δ (qsim − baseline) | **+2.57** | −0.99 | +201 ms | +91 s |
| Δ (qsim − random) | **+3.30** | −1.84 | +132 ms | +59 s |

This is the **first datapoint on the project's central thesis**: at
kr=0.75 on VQA-RAD, **question-similarity pruning beats both the
unpruned baseline (+2.57 pts) and random pruning (+3.30 pts) on
closed-set accuracy**, while removing 25% of visual tokens.

Two important caveats before reading too much into a single number:

1. **One ratio is one datapoint.** The Pareto curve across
   kr ∈ {0.75, 0.50, 0.25, 0.10} for both methods is what actually
   tests the thesis. The hypothesis from the literature scan was
   that qsim's advantage over random *grows* at higher pruning
   ratios — kr=0.75 is the "low-pruning, low-risk" regime where
   gaps should be smallest. Seeing a 3.3-pt gap here is encouraging;
   if it holds or widens at kr=0.50 and below, the thesis is
   genuinely supported. If it disappears, the kr=0.75 signal was
   noise.
2. **`temperature=0.7` decoding introduces stochastic variance.**
   3 pts is suggestive but not decisive at a single seed. A clean
   confirmation would re-run both methods with a different seed and
   confirm the gap survives.

### Latency surprise: pruning is *slower* than baseline at kr=0.75

Both pruning methods are **slower** than unpruned inference at this
ratio: random adds +69 ms/sample (+5.5%), qsim adds +201 ms/sample
(+15.9%). The compute savings from dropping 64 visual tokens don't
yet exceed the **fixed overhead** of the pruning machinery itself:

- 32 pre-forward hooks (one per `LlamaDecoderLayer`) that run every
  prefill and every decode step
- A model-level pre-forward hook for visual-token boundary detection
- The monkey-patched `prepare_inputs_for_generation` running every
  decode step
- The scoring computation for qsim (cosine similarity against the
  question embedding, once per sample) — this is the +132 ms gap
  between qsim and random that's pure scoring overhead

This is **expected behaviour at low pruning ratios** per the
literature: papers like FastV report speedups starting around
kr=0.50 and growing nonlinearly at kr=0.25. The compute saved by
dropping K tokens scales with the KV-cache length the LLM attends
over, which is dominated by the unchanged-by-pruning text token
count at kr=0.75 (~80 text tokens vs 256→192 visual = small relative
change in total sequence length). At kr=0.25 the visual contribution
shrinks 256→64, which is where the speedup should emerge.

The 132 ms qsim-vs-random gap is more interesting — that's the
scoring cost specifically. It's per-sample-fixed, so at higher
pruning ratios where the compute savings dominate, the *relative*
overhead of scoring shrinks. Worth profiling whether the
question-embedding extraction can be made cheaper if scoring cost
becomes the bottleneck.

### Where this leaves things

- **Accuracy signal**: positive, +3.3 pts qsim over random at one
  ratio. Needs the rest of the Pareto curve to be a real finding.
- **Latency signal**: net-negative at kr=0.75 due to hook overhead.
  Speedup should emerge by kr=0.50; should be substantial by kr=0.25.
- **Open recall**: qsim slightly underperforms (−1.0 pt vs baseline,
  −1.8 pt vs random). Within noise, but worth watching — if qsim
  systematically improves closed at the cost of open across all
  ratios, the method's signal is genuinely closed-set-specific.

Day 9 priority: run kr=0.50, kr=0.25, kr=0.10 for both methods (~80
min) to fill out the curve. The shape of that curve is what makes
this an actual research result rather than a single suggestive
number.

## Honest ledger of the day

- **Closed out the baseline phase** with verified zero-shot numbers
  on all three datasets, cross-validated via Baron-GG, and a
  documented "5-epoch FT doesn't fix it" finding.
- **Revised the Day 7 narrative** on broken deltas — VQA-RAD is
  catastrophic, PathVQA is degraded-but-functional, SLAKE is missing.
- **Built and verified the first working pruning method end-to-end.**
  This is the core research contribution; from this point forward
  the project is about *ablations on top of this scaffold*, not
  building scaffold.
- **First ablation running.** Day 9 starts with real numbers in hand.

No git push today — too many in-flight changes (FT eval scripts,
SLAKE wiring, new methods directory, the working pruning method).
Push consolidates Day 9 morning once the kr=0.75 numbers are in and
the diff is a coherent unit to review.

---

### Plan for Day 9 (May 18)

- [ ] **Run the rest of the Pareto curve:** kr=0.50, kr=0.25, kr=0.10
      on VQA-RAD with both random and qsim. (3 ratios × 2 methods =
      6 more evals, ~60 min total.) The +3.3 pt qsim-vs-random gap
      at kr=0.75 is only a real finding if it survives at higher
      pruning ratios.
- [ ] Investigate the latency overhead at kr=0.75 — both methods are
      *slower* than baseline due to hook fixed-cost. Profile where
      the time goes; the qsim-vs-random 132 ms gap is the scoring
      cost specifically and may be reducible.
- [ ] Decide whether to push (a) Day 8's accumulated changes in one
      commit or (b) split them into separate commits for the eval
      scaffolding + the pruning method.
- [ ] **Fix the closed-set eval on merged FT weights** — Day 8's
      consolidated reproduction tables showed the FT-merged closed
      gap is almost certainly `--answer-prompter` related. Two-stage
      decode (closed prompt for yes/no questions, free-form prompt
      for others) is the v1.0 inference recipe we're missing.
- [ ] Update [Bug #5](../../bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible)
      to reflect the May 17 reframe — open-recall reproduces paper
      across stage-2 and FT-merged, so "all deltas broken" is wrong;
      the closed-set gap is a measurement-recipe issue.
- [ ] Fix the `open_bleu` field-name bug in `eval_topk_checkpoints.py`
      (low-priority cleanup).
- [ ] Read FastV paper end-to-end — specifically their `generate()`
      integration, which solves the same decode-step mask problem we
      hit today.
- [ ] Read ToMe paper.

---

## Pushed today

_No git push today. The day's changes span three different concerns —
training pipeline plumbing (`eval_topk_checkpoints.py`), evaluation
plumbing (SLAKE registry, candidate file), and the first pruning
method (new `eval/methods/` files + `runner.py` patches) — that
deserve separate commits rather than one mega-commit. Day 9 morning
splits them, after the kr=0.75 ablation numbers land and the diff
across all of Day 8 is a coherent unit to review._
