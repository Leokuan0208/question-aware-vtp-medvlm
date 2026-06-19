# Day 3 — Tuesday, May 26, 2026

[← Back to Week 3 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) → closing out · Week 3,
Day 3 · **Day 17 of the project**

---

A debugging-and-rewrite day with two thick literature reviews wrapped
around it. The morning opened with what looked like a clean Pareto
curve waiting to be plotted, and ended with the realisation that
*yesterday's entire 8-run sweep was a no-op*. The afternoon was the
**v1 fix cascade** — three real bugs in the post-layer-0 patcher,
each surfacing as the previous one was fixed. By early evening the
architectural lesson was clear enough to justify a **v1 → v2 rewrite
that moves pruning from inside the LLM trunk to before the LLM
trunk**, dropping 150 lines of code and ~30% of inference latency at
kr=0.5. The v2 sweep launched in the early afternoon, finished in
the evening, and the raw results landed on GitHub. Numerical
analysis deferred to Day 4 — there's an interesting story in the
numbers but it deserves a fresh head.

Two long literature surveys ran in parallel while compute was busy:
**(1)** a careful positioning of QSim (mean-pooled cosine similarity)
against the published pruning literature, and **(2)** a structured
look at token *merging* and the medical-VQA properties that should
shape method choice. Both feed directly into the paper's related
work and a new **Methods Roadmap (Tier 1/2/3)** on the
[project page](../../project.md#the-research-journey-how-we-got-here).

Three commits pushed today to `huatuo-llava-v15-med-pruning`. Code
delta against yesterday's
[`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe):
three real bugs fixed in v1, v1 archived as a research artifact, v2
installed as the active patcher, and the v2 sweep's 8 result folders
committed.

---

## Phase 1 — Morning: the smell test that found the bug

Plan coming in (set in
[Day 2's "Plan for tomorrow"](day-02.md#plan-for-tomorrow-may-26-day-17-week-3-day-3)):
check the overnight sweep, smell-test the 8 result JSONs, plot the
Pareto curves, decide on a headline number. Should have been a
~30-minute morning.

The first step worked. `ALL RUNS COMPLETE` was at the bottom of the
tmux log; all 8 `__scores.json` files were on disk; the loop didn't
crash mid-flight. The smell-test loop ran cleanly across the 8 runs.
And the output looked like this:

```text
=== HuatuoGPT-Vision-7B__QSim_mean_kr0.10__scores.json ===
  total: 0.6787
  VQA-RAD: 0.6135  SLAKE: 0.7644  PathVQA: 0.5767
  PMC-VQA: 0.5420  OmniMed: 0.7346  MMMU: 0.5034
=== HuatuoGPT-Vision-7B__QSim_mean_kr0.25__scores.json ===
  total: 0.6787
  VQA-RAD: 0.6135  SLAKE: 0.7644  PathVQA: 0.5767
  PMC-VQA: 0.5420  OmniMed: 0.7346  MMMU: 0.5034
=== HuatuoGPT-Vision-7B__QSim_mean_kr0.50__scores.json ===
  total: 0.6787
  VQA-RAD: 0.6135  SLAKE: 0.7644  PathVQA: 0.5767
  ... (8 runs, every number identical to 4 decimal places) ...
```

**Every one of the 8 runs produced bit-identical scores, on every
dataset, including across QSim and Random** — two methods that
select completely different sets of tokens. This can't happen if
any pruning is actually occurring; the model is producing the same
predictions on every sample on every run. The "Pareto curve" we
were about to plot was a flat line at baseline.

### Why yesterday's smoke test couldn't have caught this

The
[Day 2 verification](day-02.md#phase-14-pruning-framework-design-code-verification)
that gave us confidence — "1,500-sample real-model match at kr=1.0"
— was structurally broken. At `keep_ratio=1.0` the pruner is, by
definition, a no-op even when correctly wired. So that test verified
the patcher didn't *corrupt* anything when no tokens were dropped;
it could not have verified that the patcher *fires* when tokens
should be dropped. **"Verification-at-no-op" is a category of bad
smoke test**, and one that's surprisingly easy to write — the test
passes because nothing happens, regardless of whether the system is
working. Filed as
[Bugs & Issues #9](../../bugs.md#9-verification-at-no-op-smoke-test-antipattern).

### Diagnosis — what could make all 8 runs identical?

Two hypotheses to distinguish:

**(a) Eval-side bug.** The eval harness is somehow caching or
reusing predictions across configs — every run is reading from the
same source.

**(b) Patcher-side bug.** The patcher's `patch_model()` call is
running silently — printing "patcher applied" — but failing to
actually attach to the live execution path. Every run is therefore
running the unpruned baseline model and producing the same answers.

The latency numbers settled it. `__latency_summary.json` showed
identical p50/p95/mean across all 8 runs, including kr=0.1. If
pruning were actually firing at kr=0.1 we'd see substantial
speedup (kept 57 of 576 visual tokens → way fewer LLM ops). The
fact that latency was constant across keep-ratios was the smoking
gun: **the patcher attached cleanly but never actually executed
during inference**.

That falsified hypothesis (a) and located the bug in the patcher's
attachment, not its math.

## Phase 2 — Adding observability

The patcher had no observability. `patch_model()` prints "patcher
applied" at attach time, but nothing during inference confirms the
patch is actually being invoked. From outside the system you can't
tell silent-attachment-success from silent-execution-failure.

Added three diagnostic `print` statements:

1. In the wrapped `prepare_inputs_labels_for_multimodal`: print the
   `visual_span` tuple every time the wrapper is called.
2. At the entry to the replacement `Qwen2Model.forward`: print
   `seq_len`, `do_prune` evaluation, and which pruner is in
   `_STATE`.
3. Just after the actual pruning step inside `_apply_pruning_step`:
   print the pre- and post-pruning sequence lengths.

A 90-second probe with these prints enabled would either show the
patch firing (pruning happening, eval just had a different bug) or
show silence in one of the three places (pinpointing where the
attachment failed).

The probe output:

```text
load_finish
patcher applied: pruner=QSim_mean_kr0.50
  0%|                                       | 0/17303 [00:00<?, ?it/s]
  ... tqdm advances; no [PATCHER] prints anywhere ...
```

**Total silence on the patcher prints.** The wrapper never fires.
The forward replacement never fires. Yet `patch_model()` reported
success at attach time. The patch is installed on the model object
but is in a dead branch — nothing in the real execution path calls
it.

## Phase 3 — Finding the wrong patch target

The patch was installed on
`LlavaMetaForCausalLM.prepare_inputs_labels_for_multimodal`. That's
the stock LLaVA mixin's multimodal-prep method, which our v1 patcher
wrapped expecting it would be called once per sample.

Read HuatuoGPT-Vision's actual model code. They subclass `LlavaQwen2`,
and their `forward` and `generate` methods both contain:

```python
) = self.prepare_inputs_labels_for_multimodal_new(   # note the "_new" suffix
    input_ids,
    ...
```

with the original method commented out as a record of what was
replaced:

```python
# ) = self.prepare_inputs_labels_for_multimodal(
) = self.prepare_inputs_labels_for_multimodal_new(
```

**HuatuoGPT-Vision wrote a custom variant
`prepare_inputs_labels_for_multimodal_new` and routes everything
through it.** The original method still exists on the class — it's
inherited from the LLaVA mixin and never deleted — but nothing in
HuatuoGPT's actual code path calls it. Yesterday's patcher attached
to the wrong method by a six-character suffix.

This is **Bug #1 of three**: the vendor-fork rename. Worth a bug
entry on its own
([#7](../../bugs.md#7-monkey-patching-vendor-forked-method-renames))
because it's a recurring pattern in monkey-patch-based research code
— patching methods that look right at the class level but are
unreachable from the real execution path. The fix was one line:
change `prepare_inputs_labels_for_multimodal` to
`prepare_inputs_labels_for_multimodal_new` in two places in
`patcher.py`.

Re-running the probe with the corrected name:

```text
load_finish
patcher applied: pruner=QSim_mean_kr0.50
[PATCHER] prepare_inputs called: visual_span=(5, 581)
[PATCHER] forward called: seq_len=632, do_prune=True, ...
[PATCHER] pruning applied: seq 632 -> 344, visual 576 -> 288
```

Three signals in three lines:

- **`visual_span=(5, 581)`**: visual tokens occupy positions 5..580
  (576 of them), with 5 text tokens before (BOS + chat-template
  opening) and 51 text tokens after (the question).
- **`seq_len=632, do_prune=True`**: the wrapper successfully
  populated `_STATE["visual_span"]`, so the forward replacement now
  evaluates `do_prune` to True instead of falling through.
- **`seq 632 → 344, visual 576 → 288`**: at kr=0.5, half of 576 ≈
  288 visual tokens kept. Total drops from 632 → 344 (= 632 − 576 +
  288). The arithmetic is consistent.

The patcher fires on the first sample. Then crashed two samples
later.

## Phase 4 — The v1 fix cascade (bugs 2 and 3)

The crash on sample 2:

```text
RuntimeError: CUDA error: device-side assert triggered
[index out of bounds]
```

Investigation traced this to a chain of two more bugs, each only
visible once the previous one was fixed.

### Bug #2 — Attention-mask frame mismatch

After pruning, our KV cache holds `pruned_prompt_len` entries. But
HuggingFace's `generate()` maintains its own `attention_mask` in
the **original (unpruned) prompt frame**, and extends it by 1 per
decode token. At decode step N:

- HF's `attention_mask` length: `original_prompt_len + N`
- Our KV cache length: `pruned_prompt_len + N`

These are inconsistent. The 4D mask construction inside
`Qwen2Model.forward` then sees mismatched shapes and blows up.

**Fix**: slice HF's 2D attention_mask down to
`-(past_key_values_length + seq_length)` entries at the entry to
the forward replacement, so the rest of the mask machinery sees
self-consistent lengths. During prefill this is a no-op
(`attention_mask=None` because HuatuoGPT's `generate()` explicitly
passes that); the slice block only matters at decode.

Filed as
[Bugs & Issues #8 (frame mismatch)](../../bugs.md#8-frame-mismatches-between-hf-generate-and-the-pruned-state).

### Bug #3 — Position-IDs RoPE index-out-of-bounds

Once the mask was reconciled, the next crash hit at decode step 1:

```text
RuntimeError: CUDA error: device-side assert triggered
(rotary cos table index OOB: requested index 631, table size 346)
```

HF's `generate()` computes `position_ids` from the
**unpruned-frame** `attention_mask` via `cumsum - 1`, so at decode
the values are like `[631, 632]` — original sequence positions.
But our rotary cos/sin tables are sized to `past_key_values_length
+ seq_length` *in the pruned frame* (e.g. 346 for kr=0.5 from the
example). Indexing a 346-entry rotary table with 631 → out of
bounds.

**Fix**: ignore HF's `position_ids` and recompute them
unconditionally inside the forward replacement using
`torch.arange(past_key_values_length, seq_length +
past_key_values_length)`. This stays inside the pruned cache frame
at every step (prefill gets `[0..seq_len-1]`, decode gets
`[past_kv_len..past_kv_len+seq_len-1]`).

Same Bugs page entry as #8 — both are instances of the same
underlying category (HF generate's unpruned-frame internal state
versus our pruned-frame KV cache and rotary tables).

### The cascade as a single pattern

Three bugs, one root cause: **once we modify what `Qwen2Model.forward`
operates on mid-trunk, every downstream piece of state that HF
generate maintains in the original frame becomes inconsistent with
what our trunk is doing in the pruned frame.** Each fix reconciles
one piece of state (the mask, the position ids). The next decode
step exposes the next inconsistency.

After all three fixes, v1 ran for ~5 minutes (around 545 samples)
without crashing, producing real predictions that differed from
baseline. **Pruning at last actually firing on real data.** This is
the v1 we'd intended to ship yesterday.

## Phase 5 — The pre-LLM rewrite (v2)

With v1 stable, the architectural question was: **is the integration
tax of trunk-level pruning worth paying, or is there a cleaner
architecture?**

Walked through the v1 design end-to-end:

- We override `Qwen2Model.forward` because we want to prune after
  layer 0 has contextualized the visual tokens.
- That forces us to manage the layer-0 KV cache directly (slice it
  after pruning so layers 1..27 see a self-consistent cache).
- That makes the 4D attention mask construction more delicate.
- That makes the position_ids → rotary lookup more delicate.
- Each of those was today's bug #2 or #3.

The recurring word is **"because we prune *after* layer 0".** And
the reason for pruning after layer 0 was: we wanted scoring to
operate on hidden states that had been contextualized by layer 0,
not on raw post-projector embeddings.

But — and this is the architectural insight — **Qwen2 uses causal
attention**. Visual tokens occupy positions 5..580; question text
occupies positions 581..631. Visual tokens *cannot attend forward
to question tokens* at any layer, including layer 0. So our
layer-0 visual reps contain *zero* question information from any
attention path — only intra-visual context.

Which means: scoring visual tokens at layer 0 versus scoring them
on post-projector pre-LLM embeddings gives us essentially the same
question-aware signal, because the question-awareness lives
entirely in the cosine-similarity step against the question text
embeddings, not in any contextualization that the visual reps
received inside the LLM.

### What v2 does

v2 attaches at **`prepare_inputs_labels_for_multimodal_new`** — the
exact same patch point as v1's wrapper, but now used for the actual
pruning, not just for span-recording. Inside the wrapper, after the
splicing of visual embeddings into the text embedding sequence has
completed, we score the visual tokens, drop the bottom-(1-kr)*100%,
and return a shorter `inputs_embeds`. HF's `generate()` then
constructs *all* its state — `attention_mask`, `position_ids`, KV
cache — from the already-pruned sequence length.

There is no "original frame" to reconcile against because HF
generate never sees the original frame. The pruned length is the
only length HF generate has ever known.

- No `Qwen2Model.forward` override.
- No mid-trunk KV cache slicing.
- No `attention_mask` reconciliation.
- No `position_ids` workaround.
- 130 lines of code total, vs v1's 280.

??? note "v2 patcher (active `pruning/patcher.py` — 130 lines)"
    Full source committed at
    [`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249).

    ```python
    """Patcher v2: prune visual tokens BEFORE the LLM trunk runs.

    Architectural rationale (see bugs page for the v1 post-mortem):
      v1 ran pruning after LLM layer 0 inside a Qwen2Model.forward
      override. This required reconciling pruned-frame state (our
      KV cache, hidden states) with HF generate's unpruned-frame
      state (attention_mask, position_ids) on every decode step.
      The reconciliation produced a chain of bugs: KV cache length
      drift, 4D attention mask shape mismatch, and rotary-position-
      embedding index-out-of-bounds. Each fix exposed the next.

      v2 prunes at the multimodal-prep hook, before any LLM layer
      runs:

          LlavaQwen2.generate
            -> prepare_inputs_labels_for_multimodal_new  <-- we patch here
               [original: splice 576 visual embeddings into text seq]
               [our wrapper: score visual tokens, slice inputs_embeds]
            -> super().generate(inputs_embeds=pruned, attention_mask=None, ...)
               [HF generate builds attention_mask/position_ids/KV
                cache from PRUNED length]

      HF generate never sees the unpruned sequence. No drift. No
      slicing inside the LLM trunk. No mid-trunk patching needed.

    Approach matches the integration style of pre-LLM token-selection
    methods (VisionZip, SparseVLM v1, FastV's k=0 mode).
    """
    # full source at the commit link above
    ```

### v2 smoke verification

Probed at kr=0.5 for ~90 seconds:

```text
load_finish
patcher applied: pruner=QSim_mean_kr0.50
[PATCHER v2] first prune confirmed: seq 632 -> 344, visual 576 -> 288
  (logged once per run)
  2%|█▏    | 372/17303 [00:58<33:38,  8.39it/s]
```

Three things to note:

- **Sentinel arithmetic matches v1.** `seq 632 → 344, visual 576 →
  288` is the same shape v1 produced at kr=0.5; pruning is firing
  identically.
- **~8 it/s is a real speedup.** v1 ran at roughly 5-7 it/s with
  full debug prints; v2 with one sentinel print runs at 8-9 it/s.
  The ~30% speedup at kr=0.5 is consistent with pruning before
  all 28 layers vs after layer 0 (v1 pruned before 27).
- **Ran for 545+ samples without crashing.** All the failure modes
  v1 hit are sidestepped by construction — HF generate sees a
  self-consistent state because it built that state from the
  pruned sequence itself.

??? note "Once-per-run sentinel pattern"
    `[PATCHER v2] first prune confirmed: ...` is a single-shot log
    line that fires inside the wrapper, gated by a flag in
    `_STATE`. It logs once and stays silent for the remaining
    17,302 samples. The point is to **make silent-attachment-success
    distinguishable from silent-execution-failure**, without spamming
    the log. If the sentinel doesn't appear within the first ~30
    seconds of a run, the patch isn't attached to the actual code
    path.

    This is the lesson from today's morning: every monkey-patch
    needs a sentinel print at the moment the patched code runs, not
    just at attach time. Filed in
    [Bugs & Issues #7](../../bugs.md#7-monkey-patching-vendor-forked-method-renames).

## Phase 6 — Repo cleanup & first push

Cleaned up the v1 patcher (removed 7 debug prints, kept one
once-per-run sentinel), moved it to
`pruning/archive/patcher_v1_post_layer0.py`, then wrote v2 in place
of `pruning/patcher.py`. Restructured the results folder so the two
patcher generations' outputs are clearly separated:

```text
results/
  archive/                            # yesterday's no-op sweep
    2026-05-25_baseline_paper_repro/
    2026-05-25_smoke_kr1.00/
    2026-05-25_sweep_no_op_BUG/
  v1_post_layer0/                     # empty; for future v1 ablation
  v2_pre_llm/                         # today's sweep lands here
```

Pushed two commits:

- **[`72bdd28`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/72bdd28)**
  — Archive v1 post-layer-0 patcher with full fix history (the
  three-bug commit message preserves the cascade as a research
  artifact for any future return to v1).
- **[`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249)**
  — Rewrite patcher as v2: prune visual tokens BEFORE LLM trunk.

## Phase 7 — v2 sweep launched (and the `tee` race)

Re-launched the same 4 keep-ratios × 2 methods design, this time
pointed at the v2 folder with per-run subdirectories:

```bash
cd ~/huatuo-llava-v15-med-pruning

for KR in 0.75 0.5 0.25 0.1; do
  for METHOD in qsim random; do
    torchrun --nproc_per_node=1 scripts/patch_and_eval.py \
      --pruner $METHOD --keep_ratio $KR \
      --model_path /data/dan/weights/HuatuoGPT-Vision-7B \
      --data_path /data/dan/dataset/Medical_Multimodal_Evaluation_Data/medical_multimodel_evaluation_data.json \
      --output_dir ~/huatuo-llava-v15-med-pruning/results/v2_pre_llm/2026-05-26_${METHOD}_kr${KR} \
      2>&1 | tee ~/huatuo-llava-v15-med-pruning/results/v2_pre_llm/2026-05-26_${METHOD}_kr${KR}/eval.log
  done
done
```

The first run threw a friendly-looking but mildly-confusing error:

```text
tee: /home/jamesyang/huatuo-llava-v15-med-pruning/results/v2_pre_llm/2026-05-26_qsim_kr0.75/eval.log: No such file or directory
```

The cause: `tee` tries to open `eval.log` for writing immediately
at process start (second zero). But `patch_and_eval.py`'s
`os.makedirs(output_dir, exist_ok=True)` doesn't fire until the
script has loaded the model and reached that line — about 30
seconds in. Race condition: `tee` opens before the directory
exists, fails non-fatally, and the rest of the pipeline keeps
running. The result files (`__predictions.json`, `__scores.json`,
etc.) still get written because `patch_and_eval.py` writes them
through its own logic, independent of the `tee`. Only the per-run
log capture is lost for the affected run.

Fixed for the remaining 7 runs by pre-creating the folders in a
second terminal: `mkdir -p results/v2_pre_llm/2026-05-26_{qsim,random}_kr{0.75,0.5,0.25,0.1}`.
The general lesson — *put `mkdir -p` inside the loop before the
`tee`* — is filed in
[Bugs & Issues #7](../../bugs.md#7-monkey-patching-vendor-forked-method-renames)
as a related shell-pipeline gotcha note (low priority; doesn't
affect scientific results).

## Phase 8 — Two literature surveys (during the sweep)

The sweep runs at ~8 it/s × 17,303 samples × 8 configurations = ~4
hours of compute. Used the time to do two literature surveys whose
conclusions will sit in the paper's related-work section and on the
project page.

### Survey 1 — Has cosine-similarity scoring been done before?

Short answer: **yes, and our v2's specific formulation is documented
in two recent papers as a baseline.** The taxonomy:

**Where pruning happens.** The field has converged on three insertion
points:

1. **Inside the vision encoder, or between encoder and projector.**
   ToMe, LLaVA-PruMerge, EvoPrune (inside the encoder); ReDiPrune
   (An Yu et al., arXiv:2603.24680) inserts between encoder output
   and projector. Operates on rich pre-projection features; ReDiPrune
   is the recent close-in-spirit neighbor to v2 (same scoring
   signals — text-relevance + diversity — at a different stage).
2. **Between projector and LLM (post-projector, pre-LLM).**
   FasterVLM, VisionZip (CLS attention), LLaMA-VID (Q-Former), 
   LLaVA-Mini (fuse-into-text). **Our v2 lives here.**
3. **Inside the LLM trunk.** FastV (after layer 2), SparseVLM
   (text-aware via decoder attention), PDrop (progressive), HoloV
   (later layers). **Our v1 lived here.**

**What signal is used to score tokens.** The defining axis is
**text-aware vs text-agnostic**:

- **Text-aware** (our QSim, ZSPAPrune, ResPrune, SparseVLM): score
  visual tokens by their relationship to the question text.
- **Text-agnostic** (FastV, FasterVLM, VisPruner, LLaVA-PruMerge):
  score visual tokens by intra-visual signal — CLS attention,
  similarity, redundancy — without reference to the question.

**Our exact scoring formula has prior art as a baseline.** Two
papers in the last 8 months evaluate the **mean-pooled-question /
cosine-similarity / top-K** formulation:

- **ZSPAPrune (Zhang et al., Oct 2025)** uses the same mean-pooled
  cosine score as the "relevance" phase, then adds a diversity
  selection phase on top. **Our QSim is the simpler "relevance only"
  half of ZSPAPrune.**
- **ResPrune** evaluates exactly our formulation as their *Setting-3*
  ablation. They report it as the **weakest** of three formulations
  (Setting-1: max-similarity per visual token across text tokens
  wins at 98.4%; Setting-2: averaged-similarity per visual token
  98.1%; Setting-3: pooled-text cosine 95.4%). Their explanation:
  *"pooling textual tokens collapses the strongest visual-text
  correspondence into a single vector and dilutes it; max acts as
  a selective mechanism that emphasizes the strongest pairing."*

**This is the most actionable result of the survey.** There's
published evidence that switching from mean-pooled cosine to
max-similarity-across-text-tokens is a likely upgrade. Small code
change, likely better numbers — strong Tier-1 follow-up experiment.

??? note "What this means for the paper's contribution claim"
    Our scoring formula itself isn't novel. ZSPAPrune uses it as a
    starting point; ResPrune evaluates it as a baseline. **Saying
    "we invented cosine-similarity scoring for pruning" would be
    wrong.**

    What's potentially novel:

    1. **The medical-VQA domain.** Almost all published text-aware
       pruning work is on general-purpose VLMs (LLaVA-1.5 on COCO /
       GQA / POPE / MME / TextVQA). Medical VQA has different
       characteristics (small training sets, specialized vocabulary,
       fine-grained regions of interest); whether the same scoring
       methods transfer cleanly is empirically open.
    2. **The HuatuoGPT-Vision-7B baseline.** Existing pruning papers
       target LLaVA-1.5 or Qwen2.5-VL. HuatuoGPT-Vision uses
       LLaVA-v1.5 architecture but is medical-trained; the
       interaction between domain training and pruning is unstudied.
    3. **Clean within-method comparisons.** Random pruning at
       matched keep-ratio is a clean control isolating the
       contribution of question-awareness.
    4. **Cross-benchmark coverage.** Six benchmarks (VQA-RAD, SLAKE,
       PathVQA, PMC-VQA, OmniMedVQA, MMMU-Medical), not the typical
       1-3.

    The honest pitch: *"we benchmark question-aware visual token
    pruning on medical VLMs across six benchmarks, with a clean
    random-baseline ablation, on a recent medical-trained base
    model where this hasn't been studied."*

??? note "Why the v1→v2 move doesn't hurt the question-awareness claim"
    Under Qwen2's causal attention, visual tokens at positions
    5..580 cannot attend forward to question tokens at positions
    581..631. So layer-0's contextualization of visual tokens
    contains zero question information — the question-awareness in
    both v1 and v2 lives **entirely in the cosine-similarity
    scoring step**, not in any in-LLM mixing of visual and text
    reps. v2 ≈ v1 for question-awareness; v2 < v1 in code
    complexity. The future v1-vs-v2 ablation will confirm
    empirically whether causal attention's theoretical claim holds.

### Survey 2 — Can we use pruning and merging together? Does medical VQA benefit from a specific approach?

Two-part question; two-part answer.

**Part A — Pruning vs merging vs hybrid.** Pruning *discards*
tokens; merging *combines* them. ToMe (Bolya et al., ICLR 2023) is
the canonical merge: for redundant regions, merging is strictly
better than pruning because no information is dropped — the 50
redundant lung-tissue tokens become 25 averaged representatives.
For irrelevant regions, pruning is strictly better — merging in
background averages dilutes the signal.

**Hybrid prune+merge methods exist and align with this intuition:**

- **PuMer** (ACL 2023) — text-informed pruning of irrelevant tokens
  + similarity-based merging of redundant ones, combined into a
  single end-to-end framework.
- **LLaVA-PruMerge** (ICCV 2025) — adaptive token reduction that
  combines pruning (drop low-importance) with merging (consolidate
  similar) to hit a target compression ratio.
- **AIM (Adaptive Inference Merging)** — per-sample decides how
  much to prune vs merge based on image information density.
  Homogeneous radiograph → aggressive pruning; busy histology slide
  → more merging.

The mental model: prune for *relevance* (drop tokens irrelevant to
the question), merge for *redundancy* (consolidate tokens that
duplicate each other), and use both together to hit a target keep
count.

**Part B — What makes medical VQA different.** The literature gives
us six identifiable properties of medical VQA that should inform
method choice. The three most important:

- **High background-to-signal ratio.** Chest X-rays are mostly
  black borders + uniform soft tissue; pathology slides have vast
  stretches of stroma punctuated by clusters of interest. This is
  widely-observed in medical-imaging analysis. Earlier notes here
  attributed a specific quote on MIMIC-CXR to "ViTAS (Ahmed et al.,
  2026)"; the May 28 paper audit found no such paper exists, and
  the attribution has been removed. **Implication: the redundancy
  ceiling is higher than general VQA — aggressive compression
  should work better here.**
- **Lesions are small and localized.** Medical-VQA survey (Lin et
  al., 2023): *"the task needs to focus on a fine-grained scale
  because a lesion is microscopic."* **Implication: drop the 3
  tokens with the lesion and the question can't be answered, no
  matter how many other tokens you keep. Token-level individual
  scoring (like QSim) is vulnerable; spatial-coherence-aware
  scoring is potentially valuable.**
- **Question types strongly predict which tokens matter.** Modality
  ("is this CT or MRI?") needs almost any patch; abnormality
  ("is there a pneumothorax?") needs the lesion region.
  **Implication: per-question-type adaptive compression — aggressive
  for modality/plane, conservative for abnormality — is medical-VQA-
  specific and not in the general-VQA pruning literature.**

Three more properties (anatomy structure constraints, scan-modality
diversity, dataset-shift sensitivity) feed downstream into the
Methods Roadmap. Full writeup folded into the
[project page's Methods Roadmap](../../project.md#the-research-journey-how-we-got-here).

### A QSim weakness worth flagging up front

One more critique surfaced during the survey, and it's worth being
honest about. **HoloV (Oct 2025)** observes that attention/similarity
scored individually tends to keep *semantically similar* tokens —
because they all attend to the same query word, or all score high
against the same pooled question vector. The result: pruning
concentrates the kept tokens in a few salient regions and *loses
global context*. This is a diversity problem.

For QSim specifically: if the question mentions "lung" and the image
has 50 patches that are all "obvious lung tissue", QSim will keep
all 50 — losing diversity across the rest of the image. Even when
the question is *about* lung tissue, the model might benefit from
non-lung tokens for context (background, contrast, what isn't lung).
**Adding a diversity term to QSim — the ZSPAPrune approach — is the
natural follow-up.** Tier-1.

A related and even sharper critique: **"When Token Pruning is Worse
than Random"** (Dec 2025) found that in deep LLM layers, existing
token pruning methods perform **similarly or worse than random
pruning**. It doesn't say all pruning is useless — it says the
chosen *metric* often isn't doing useful work, and the speedup
comes from "any 50% of tokens" rather than "the right 50%." **Our
Random comparison floor isn't optional. It's the experimental
control that tells us whether QSim is doing real work.** If the
v2 sweep results show QSim ≈ Random at every kr, we're in this
regime and need to upgrade the scoring signal before claiming
question-awareness helps.

## Phase 9 — v2 sweep completes; results pushed

Sweep finished mid-evening — total wall time roughly 4-5 hours, as
predicted. All 8 runs landed cleanly under `results/v2_pre_llm/`.
The `__scores.json` files are no longer bit-identical across configs
— that alone is the proof that pruning is now actually happening on
real data. Per-run latency summaries also show the expected
ordering (kr=0.1 fastest, kr=0.75 slowest).

**Held back the numerical analysis to Day 4.** It's not that the
results are bad — they're not — but doing the analysis at 11pm
after a 14-hour debugging-and-rewrite-and-survey day risks reading
noise as signal. The numbers go into the
[Experiments page](../../experiments.md) tomorrow with a clean head;
the headline analysis question is whether QSim beats Random at any
keep-ratio, and by how much, on which benchmarks.

Third commit of the day captured the raw results:

- **[`24ef568`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/24ef568)**
  — Add v2 pre-LLM pruning sweep results (2026-05-26).
  8 runs: {qsim, random} × {kr=0.75, 0.5, 0.25, 0.1} across 6
  benchmarks. First successfully-pruned sweep on this codebase.

## Honest ledger of the day

1. **Yesterday's sweep was a no-op.** Diagnosed via the smell-test
   showing bit-identical scores across 8 configurations. Verified
   by sentinel observability showing the patcher's `_new`-suffix
   method-name mismatch.
2. **v1 fix cascade documented and stabilized.** Three real bugs
   chained together: method rename (Bug #7), attention-mask frame
   reconciliation (Bug #8), position_ids RoPE OOB (also #8).
   Patcher ran ~545 samples cleanly after the third fix.
3. **v1 → v2 architectural rewrite.** 280 → 130 lines, all
   trunk-modification bugs sidestepped by construction, ~30%
   speedup at kr=0.5. The rewrite is consistent with the integration
   style of ReDiPrune, VisionZip, SparseVLM v1, and FastV's k=0
   mode — pre-LLM pruning is well-trodden ground.
4. **v2 verified end-to-end and committed.** Once-per-run sentinel,
   5+ minutes of clean runtime in the smoke probe, both pushes
   landed.
5. **Full v2 sweep launched, ran 4-5 hours, completed cleanly.**
   8 configurations, 17,303 samples each, no crashes. Results
   committed to git.
6. **Literature survey 1 (cosine similarity).** QSim is the
   simpler half of ZSPAPrune and ResPrune's Setting-3 baseline. Not
   novel as a scoring formula; potentially novel as the
   medical-VQA application + clean random-baseline + cross-benchmark
   coverage.
7. **Literature survey 2 (token merging + medical-VQA properties).**
   Hybrid prune+merge frameworks exist (PuMer, LLaVA-PruMerge, AIM).
   Medical VQA has three properties — high background-to-signal,
   small-localized-lesions, structured-question-types — that map
   onto specific method choices. Three tiers of next-step
   experiments documented on the
   [project page](../../project.md#the-research-journey-how-we-got-here).
8. **The QSim weakness worth flagging.** Mean-pooled cosine is
   probably weaker than max-similarity; QSim has no diversity term
   and may concentrate too narrowly. Random baseline at every
   keep_ratio is the experimental control that catches "QSim isn't
   actually doing useful work" if that's the result.

---

### Plan for tomorrow (May 27, Day 18 / Week 3 Day 4)

- [ ] **Pull the v2 sweep scores into a proper table.** 8 rows ×
      7 columns (total + 6 benchmarks). Compute Δ vs the kr=1.0
      paper-reproduction baseline (0.6787) per benchmark per
      method.
- [ ] **Plot the Pareto curve** (accuracy vs keep-ratio) — one
      panel per benchmark, two lines per panel (QSim, Random). The
      decisive question: at which keep-ratio does QSim's gap over
      Random first become visible, and how does the gap evolve as
      kr drops to 0.1?
- [ ] **Latency-speed Pareto** — accuracy vs latency, one panel
      total. The "is the speedup worth the accuracy cost" plot the
      project has been building toward since Day 1.
- [ ] **Write up E2 (the v2 sweep) on the
      [Experiments page](../../experiments.md)** with the table +
      plots + first analysis.
- [ ] **Add the literature-survey takeaways to the
      [Project page](../../project.md)** — Methods Roadmap
      (Tier 1/2/3), Related-work positioning, the medical-VQA
      properties section. *(Drafted today; needs polishing
      tomorrow.)*
- [ ] **First Tier-1 follow-up: max-similarity scoring.** If the
      v2 sweep shows QSim ≈ Random, max-similarity is the
      lowest-cost upgrade (ResPrune Setting-1 → 98.4% vs Setting-3's
      95.4%). 1-2 hours of code, 4-5 hours of sweep compute.
- [ ] **Read ToMe end-to-end.** Still pending from Week 2; the
      survey makes it tractable in one sitting now.

---

## Pushed today

Three commits to
**[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)**:

**[`72bdd28`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/72bdd28)**
— *Archive v1 post-layer-0 patcher with full fix history.*
Documents the three-bug cascade (method rename → mask frame →
position_ids RoPE) as a permanent research record. Preserves v1 in
`pruning/archive/patcher_v1_post_layer0.py` for future ablation
(v1 vs v2 will isolate whether layer-0 contextualization helps
scoring under causal attention; theoretical answer is no, since
visual tokens can't attend forward to question tokens at any layer).

**[`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249)**
— *Rewrite patcher as v2: prune visual tokens BEFORE LLM trunk.*
Architectural pivot. v2 attaches at
`prepare_inputs_labels_for_multimodal_new` and prunes the spliced
`inputs_embeds` before any LLM layer runs; HF generate then
constructs `attention_mask`/`position_ids`/KV-cache from the
already-pruned sequence length. 130 lines vs v1's 280; no
trunk-modification bugs are reachable by construction. Matches the
integration style of VisionZip, SparseVLM v1, and FastV's k=0
mode.

**[`24ef568`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/24ef568)**
— *Add v2 pre-LLM pruning sweep results (2026-05-26).* 8 runs:
{qsim, random} × {kr=0.75, 0.5, 0.25, 0.1} on HuatuoGPT-Vision-7B
across VQA-RAD, SLAKE, PathVQA, PMC-VQA, OmniMedVQA,
MMMU-Medical. First successfully-pruned sweep on this codebase
(yesterday's `c216bbe` sweep was retroactively diagnosed as a
no-op). Per-run `__scores.json` / `__latency_summary.json` /
`eval.log` files committed under
`results/v2_pre_llm/2026-05-26_<method>_kr<ratio>/`.
