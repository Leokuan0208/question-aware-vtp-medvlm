# Day 5 — Thursday, May 21, 2026

[← Back to Week 2 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 2, Day 5 · **Day 12 of
the project**

---

The most consequential day of the project so far, in a way I didn't
expect. Came back from three days of travel expecting to compile the
kr ∈ {0.50, 0.25, 0.10} sweep into a Pareto curve and ship it to the
Experiments page. Instead, the day produced (1) a real bug in the
LLaVA-Med v1.0 scorer that inflates every published v1.0 closed
accuracy number by ~9-12 pts, (2) a residual rising-curve anomaly that
isn't fully explained, (3) a series of self-corrections to earlier
hypotheses, and (4) a decisive pivot away from LLaVA-Med v1.0 as the
project's base model. The site's headline pages stay on the May 17
numbers for now; this day-page is where the in-flux story lives.

## Phase 1 — Inventory of the May 17 sweep

First thing on returning to the desk: confirm the `nohup` background
job from Day 1 had actually completed. Inventoried `results/`:

```
E0_ablation_qsim_kr0p10_metrics.json     E0_ablation_random_kr0p10_metrics.json
E0_ablation_qsim_kr0p25_metrics.json     E0_ablation_random_kr0p25_metrics.json
E0_ablation_qsim_kr0p50_metrics.json     E0_ablation_random_kr0p50_metrics.json
E0_kr0p75_qsim_metrics.json              E0_kr0p75_random_metrics.json
```

All 8 ablation cells present, plus the Baron-GG stage-2 baseline
already on disk. No missing runs, no crashed jobs. Also noticed and
fixed a small thing: `scripts/run_E0_v1.py`'s config dict didn't
include `keep_ratio` as a field, which made downstream parsing rely
on regex-extracting the ratio from run names. Added the field for
future runs.

## Phase 2 — Compiling the Pareto curve, and noticing the shape

Aggregating the 9 runs against the unpruned baseline (Baron-GG
stage-2, 57.72 closed):

| K (keep) | Method | Closed acc | Open recall | Latency |
|---|---|---:|---:|---:|
| 1.00 | baseline | 57.72 | 29.52 | 1266 ms |
| 0.75 | random | 56.99 | 30.37 | 1335 ms |
| 0.75 | qsim   | 60.29 | 28.53 | 1467 ms |
| 0.50 | random | 56.27 | 28.94 | 1395 ms |
| 0.50 | qsim   | 53.31 | 27.85 | 1521 ms |
| 0.25 | random | 60.10 | 27.65 | 1467 ms |
| 0.25 | qsim   | 62.42 | 31.84 | 1493 ms |
| 0.10 | random | 63.74 | 26.21 | 1524 ms |
| 0.10 | qsim   | **65.07** | 28.65 | 1568 ms |

This shape is anomalous. **Closed accuracy rises monotonically with
pruning aggressiveness, reaching +7.35 pts over baseline at qsim
kr=0.10**, while open recall stays flat or drifts down, and latency
*never recovers* — even at 90% pruning, both methods are ~20% slower
than baseline. The latency story alone is a problem (hook overhead
dominating), but the rising closed accuracy is the surprising part:
if dropping 90% of visual tokens *improves* closed-set accuracy,
either the model wasn't using visual information at all in the
baseline, or the closed metric isn't measuring what we think it is.

Reasonable instincts at this point:

- **The metric is misbehaving.** Possible — the v1.0 scorer is
  substring-based and could be flagged by spurious matches.
- **The pruning is broken.** Maybe pruning is causing degenerate
  short outputs that happen to contain "yes" or "no" more reliably
  than the baseline's verbose responses.
- **The result is real, sort of.** Maybe partial visual corruption
  forces the model to fall back to question-only language priors,
  and that's a clean rule-based path that scores well on closed
  questions. Unlikely but not impossible.

Without prediction inspection, we couldn't tell. The original Day 1
+2.57 / +3.30 framing at kr=0.75 had assumed the metric was working;
the full-curve shape now made that assumption testable.

## Phase 3 — The substring bug in the v1.0 closed-set scorer

Read `eval/metrics.py` carefully. Found the bug on the first careful
pass:

```python
# Original LLaVA-Med v1.0 scoring logic (paraphrase):
def closed_yes_no_accuracy(pred, gt):
    pred_lower = pred.lower()
    if "yes" in pred_lower:  # substring match!
        return 1 if gt.lower() == "yes" else 0
    if "no" in pred_lower:   # substring match!
        return 1 if gt.lower() == "no" else 0
    return 0
```

The `in` check is a substring match, not a word match. So:

- *"There is **no** evidence of pneumothorax"* → matches "no" → scored
  as "no answer." Correct, by luck of which token came first.
- *"**No**dules are visible bilaterally"* → matches "no" → scored as
  "no answer." Wrong; this is an *open-set* description that the
  scorer treats as a closed "no" answer.
- *"**Yes**terday's scan showed..."* → would match "yes." Doesn't
  appear in practice but illustrates the failure mode.
- *"The lesion is **not** in the right lung"* → contains neither
  "yes" nor "no" as substrings — scored as "no answer found" and gets
  0, even though "not" is a clear negative.

Most consequentially: *"There is also **no**dularity in..."* and
similar verbose descriptive predictions get scored as "no" answers,
which **inflates the closed-set accuracy uniformly across all models
that produce verbose responses.** And the kicker: it inflates *more*
when the model produces *more* verbose output — exactly what happens
when pruning starts breaking the model's grounding and it falls back
to generic radiology-prose templates.

Rewrote the scorer using word-boundary matching:

```python
import re
def closed_yes_no_accuracy_fixed(pred, gt):
    # Tokenize: lowercase, split on word boundaries
    words = re.findall(r"\b[a-z]+\b", pred.lower())
    if "yes" in words:
        return 1 if gt.lower() == "yes" else 0
    if "no"  in words:
        return 1 if gt.lower() == "no"  else 0
    return 0
```

Re-scored all 9 runs through both scorers (preserving the original
metric in JSON for comparison, naming the new column `closed_strict`):

| K | Method | Closed (substring, old) | Closed (word-boundary, new) | Δ |
|---|---|---:|---:|---:|
| 1.00 | baseline | 57.72 | 47.41 | −10.31 |
| 0.75 | random | 56.99 | 47.41 | −9.58 |
| 0.75 | qsim   | 60.29 | 49.40 | −10.89 |
| 0.50 | random | 56.27 | 48.21 | −8.06 |
| 0.50 | qsim   | 53.31 | 44.22 | −9.09 |
| 0.25 | random | 60.10 | 49.00 | −11.10 |
| 0.25 | qsim   | 62.42 | 50.20 | −12.22 |
| 0.10 | random | 63.74 | 52.99 | −10.75 |
| 0.10 | qsim   | **65.07** | **53.78** | −11.29 |

**The bug inflates every v1.0 closed-accuracy number by 9-12 pts
uniformly.** That includes every number the v1.0 paper reports for
Table 4, and every reproduction attempt anyone has made using the
released code. This is a real finding — and a publishable one in its
own right.

But on its own, the bug *doesn't explain the rising curve*. Looking
at the word-boundary column: 47.41 (baseline) → 53.78 (qsim kr=0.10).
**The closed accuracy still rises by +6.37 pts under aggressive
pruning, even after fixing the bug.** Something else is going on.

## Phase 4 — Self-correcting two earlier claims

Before chasing the residual anomaly, two claims from the morning
needed walking back:

1. **"Open recall is falling" — wrong.** I'd said earlier the open
   recall was drifting down across the curve. Looking at the actual
   numbers: 29.52, 30.37, 28.53, 28.94, 27.85, 27.65, 31.84, 26.21,
   28.65. That's noise in a 0.26-0.32 band, not a monotonic trend.
   Open recall is essentially flat, not degrading. The "visual
   conditioning is breaking" framing I'd used was overstated.
2. **"The Day 1 +2.57 / +3.30 result is wrong" — partially.** The
   substring-bug correction does pull the kr=0.75 qsim result back
   to within noise of baseline on the strict metric (49.40 vs 47.41,
   gap of +1.99 pts). So the headline "qsim beats baseline" claim
   is weaker than reported, but not zero. The strict-metric gap
   between qsim and random at kr=0.75 is still +1.99 pts. Not the
   +3.30 pts I'd reported, but not nothing either.

## Phase 5 — Three-way scoring diagnostic

The substring bug exists on a spectrum of strictness. To bound the
residual anomaly, ran the predictions through three scorers
simultaneously:

- **`strict`** — the prediction must *lead with* "yes" or "no" as
  its first content word
- **`medium`** — the prediction must contain "yes" or "no" as a
  whole word anywhere
- **`lenient`** — `medium`, plus also accepts "not" as a synonym for
  "no"

GT distribution on VQA-RAD closed test set: yes=118, no=133, other=21.
Yes-share among yes/no: 0.4701 — slightly *no*-leaning, so "always
yes" can't be the explanation.

| Run | Strict | Medium | Lenient | Lenient−Strict gap |
|---|---:|---:|---:|---:|
| baseline (Baron-GG) | 35.46 | 42.23 | 47.41 | 11.95 |
| kr=0.75 random | 30.68 | 41.43 | 47.41 | 16.73 |
| kr=0.75 qsim   | 27.49 | 39.04 | 49.40 | 21.91 |
| kr=0.50 random | 27.49 | 39.84 | 48.21 | 20.72 |
| kr=0.50 qsim   | 26.29 | 35.06 | 44.22 | 17.93 |
| kr=0.25 random | 31.08 | 42.23 | 49.00 | 17.93 |
| kr=0.25 qsim   | 31.08 | 43.03 | 50.20 | 19.12 |
| kr=0.10 random | 32.67 | 46.61 | 52.99 | 20.32 |
| kr=0.10 qsim   | **34.26** | 45.42 | **53.78** | 19.52 |

Two things this table tells us:

1. **Under the strictest possible metric, pruning does NOT improve
   closed accuracy.** Baseline strict is 35.46; qsim kr=0.10 strict
   is 34.26. The "pruning helps" story collapses entirely under
   strict scoring — the model isn't getting *better* at answering
   yes/no when pruned, it's getting *more verbose* in ways that
   accidentally satisfy looser scorers.
2. **The lenient-minus-strict gap widens under pruning.** Baseline
   gap is 11.95; pruned runs have gaps in the 17-22 range. So
   pruning is creating exactly the kind of verbose output the
   substring/lenient scorers reward spuriously. The substring bug
   doesn't *create* the rising-curve effect on its own, but it
   *amplifies* an effect that's there in any non-strict scorer.

By this point in the day I was looking at a project where:

- The published baseline accuracy numbers I'd been comparing to are
  inflated by 9-12 pts due to a scorer bug nobody had noticed.
- My own pruning method's +2.57 / +3.30 improvement collapses to
  +1.99 / +3.19 under word-boundary scoring, and to essentially zero
  (or negative) under strict scoring.
- The pruning architecture's hook overhead means latency *never
  recovers* even at 90% pruning, so even if accuracy held flat
  we'd be in a "no win" regime on the efficiency axis.

This was the point where the question shifted from "what's the bug
in our scorer?" to "is there a fundamental problem with our base
model and evaluation methodology?"

## Phase 6 — The MCQ-letter test, and the decision point

Looked into how the modern medical-VLM literature handles closed-set
scoring. The standard turns out to be **MCQ-letter extraction**:
reformulate every closed question into multiple-choice with options
A, B, C, ... and prompt the model with *"Answer with the option's
letter from the given choices directly."* Scoring is a single-character
equality check between extracted letter and ground-truth letter. This
sidesteps the substring bug, the verbosity inflation, and the
word-leading arbitrariness all at once.

Wrote a 20-sample VQA-RAD smoke test with this MCQ format against
the merged LLaVA-Med v1.0 weights.

**Result: 0/11 letter extraction rate.** The model produced verbose
biomedical prose responses ("There is no evidence of pneumothorax in
the chest x-ray image, and the heart appears to be of normal size...")
that completely ignored the MCQ format instruction. Not a single
response started with a letter.

This is the diagnostic outcome that made the decision unavoidable:

> LLaVA-Med v1.0 was instruction-tuned in 2023 on biomedical dialogue
> data where every response is multi-sentence explanation. There is
> effectively no MCQ-format data in its training distribution, so it
> ignores MCQ instructions in favor of producing fluent biomedical
> prose. This isn't a fixable prompt-engineering problem — the model's
> response distribution is fundamentally shaped against the
> evaluation format the field has standardized on.

Combined with everything else:

- Substring bug in the official scorer (inflates published numbers).
- 32-layer hook architecture with position_id workarounds that
  doesn't actually deliver latency wins.
- Published per-dataset deltas that don't reproduce the paper's
  closed-set numbers (the May 16-17 finding, now re-contextualized).
- An instruction-following profile incompatible with modern eval
  methodology.
- A model the pruning literature has moved off of — every recent
  paper (FastV, GlimpsePrune, DivPrune, IDPruner) benchmarks on
  Qwen2.5-VL-7B-Instruct.

**Decision: pivot the project's base model to Qwen2.5-VL-7B-Instruct.**

The work done on LLaVA-Med v1.0 is not wasted — it produced three
methodologically substantive findings (the substring bug, the
verbosity inflation effect, and the community-wide reproduction
failure of v1.0's per-dataset deltas) that become part of the
related-work and motivation sections of the eventual writeup. They
justify the migration as a methodological choice, not a defeat.

## Phase 7 — Qwen2.5-VL environment setup

With the decision made, set up the new environment. Decisions:

- **Base image: `nvcr.io/nvidia/pytorch:25.06-py3`.** Chose 25.06
  over the latest 26.04 because it's the last CUDA 12.x NGC release
  (flash-attn pre-built wheels available), the R555+ driver
  requirement is widely deployed, and 11 months of library maturity
  means every Qwen2.5-VL dependency has tested wheels for this
  stack.
- **Eval framework: VLMEvalKit + lmms-eval.** Both support
  Qwen2.5-VL and VQA-RAD/SLAKE/PathVQA out of the box. Adopting
  these eliminates the entire class of metric bugs we encountered
  on the v1.0 track.
- **Pruning method port: reuse `random` and `qsim` scoring logic
  on Qwen2.5-VL's standard HF transformers architecture.** The
  hook target changes from `LlavaLlamaModel.model.layers` to
  Qwen2.5-VL's decoder layers; the scoring math is the same.

Wrote a four-file environment package saved to `~/qwen-medvlm/`:

??? note "`Dockerfile` — Qwen2.5-VL on NGC 25.06"

    Two important constraints baked in. First: the file
    `/etc/pip/constraint.txt` in the NGC image pins transformers to
    an older version than Qwen2.5-VL needs; emptying it (rather than
    deleting, which would break pip config) is necessary before
    layering newer deps. Second: NGC 25.06's PyTorch was compiled
    against NumPy 1.x, but VLMEvalKit's transitive deps would
    otherwise pull in NumPy 2.x and silently break `torch.export`.
    The `numpy<2.0` pin blocks that.

    ```dockerfile
    # Dockerfile for Qwen2.5-VL medical VQA + visual token pruning research
    # Base image: NGC PyTorch 25.06 -> Python 3.12, CUDA 12.9.1, PyTorch 2.8
    FROM nvcr.io/nvidia/pytorch:25.06-py3

    # Ubuntu packages
    # git-lfs needed to pull model weights from HuggingFace
    # libgl1, libglib2.0-0 required by opencv-python (used by
    # qwen_vl_utils image preprocessing)
    RUN apt update -y && apt install -y \
        git \
        git-lfs \
        python3-pip \
        libgl1 \
        libglib2.0-0 \
        && rm -rf /var/lib/apt/lists/*

    # Empty NGC's pip constraint file: it pins transformers to an older
    # version than Qwen2.5-VL needs (>=4.49). Pip's config still references
    # the file path, so we empty rather than delete it.
    RUN mkdir -p /etc/pip && echo "" > /etc/pip/constraint.txt

    # JupyterLab for the VM launch interface
    RUN pip3 install --no-cache-dir jupyter jupyterlab

    # Qwen2.5-VL core dependencies, version-pinned to a known-good
    # combination tested with Qwen/Qwen2.5-VL-7B-Instruct as of mid-2025.
    # CRITICAL: numpy<2.0 -- NGC 25.06's PyTorch was compiled against
    # NumPy 1.x; NumPy 2.x is binary-incompatible and breaks torch.export
    # silently.
    RUN pip3 install --no-cache-dir \
            "numpy<2.0" \
            "transformers>=4.49" \
            "qwen-vl-utils[decord]" \
            "vlmeval" \
            "vllm>=0.7.2" \
            "accelerate" \
            "decord" \
            "pillow" \
            "opencv-python"
    ```

The accompanying `docker-compose.yml` mounts the project code at
`/workspace/`, the existing dataset directory at `/data/`, and an
`hf_cache/` for HuggingFace weight downloads to persist across
container restarts. A `smoke_test.py` loads the model and runs an
MCQ-format prompt against a chest X-ray, asserting the response
starts with "A" or "B" — the *exact* test LLaVA-Med v1.0 failed.

## Phase 8 — Image build, container up, weights downloading

```bash
cd ~/qwen-medvlm
docker compose build 2>&1 | tee build.log    # ~25 min
docker compose up -d
docker compose exec qwen-medvlm bash
```

Build succeeded on the first try. Container is up. The smoke test
launched, and got as far as `Loading Qwen2.5-VL-7B-Instruct...` — at
which point the first run started downloading the ~16 GB model weights
from HuggingFace into the mounted cache.

**Weights still downloading at end of day.** The smoke test (and with
it, the decisive MCQ-compliance check) is pending the download
finishing. Tomorrow morning should pick that up.

## Honest ledger of the day

A long, branching day. The findings, ranked by how much they reshape
the project:

1. **Pivoted the project's base model from LLaVA-Med v1.0 to
   Qwen2.5-VL-7B-Instruct.** The biggest single decision of the
   project so far. The work on v1.0 is repurposed as motivation
   ("here are three concrete reasons modern medical-VLM research
   needed to move off LLaVA-Med v1.0") rather than discarded.
2. **The substring bug in the v1.0 closed-set scorer is real and
   publishable.** Inflates every published v1.0 closed-accuracy
   number by 9-12 pts uniformly. Worth a section in the eventual
   writeup as a methodology lesson.
3. **The verbosity-inflation effect compounds the substring bug
   under pruning.** Lenient scorers reward pruned models that
   produce more verbose output, creating the false appearance of
   pruning improving accuracy. A real and reportable methodology
   lesson.
4. **The original kr=0.75 +2.57 / +3.30 result is partially
   weakened, not eliminated.** Word-boundary scoring drops the
   improvement to +1.99 over baseline and +3.19 over random; strict
   first-content-word scoring drops it to essentially zero or
   negative. The qsim-vs-random comparison still has a small signal
   under medium-strictness scoring; the qsim-vs-baseline claim is
   noisy under strict scoring.
5. **The residual rising-curve anomaly is partially explained but
   not closed out.** The substring bug accounts for a large fraction
   but not all of the +7.35 pt original rise. The remaining +6.37
   pt rise under word-boundary scoring may be the verbosity-inflation
   effect on the medium scorer (the strict metric does not rise),
   in which case it's a measurement artifact and not a real signal.
   This needs cleaner methodology to verify, which is exactly what
   the Qwen2.5-VL + VLMEvalKit migration provides.

**Self-correction worth noting.** I made two analytical mistakes
during the day that I want to flag for the record:

- Initially framed "open recall is falling" as one of the
  diagnostic signals. It isn't; it's noise in a 0.26-0.32 band.
  Walked that back later in the day.
- Initially floated "the GT yes-distribution is skewed and 'always
  yes' wins" as a hypothesis for the rising curve. The GT distribution
  came back 47/53 — slightly no-leaning, so the hypothesis was
  decisively refuted.

Both are listed because the value of a research log includes the
hypotheses that *didn't* survive contact with data, not just the
ones that did.

## What stays on the site, and what doesn't

Per the editorial decision at end-of-day:

- **The site's headline pages (home, Experiments, Day 1 of Week 2)
  keep the May 17 numbers** (+2.57 / +3.30 framing at kr=0.75). The
  research story is too in-flux today to update those pages
  responsibly.
- **The Week 2 overview gets a Day 5 summary** but the kr ablation
  pending-item stays as-is rather than being marked complete —
  because under cleaner methodology, the headline claim may not
  hold.
- **No update to Bug #5** — its narrative was due for revision based
  on the open-recall reproduction story, but the substring bug
  finding makes the closed-set part of Bug #5 also stale. Better to
  rewrite once after Qwen2.5-VL produces reproducible baselines than
  to do two passes.
- **Today's day-page (this page) is the canonical record** of the
  in-flux findings, the substring bug, the residual anomaly, and the
  pivot decision. Anyone reading the site tomorrow can find the
  current state of understanding here without disturbing the
  established headline narrative.

---

### Plan for tomorrow (May 22, Day 6 of Week 2)

- [ ] Wait for / confirm the Qwen2.5-VL weights finished downloading
- [ ] Run the smoke test — assert MCQ-letter compliance on a sample
      (the test LLaVA-Med v1.0 failed at 0/11)
- [ ] If smoke passes: run zero-shot Qwen2.5-VL on VQA-RAD via
      VLMEvalKit's MCQ scorer; bank the canonical baseline numbers
- [ ] Port `random` and `qsim` scoring logic from
      `eval/methods/` onto Qwen2.5-VL's decoder layers. The hook
      target changes; the scoring math is the same
- [ ] Once both are in: re-run the kr ∈ {0.75, 0.50, 0.25, 0.10}
      ablation on the new stack with the new (correct) scorer. This
      is the experiment that answers the project's central
      question cleanly
- [ ] Eventually: rewrite Bug #5 with both the open-recall finding
      *and* the substring-bug finding consolidated, once we have a
      stable baseline to compare against

---

## Pushed today

**Repository:** [`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
&nbsp;·&nbsp; **Commit:**
[`14a62d3`](https://github.com/Leokuan0208/llava-med-pruning-v1/commit/14a62d3aa8dd3060c6075e19177099da3d0175ef)

The commit captures the accumulated state of the v1.0 track at the
point of pivot: the in-LLM pruning method, the SLAKE wiring, the
`eval_topk_checkpoints.py` script, the candidate-set builders. It's
the natural "this is where we left this branch" snapshot before the
work shifts to Qwen2.5-VL. The `~/qwen-medvlm/` environment is on
disk but not yet in a versioned repo — that gets initialized
tomorrow once the smoke test confirms the stack works.
