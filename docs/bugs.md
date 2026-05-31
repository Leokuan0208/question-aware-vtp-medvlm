# Bugs & Issues

A running log of bugs encountered during the project. Each entry uses
the same template so they're easy to scan, and — importantly —
documents the **full troubleshooting trail**, not just the final fix.
Bug-hunts are part of the research record; later-me will want to know
what hypotheses were eliminated, not just the answer.

---

## #11 — Nested vs. independent random pruning cannot be an independent check

<span class="pill pill--done">Resolved (methodology lesson)</span>

**Found** May 31, 2026 · **Severity** Medium (a misread would have
overclaimed the evidence-quantity result) · **Upstream status**
_n/a — analysis-methodology lesson_

### What I observed

The scored sweep ran two random-pruning arms: **independent** (a
fresh random token subset at each keep-ratio) and **nested** (each
lower-kr subset a strict subset of the higher-kr one). Two
observations looked like clean results at first and were not:

1. **The aggregate accuracy curves of the two arms agreed at every
   keep-ratio** (diffs +0.0016, −0.0026, +0.0031, +0.0045 — all under
   half a point, no sign pattern). It was tempting to read this as
   "removing tokens hurts the same as swapping them → quantity, not
   content, is what matters."
2. **The flip-*direction* split reported identical counts across the
   two arms** — 1208 evidence-loss and 560 distractor-removal flips,
   to the integer, on every dataset.

### Root cause

Both are structural, not data.

For **(1)**: with *random* pruning, the two arms must agree on any
per-kr aggregate. At a fixed keep-ratio both keep a uniformly random
subset of the same size, so they share an identical marginal
distribution and therefore identical expected accuracy. The only
thing nesting changes is the *coupling across keep-ratios within a
sample*, which is invisible to a per-kr aggregate. The ±0.004 wobble
is seed noise between two draws of the same distribution. Random
selection has **no content signal**, so the comparison cannot
distinguish "quantity vs. content" — there's no content axis to vary.

For **(2)**: the direction split inspects only the two endpoints
(kr=0.75 and kr=0.10), and both `RandomPruner` and
`NestedRandomPruner` seed per-sample from the same base seed (42).
At those two specific budgets they therefore draw *identical* token
subsets, so the endpoint-based direction counts are shared by
construction — not an independent replication.

### Fix

No code change — a reinterpretation, logged so the numbers aren't
oversold:

1. **The aggregate nested≈independent agreement is reframed as a
   passed consistency check**, not a result. (Had the arms diverged,
   that would have signalled the seeding accidentally correlating
   with token content — a real bug. They didn't. Good.)
2. **The identical direction counts are flagged as a shared-seed
   artifact**, not a second confirmation of the evidence-loss split.
3. **The real result lives in the per-sample, per-dataset gradient**
   (evidence-loss rate PMC-VQA 10.7% → PathVQA 4.4%), which *is*
   meaningful because it varies across datasets regardless of the
   pruning scheme — it's a property of the data, not the pruner.

### Notes / lessons

- **Ask what axis a comparison actually varies.** Two arms that
  differ only in a dimension your metric integrates over cannot
  produce an independent result on that dimension. The nested arm
  earns its keep at the *per-sample flip* level, not the aggregate.
- **Shared RNG seeds make "independent" runs identical at matched
  budgets.** Useful for reproducibility, but it means cross-arm
  agreement at those budgets is guaranteed, not evidence.

### Upstream

- [ ] Issue filed — _n/a, methodology lesson_
- [ ] PR opened — _n/a_
- [ ] Merged — _n/a_

---

## #10 — Degenerate FASP+GridPrune branch at kr=0.75 inflated the E3 table

<span class="pill pill--done">Resolved (data-integrity note)</span>

**Found** May 28, 2026 · **Severity** Medium (no crash; produced a
misleading "win" in the E3 results table) · **Upstream status**
_n/a — our composed method's own logic_

### What I observed

In the E3 sweep, the FASP+GridPrune kr=0.75 cell did two suspicious
things at once. Its **prune time was 0.58 ms** — essentially
Random's "do-nothing" cost (0.22 ms) and *cheaper* than plain
GridPrune (20.47 ms), when FASP+GridPrune should always cost *more*
than GridPrune (it runs FASP's anatomy filter on top of GridPrune's
zonal logic). At the other three keep-ratios it does cost more
(31.55 / 27.46 / 20.57 ms vs GridPrune's 20.52 / 18.58 / 9.58).
Only kr=0.75 inverted. And its **accuracy cell (0.6759) was the one
result that "beat" Random** (+0.13 pts) — out of step with every
other cell, where FASP+GridPrune loses to Random.

### Root cause

A short-circuit code branch, diagnosable entirely from the config.
The run used `bg_fraction = 0.3`: FASP designates 30% of tokens as
background and filters them out, leaving ~404 of 576 tokens as
foreground candidates. But at kr=0.75 the keep target is 432 tokens
— **more than the 404 the filter leaves.** When the keep target
exceeds the foreground budget, the zonal GridPrune stage has nothing
to select among (you're forced to keep all foreground), so the
method falls into a degenerate branch: keep all foreground, backfill
the remaining ~28 tokens from the discarded background, skip the
expensive zonal allocation entirely. That bypass is the 0.58 ms, and
the cell's accuracy was produced by that backfill branch — **not by
the real FASP+GridPrune algorithm.**

The trigger is exactly `keep_ratio > 1 − bg_fraction = 0.70`. Of the
four swept values only kr=0.75 sits above 0.70, which is precisely
where the anomaly appears. The arithmetic predicts it exactly.

### Fix

This is a data-integrity correction, not a code patch (the project
is pivoting away from pruning, so the branch itself isn't worth
re-engineering). The corrections to the analysis:

1. **The kr=0.75 FASP+GridPrune cell is flagged degenerate**
   wherever it appears (Experiments E3 table, Day 5 page) with an
   explicit footnote rather than silently dropped — transparency,
   and a clean illustration of the smell-test discipline.
2. **Of the 4 per-benchmark cells where FASP+GridPrune beat Random,
   3 were at kr=0.75** — all degenerate, all dropped. The one
   surviving real-path win is VQA-RAD at kr=0.25 (+3.59), a single
   cell already flagged as likely high-variance noise.
3. So on valid (non-degenerate) cells, FASP+GridPrune beats Random
   in **1 of 18** benchmark×kr comparisons. Removing the artifact
   makes the negative result *cleaner and stronger*.

If a true kr=0.75 point were needed for completeness, it's a cheap
re-run with `bg_fraction ≤ 0.20` (foreground ≥ 461 > 432, so the
real path fires) — but given the pivot, that's low priority.

### Notes / lessons

- **A smell-test on the latency table caught what the accuracy
  table hid.** The "win" looked like signal until the prune-time
  inversion flagged it as an artifact. Cross-checking two
  independent measurements (accuracy and timing) is what surfaced
  the degenerate branch.
- **Composed methods need guard-rail awareness.** Any time a method
  has a stage whose budget depends on a config fraction
  (`bg_fraction`), a keep-ratio above the complementary threshold
  silently changes which algorithm actually runs. Worth a logged
  warning at the branch in future implementations.

### Upstream

- [ ] Issue filed — _n/a, our own method_
- [ ] PR opened — _n/a_
- [ ] Merged — _n/a_

---

## #9 — "Verification-at-no-op" smoke-test antipattern

<span class="pill pill--done">Resolved</span>

**Found** May 26, 2026 · **Severity** High (gave false confidence
that the entire pruning framework was working) · **Upstream status**
_n/a — research-code methodology lesson_

### What I observed

On May 25 (Day 16), the new pruning framework was verified by a
"1,500-sample real-model match at `kr=1.0`" smoke test that confirmed
the patched model produced **100% identical predictions to the
unpatched baseline**. This was treated as strong evidence that
the patcher integration was correct. The framework was pushed at
[`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe)
and an overnight sweep launched.

On May 26 morning, the smell-test of the sweep showed
**bit-identical scores across all 8 configurations** — at every
keep-ratio, on every benchmark, for both QSim and Random. The
patcher had never actually pruned anything during the overnight
sweep. The kr=1.0 test had cleared, but the patch was attached to
a dead branch
([#7](#7-monkey-patching-vendor-forked-method-renames)) and the
sweep was a no-op.

### Root cause

A smoke test where the **system-under-test is a no-op by
construction** can never verify that the system fires when it
should. At `keep_ratio = 1.0`, *every* pruning algorithm is a no-op
— `argsort → top-K` where K equals the input length always returns
all the inputs. So "kr=1.0 matches baseline" verifies that the
patcher *doesn't corrupt anything when no tokens are dropped* —
which is a useful but insufficient property. It cannot distinguish
between two situations:

- **Patcher attached, pruning skipped because kr=1.0** (correct
  wiring, no-op by design)
- **Patcher attached to a dead branch, never executes during
  inference at all** (incorrect wiring, no-op by accident)

Both produce the same observable behavior: predictions identical
to baseline. The test passes either way.

### Fix

Two complementary structural changes:

1. **Replace kr=1.0 smoke tests with kr=0.5 smoke tests that
   require predictions to differ from baseline.** When the test
   is "did the model produce different outputs than the unpatched
   baseline?" rather than "did the model produce the same outputs?",
   no-op attachments are caught immediately. This is the test the
   May 25 framework needed and didn't have.
2. **Add an observability sentinel inside the patched code.** Print
   one line — `[PATCHER v2] first prune confirmed: seq X -> Y` —
   the first time the patched code actually executes during a run.
   Silent attachment is now distinguishable from silent execution.
   The sentinel only fires once per run (gated by a flag in
   `_STATE`) so it doesn't spam the log.

The v2 patcher
([`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249))
implements both: the once-per-run sentinel fires within the first
~30 seconds of a real eval, and the v2 sweep itself functions as
a kr-varying smoke test (results differ across configs → pruning
is firing).

### Notes / lessons

- **Designing a smoke test, ask: "what failure modes does this
  test rule out, and what failure modes does it leave open?"**
  The kr=1.0 test ruled out "patcher corrupts the model output"
  and left open "patcher never fires." The latter is the more
  common failure mode for monkey-patched research code.
- **Observability inside the patched code, not just at the patch
  site.** `patch_model()` prints "patcher applied" at attach time,
  but that print can succeed even when the patch attaches to a
  dead branch. A sentinel inside the patched code is the only
  thing that proves the patched code actually runs.
- **Test failure modes that match the deployment situation.**
  Pruning will always run with kr < 1.0 in deployment, so the
  smoke test should also exercise kr < 1.0. The "test what you
  ship" principle.

### Upstream

- [ ] Issue filed — _n/a, methodology lesson_
- [ ] PR opened — _n/a_
- [ ] Merged — _n/a_

---

## #8 — Frame mismatches between HF generate and the pruned state

<span class="pill pill--done">Resolved (v1); sidestepped by design (v2)</span>

**Found** May 26, 2026 · **Severity** High (caused two consecutive
CUDA crashes during the v1 fix cascade) · **Upstream status**
_n/a — design choice in HF transformers; our pruning approach has
to coexist with it_

### What I observed

After fixing the wrong-method monkey patch
([#7](#7-monkey-patching-vendor-forked-method-renames)) and getting
the v1 patcher to actually fire, the first sample completed
successfully but the **second sample crashed at decode step 0**:

```text
RuntimeError: CUDA error: device-side assert triggered
  [4D attention mask shape mismatch:
   expected (1, 1, 1, 346), got (1, 1, 1, 632)]
```

After fixing that, the third crash hit at decode step 1:

```text
RuntimeError: CUDA error: device-side assert triggered
  (rotary cos table index out of bounds:
   requested index 631, table size 346)
```

Both crashes are different surface symptoms of the same underlying
issue.

### Root cause

HuggingFace's `generate()` loop maintains state — `attention_mask`
length, `position_ids` values — **in the original prompt frame**,
i.e. computed from the unpruned prompt length. Our KV cache, after
layer-0 pruning, holds state **in the pruned frame**. At every
decode step, HF passes its unpruned-frame state into our
forward replacement, which then uses that state to index into our
pruned-frame structures (the 4D attention mask, the rotary cos/sin
tables, position_ids).

Concretely, with kr=0.5 on a 632-token prompt:

| Quantity | HF generate maintains | Our trunk needs |
| --- | --- | --- |
| Prompt length | 632 (original) | 344 (pruned) |
| `attention_mask.shape[-1]` after N decode steps | 632 + N | 344 + N |
| `position_ids` at decode | cumsum from unpruned mask: `[631, 632, ...]` | pruned-frame: `[344, 345, ...]` |
| Rotary cos/sin table size | n/a | 344 + N |

So at decode step 1, HF passes `position_ids = [632]` into a
forward replacement whose rotary table is 346 entries long → CUDA
index 632 into a length-346 tensor → out of bounds.

### Fix (v1)

Two reconciliations at the entry to the forward replacement:

1. **Slice the 2D attention mask** down to the last
   `past_key_values_length + seq_length` entries — bringing HF's
   unpruned-frame mask into our pruned frame before the 4D mask
   construction.
2. **Ignore HF's position_ids and recompute unconditionally** from
   `past_key_values_length` using
   `torch.arange(past_kv_len, past_kv_len + seq_len)`. This stays
   inside the pruned cache frame at every step.

Both fixes are inside v1's `Qwen2Model.forward` override and
preserved in
`pruning/archive/patcher_v1_post_layer0.py` as the canonical
record.

### Fix (v2 — by design)

**v2 sidesteps the entire category of bug** by pruning *before* the
LLM trunk runs. The patcher attaches to
`prepare_inputs_labels_for_multimodal_new` and slices the spliced
`inputs_embeds` to the pruned length. HF generate then constructs
`attention_mask`, `position_ids`, and the KV cache **from the
already-pruned sequence length**. There is no "original frame" to
reconcile against because HF generate never sees the original
frame. Frame consistency is structural, not maintained by ad-hoc
slicing.

This is why v2 dropped from 280 lines (v1) to 130 lines — most of
v1's complexity was managing frame consistency that v2 makes
unnecessary by construction.

### Troubleshooting trail

#### Step 1 — Smoke probe ran sample 0 cleanly; sample 1 hit a 4D-mask shape error

The mask construction inside `_prepare_4d_causal_attention_mask`
expects `attention_mask.shape[-1] == past_key_values_length +
seq_length`. HF passes a 2D mask in the unpruned frame; we'd already
sliced layer-0's KV cache to the pruned frame; the dimensions
mismatched at sample 1's decode step (sample 0 worked because
prefill has `attention_mask=None`).

Read the
[transformers 4.41 source for `Qwen2Model.forward`](https://github.com/huggingface/transformers/blob/v4.41.2/src/transformers/models/qwen2/modeling_qwen2.py)
to confirm the assumed invariant, then added the slice block at
the entry to the forward replacement.

#### Step 2 — Mask fix worked; new crash on `position_ids`

Now the 4D mask construction succeeded but the next decode step
hit the rotary OOB. HF computes `position_ids` from the 2D mask via
`cumsum - 1`; even though we'd sliced the mask for the 4D
construction, HF's `prepare_inputs_for_generation` had already
computed position_ids upstream from the *unsliced* mask.

Read the transformers `generate()` source's
`prepare_inputs_for_generation` path; confirmed position_ids comes
in already computed and we have no influence over it before this
point.

#### Step 3 — Decision: don't try to fix `position_ids` upstream; recompute it locally

The cleanest fix is to ignore the value HF passes and compute it
ourselves from `past_key_values_length`. This is unconditional —
the v1 forward replacement now always uses
`torch.arange(past_kv_len, past_kv_len + seq_len)` regardless of
what HF passed.

After this fix, v1 ran ~545 samples without crashing.

### Notes / lessons

- **HF generate's internal state is the source of truth from its
  perspective.** Modifying what the LLM trunk operates on
  mid-flight (which is what pruning inside `Qwen2Model.forward`
  is) creates an impedance mismatch that must be reconciled at
  every point HF generate's state crosses into our pruned trunk.
  Each reconciliation point is a potential bug surface.
- **The architectural cost of trunk-modification was the real
  finding.** Three bugs in v1 weren't independent — they were all
  instances of "HF generate maintains unpruned-frame state we
  have to reconcile with our pruned-frame trunk." Once we saw the
  pattern, v2's pre-LLM rewrite was the natural conclusion.
- **Published pre-LLM pruning methods (VisionZip, SparseVLM v1,
  FastV's k=0 mode) avoid this whole problem by construction.**
  We had to learn the hard way what they presumably learned the
  same way.

### Upstream

- [ ] Issue filed — _n/a; the design is HF's choice, our adaptation
      is the work_
- [ ] PR opened — _n/a_
- [ ] Merged — _n/a_

---

## #7 — Monkey-patching vendor-forked method renames

<span class="pill pill--done">Resolved</span>

**Found** May 26, 2026 · **Severity** High (caused the entire May
25 overnight sweep to silently be a no-op — 12 hours of compute
produced bit-identical baseline numbers across all 8 configurations)
· **Upstream status** _n/a — class of failure mode in
monkey-patch-based research code_

### What I observed

The May 25 pruning framework
([`c216bbe`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/c216bbe))
monkey-patched two methods on HuatuoGPT-Vision's model object:

```python
# pruning/patcher.py (May 25 version)
original = model.prepare_inputs_labels_for_multimodal  # records visual_span
model.prepare_inputs_labels_for_multimodal = wrapped
```

`patch_model()` ran without errors and printed
`patcher applied: pruner=QSim_mean_kr0.50`. The May 25 kr=1.0
smoke test passed (100% identical predictions, see
[#9](#9-verification-at-no-op-smoke-test-antipattern)). The
8-run sweep ran 12 hours overnight without errors.

On May 26 morning, the smell-test of the sweep showed:

```text
=== HuatuoGPT-Vision-7B__QSim_mean_kr0.10__scores.json ===
  total: 0.6787
=== HuatuoGPT-Vision-7B__QSim_mean_kr0.25__scores.json ===
  total: 0.6787
...
=== HuatuoGPT-Vision-7B__RandomPruner_kr0.75__scores.json ===
  total: 0.6787
```

**Every one of the 8 runs produced bit-identical scores, on every
dataset, including across QSim and Random methods.** Two methods
selecting completely different sets of tokens cannot produce
identical predictions — the patcher had never actually fired during
the overnight sweep.

### Root cause

HuatuoGPT-Vision **subclasses LLaVA's mixin and writes a custom
variant** of `prepare_inputs_labels_for_multimodal` named
`prepare_inputs_labels_for_multimodal_new`, then routes both
`forward` and `generate` through the `_new` variant:

```python
# HuatuoGPT-Vision/llava/model/language_model/llava_qwen2.py
def forward(self, ...):
    ...
    (
        input_ids, position_ids, attention_mask, past_key_values, inputs_embeds, labels
    # ) = self.prepare_inputs_labels_for_multimodal(   # original, now dead
    ) = self.prepare_inputs_labels_for_multimodal_new(  # actually called
        input_ids, position_ids, attention_mask, past_key_values, labels, images
    )

def generate(self, inputs, images, **kwargs):
    ...
    (
        ...
    ) = self.prepare_inputs_labels_for_multimodal_new(  # also _new here
        inputs, ...
    )
```

The original `prepare_inputs_labels_for_multimodal` still exists on
the class — it's inherited from the LLaMA mixin and never deleted —
but **nothing in HuatuoGPT-Vision's actual execution path calls it
anymore**. The commented-out reference (literally preserved in
their source as `# ) = self.prepare_inputs_labels_for_multimodal(`)
is a record of what they replaced when they forked.

The May 25 patcher attached its wrapper to the original method by
name. Class-level reflection (e.g. `dir(model)`) shows both methods
exist; nothing in standard introspection reveals that the original
is unreachable from the live code path. Silent attachment, silent
non-execution.

### Fix

One-line change to `patcher.py`, in two places:

```python
# Before
original = model.prepare_inputs_labels_for_multimodal
model.prepare_inputs_labels_for_multimodal = wrapped

# After
original = model.prepare_inputs_labels_for_multimodal_new
model.prepare_inputs_labels_for_multimodal_new = wrapped
```

After the fix, the patcher fires on the first sample of every run.
Confirmed via the sentinel
`[PATCHER] prepare_inputs called: visual_span=(5, 581)` printing
within the first ~15 seconds of inference.

### Troubleshooting trail

#### Step 1 — Confirm the issue is patcher-side, not eval-side

Two hypotheses for bit-identical scores: (a) eval harness caching
predictions across configs, or (b) patcher attaching silently but
never executing. Latency summaries showed identical p50/p95/mean
across all 8 runs *including at kr=0.1* — if pruning at kr=0.1
were firing, the LLM ops would drop substantially. Constant
latency was the smoking gun for hypothesis (b).

#### Step 2 — Add observability inside the patched code

Three diagnostic prints added: at the entry to the wrapper, at the
entry to the forward replacement, and after the actual pruning
step. A 90-second probe with the prints enabled — and **all three
prints stayed silent**. The wrapper never fired. Forward
replacement never fired. Yet `patch_model()` reported success.
This located the bug in attachment, not in pruning math.

#### Step 3 — Read HuatuoGPT-Vision's actual model code

The class subclasses `LlavaQwen2`. Opened
`HuatuoGPT-Vision/llava/model/language_model/llava_qwen2.py` and
searched for `prepare_inputs_labels`. Found:

```python
# ) = self.prepare_inputs_labels_for_multimodal(  # the original
) = self.prepare_inputs_labels_for_multimodal_new(  # what runs
```

The commented-out reference is the smoking gun — HuatuoGPT
explicitly forked the method, renamed it `_new`, and switched
both `forward` and `generate` to route through the new variant.
The original is dead code in this subclass.

#### Step 4 — Apply the one-line fix, re-probe

Changed two occurrences of `prepare_inputs_labels_for_multimodal`
to `prepare_inputs_labels_for_multimodal_new` in `patcher.py`.
The 90-second probe with prints enabled now showed:

```text
[PATCHER] prepare_inputs called: visual_span=(5, 581)
[PATCHER] forward called: seq_len=632, do_prune=True, ...
[PATCHER] pruning applied: seq 632 -> 344, visual 576 -> 288
```

All three prints firing. Patcher attached and executing.

### Notes / lessons

- **The killer of monkey-patch-based research code: patches that
  attach to methods that exist on the class but aren't called by
  anything in the real execution path.** This is what computer
  scientists call "action at a distance" — behavior is changing
  somewhere far from where the change is visible. Standard
  introspection (`dir(obj)`, `hasattr`) can't detect it because
  the method actually exists.
- **Always read the subclass before patching the mixin.** LLaVA's
  `LlavaMetaForCausalLM` mixin is the documented API. But
  HuatuoGPT-Vision (and many downstream forks) override mixin
  methods with custom variants, sometimes under different names.
  The mixin's documented method may be inherited but unreachable.
- **Patch attachment is not patch execution.** Always add a
  sentinel print **inside the patched code**, not just at attach
  time. The May 25 patcher printed "patcher applied" at attach
  but had no in-code observability — that gap is what made the
  no-op silent. The v2 sentinel pattern (one-per-run flag-gated
  print) is now the standard going forward.
- **A related shell-pipeline gotcha worth noting here** rather
  than as its own bug entry: the `tee` race condition. `tee` opens
  its output file at process start; if the path's directory
  doesn't exist yet (because the Python script's `os.makedirs`
  hasn't run), `tee` fails with `No such file or directory` but
  the rest of the pipeline keeps running and the result files
  still get written. The fix: put `mkdir -p "$OUTPUT_DIR"` inside
  the loop before the tee. Cheap defensive move; affected one
  run's log capture during the May 26 v2 sweep launch.
- **Vendor-fork renames are a recurring pattern.** HuatuoGPT did
  this in one place that mattered; other downstream forks
  (LLaVA-Next, LLaVA-Med v1.0 variants) likely do similar things.
  Worth budgeting time when adapting research code that
  monkey-patches a subclassed mixin.

### Upstream

- [ ] Issue filed — _n/a; the rename is HuatuoGPT-Vision's
      legitimate fork choice and not a bug in their code._
- [ ] PR opened — _n/a_
- [ ] Merged — _n/a_

---

## #6 — Wrong memory accounting for 8-bit AdamW

<span class="pill pill--done">Corrected</span>

**Found** May 16, 2026 &nbsp; · &nbsp; **Severity** Low (analytical
error, not a code bug — but it cost an iteration of fine-tuning
setup) &nbsp; · &nbsp; **Upstream status** _n/a — my mistake, lesson
logged_

### What I observed

While planning the 15-epoch VQA-RAD full fine-tune on a single 80 GB
A100, I worked out the memory budget for full-FT 7B in bf16:

- Parameters: 14 GB (7B × 2 bytes bf16)
- Gradients: 14 GB
- AdamW state (fp32 momentum + variance): 28 GB + 28 GB = **56 GB**
- Activations + workspace: ~5-8 GB
- **Total: ~89-92 GB → won't fit.**

To bring it down, I switched the optimiser to `bitsandbytes` 8-bit
AdamW (`--optim adamw_bnb_8bit`), claiming this would drop optimiser
state from 56 GB to ~12 GB. The run OOM'd anyway.

### Root cause (summary)

**8-bit AdamW saves substantially less than I told myself it would.**
`bitsandbytes.optim.AdamW8bit` quantises the first and second moments
to 8-bit (saving 28 GB of the 56 GB I'd counted), but **still keeps
fp32 master weights** (28 GB on its own — the optimiser holds an
fp32 copy of the model parameters as the source of truth, updates
those, and casts back to bf16 for the forward pass).

Real savings: 56 GB → 28 GB (master) + 7 GB (8-bit momentum) + 7 GB
(8-bit variance) = **42 GB**, not 12 GB. Net memory was therefore
~75 GB, which is right at the 80 GB cliff and OOMs the moment any
activation memory bumps up against it.

### Fix (applied)

The real fix for fitting 7B full-FT on 80 GB is **DeepSpeed Zero-2
with bf16 master weights** — `"bf16_optimizer": true` in the DS
config — which drops the master copy from 28 GB to 14 GB. That puts
the total at ~56 GB, with comfortable headroom for activations and
gradient checkpointing.

Switched the pipeline to DeepSpeed Zero-2 and dropped the bnb
8-bit AdamW (kept the package installed but the trainer no longer
uses it). This is the standard recipe for single-GPU full-FT on a
~7B model; should have been the first thing tried rather than the
fifth iteration.

### Notes / lessons

- **bf16 master weights are the lever, not 8-bit optimiser quant.**
  For full fine-tuning, the dominant cost is the master copy of
  parameters held by the optimiser, not the momentum/variance state.
  Halving master is worth more than 4× compressing the moments.
- **`adamw_bnb_8bit` is more useful when paired with LoRA or other
  parameter-efficient methods**, where the optimiser only updates a
  small subset of parameters and master-weight cost is small.
- **Sanity-check optimiser memory math** by reading the optimiser's
  source. `bitsandbytes/optim/adamw.py` makes the fp32 master
  explicit in a single line; ten minutes of reading would have saved
  an iteration.

### Upstream

n/a — this was an analytical mistake on my end. No external bug.

---

## #5 — LLaVA-Med v1.0: published per-dataset fine-tuned deltas are not paper-reproducible

<span class="pill pill--done">Documented finding</span>

**Found** May 16, 2026 &nbsp; · &nbsp; **Severity** Critical
(reproducibility gap in a widely-cited release) &nbsp; · &nbsp;
**Upstream status** _Documented locally; consider filing on
microsoft/LLaVA-Med after the FT-from-scratch attempt resolves
the open question_

### What I observed

Microsoft's LLaVA-Med v1.0 release publishes three per-dataset
fine-tuned delta weights on HuggingFace:

- `microsoft/llava-med-7b-vqarad-delta`
- `microsoft/llava-med-7b-slake-delta`
- `microsoft/llava-med-7b-pathvqa-delta`

The paper's Table 4 reports closed-form accuracy of ~0.84 (VQA-RAD),
~0.83 (SLAKE), and ~0.91 (PathVQA) for these fine-tuned variants.

After merging each delta with the documented base model (`huggyllama/llama-7b`,
the canonical ungated mirror of LLaMA-1 7B that v1.0 was trained on)
via `python -m llava.model.apply_delta` from the v1.0 repository,
evaluating against each dataset's test split:

- **VQA-RAD-merged** scored **0.21 closed** vs paper's ~0.84
  (63-point gap).
- **PathVQA-merged** scored similarly low (~0.20 closed) vs paper's
  ~0.91 (a comparable ~70-point gap).
- **SLAKE delta** is hosted as an *empty repository* on HuggingFace —
  there are no weights to download (discovered May 15).

In other words: **all three published per-dataset fine-tuned
artifacts are unusable for reproducing the paper's headline numbers.**

### Root cause (summary, by differential diagnosis)

Suspects, eliminated one at a time:

1. **The harness?** — Disproved by Suspect 4 below.
2. **The base LLaMA?** — Disproved by Suspect 4.
3. **The merge process?** — Disproved by Suspect 4.
4. **The published delta itself?** — The remaining suspect.

The decisive test was merging `microsoft/llava-med-7b-delta` (the
*stage-2 instruction-tuned* checkpoint, *before* per-dataset
fine-tuning) using the **same harness, the same base LLaMA, the same
`apply_delta` process**, and evaluating against VQA-RAD test. Result:
**0.58 closed**, within 8 pts of the paper's stage-2 zero-shot row
(~0.50, well inside stochastic-decode variance).

The stage-2 chain *works correctly*. Every component is sound. So the
only thing that differs between the working chain and the broken
chain is the per-dataset delta weights themselves. Those are
upstream of us and do not produce the paper number.

Reading `chunyl/finetune_on_benchmarks/` in the v1.0 repository for
the recipe that *would* produce the paper number revealed:

- **`fine_tuning_vqa_rad_7B.sh` is mislabeled.** Despite the name, it
  configures a **stage-1 projector-only training ablation** (single
  epoch, only the mm_projector trained, the LLM frozen). It's not
  the stage-3 full fine-tune that produces Table 4's numbers.
- **The "eval scripts" in the same directory all evaluate the
  stage-2 model, not per-dataset fine-tuned variants.** The
  uncommented `python llava/eval/model_vqa_med.py` invocations point
  at paths ending in `finetune_e2e_on_instruct-3epoch/` — that's the
  stage-2 checkpoint, not `vqa_rad-3epoch/` (which appears only in
  *commented-out* lines).

**The conclusion: the paper's Table 4 was produced by an internal
Microsoft training pipeline that was not open-sourced.** The public
release ships the stage-2 model + per-dataset deltas, but the deltas
do not match the paper's checkpoints, and no public script reproduces
them.

### Fix (planned)

Two paths forward, not mutually exclusive:

1. **Train per-dataset fine-tunes from stage-2 ourselves.** The
   paper documents the hyperparameters (15 epochs of full FT,
   `lr=2e-5`, cosine schedule, `bf16`, etc.). If our re-trained
   checkpoint reproduces ~0.84, we've confirmed the paper number is
   real and the published delta is the only broken artifact —
   pipeline built, smoke-test pending the DeepSpeed activation-policy
   fix.
2. **Adopt stage-2 zero-shot as the canonical v1.0 baseline.**
   Verified-correct (0.58 closed on VQA-RAD matches paper's stage-2
   row), available on HuggingFace, no fine-tuning required. Pruning
   experiments measured against this give clean, reproducible
   results.

Path 1 is the ambitious option; Path 2 is the certain option. The
project will pursue Path 1 as a Week-2 experiment; if it doesn't
reproduce, Path 2 becomes the canonical baseline.

### Notes / lessons

- **Reproduction-by-merge is a single point of failure.** A
  published delta with a single bit flipped is indistinguishable
  from a correctly published one until you actually run inference and
  check the number. Differential diagnosis (same chain, two
  endpoints, one known target) is the cheapest way to localise the
  fault.
- **"Eval scripts in the official repo" don't necessarily evaluate
  the model the paper reports on.** chunyl's eval scripts evaluate
  *stage-2*, not the per-dataset fine-tuned model that Table 4
  refers to. Always cross-check what an "official eval" actually
  loads.
- **This finding has citation value.** Any future paper or report
  comparing against LLaVA-Med v1.0's fine-tuned numbers should be
  aware that the published artifacts don't reproduce them. The
  comparison target literally doesn't exist as a downloadable file.

### Upstream

Considering filing as an issue on `microsoft/LLaVA-Med` after the
FT-from-scratch attempt finishes — if our re-trained checkpoint
reproduces, we have a clean question to ask Microsoft (*"these
deltas don't match your paper's numbers, here's what does"*). If our
re-train also fails to reproduce, the question becomes *"what
recipe actually produced Table 4?"*, which is a harder issue to
file but a more important one.

- [ ] Issue filed on microsoft/LLaVA-Med
- [ ] Microsoft response received

---

## #4 — LLaVA-Med v1.0's `model_vqa_med.py` missing trailing assistant role

<span class="pill pill--done">Patched locally</span>

**Found** May 16, 2026 &nbsp; · &nbsp; **Severity** Moderate (without
the fix, every prediction is structurally broken) &nbsp; · &nbsp;
**Upstream status** _Patched locally; will file when the more
substantial v1.0 findings are also ready_

### What I observed

When running v1.0's `model_vqa_med.py` against the merged VQA-RAD
checkpoint, every prediction started literally with the word
**`"Assistant:"`** and frequently looped back into another
`"Human:"` turn before stopping. Examples:

```
Q: is there evidence of an aortic aneurysm?
Pred: Assistant: There is no evidence of an aortic aneurysm. Human: is there any...
```

The structural breakage made closed-question matching essentially
useless — the metric saw a hallucinated multi-turn dialogue, not an
answer.

### Root cause (summary)

In `llava/eval/model_vqa_med.py`'s prompt construction, the v1.0
conversation template builds a multi-turn `Human: ... Assistant: ...`
sequence — but the reference code **does not append the trailing
`Assistant:` role** to the prompt before generation. So the model
sees a prompt ending in the user's question, and dutifully *completes
as if it were the user*: it generates `Assistant: <answer>` (literally
writing the role label), then continues into another `Human:` turn
because that's the multi-turn pattern it was trained on.

The fix is one line in the prompt-construction path: ensure the
prompt ends with `"Assistant:"` (without trailing whitespace, which
the conversation template handles) before being passed to `generate()`.

### Fix (applied locally)

In `eval/runner.py`'s `_build_prompt` function, append the assistant
role explicitly after the user turn:

```python
conv.append_message(conv.roles[0], question_with_image_tokens)
conv.append_message(conv.roles[1], None)   # trailing assistant role
prompt = conv.get_prompt()
```

After the fix, predictions are coherent answers without the
`"Assistant:"` literal prefix, and don't loop into a hallucinated
second turn:

```
Q: is there evidence of an aortic aneurysm?
Pred: There is no evidence of an aortic aneurysm
```

### Notes

- The v1.5 (Mistral) conversation template handles this implicitly —
  `mistral_instruct` ends with the assistant turn marker by design.
  v1.0's `simple` template doesn't, which is the reason this affects
  v1.0 only.
- Every published v1.0 evaluation script in `llava/eval/` that uses
  the `simple` conv template has this same omission. Anyone
  reproducing v1.0 zero-shot evals from the public scripts will hit
  the same bug — it's repository-wide.

### Upstream

- [ ] Issue filed on microsoft/LLaVA-Med
- [ ] PR opened
- [ ] Merged

---

## #3 — VQA-RAD HuggingFace mirror dropped the `answer_type` field; loader heuristic mislabels closed questions

<span class="pill pill--done">Fixed & verified</span>

**Found** May 14, 2026 &nbsp; · &nbsp; **Severity** Moderate (silently
wrong evaluation labels) &nbsp; · &nbsp; **Upstream status** _n/a — a
data-mirror limitation, worked around locally_

### What I observed

While investigating why the E00 baseline closed-ended accuracy looked
low, noticed the closed/open split of the VQA-RAD test set didn't match
the original paper — the harness reported 251 closed / 200 open, but
the original VQA-RAD test set is closer to 272 closed / 179 open. The
~21-question discrepancy was concentrated in "which side?",
"left or right?", "what modality?"-type questions: genuinely
closed-ended questions that were being scored as open.

### Root cause (summary)

The harness loads VQA-RAD from the HuggingFace Parquet mirror
(`flaviagiammarino/vqa-rad`). That mirror's schema is only
`image` / `question` / `answer` — **the original dataset's
`answer_type` field was dropped in the mirroring**.

To compensate, the loader had an `_infer_answer_type` heuristic:
answer is "yes"/"no" → closed, otherwise → open. But VQA-RAD's real
`answer_type` is assigned by **question intent, not answer format**. A
"what modality is this?" question with the answer "CT" is labeled
`CLOSED` in the original dataset, but the yes/no heuristic tags it
`open`. The labels are simply not derivable from the answer string —
so the heuristic was structurally guaranteed to mislabel a chunk of
the test set, which then got scored with the wrong metric
(open-ended recall instead of closed-ended accuracy).

### Fix (applied & verified)

A two-part fix:

1. **Build a real-label lookup.** A one-time script reads the original
   VQA-RAD distribution (`VQA_RAD Dataset Public.json`, 2,248 records)
   and builds a `(question, answer)` → `answer_type` lookup, saved as
   `answer_type_lookup.json` beside the dataset.
2. **Rewrite the loader to use it.** `_infer_answer_type` is demoted to
   a fallback-only path; the loader now assigns real labels by joining
   on a normalised `(question, answer)` key, and *loudly reports* how
   many questions missed the lookup (a clean join → no warning; a high
   fallback count → the labels can't be trusted).

The join matched **450 of 451** test samples (99.8%); the 1 unmatched
pair fell back to the heuristic, which happened to label it correctly.
The closed/open split corrected from 251/200 to the real **272/179**.

### Troubleshooting trail

#### Step 1 — Confirmed the field was genuinely absent

Inspected the Parquet schema directly — only `image`, `question`,
`answer`. No `answer_type` column hiding under a different name. The
mirror really did strip it.

#### Step 2 — Confirmed the heuristic was unfixable in principle

Considered just improving the heuristic (add "left/right", numeric
answers, etc. as closed patterns). Rejected it: that's hand-tuning a
heuristic to match a count, which is circular, and the real labels
depend on question intent that the answer string doesn't carry. Decided
to get ground-truth labels from the original distribution instead.

#### Step 3 — Built the lookup, hit a collision problem

First attempt keyed the lookup on **question text alone**. That
produced **6 collisions** — the same question string mapped to two
different `answer_type` labels. Root cause: VQA-RAD asks the same
question about *different images* (2,248 questions over only ~315
images), and `answer_type` was annotated per (question, image) pair.

#### Step 4 — Switched to a `(question, answer)` key

Re-keyed the lookup on `(question, answer)` together. Rationale: for a
given question, different images yield different answers, so the answer
acts as a proxy for the image — and since `answer_type` is itself
determined by the answer, keying on the answer keys on exactly the
determinant of the value being retrieved. Result: 2,248 records →
2,086 unique keys, **0 collisions**. Also handled 5 numeric answers
via `str()` coercion.

#### Step 5 — `NameError: name 'json' is not defined`

First run of the patched loader crashed: the new
`_load_answer_type_lookup` function calls `json.load`, but the
original `vqa_rad.py` only ever used `pyarrow` and had no
`import json`. One-line fix — added the import. Logged here because
"new helper function introduced a new import" is an easy omission to
repeat.

#### Step 6 — Verified the join in isolation

Ran the loader's isolation test (the same `len()` + sample-fields +
closed/open-count check used when the loader was first written).
Result: 450/451 join, the loud fallback counter correctly flagged the
1 miss, and the closed/open split shifted to 272/179 — matching the
independently-observed ~21-question discrepancy. Only then was E00
re-run.

### Notes / lessons

- **Dataset mirrors are not the dataset.** A HuggingFace mirror can
  silently drop fields the original has. When a derived label looks
  wrong, check the original distribution's schema before trusting any
  reconstruction heuristic.
- **A heuristic tuned to match a target number is circular.** If a
  real ground-truth source exists, the extra hour to join against it
  buys a label you can actually trust.
- **Pick the join key that matches the determinant of what you're
  looking up.** Question-text alone was too coarse; `(question,
  answer)` collapsed the collisions to zero because the answer is what
  actually determines `answer_type`.
- **Make the join fail loud.** The loader counts and prints every
  lookup miss — a quietly-wrong label set is worse than a crash,
  because it produces a plausible-looking but invalid baseline.

### Upstream

n/a — this is a limitation of a third-party data mirror, not a bug in
LLaVA-Med or any project dependency. Worked around locally by sourcing
real labels from the original VQA-RAD distribution.

---

## #2 — `pip install --force-reinstall` cascaded and clobbered the NGC-pinned stack

<span class="pill pill--done">Recovered</span>

**Found** May 13, 2026 &nbsp; · &nbsp; **Severity** High (container
broken, ~30 min recovery) &nbsp; · &nbsp; **Upstream status** _n/a —
self-inflicted; lesson logged_

### What I observed

I needed to read VQA-RAD and PathVQA parquet files to verify sample
counts. The `datasets` Python library wasn't in the container, so I
ran:

```bash
pip install datasets==2.16.1 --force-reinstall
```

The install completed but emitted dozens of dependency-conflict
warnings. After the install, importing `torch` showed a brand-new
version, importing `llava` failed entirely, and any GPU work would
have crashed.

### How to reproduce it (don't)

Inside the NGC PyTorch 23.10 container with the project's pinned
LLaVA-Med stack installed, run:

```bash
pip install datasets==2.16.1 --force-reinstall
```

The `--force-reinstall` flag is the trigger: it tells pip to
reinstall the named package **and all its transitive dependencies**,
pulling latest versions of everything in the chain. In a freshly-built
NGC container that has a finely-tuned `torch` build pinned to a
specific CUDA/cuDNN/NCCL combination, this is catastrophic.

### Root cause (summary)

`pip install --force-reinstall <pkg>` does not respect the existing
pinned environment. The dependency resolver sees the full transitive
tree of `<pkg>` and reinstalls everything — even packages where the
already-installed version was correct and intentional. In this case:

- `torch 2.1.0a0+32f93b1` (NGC-built, CUDA 12.2) was replaced by
  `torch 2.12.0` from PyPI (CUDA 13).
- The new `torch 2.12.0` was binary-incompatible with the existing
  `flash-attn 2.3.6` (built against the old torch).
- `bitsandbytes` was replaced with a CPU-only build that's missing
  `triton.ops`.
- `nvidia-cuda-runtime-13` was pulled in even though the host
  driver only supports CUDA 12.4.
- The user-local `~/.local/lib/python3.10/site-packages/` directory
  was now shadowing the container's system site-packages, so even
  packages that hadn't been touched (`transformers`, `accelerate`)
  were resolving to whatever pip had just dropped into `~/.local/`.

The error message stream after the install included:

```
torch-tensorrt 0.0.0 requires torch<2.3.0,>=2.1.0.dev, but you have torch 2.12.0
torchdata 0.7.0a0 requires torch==2.1.0a0+32f93b1, but you have torch 2.12.0
torchtext 0.16.0a0 requires torch==2.1.0a0+32f93b1, but you have torch 2.12.0
transformer-engine 0.12.0+170797 requires flash-attn<=2.0.4,>=1.0.6, but you have flash-attn 2.3.6
```

— a clear sign that the install had crossed into territory it
shouldn't have.

### Fix (applied)

The cleanest recovery path is **rebuild the container from the
Dockerfile**, since that guarantees a known-good state. But the
container-rebuild process on KUBERUN takes ~5 minutes per cycle, and
the downloaded datasets and model weights live on `/data` (a mount)
which survives rebuilds anyway.

I tried a faster surgical recovery first and it worked:

```bash
# 1. Wipe the user-local site-packages directory that pip
#    polluted. The container's system site-packages (where the
#    NGC-built torch lives) is untouched.
rm -rf ~/.local/lib/python3.10/site-packages/

# 2. Restart the Python kernel (close and reopen the Jupyter terminal)
#    so any cached imports are cleared.

# 3. Verify the environment is sane.
python -c "
import torch
print('torch:', torch.__version__)
print('CUDA available:', torch.cuda.is_available())
import transformers; print('transformers:', transformers.__version__)
"
```

Output after the wipe:

```
torch: 2.1.0a0+32f93b1
CUDA available: True
transformers: 4.36.2
```

— the NGC-pinned versions are back. The only remaining problem was
that `llava` couldn't import (its editable-install registration files
got deleted along with everything else under `~/.local/`). One-line
fix:

```bash
cd ~/LLaVA-Med
pip install -e . --no-deps
```

The `--no-deps` matters: without it, pip would re-resolve the
dependency tree from the `pyproject.toml` pins and could pull `torch`
again. With `--no-deps`, pip only registers the editable package and
trusts that the existing dependencies are correct.

After this, everything imported cleanly and inference worked again.

### Troubleshooting trail

Documenting every step so future-me (and future readers) can follow
the recovery logic:

#### Step 1 — Recognised the install was a regression

Read the output of the `pip install` command and noticed the dozens
of `requires X, but you have Y` lines, plus the
`Successfully installed ... torch-2.12.0` line. PyTorch shouldn't
have been in that "successfully installed" list — it was already
present and pinned.

#### Step 2 — Confirmed the breakage

Tried to import `torch` and check the version:

```python
import torch
print(torch.__version__)
# 2.12.0  <-- wrong! should be 2.1.0a0+32f93b1
```

Tried `import llava`:

```
ModuleNotFoundError: No module named 'llava'
```

Both confirmed: container is broken.

#### Step 3 — Considered options

Two possible recovery paths:

1. **Rebuild the container** (cleanest, ~5 minutes downtime). On
   KUBERUN, this restarts the VM with a fresh container from the
   same image. `/data` is mounted, so downloaded data survives.
2. **Surgical cleanup** (faster if it works, risky if it doesn't).
   Manually identify and remove the polluting packages.

Tried surgical first because the downtime was annoying. Would have
fallen back to rebuild if it didn't work.

#### Step 4 — Identified the pollution layer

Critical insight: pip installs by default go to **`~/.local/lib/python3.10/site-packages/`**
(the user site-packages directory), not the container's system
site-packages (typically `/usr/local/lib/python3.10/dist-packages/`).
Python prefers user site-packages over system ones, so the polluted
`~/.local/` was shadowing the NGC builds.

Meaning: **the NGC-built torch was still on disk**, just hidden by
the bad versions in `~/.local/`. Wiping `~/.local/` should expose it
again.

#### Step 5 — Wiped and verified

```bash
rm -rf ~/.local/lib/python3.10/site-packages/
```

(Closed and reopened the Jupyter terminal to flush any cached
imports.)

Re-ran the verification script: `torch 2.1.0a0+32f93b1`, CUDA
available, transformers 4.36.2. The NGC stack was back.

#### Step 6 — Reinstalled the LLaVA-Med editable package

`llava` still didn't import because its `egg-info` registration
metadata had been deleted along with everything else under
`~/.local/`. Reinstalled with `--no-deps` so pip wouldn't try to
"fix" dependencies and re-trigger the regression:

```bash
cd ~/LLaVA-Med
pip install -e . --no-deps
```

After this, `import llava` worked, and a quick CLI inference test
produced coherent output. Full recovery confirmed.

#### Step 7 — Read the parquet files without `datasets`

The original reason for the install was to read parquet files.
**`pyarrow` is already in the NGC image** and reads parquet directly:

```python
import pyarrow.parquet as pq
import glob

for split in ["train", "test"]:
    files = sorted(glob.glob(f"/data/dan/dataset/vqa_rad/data/{split}-*.parquet"))
    total = sum(len(pq.read_table(f)) for f in files)
    print(f"{split}: {total} samples")
```

No new package installs needed. Sample counts verified, work
continued.

### Notes / lessons

- **Never use `pip install --force-reinstall` in a Dockerfile-pinned
  environment.** The NGC images are precisely tuned; pip will happily
  destroy that tuning if asked.
- **The correct flag for adding a single new package without
  touching dependencies** is `pip install --no-deps <pkg>`. This is
  what should have been used here.
- **Even better than `--no-deps`: don't add the dependency at all
  if a lighter-weight alternative exists.** `pyarrow` was already in
  the image and could read parquet directly; pulling in the entire
  `datasets` library (and its transitive 30+ packages) was overkill.
- **The user-local site-packages layer is a useful escape hatch.**
  Because pip defaults to installing in `~/.local/` rather than the
  container's system directories, you can wipe `~/.local/` to
  recover from many install mistakes without rebuilding the
  container. This wouldn't work if pip ever installed with
  `--user=false` or `sudo`, but for normal `pip install` it does.
- **Action item — add `datasets` to the Dockerfile** so it's
  installed at image-build time with the rest of the pinned stack,
  rather than tempting fate at runtime in future container sessions.

### Upstream

n/a — this was a self-inflicted error from running the wrong pip
command. No upstream issue to file. The lesson is recorded here for
future container sessions.

---

## #1 — `llava.serve.cli` stops generation immediately for the Mistral variant

<span class="pill pill--done">Patched locally</span>

**Found** May 11, 2026 &nbsp; · &nbsp; **Severity** Moderate (works only
with a one-line patch) &nbsp; · &nbsp; **Upstream status** _not yet
filed — patch ready, planning a PR to `microsoft/LLaVA-Med`_

### What I observed

When running `llava.serve.cli` against `llava-med-v1.5-mistral-7b`, the
model emitted effectively one token per turn — a single word or
fragment, then immediately stopped. The CLI looped and accepted the
next user input, but every response was truncated to a single token.

Direct inference outside the CLI returned coherent paragraphs, so the
model and weights were fine; the bug was in the CLI's generation
path.

### How to reproduce it (pre-fix)

```bash
cd ~/LLaVA-Med

python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png \
    --conv-mode mistral_instruct
```

**Expected** — a coherent paragraph describing the image.

**Actual** — a single word (or one short token), then the CLI re-prompts
for the next user input.

### Root cause (summary)

In `llava/serve/cli.py`, inside the main `while True:` loop, the
stopping criterion is built with:

```python
stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
keywords = [stop_str]
stopping_criteria = KeywordsStoppingCriteria(keywords, tokenizer, input_ids)
```

For the `mistral_instruct` template, the conversation object has
`sep_style = SeparatorStyle.LLAMA_2`, `sep = ''`, and `sep2 = '</s>'`.
Because `LLAMA_2 != TWO`, the conditional picks `conv.sep` — the
empty string. So `stop_str = ''` and `keywords = ['']`.

`KeywordsStoppingCriteria` then halts generation after the very first
token, because the empty string is trivially contained in any decoded
prefix. The "single-token output" symptom is really the model being
interrupted at step 1.

### Fix (applied locally, May 11 2026)

One-line change in `llava/serve/cli.py`:

```diff
- stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
+ stop_str = conv.sep2 if conv.sep_style in (SeparatorStyle.TWO, SeparatorStyle.LLAMA_2) else conv.sep
```

The new conditional picks `sep2` for both LLAMA-2-family separator
styles (which keep the real terminator in `sep2` and leave `sep`
empty), and falls back to `sep` for everything else. After applying,
the CLI returns full multi-token responses for
`llava-med-v1.5-mistral-7b`, and multi-turn conversation works as
expected.

### Notes

This restores correct stopping for `mistral_instruct` without
breaking the older Vicuna-based templates whose `sep` is non-empty.

- The bug only manifests for templates where `sep == ''`. Older
  LLaVA-Med v1.0 (Vicuna-based) used templates where `sep` was the
  real terminator and `SeparatorStyle.TWO` was the right special case
  — which is presumably why the original conditional was written that
  way and never caught. The Mistral migration in v1.5 introduced the
  empty-`sep` case without updating the CLI.
- Worth checking whether downstream LLaVA-derived forks inherited the
  same logic.

### Upstream

- [ ] Filed as a GitHub issue on `microsoft/LLaVA-Med` → _link_
- [ ] Pull request opened → _link_
- [ ] PR merged → _date_

---

## Template for new bug entries

Copy the block below, paste it above the previous bug, and renumber.

```markdown
## #N — Short title

<span class="pill pill--wip">In progress</span>

**Found** _date_ · **Severity** _x_ · **Upstream status** _x_

### What I observed
### How to reproduce it
### Root cause (summary)
### Fix
### Troubleshooting trail
   #### Step 1 — ...
   #### Step 2 — ...
### Notes
### Upstream
- [ ] Issue filed
- [ ] PR opened
- [ ] Merged
```
