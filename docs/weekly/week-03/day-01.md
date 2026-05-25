# Day 1 — Sunday, May 24, 2026

[← Back to Week 3 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) → **closing out** · Week 3,
Day 1 · **Day 15 of the project**

---

Pivot validation day. Resumed after a 2-day gap (May 22-23) during
which the Qwen2.5-VL weights finished downloading in the background.
The day's job: confirm the new stack actually works end-to-end, run
the decision-validating MCQ-letter compliance test, and reorganize
the project's repos to reflect the LLaVA-Med v1.0 → Qwen2.5-VL
transition. All three landed cleanly.

The headline: **Qwen2.5-VL-7B-Instruct scored 20/20 strict MCQ-letter
compliance** on a 20-sample VQA-RAD smoke test, against LLaVA-Med
v1.0's 0/11 on the equivalent test on May 20. The pivot is
validated; the path to VLMEvalKit / lmms-eval is open.

## Phase 1 — Weight integrity check

Picked up where Day 5 ended — the safetensor download had been
stuck on file 4 of 5 at end-of-day, with three possible
explanations (real stall, reporting artifact, already past
download). Before running anything that depends on the weights,
verify the download actually completed cleanly.

Inventory in `/data/dan/weights/hub/models--Qwen--Qwen2.5-VL-7B-Instruct/`:

```
=== Total size ===
16G     /data/dan/weights/hub/models--Qwen--Qwen2.5-VL-7B-Instruct
=== Per-shard sizes ===
3.7 GB  model-00001-of-00005.safetensors
3.6 GB  model-00002-of-00005.safetensors
3.6 GB  model-00003-of-00005.safetensors
3.6 GB  model-00004-of-00005.safetensors
1.1 GB  model-00005-of-00005.safetensors
=== Config / tokenizer / processor files ===
chat_template.json          1.1K
config.json                 1.4K
generation_config.json      216
merges.txt                  1.6M
model.safetensors.index.json  57K
preprocessor_config.json    350
tokenizer.json              6.8M
tokenizer_config.json       5.6K
vocab.json                  2.7M
```

All five shards present, sizes match the expected Qwen2.5-VL-7B
bf16 footprint (~15.6 GB raw weights + ~400 MB metadata), every
config/tokenizer/processor file accounted for. Download cleanly
completed — the "stuck on file 4" at end of Day 5 was a reporting
artifact (parallel downloads not refreshing per-file display), not
a real stall.

**Small gotcha worth noting:** the first version of the inventory
`find` command used `-type f`, which filters out everything in
HuggingFace's `snapshots/` directory. HF stores model files as
**symlinks** (`-type l`) in `snapshots/` pointing to the real bytes
in `blobs/`. So the first listing looked like every config file
was missing. Fix: either follow symlinks (`-L find ...`) or list
the snapshot directory directly with `ls -L`. False-alarm noise,
but worth remembering for next time.

## Phase 2 — Model load smoke test (Step 2)

Standalone load diagnostic, inline `python << 'EOF'` heredoc in the
JupyterLab terminal:

??? note "`load_smoke_test.py` — what the heredoc does"

    No inference. Just verifies that `transformers` can find the
    `Qwen2_5_VLForConditionalGeneration` class (no `KeyError:
    'qwen2_5_vl'` — which is what would happen if the transformers
    pin in the container were too old), that the weights load
    from cache without re-downloading, that the model lands on the
    GPU in bf16 with `flash_attention_2` as the attention impl
    (with SDPA as a fallback if flash-attn fails), and that the
    parameter count matches the published 8.3B.

    ```python
    import os, time, torch
    from transformers import (
        Qwen2_5_VLForConditionalGeneration,
        AutoProcessor,
    )

    MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"

    print(f"torch: {torch.__version__}, CUDA: {torch.version.cuda}")
    print(f"GPU:   {torch.cuda.get_device_name(0)}")

    # Try flash_attention_2; fall back to sdpa if it doesn't load.
    for attn in ("flash_attention_2", "sdpa"):
        try:
            t0 = time.time()
            model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                MODEL_ID,
                torch_dtype=torch.bfloat16,
                device_map="cuda:0",
                attn_implementation=attn,
            )
            print(f"loaded with {attn} in {time.time()-t0:.1f}s")
            break
        except Exception as e:
            print(f"failed with {attn}: {e}")

    processor = AutoProcessor.from_pretrained(MODEL_ID, use_fast=True)

    n_params = sum(p.numel() for p in model.parameters()) / 1e9
    alloc    = torch.cuda.memory_allocated()  / 1e9
    print(f"params: {n_params:.2f}B  ·  GPU alloc: {alloc:.2f} GB")
    print(f"attn:   {model.config._attn_implementation}")
    print(f"dtype:  {model.dtype}  ·  device: {model.device}")
    print(f"tokenizer: {type(processor.tokenizer).__name__}")
    print(f"image:     {type(processor.image_processor).__name__}")
    ```

**Output (cleaned):**

```
torch: 2.8.0a0+5228986c39.nv25.06, CUDA: 12.9
GPU:   NVIDIA A100 80GB PCIe
loaded with flash_attention_2 in 8.8s
params: 8.29 B
GPU alloc: 16.64 GB
attn:   flash_attention_2
dtype:  torch.bfloat16  ·  device: cuda:0
training mode: False
tokenizer: Qwen2TokenizerFast
image:     Qwen2VLImageProcessor
Load smoke test PASSED.
```

Everything in range: 8.29B parameters (expected ~8.3B including the
vision encoder), 16.64 GB GPU allocated (plenty of headroom on the
80 GB A100 for KV cache during generation), `flash_attention_2`
loaded successfully — no fallback to SDPA needed. The
`Qwen2TokenizerFast` + `Qwen2VLImageProcessor` confirm both the
tokenizer and image processor come up with the expected classes.

8.8 second cold load is acceptable; subsequent loads from cache
should be faster.

## Phase 3 — MCQ-letter compliance smoke test (Step 3)

The decision-validating test of the whole pivot. **Why this matters:**
on May 20, we ran an equivalent test against the merged LLaVA-Med
v1.0 weights and got **0/11 strict compliance** — not a single
response even started with a letter. The model produced verbose
biomedical prose ignoring every form of MCQ-letter instruction. That
result is what triggered the model swap on May 21. The whole pivot
hangs on Qwen2.5-VL doing better on the same test.

### Test setup

20 random yes/no closed questions from the VQA-RAD test parquet,
reformatted as MCQ:

```
[image attached]
Question: <original question>
A. yes
B. no
Answer with the option's letter from the given choices directly.
```

Greedy decoding (`do_sample=False`), `max_new_tokens=16`, seed=42
for the sample selection. The A/B option-order is shuffled per
sample (also seeded) so the model can't trivially pass by always
outputting "A."

### Result

**20/20 strict MCQ-letter compliance.** Every single response was
exactly `A.` or `B.` followed by a brief explanation. Zero
extraction failures, no need for a fallback letter-extraction
regex.

Side observations from the same 20-sample run, not the point of the
test but interesting:

- **15/20 letter-correct (75%).** Prediction distribution: 11 A
  responses / 9 B responses — no obvious yes/no bias. The 5
  errors are all opposite-letter mistakes (e.g., "A. yes" when GT
  was "B. no"), not format failures.
- For context: LLaVA-Med v1.0's published-method closed accuracy on
  VQA-RAD is in the 50-65% range (substring-bug-inflated, per
  Day 5's finding); Qwen2.5-VL's reported VQA-RAD closed numbers
  in the literature are in the 65-75% range. The 75% smoke-test
  number is in the right ballpark — not a benchmark result (20
  samples is tiny), but a positive directional signal.

### Two warnings observed but not blocking

The smoke test printed two transformer warnings between the load
line and the per-sample rows:

1. **`use_fast` defaults to slow PIL-based image preprocessing**
   because Qwen2.5-VL ships its preprocessor metadata in the legacy
   format. Will be the default in transformers v4.48; we explicitly
   opt in with `AutoProcessor.from_pretrained(MODEL_ID,
   use_fast=True)` for a ~5-10% speedup on VQA-RAD (more on larger
   datasets). Minor floating-point differences from the kernel
   implementation, doesn't affect generation.
2. **`temperature=1e-6` (Qwen2.5-VL's baked-in
   `generation_config.json` default) triggers a warning under
   `do_sample=False`** because sampling parameters are meaningless
   in greedy decoding. Purely cosmetic — greedy ran as intended.

Both are silenced in the polished version of the script (Phase 5).

### What this validates

The pivot from LLaVA-Med v1.0 to Qwen2.5-VL-7B-Instruct is the
right call:

- ✅ Standard HuggingFace transformers code path — no custom fork,
  no `apply_delta` merge dance, no monkey-patching.
- ✅ Instruction-following is compatible with MCQ-letter scoring,
  which is what every modern evaluation harness (VLMEvalKit,
  lmms-eval) uses for closed-set medical VQA.
- ✅ Closed-set scoring will work without the substring-bug
  workarounds Day 5's investigation required.

## Phase 4 — Repo reorganization (with a detour)

With the pivot validated, the project's git layout needs to reflect
the new structure. The LLaVA-Med v1.0 code is frozen; new work is
all Qwen2.5-VL. Two clean options:

- **Option A: single repo with subdirectories** — rename
  `llava-med-pruning-v1` to `medical-vlm-pruning`, move existing
  v1.0 code into a `llava_med_v1/` subfolder, start a `qwen25vl/`
  subfolder for new work.
- **Option B: two separate repos** — freeze `llava-med-pruning-v1`
  as-is, create a fresh `medical-vlm-pruning` for the
  Qwen2.5-VL track.

Started with Option A (rename + `git mv` the existing
files into `llava_med_v1/`, create empty `qwen25vl/`). Got partway
through and then reverted — Option B is cleaner for three reasons:

1. **No accidental contamination.** With the subfolder layout, it's
   easy to accidentally import from `llava_med_v1/` into Qwen2.5-VL
   code, smuggling in dependencies (LLaVA-Med harness, candidate
   files, hook architecture) that don't apply to the new model.
2. **Cleaner CI / install story.** A future viewer cloning either
   repo gets exactly the dependencies they need without the other
   model's stack polluting the import path.
3. **No cognitive overhead from a layout we don't yet need.** The
   Qwen2.5-VL track may grow to support multiple medical VLMs
   (HuatuoGPT-Vision, etc.), at which point a multi-model layout
   makes sense. But that's a forward-looking concern, not a
   today-concern.

### Reverting Option A

The Option A migration had been staged via `git mv` but never
committed (`git status` showed `Your branch is up to date with
'origin/main'` with pending `renamed:` entries). HEAD remained at
`14a62d3` from May 21.

Undo path:

```bash
git reset --hard HEAD            # discard the staged renames
mv llava_med_v1/results . ; mv llava_med_v1/*.log .    # restore root files
rm -rf qwen25vl/                 # remove the empty new-track skeleton
```

Clean undo because nothing had been committed yet — no history
rewrite, no force-push needed. `llava-med-pruning-v1` returns
exactly to its end-of-Day-5 state.

### Reverting the GitHub repo rename

The GitHub-side rename to `medical-vlm-pruning` had to be reverted
too. Settings → General → Repository name → renamed back to
`llava-med-pruning-v1`. GitHub treats repo renames as fully
reversible; redirects work in both directions during the rename, so
the historical commit URLs from Days 1-14 footers (which point at
`.../llava-med-pruning-v1/tree/<hash>`) kept resolving correctly
throughout. The name `medical-vlm-pruning` is now free for the new
repo.

## Phase 5 — Freezing `llava-med-pruning-v1`

Final commit on the v1.0 repo: prepend a frozen-status notice to the
README pointing at the new repo and the progress site. No code
changes. The freeze block:

```markdown
> **🧊 FROZEN — 2026-05-24**
>
> This repository contains the LLaVA-Med v1.0 reproduction work from
> May 10–21, 2026. The project pivoted to Qwen2.5-VL-7B-Instruct on
> May 21 after identifying two unreproducibility issues with v1.0: a
> substring-match bug in the closed-set scorer that inflated reported
> accuracy, and 0/11 MCQ-letter compliance on an instruction-following
> smoke test that blocked use of standardized evaluation harnesses.
> No further commits are planned here.
>
> Active project work continues at:
> **[Leokuan0208/medical-vlm-pruning](https://github.com/Leokuan0208/medical-vlm-pruning)**
>
> Day-by-day progress lives on the
> [project progress site](https://github.com/Leokuan0208/question-aware-vtp-medvlm).
```

Committed on top of `14a62d3`, pushed. The repo's earlier state
(everything through May 21) remains intact at `14a62d3`; the freeze
is purely a status notice, not a code change. The repo is now
officially closed.

## Phase 6 — Initializing `medical-vlm-pruning`

Created on GitHub via the web UI (no auto-initialization of
README/.gitignore/license, so the first local push isn't rejected
for unrelated histories). Then initialized locally at
`~/medical-vlm-pruning/`:

```
~/medical-vlm-pruning/
├── .gitignore          # patterns copied from the old repo
├── README.md           # cross-links to the frozen repo and progress site
├── scripts/
│   └── .gitkeep
├── pruning/
│   └── .gitkeep
└── eval/
    └── .gitkeep
```

Flat layout — three top-level dirs (`scripts/`, `pruning/`, `eval/`)
instead of any model-specific subfolder. Gitignored `results/` for
runtime artifacts (regenerable, doesn't belong in the repo).
`.gitkeep` placeholders so the empty directories exist in git.

`.gitignore` patterns copied from the old repo are
**depth-agnostic** (no leading `/`, so they match at any nesting
depth), which keeps them applying as the tree grows. Git identity
set per-repo to `Leokuan0208 / d38963968@gmail.com` to match the
existing config from `llava-med-pruning-v1`.

Initial commit pushed to `main`.

## Phase 7 — First real artifact: `mcq_compliance_smoke.py`

The smoke test from Phase 3 promoted from a one-off heredoc to a
committed script under `scripts/`. The polished version differs from
the heredoc in three ways:

1. **`use_fast=True` on the processor** — silences the slow-processor
   warning and uses the torchvision-v2 compiled image ops instead of
   PIL. Minor floating-point differences from the kernel
   implementation; no behavioral change in the smoke test.
2. **Explicit `GenerationConfig(do_sample=False, max_new_tokens=16,
   temperature=None)` passed to `model.generate()`** — overrides
   the model's baked-in `temperature=1e-6` default and silences the
   `do_sample / temperature` mismatch warning. Output unchanged
   since both configs are greedy.
3. **`--output-dir` / `--no-output` flags** — per-sample results
   plus a summary plus timing now written by default to
   `results/mcq_compliance_smoke_<timestamp>.json` (gitignored —
   the artifact lives on disk for reference but doesn't pollute the
   repo with run outputs).

Re-ran the polished script:

```
Loading Qwen/Qwen2.5-VL-7B-Instruct...
[20 sample lines, each "A." or "B." + brief explanation]
strict MCQ compliance: 20/20 (100.0%)
letter correct:        15/20 (75.0%)
Wrote: results/mcq_compliance_smoke_20260524_HHMMSS.json
```

Identical to the heredoc run (seed=42, greedy, deterministic), no
warnings in the output between the loading line and the per-sample
rows. Committed.

## Honest ledger of the day

A milestone day. Three things land:

1. **🎯 Pivot validated.** 20/20 strict MCQ-letter compliance on
   Qwen2.5-VL-7B-Instruct vs. LLaVA-Med v1.0's 0/11 on May 20. The
   binary signal we needed. The path to VLMEvalKit / lmms-eval as
   the standardized evaluation backbone is open.
2. **Two-repo separation done cleanly.** `llava-med-pruning-v1`
   frozen with a status-notice commit on top of `14a62d3`,
   `medical-vlm-pruning` initialized fresh with a flat layout.
   Brief Option A detour (rename + subfolder layout) reverted
   without leaving any tracked state behind. Historical commit
   URLs from Days 1-14 keep resolving thanks to GitHub's
   bidirectional rename redirects.
3. **First Qwen2.5-VL artifact committed.** `mcq_compliance_smoke.py`
   landed in the new repo's `scripts/` directory; polished version
   silences both transformer warnings and writes durable per-run
   JSON output for reproducibility.

What's not in scope yet — and is tomorrow's work — is the actual
research question. The smoke test confirms Qwen2.5-VL is *capable*
of MCQ-letter output, but the project's central question is whether
question-aware visual token pruning beats random pruning on
Qwen2.5-VL. The next step is VLMEvalKit setup: a clean, standardized
evaluation backbone, then a real baseline number on the full 272
canonical VQA-RAD closed questions, then porting the `random` and
`qsim` pruning methods from the frozen v1.0 codebase onto
Qwen2.5-VL's decoder layers.

---

### Plan for tomorrow (May 25, Day 16 / Week 3 Day 2)

- [ ] Install **VLMEvalKit** into the container, pinning a specific
      version for reproducibility
- [ ] Wire up Qwen2.5-VL as a VLMEvalKit model, pointing it at the
      cached weights path so it doesn't re-download
- [ ] Run VLMEvalKit on **VQA-RAD closed** — full 272-question
      canonical closed set (from `answer_type_lookup.json`; the
      May 14 work pays off here). This produces our
      **unpruned-baseline number** that all pruning experiments
      will be measured against
- [ ] If time allows, repeat for **SLAKE** and **PathVQA** closed
- [ ] Start sketching the Qwen2.5-VL port of `RandomPruning` and
      `QuestionSimilarityPruning` — the hook target changes from
      `LlavaLlamaModel.model.layers` to Qwen2.5-VL's decoder
      layers, but the scoring math is the same

---

## Pushed today

Two repos touched, three commits total — but no single repo state
worth singling out the way prior days have. Summary:

**[`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)**
— **frozen.** One final commit on top of `14a62d3` adds the
frozen-status notice to the README. No code changes. No further
commits planned. Latest commit:
[`e092251`](https://github.com/Leokuan0208/llava-med-pruning-v1/commit/e0922519b57e5e36485b030447cf9f56abf75260).

**[`medical-vlm-pruning`](https://github.com/Leokuan0208/medical-vlm-pruning)**
— **new repo.** Two commits: an initial skeleton (`.gitignore`,
cross-linking README, three empty `scripts/ pruning/ eval/` dirs
with `.gitkeep`s), and the `scripts/mcq_compliance_smoke.py`
artifact from Phase 7. The active project work continues here.
Latest commit:
[`04f7dc8`](https://github.com/Leokuan0208/medical-vlm-pruning/commit/04f7dc8675a5f9242caa376ebb24600dee4a1311).
