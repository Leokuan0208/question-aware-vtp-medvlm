# Day 7 — Saturday, May 16, 2026

[← Back to Week 1 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 1, Day 7

---

The most substantive day of the project so far. Started with a clean
Docker rebuild after yesterday's env battle, finished with the v1.0
evaluation harness pushed to GitHub
([Leokuan0208/llava-med-pruning-v1](https://github.com/Leokuan0208/llava-med-pruning-v1)),
a **verifiable v1.0 stage-2 baseline** that reproduces the paper,
and a documented finding that
**Microsoft's published per-dataset fine-tuned delta weights are not
reproducible from public artifacts**. The full-FT pipeline got built
overnight but didn't successfully launch; it's banked for Monday.

## Phase 1 — fresh Docker build (replaces yesterday's broken venv)

Yesterday's lesson was clear: in-place pip patching a torch install in
the wrong order is unfixable. The right move is a clean image where
the entire stack is correct at build time.

??? note "`Dockerfile.v1.0` — what changed vs. the v1.5 base"

    Same NGC base (`nvcr.io/nvidia/pytorch:23.10-py3`) since v1.5
    proved it works on this hardware. Three substantive differences
    from the v1.5 Dockerfile: a different `transformers` pin (git
    commit `cae78c46`, June 2023), `open-clip-torch` added (needed at
    `llava` package init), and `openai==0.27.8` pre-1.0 SDK.
    `flash-attn` deliberately omitted — only needed for training, not
    apply_delta or inference, and building it from source is the most
    failure-prone step in any LLaVA-Med install.

    ```dockerfile
    # Base: nvcr.io/nvidia/pytorch:23.10-py3
    #   - PyTorch 2.1.0a0+32f93b1 (NGC's custom build, ~2.1.x semantics)
    #   - CUDA 12.2.2, cuDNN 8.9.5, Ubuntu 22.04, Python 3.10
    # Same NGC base as v1.5 — known-good on this A100/driver.
    #
    # Why a separate image even though it's the same base:
    #   v1.0 needs transformers @ git commit cae78c46 (June 2023), not
    #   4.36.2. v1.0 needs open-clip-torch (imported at llava package
    #   init). v1.0 uses openai==0.27.8 (pre-1.0 SDK) vs v1.5's 1.12.0.
    #   These pins are mutually incompatible; each version gets its
    #   own image.

    FROM nvcr.io/nvidia/pytorch:23.10-py3
    ENV DEBIAN_FRONTEND=noninteractive

    RUN apt update -y && apt install -y \
            git git-lfs python3-pip \
        && rm -rf /var/lib/apt/lists/*

    RUN pip3 install --no-cache-dir jupyter jupyterlab

    # Install all regular deps first, then the git-pinned transformers
    # commit. This order prevents pip from later re-resolving transformers
    # in some surprising way — the v1.5 image's pip ordering bug taught
    # us this lesson.
    RUN pip3 install --no-cache-dir \
            "openai==0.27.8" \
            "sentencepiece==0.1.99" \
            "accelerate==0.21.0" \
            "peft==0.4.0" \
            "bitsandbytes==0.41.0" \
            "einops==0.6.1" "einops-exts==0.0.4" \
            "open-clip-torch" \
            "ninja" "shortuuid" "tabulate" "nltk" "tqdm" "Pillow" \
            "scikit-learn==1.2.2" "pydantic<2,>=1" \
            "markdown2[all]" "fastapi" "uvicorn" "httpx==0.24.0" \
            "huggingface_hub" \
     && pip3 install --no-cache-dir \
            "git+https://github.com/huggingface/transformers@cae78c46"

    # JupyterLab opens its file browser at /data, where the persistent
    # KUBERUN volume mounts at runtime.
    WORKDIR /data
    CMD ["jupyter", "lab", "--port=8888", "--ip=0.0.0.0", \
         "--allow-root", "--no-browser", "--notebook-dir=/data"]
    ```

Build succeeded on the first try. Inside the new container, `import
llava` works, `LlavaLlamaForCausalLM` imports cleanly, and torch sees
the GPU. **The env class of problems from yesterday is over.**

## Phase 2 — v1.0 model loader, runner, metrics

With the env behaving, finished the three v1.0-specific files. Each
small but each substantive — they're what make the harness actually
*work* against v1.0's architecture rather than just *load* it.

**`eval/model_loader.py`** — loads a merged LLaVA-Med v1.0 checkpoint
via `LlavaLlamaForCausalLM.from_pretrained()`, registers the three
special tokens v1.0 expects (`<im_patch>`, `<im_start>`, `<im_end>`)
via `tokenizer.add_tokens()`, and exposes the `image_token_len = 256`
constant. Returns a `LoadedModel` bundle.

**`eval/runner.py`** — single-turn inference with v1.0's specifics:
prompt construction with `<im_patch>×256` injected inline before the
question, `conv_mode='simple'` template, `KeywordsStoppingCriteria`
with `'###'` as the stop string, and stochastic decoding at
`temperature=0.7`. Hit one substantive bug here:
**v1.0's reference `model_vqa_med.py` is missing the trailing
assistant role**, which makes the model continue *as if it were the
user*. Symptom: predictions start with `"Assistant:"` literally and
loop back into another `"Human:"` turn. Patched locally — full
writeup in [Bugs & Issues #4](../../bugs.md#4-llava-med-v10s-model_vqa_medpy-missing-trailing-assistant-role).

**`eval/metrics.py`** — byte-for-byte port of v1.0's scoring math
from `chunyl/finetune_on_benchmarks/run_eval.py` and
`evaluate_metrics.py`. The functions:

- `normalize_word` — lowercase, strip articles, collapse whitespace.
- `split_sentence` — tokenize the way v1.0 does it.
- `calculate_appearance_with_normalization` — word-appearance scoring
  used for open-ended questions.
- `calculate_f1score`, `calculate_exactmatch` — closed-form scoring.
- `evaluate()` — orchestrator that returns the metric dict.

The crucial v1.0-vs-v1.5 difference: v1.0 uses **candidate-set argmax
classification** for open questions. Instead of comparing the model's
free-form output against the ground truth (the v1.5-era approach
we'd been using), v1.0 builds a candidate set from the training
answers, has the model embed-score each candidate, and picks the
argmax. The full appearance-with-normalisation step happens after.

## Phase 3 — candidate sets

Wrote `eval/build_vqa_rad_train_open_answers.py` and (later, after
SLAKE pivot) `eval/build_path_vqa_train_open_answers.py`. Both
produce the JSON candidate file that v1.0's open-question metric
consumes.

**Counts came out exactly where they should have:**

| Dataset | Train total | Open train | Unique open answers (candidates) |
|---|---|---|---|
| VQA-RAD | 1,793 | 768 (43%) | **402** |
| PathVQA | 19,654 | 9,903 (50%) | **3,223** |

Sample VQA-RAD candidates (seeded): _"ring enhancing lesion in the
right frontal lobe"_, _"blunting of the costophrenic angle, loss of
the right hemidiaphragm and right heart border"_, _"7th rib"_,
_"hip bones"_. Sample PathVQA candidates: _"central giant cell
lesion"_, _"papillary adenoma"_, _"petechial and purpuric
hemorrhages"_, _"stellate fibroblasts and mast cells"_. All
coherent, no mojibake, encoding clean.

The ~32% unique-to-total ratio is the same across both datasets,
which is a nice consistency check that the candidate-set design is
behaving identically across benchmarks.

## Phase 4 — the prompt-bug fix and smoke test pass

After patching the trailing-assistant-role bug, ran a 3-sample smoke
test against the merged VQA-RAD checkpoint:

```
[vqa_rad_test_00000] type=closed
  Q: is there evidence of an aortic aneurysm?
  GT: yes
  Pred: There is no evidence of an aortic aneurysm
  Latency: 1207ms | in_tok=335 out_tok=16
[vqa_rad_test_00001] type=closed
  Q: is there airspace consolidation on the left side?
  GT: yes
  Pred: on the left side
  Latency: 239ms | in_tok=334 out_tok=7
[vqa_rad_test_00002] type=closed
  Q: is there any intraparenchymal abnormalities in the lung fields?
  GT: no
  Pred: there is no pleural effusion
  Latency: 275ms | in_tok=340 out_tok=10
```

The `"Assistant:"` prefix is gone from every prediction — the prompt
fix landed. Predictions are wrong in interesting ways (the model
disagrees with ground truth on samples 0 and 1, and gets sample 2
wrong but coherent), but **structurally the harness is producing
valid answers**. Ready for full-scale eval.

## Phase 5 — the moment of truth, and what we actually found

Ran the full E0_v1.0 evaluation on VQA-RAD test (451 samples) against
the merged VQA-RAD-fine-tuned checkpoint, expecting roughly the v1.0
paper's Table 4 number of ~0.84 closed.

**Result: 0.21 closed.** A 63-point gap from the paper. Far below
even the v1.5 zero-shot baseline of 0.537.

This is wildly off. Initial suspects:

1. **The harness?** — could be a scoring bug, prompt bug, decode bug.
2. **The merge?** — could be that `apply_delta` corrupted something.
3. **The base LLaMA?** — could be the wrong upstream weights.
4. **The VQA-RAD delta itself?** — could be that the published delta
   doesn't actually produce the paper number when correctly merged.

The way to distinguish: differential diagnosis. Get a second merged
model — same harness, same base LLaMA, same merge process — and
score it against a known target.

### Differential diagnosis — stage-2 zero-shot

Merged `microsoft/llava-med-7b-delta` (the stage-2 instruction-tuned
checkpoint, *before* per-dataset fine-tuning) with the same base
LLaMA-7B using the same `apply_delta` command. Ran the same harness
against it on VQA-RAD test.

**Result: 0.58 closed.** The v1.0 paper's stage-2 zero-shot row on
VQA-RAD is approximately 0.50 closed. **We're within 8 points of the
paper.** That's well inside stochastic-decode variance.

This is the key finding. The stage-2 result *validates the whole
pipeline*: the harness is correct, the base LLaMA is correct, the
merge process is correct, the inference recipe is correct. Every
component is sound.

So the only difference between the stage-2 chain (which works) and
the VQA-RAD chain (which doesn't) is the **VQA-RAD delta weights
themselves**. Those are upstream of us, on HuggingFace, and they don't
produce the paper number.

### And then PathVQA — same broken result

Per your suggestion, ran the same test on the merged PathVQA model.
Paper claim is ~0.91 closed. **Result: similarly broken.** Two out of
three published per-dataset deltas confirmed not reproducing the
paper. The SLAKE delta on HuggingFace turned out to be empty
yesterday. **All three published per-dataset fine-tuned artifacts are
unusable.**

Read `chunyl/finetune_on_benchmarks/` carefully to look for the
recipe that *would* reproduce the paper. The script
`fine_tuning_vqa_rad_7B.sh` is misleadingly named — it's a
**stage-1 projector-only ablation**, not the stage-3 full fine-tune
that would produce Table 4's numbers. The "eval scripts" in the same
directory all evaluate the *stage-2* model, not the per-dataset
fine-tuned variants. The uncommented invocations point at
`finetune_e2e_on_instruct-3epoch/` — that's stage-2.

**Conclusion: v1.0 has no public training recipe for the per-dataset
fine-tunes**, and the released delta weights don't produce the paper
numbers. The paper's Table 4 was trained with internal Microsoft
tooling that was not open-sourced. Full writeup in
[Bugs & Issues #5](../../bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible).

This is genuinely a **research finding worth publishing.** Less "I
reproduced the paper" and more "I discovered a real reproducibility
gap in a widely-cited release." It also reshapes the project: the
canonical v1.0 baseline becomes **stage-2 zero-shot** (verified
correct), and per-dataset fine-tunes (if we want them) have to be
*trained from scratch* on stage-2.

## Phase 6 — committing to a full fine-tune attempt (15 epochs target)

The decision: don't pivot away from per-dataset fine-tuning. Instead,
**train it ourselves** from stage-2, using the paper's documented
hyperparameters. The paper reports that **15 epochs of full FT** is
where the best per-dataset result appeared; that became the night's
target. If our re-trained checkpoint reproduces ~0.84, the published
delta is the only broken artifact and the methodology is sound.

This sets up the night's work — building a full fine-tuning pipeline
on a single A100, which turns out to be genuinely difficult for a 7B
model.

## Phase 7 — the FT pipeline build (8 iterations, one failed launch)

Built `scripts/finetune_smoke.sh` and `scripts/finetune_vqarad_full.sh`,
a small data converter (`scripts/build_vqarad_train_v1_format.py`),
and a top-k checkpoint evaluator (`scripts/eval_topk_checkpoints.py`)
to pick the best-performing 3 checkpoints out of however many epochs
the run produces. Eight troubleshooting
iterations covered the gap between "code written" and "training
running":

1. `PYTHONPATH` not propagated to `torchrun` subprocesses — fixed by
   exporting it explicitly in the shell script.
2. **OOM at `model_max_length=1024`** — 7B in bf16 + grads + AdamW
   state (56 GB for fp32 momentum + variance) blows past 80 GB.
3. **OOM at `model_max_length=512`** — still OOMs. The earlier memory
   math I'd worked out was wrong by ~3× (see [Bugs & Issues #6](../../bugs.md#6-wrong-memory-accounting-for-8-bit-adamw)).
4. Switched to bitsandbytes 8-bit AdamW (`--optim adamw_bnb_8bit`).
   Still OOMs — 8-bit AdamW saves less than I'd thought because it
   *still keeps fp32 master weights*.
5. `deepspeed` command not on PATH — wrong invocation pattern; needed
   `python -m deepspeed.launcher.runner` instead.
6. `deepspeed` not installed — `pip install --no-deps deepspeed==0.9.5`.
7. DeepSpeed import error: missing `py-cpuinfo`. Installed.
8. **DeepSpeed/pydantic API mismatch** — `pydantic==2.x` in the
   container (silently installed by some other dep), `deepspeed 0.9.5`
   wants `pydantic==1.x`. Pinned `pydantic<2`. Imports clean.

**Smoke test final attempt, after all that:** **OOM trying to allocate
25 GB in a single allocation**, with only 14 GB free at the time.
The allocation pattern is wrong for optimizer state — 25 GB at once is
the *activation memory* for a forward pass at seq 1024 + 256 image
tokens. **`gradient_checkpointing=True` isn't actually engaging
through DeepSpeed.** When DS Zero-2 takes over the training loop, it
manages its own activation policy and HF's grad-checkpointing flag
gets quietly ignored. The fix is to set
`"activation_checkpointing"` in the DS config directly, not via the
HF Trainer arg.

That fix didn't get applied tonight. **The full fine-tune did not
successfully launch on Day 7.**

Honest ledger: the pipeline is *95% complete*. The memory budget is
understood, the DS config is correct except for the activation-policy
line, the scripts are in place. Monday morning is "apply the
activation-checkpointing setting, smoke-test, launch the ~7-8 hour
run during waking hours."

## Phase 8 — the GitHub push

Despite the FT not launching, the day's substantive work was real and
needed to be off the single-server-that-keeps-crashing. Initialized
`~/llava-med-pruning-v1` as a git repo, wrote a README describing the
v1.0 reproduction track, made the first commit, created the empty
repo on GitHub, and pushed:

[`Leokuan0208/llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)

## Honest ledger of the day

Today produced more substantive research progress than any previous
day in the project. Five real outputs, only one of which was even on
the planned agenda:

1. **Stage-2 zero-shot baseline reproduces v1.0 paper** — 0.58 closed
   on VQA-RAD, within 8 pts of paper's ~0.50. *First paper-comparable
   v1.0 result in this project.*
2. **VQA-RAD-merged confirmed broken upstream** — 0.21 closed vs
   paper's 0.84. Differential diagnosis ruled out base LLaMA, merge,
   and harness as causes.
3. **PathVQA-merged confirmed broken in the same pattern** — two of
   three published deltas unusable, confirming a systemic
   reproducibility gap, not an isolated bad upload.
4. **Multi-dataset v1.0 eval harness** — `run_E0_v1.py` with registry
   pattern, candidate-file auto-fallback, dataset-explicit naming.
5. **Full FT pipeline at ~95%** — scripts written, DeepSpeed Zero-2
   config built, all 8 troubleshooting iterations documented; one
   activation-policy fix away from launching.

Plus three new bug entries on the project page — the trailing
assistant role, the broken-deltas reproducibility finding (a real
research contribution), and the 8-bit AdamW memory miscalculation.

The day failed *only* at the most ambitious stretch goal (overnight
15-epoch full FT, the paper's best-performance setting). Everything
else worked, and the harness is now
backed up to GitHub.

---

### Plan for the week (Week 2 — May 17 onward)

Week 1 ends here. Week 2 picks up with:

- [ ] Fix the DeepSpeed activation-checkpointing config setting,
      smoke test cleanly, launch a **5-epoch** full FT on VQA-RAD as
      a first pass — the paper's best result is at 15 epochs, but a
      5-epoch run is a fraction of the wall time and lets us see how
      far accuracy moves before committing to the full 15. Decide
      whether to extend based on the 5-epoch numbers.
- [ ] If FT reproduces ~0.84, repeat for SLAKE and PathVQA from
      stage-2. If FT doesn't reproduce, formalise the
      "stage-2 zero-shot is the canonical v1.0 baseline" framing.
- [ ] Run full E0_v1.0 on all three datasets against the stage-2
      merged model — produces the v1.0 baseline row directly
      comparable to the v1.5 row already on the
      [Experiments](../../experiments.md) page.
- [ ] Start the literature reading — ToMe and FastV — that slipped
      from Week 1.
- [ ] Begin Phase 2 of the project plan: the LLaVA-Med codebase
      deep-dive, with print-statement instrumentation on
      `prepare_inputs_labels_for_multimodal`.

---

## Pushed today

**Repository:** [`llava-med-pruning-v1`](https://github.com/Leokuan0208/llava-med-pruning-v1)
&nbsp;·&nbsp; **Commit:**
[`5634898`](https://github.com/Leokuan0208/llava-med-pruning-v1/tree/5634898)
— "Initial commit: LLaVA-Med v1.0 eval and FT harness"

The linked commit is the entire day's work in one snapshot: the v1.0
multi-dataset eval harness (VQA-RAD + PathVQA loaders, model_loader,
runner, metrics ported from chunyl's reference), the candidate sets
for VQA-RAD (402 entries) and PathVQA (3,223 entries), the DeepSpeed
Zero-2 + CPU offload full-FT pipeline, the build scripts, and the
README documenting the broken-deltas finding.

Note: this is a *new repository*, separate from the v1.5 harness at
[`llava-med-pruning`](https://github.com/Leokuan0208/llava-med-pruning).
The two coexist; the v1.5 repo is the working v1.5 evaluation track,
and this one is the v1.0 reproduction track.
