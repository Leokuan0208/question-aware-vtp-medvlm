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

## Phase 7 — Drafting the Qwen2.5-VL Dockerfile

With the decision made, drafted a single Dockerfile in the project's
established format — same shape as the LLaVA-Med v1.5 and v1.0
Dockerfiles already on the [setup page](../../setup.md): one
`FROM`, layered `RUN pip install` blocks for pinned dependencies,
JupyterLab as the entrypoint command. The build itself is submitted
through the HONGHU KUBERUN web interface (paste Dockerfile → platform
builds the image → JupyterLab terminal is the entrypoint into the
running container); no `docker` CLI involved at any step. Decisions
on the contents:

- **Base image: `nvcr.io/nvidia/pytorch:25.06-py3`.** Chose 25.06
  over the latest 26.04 because it's the last CUDA 12.x NGC release
  (flash-attn pre-built wheels available; CUDA 13 would force a
  30-60 min source build), the R555+ driver requirement is widely
  deployed on KUBERUN, and 11 months of library maturity means
  every Qwen2.5-VL dependency has tested wheels for this stack.
  NGC 25.06 ships Python 3.12, CUDA 12.9.1, PyTorch 2.8.0a0.
- **Eval framework: VLMEvalKit + lmms-eval.** Both support
  Qwen2.5-VL and VQA-RAD/SLAKE/PathVQA out of the box. Adopting
  these eliminates the entire class of metric bugs we encountered
  on the v1.0 track (the substring bug found earlier today being
  the biggest example).
- **Pruning method port: reuse `random` and `qsim` scoring logic
  on Qwen2.5-VL's standard HF transformers architecture.** The
  hook target changes from `LlavaLlamaModel.model.layers` to
  Qwen2.5-VL's decoder layers; the scoring math is the same.

## Phase 8 — First KUBERUN build, constraint-file failure, rebuild

First draft of the Dockerfile pasted into KUBERUN. The build kicked
off, and failed immediately at step 4:

```
#7 [4/8] RUN pip3 install --no-cache-dir jupyter jupyterlab
#7 1.040 ERROR: Could not open requirements file:
        [Errno 2] No such file or directory: '/etc/pip/constraint.txt'
#7 ERROR: process "/bin/sh -c pip3 install --no-cache-dir jupyter jupyterlab"
        did not complete successfully: exit code: 1
```

The root cause: NGC's PyTorch base image ships with `/etc/pip.conf`
configured to point at a constraint file at `/etc/pip/constraint.txt`,
which pins `transformers` to a version older than Qwen2.5-VL needs
(< 4.49). I'd written the Dockerfile with `RUN rm -f
/etc/pip/constraint.txt` to remove that pin — but **deleting the
file leaves the pip-config reference dangling**, so the *next*
`pip install` call (jupyter, in this case) crashes trying to read
the now-missing file.

The fix is to **empty the file** instead of deleting it. That way
pip's config still finds a valid (empty) constraint file and skips
straight through:

```dockerfile
RUN mkdir -p /etc/pip && echo "" > /etc/pip/constraint.txt
```

Updated the Dockerfile, re-submitted through KUBERUN. Build
succeeded on the second attempt, ~25 minutes total (the NGC base
image is ~25 GB compressed; pulling it from NGC dominates the
build time).

??? note "`Dockerfile` — Qwen2.5-VL on NGC 25.06 (working version, after Phase 9 NumPy fix)"

    This is the final working version that includes both the
    constraint-file emptying (from this phase) and the
    `numpy<2.0` pin (added in Phase 9 below after the dependency
    conflict surfaced).

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
    # the file path, so we empty rather than delete it -- deleting would
    # break every subsequent pip call.
    RUN mkdir -p /etc/pip && echo "" > /etc/pip/constraint.txt

    # JupyterLab - required by the HONGHU KUBERUN VM launch interface
    RUN pip3 install --no-cache-dir jupyter jupyterlab

    # Qwen2.5-VL core dependencies, version-pinned to a known-good
    # combination tested with Qwen/Qwen2.5-VL-7B-Instruct as of mid-2025.
    # CRITICAL: numpy<2.0 -- NGC 25.06's PyTorch was compiled against
    # NumPy 1.x; NumPy 2.x is binary-incompatible and breaks torch.export
    # silently. The pin blocks transitive deps from upgrading numpy.
    RUN pip3 install --no-cache-dir \
            "numpy<2.0" \
            "transformers==4.49.0" \
            "qwen-vl-utils[decord]==0.0.10" \
            "vlmeval" \
            "accelerate" \
            "pydantic>=2.0" \
            "pillow" \
            "opencv-python" \
            "tifffile"

    # Flash-Attention 2 - reinstall pinned, since NGC's pre-installed
    # version could vary between image pulls. 2.7.4.post1 has stable
    # Qwen2.5-VL support and CUDA 12.9 wheels.
    RUN pip3 install --no-cache-dir flash-attn==2.7.4.post1 --no-build-isolation

    # Symlink so /data shows up in the JupyterLab file browser
    RUN ln -s /data /root/data

    CMD ["jupyter", "lab", "--port=8888", "--ip=0.0.0.0", "--allow-root", "--no-browser"]
    ```

## Phase 9 — Step 1 import check, NumPy 2.x conflict, second rebuild

With the container running on KUBERUN, dropped into the JupyterLab
terminal and ran a step-by-step verification — same pattern as the
v1.0 setup days. **Step 1** was an inline heredoc import check that
loads every library the project needs (PyTorch, transformers,
qwen_vl_utils, flash-attn, vlmeval, Pillow, opencv, tifffile) and
prints versions:

```bash
python << 'EOF'
import torch
print(f"PyTorch:        {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version:   {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU:            {torch.cuda.get_device_name(0)}")
import transformers; print(f"transformers:   {transformers.__version__}")
import qwen_vl_utils;  print("qwen_vl_utils:  OK")
import flash_attn;     print(f"flash-attn:     {flash_attn.__version__}")
import vlmeval;        print("vlmeval:        OK")
EOF
```

The output included a NumPy version warning at the top:

```
A module that was compiled using NumPy 1.x cannot be run in
NumPy 2.x as it may crash. ...
```

This is the kind of warning that looks ignorable but isn't. NGC's
PyTorch 2.8.0a0 was compiled against NumPy 1.x, but the
`pip install` of VLMEvalKit and its transitive dependencies
silently pulled in NumPy 2.x. PyTorch will mostly continue to work,
but specific code paths (notably `torch.export`, used by some
quantisation and serialisation flows) hit hard incompatibilities at
runtime that show up as opaque `TypeError`s or `AttributeError`s
mid-eval — exactly the kind of bug we don't want lurking in a
multi-hour batch run.

The fix is upstream of the install: **pin NumPy to < 2.0** in the
Dockerfile, *before* the line that installs VLMEvalKit. That way
NumPy 2.x never enters the environment in the first place.

Updated the Dockerfile (the version embedded in Phase 8's
collapsible block above is the final version, with this pin already
in place) and re-submitted through KUBERUN. Third build, succeeded
cleanly. Re-ran the Step 1 import check; this time:

```
PyTorch:        2.8.0a0+5228986c39.nv25.06
CUDA available: True
CUDA version:   12.9
GPU:            NVIDIA A100 80GB PCIe
GPU count:      1
NumPy:          1.26.4
transformers:   4.49.0
qwen_vl_utils:  OK
flash-attn:     2.7.4.post1
vlmeval:        OK
Pillow:         10.4.0
opencv:         4.13.0
tifffile:       2026.5.15
All imports succeeded with no warnings.
```

Clean — every library at the expected version, NumPy correctly
locked to 1.26.4, no warnings of any kind. The environment is
fully functional from a library-import standpoint.

## Phase 10 — Step 2 passes, Step 3 stuck on safetensor 4

**Step 2** — additional minor verifications (GPU memory visible,
`/data` symlink works, dataset directory reachable) — passed
without surprises.

**Step 3** was the model-loading test. The script imports
`Qwen2_5_VLForConditionalGeneration` and calls
`.from_pretrained("Qwen/Qwen2.5-VL-7B-Instruct", ...)`, which
triggers HuggingFace's first-run download of ~16 GB of weights into
the mounted cache directory. The download streams in parallel
across multiple safetensor shard files, with `tqdm` progress bars
per file.

The download started cleanly, three shards completed, and then
**the fourth safetensor file stopped updating its progress bar**.
The terminal sat without progress for several minutes. This could
mean any of three things:

1. **Real stall** — HuggingFace's CDN or the local network hiccupped.
2. **Reporting artifact** — HuggingFace's downloader doesn't always
   refresh per-file display when shards download in parallel; one
   file appears stuck while another is actively progressing.
3. **Past download, into loading** — the shard finished and the loader
   is now in the (slower, less verbose) "copy shard into GPU memory"
   phase, which can pause visually for tens of seconds per shard.

The day ran out before resolving which one. The download is in
progress in the background of a long-running container; will pick
up tomorrow morning by checking total cache-directory size and
file-by-file `ls -lh` to see whether the total is still growing
(case 1 vs case 2 vs case 3).

**End-of-day state**: KUBERUN-built image working, container up,
JupyterLab accessible, Step 1 + Step 2 verifications clean, Step 3
model download paused/progressing on safetensor 4 of N. The smoke
test's decisive output — the MCQ-letter compliance check — is
pending the download finishing.

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

- [ ] Confirm Step 3's safetensor download completed (check
      cache directory total size — if it's near 16 GB, the download
      finished while the terminal was unresponsive)
- [ ] Run Step 4 — the MCQ-letter compliance test against
      Qwen2.5-VL on a sample chest X-ray. This is the decisive test
      LLaVA-Med v1.0 failed at 0/11
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
work shifts to Qwen2.5-VL. The Qwen2.5-VL image lives inside KUBERUN
(built from the Dockerfile in Phase 8's collapsible block), and the
Dockerfile itself isn't yet in a versioned repo — that gets done
tomorrow once the smoke test confirms the stack works, alongside
initializing a new `llava-med-pruning-v2` (or similar) repo for the
Qwen2.5-VL pruning code.
