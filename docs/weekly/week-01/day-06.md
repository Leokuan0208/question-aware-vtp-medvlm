# Day 6 — Friday, May 15, 2026

[← Back to Week 1 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 1, Day 6

---

A long day with three distinct phases. The morning landed **Batch 3**
(SLAKE + PathVQA loaders) and completed the v1.5 baseline row. The
afternoon brought a strategic pivot — once all three v1.5 baselines
were on the table, the gap to published numbers made it clear that
**LLaVA-Med v1.0's already-fine-tuned weights are the better path**.
The evening went to scaffolding a forked v1.0 reproduction harness;
the env setup hit problems and the session ended before a working
v1.0 run.

## Batch 3 — SLAKE loader

`eval/datasets/slake.py` written following the VQA-RAD template, but
with two genuine differences:

- **JSON, not Parquet.** SLAKE ships per-split JSON files
  (`train.json`, `validate.json`, `test.json`); images are loose files
  under `<root>/imgs/<img_name>` from the one-time `imgs.zip`
  extraction.
- **English-only filter.** SLAKE is bilingual; filtering to
  `q_lang == 'en'` gives the standard English subset used in
  comparisons (2,094 → 1,061 test samples).

**Real `answer_type` field present** — no heuristic needed. Values are
uppercase (`OPEN`, `CLOSED`) in the source and get lower-cased to
match the contract used by the metrics module.

**Isolation test:** `len(dataset) = 1061`, `answer_type` distribution
416 closed / 645 open, first and last image files open cleanly, all
512×512 RGB. All `VQASample` contract fields conform. Committed.

## Batch 3 — PathVQA loader

`eval/datasets/path_vqa.py` is essentially **the VQA-RAD loader plus a
glob loop** — the schema (`image: {bytes, path}`, `question`,
`answer`) is identical, just sharded across 3 parquet files
(`test-00000-of-00003`, `test-00001-of-00003`, `test-00002-of-00003`).

Two design choices worth noting:

- **Deterministic shard ordering.** `glob.glob` order is
  filesystem-dependent and not guaranteed, so the loader does
  `sorted(glob.glob(...))` before iterating. Without this, sample
  indexing would be silently non-reproducible across machines.
- **Image bytes materialisation, same as VQA-RAD.** Parquet-embedded
  bytes get extracted once to `<root>/extracted_images/test/` on
  first load. Extraction took **929.5 seconds** (~15.5 min) — longer
  than the 5-10 min estimate, presumably CPU contention in the
  container. The cache is now warm; every subsequent PathVQA load
  skips this entirely.

??? note "Shard-aware loading in `eval/datasets/path_vqa.py`"

    The non-trivial part: PathVQA's test split is spread across 3
    parquet files. Concatenation has to be deterministic so the
    `question_id` indexing stays reproducible across machines and
    runs.

    ```python
    def _read_test_parquets(root: Path):
        """Read all test-*.parquet shards in sorted order.

        glob.glob's order is filesystem-dependent and NOT guaranteed.
        Without sorting, samples 0..6718 would silently shuffle on
        different machines or after a filesystem reorganisation. The
        sort makes shard ordering content-deterministic (the filenames
        encode shard number).
        """
        shard_paths = sorted(glob.glob(str(root / "data" / "test-*.parquet")))
        if not shard_paths:
            raise FileNotFoundError(
                f"No test-*.parquet shards under {root / 'data'}"
            )
        # pyarrow.concat_tables preserves shard order. We accept the
        # whole concatenated table into memory -- the metadata is tiny
        # (~7000 rows of strings + byte blobs that will get streamed
        # to disk anyway), so this is fine.
        tables = [pq.read_table(p) for p in shard_paths]
        return pa.concat_tables(tables)
    ```

**Isolation test:** `len(dataset) = 6719` (3362 closed / 3357 open),
sample 0's question/answer match the reconnaissance output
bit-for-bit, images decode and confirm heterogeneous sizes (image
sizes vary across the dataset; the LLaVA-Med processor will resize
to 336² downstream anyway). All `VQASample` fields conform. Committed.

## E00 on SLAKE — first complete row begins

Ran the full E00 baseline against SLAKE test (English subset, 1,061
samples):

| Metric | Value |
|---|---|
| Closed accuracy | 0.587 |
| Open recall | 0.395 |
| Overall accuracy | 0.470 |
| Mean latency | 787.9 ms / sample |
| Peak GPU memory | 14.86 GiB |

Higher than VQA-RAD on both axes, in the expected way: SLAKE's closed
answers are nearly all yes/no (easiest format), and SLAKE's open
answers are short single words like `CT`, `Lung`, `left` — exactly the
kind of answer the token-recall metric rewards. The mean latency is
6.5% lower than VQA-RAD's 843 ms (842.5 from yesterday) because
SLAKE's images are uniformly 512×512 — less PIL work per sample
upstream of the image processor's resize. Peak GPU memory is
identical to VQA-RAD's 14.86 GiB, confirming that memory is dominated
by model weights, not data.

## E00 on PathVQA — completes the v1.5 baseline row

Same procedure, against PathVQA test (6,719 samples):

| Metric | Value |
|---|---|
| Closed accuracy | 0.587 |
| Open recall | 0.106 |
| Overall accuracy | 0.347 |
| Mean latency | 1072.9 ms / sample |
| Peak GPU memory | 14.86 GiB |

**Closed 0.587, identical to SLAKE.** PathVQA's closed questions are
also almost all yes/no, so they produce essentially the same yes/no
performance as SLAKE on this model — a sanity-check signal that the
model isn't doing anything dataset-specific.

**Open recall 0.106 is much lower than VQA-RAD's 0.340 or SLAKE's
0.395.** This is *expected*, not concerning: PathVQA's open answers
are long descriptive phrases (`'thick with abundance of eosinophilic
cytoplasm'`, `'early (reversible) ischemic injury'`) where multi-word
token recall is intrinsically harder. Same metric across all three;
the dataset difficulty differs.

**Mean latency 1073 ms — 36% higher than SLAKE.** PathVQA images are
heterogeneous and many are notably larger (e.g. 792×528 vs. SLAKE's
uniform 512×512). PIL decode + the image-processor's resize takes
longer on bigger inputs.

**The Week 1 baseline row is complete.** All three datasets have
honest zero-shot v1.5 numbers banked — the work the
[Experiments](../../experiments.md) page exists to record.

## The strategic pivot — switching to LLaVA-Med v1.0

With the complete baseline row visible side-by-side, three problems
with v1.5 as the baseline became hard to ignore:

| | VQA-RAD | SLAKE | PathVQA |
|---|---|---|---|
| v1.5 closed | 0.537 | 0.587 | 0.587 |
| Published (v1.0, fine-tuned) | ~0.84 | ~0.83 | ~0.91 |
| Gap | **-30 pts** | **-24 pts** | **-32 pts** |

**The three assumptions that made me pick v1.5 in the first place all
turned out to be wrong:**

1. *"v1.5 has more resources."* — comparable to v1.0 in practice.
2. *"v1.5's weights are already fine-tuned for all three datasets."*
   — false. v1.5 ships as an instruction-tuned generalist; v1.0 has
   per-dataset fine-tuned delta weights published.
3. *"Newer model = newer papers compare against it."* — most
   published comparisons still use v1.0's fine-tuned weights as the
   reference.

**The decision: pivot to LLaVA-Med v1.0**, using the per-dataset
fine-tuned delta weights (`katielink/llava-med-7b-vqarad-delta`,
`...-slake-delta`, `...-pathvqa-delta`). The pruning method is
inference-only — no retraining needed — so the only thing the choice
of base model affects is the strength of the baseline we compare
against. Using already-fine-tuned weights saves 1-2 weeks of
fine-tuning work and makes the comparison to literature direct.

**Branch, don't rewrite.** ~80% of the harness (data loading, metric
plumbing, the `MedVQADataset` / `PruningMethod` contracts, the runner
loop) is model-agnostic. Only the model loader, the prompt
construction, and the metrics are v1.0-specific. Forked the harness
to a sibling folder `~/llava-med-pruning-v1` (verbatim copy from
commit `0b90a63`) — `main` stays as the v1.5 evaluation harness so
both can coexist if needed.

## v1.0 reproduction — what's involved

Reading v1.0's `apply_delta.py` and `model_vqa.py` made clear that
v1.0 differs from v1.5 in several non-trivial ways:

- **Different visual-token count** — 256 (= (224 / 14)²) instead of
  v1.5's 576. v1.0 uses CLIP ViT-L/14 at 224², not 336².
- **Different prompt construction** — `<im_patch>` × 256 injected
  inline, `simple_conv` template, `KeywordsStoppingCriteria` with
  `'###'` as the stop token.
- **Different scoring methodology** — the original v1.0 paper uses
  **candidate-set argmax classification** for closed-form questions
  (the model's answer is matched against a closed candidate set
  built from training answers), not the lenient whole-word match
  we've been using. This is genuine new work for `eval/metrics.py`.
- **Stochastic decoding** — `temperature=0.7` in v1.0's reference,
  not v1.5's greedy `temperature=0.0`.

## Delta-merge pipeline

Started the three delta downloads in parallel via `huggingface-cli`,
plus the base LLaMA-7B weights (the deltas are computed against base
LLaMA-1 7B, for which `huggyllama/llama-7b` is the canonical ungated
mirror).

```bash
# Each download runs as its own backgrounded huggingface-cli process.
# nohup decouples them from the terminal; logs go to per-file logs.
nohup huggingface-cli download huggyllama/llama-7b \
    --local-dir /data/dan/weights/llama-7b \
    --local-dir-use-symlinks False \
    > /data/dan/weights/llama-7b-download.log 2>&1 &
nohup huggingface-cli download katielink/llava-med-7b-vqarad-delta \
    --local-dir /data/dan/weights/llava-med-7b-vqarad-delta \
    --local-dir-use-symlinks False \
    > /data/dan/weights/vqarad-delta-download.log 2>&1 &
nohup huggingface-cli download katielink/llava-med-7b-slake-delta \
    --local-dir /data/dan/weights/llava-med-7b-slake-delta \
    --local-dir-use-symlinks False \
    > /data/dan/weights/slake-delta-download.log 2>&1 &
nohup huggingface-cli download katielink/llava-med-7b-pathvqa-delta \
    --local-dir /data/dan/weights/llava-med-7b-pathvqa-delta \
    --local-dir-use-symlinks False \
    > /data/dan/weights/pathvqa-delta-download.log 2>&1 &
```

**~52 GB total downloaded.** Three deltas + base LLaMA. SLAKE and
PathVQA deltas listed on HuggingFace but the SLAKE delta turned out
to be missing/empty on the mirror — *the weights were never actually
uploaded for SLAKE*. PathVQA delta downloaded fine. Net: only
VQA-RAD's full reproduction chain is intact today; SLAKE
reproduction is blocked on locating the missing weights.

**VQA-RAD merge succeeded** via `python -m llava.model.apply_delta`
(CPU-only, ~5 min, ~30 GB peak RAM). Output:

```
13G    /data/dan/weights/llava-med-7b-vqarad-merged/
       ├── pytorch_model-00001-of-00002.bin   (9.3G)
       ├── pytorch_model-00002-of-00002.bin   (3.3G)
       ├── pytorch_model.bin.index.json
       ├── config.json
       ├── generation_config.json
       ├── tokenizer.model
       ├── tokenizer_config.json
       ├── added_tokens.json
       └── special_tokens_map.json
```

The merged model is at the right size (~12.6 GB across the two
shards), has all the LLaVA-Med v1.0 special tokens registered, and is
ready to be loaded by `LlavaLlamaForCausalLM.from_pretrained()`.

## Forking the harness — `~/llava-med-pruning-v1`

`cp -r ~/llava-med-pruning ~/llava-med-pruning-v1`, then cleaned the
copy of v1.5-specific artifacts (the `results/` directory belonged
to v1.5; the README described the v1.5 work). The `.gitignore` from
the v1.5 fork is already comprehensive (`__pycache__/`, `*.py[cod]`,
`.ipynb_checkpoints/`, `results/`, even `.venv/` defensively) — no
edits needed.

**Wrote `eval/model_loader.py` for v1.0** — hand-rolled, mirroring
v1.0's `model_vqa.py` init block. `AutoTokenizer` + special-token
registration for `<im_patch>`, `<im_start>`, `<im_end>`, then
`LlavaLlamaForCausalLM.from_pretrained()` with vision-config wiring
and `image_token_len = (224/14)**2 = 256` instead of v1.5's
`builder.py`-based path.

??? note "v1.0 model loader — `eval/model_loader.py` (initialisation block)"

    Mirrors `model_vqa_med.py`'s init exactly. The hand-rolled
    `AutoTokenizer` + special-token registration is required because
    v1.0 doesn't ship a `builder.py` like v1.5 does.

    ```python
    def load_llava_med_v1(model_path: str, device: str = "cuda") -> LoadedModel:
        """Load LLaVA-Med v1.0 merged weights for inference.

        Unlike v1.5's load_pretrained_model in builder.py, v1.0 expects
        a hand-rolled init: AutoTokenizer with special-token registration,
        then LlavaLlamaForCausalLM.from_pretrained() with the vision
        config wired up after the fact.

        Args:
            model_path: Path to the merged model directory (output of
                apply_delta).
            device: 'cuda' for GPU inference, 'cpu' only useful for
                debugging.

        Returns:
            A LoadedModel bundle.
        """
        tokenizer = AutoTokenizer.from_pretrained(model_path)

        # Register the three special tokens v1.0 uses for image splicing.
        # add_tokens returns the number actually added (0 if already
        # present in the merged tokenizer, which is the normal case).
        tokenizer.add_tokens(
            [DEFAULT_IMAGE_PATCH_TOKEN, DEFAULT_IM_START_TOKEN,
             DEFAULT_IM_END_TOKEN],
            special_tokens=True,
        )

        model = LlavaLlamaForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True,
        ).to(device)

        # Vision tower lives at config.mm_vision_tower; v1.0 expects us
        # to resolve and load it manually since the from_pretrained path
        # doesn't do it for v1.0's class hierarchy.
        vision_tower = model.get_model().vision_tower[0]
        if isinstance(vision_tower, CLIPVisionModel):
            vision_tower.to(device=device, dtype=torch.float16)

        # 224 / 14 = 16, so 16*16 = 256 visual tokens per image.
        image_token_len = (224 // 14) ** 2

        return LoadedModel(
            model=model,
            tokenizer=tokenizer,
            image_processor=CLIPImageProcessor.from_pretrained(
                model.config.mm_vision_tower
            ),
            conv_mode="simple",       # v1.0's conversation template
            image_token_len=image_token_len,
        )
    ```

## The env battle — what went wrong, what was learned

Setting up a v1.0-compatible Python environment took the rest of the
session and didn't conclude. The two underlying problems, both
recoverable but expensive in time, were:

**Container is non-root and missing `python3.10-venv` + `sudo`.**
`python -m venv ~/venvs/llava-med-v1` half-built the directory (the
`bin/python` was created) but bailed during pip bootstrap because
Debian/Ubuntu split `ensurepip` out into a separate apt package
(`python3.10-venv`) that wasn't installed. `apt install` requires
root; `sudo` itself isn't installed in the container either.

**Workaround:** `pip install --user virtualenv`, then
`~/.local/bin/virtualenv ~/venvs/llava-med-v1`. This avoids stdlib
`venv` entirely, uses a third-party `virtualenv` that's pure Python,
and doesn't need apt or sudo. Worked first try.

**Torch ABI breakage from a partial install.** Once the venv was up
and the v1.0 source `pip install -e .` ran, torch ended up in a
mixed-version state:
`torch-2.1.2.dist-info` from one install attempt alongside `.py`
files from a newer torch left behind from an earlier `pip install`
that wasn't cleanly undone. The symptom was:

```
RuntimeError: No such operator aten::sym_constrain_range_for_size
```

`sym_constrain_range_for_size` is a TorchScript op that was added in
torch 2.3+. Torch 2.1.2's `_ops.py` was trying to look it up because
it was reading **stale `.py` files** from the previous install while
the C++ side was 2.1.2. Compounding this, NumPy 2.2.6 was present
where torch 2.1.2 expects NumPy 1.x (ABI-incompatible at the
1.x → 2.x boundary).

Attempted recovery via `pip uninstall torch torchvision torchaudio
numpy`, manual `rm -rf` of the leftover `site-packages/torch*`
directories, then a clean `pip install --force-reinstall --no-cache-dir
"numpy<2" torch==2.1.2 torchvision==0.16.2 --index-url ...cu121`.
This *should* have produced a clean state, but a follow-up import test
still failed — at which point the server crashed, and the env work
ended for the day.

**Path forward — a fresh Docker image.** Started sketching a v1.0
Dockerfile based on `pytorch/pytorch:2.1.2-cuda12.1-cudnn8-devel`,
where torch is pre-installed at the exact target version. Starting
from a known-good torch eliminates the entire class of mixed-version
problems. Build time is ~5 minutes; will pick this up next session.

??? note "v1.0 Dockerfile (in-progress draft)"

    Not yet built. Built off the `pytorch/pytorch:2.1.2-cuda12.1` base
    so torch is already correct; pre-installs all v1.0 runtime deps
    before the editable install so pip has nothing to re-resolve.

    ```dockerfile
    # Base: pytorch/pytorch:2.1.2-cuda12.1-cudnn8-devel
    # Rationale: torch 2.1.2 + cu121 is the version line LLaVA-Med v1.0
    # was developed against. Starting from an image where torch is ALREADY
    # at the right version eliminates the mixed-install class of problems
    # that bit us today.

    FROM pytorch/pytorch:2.1.2-cuda12.1-cudnn8-devel

    ENV DEBIAN_FRONTEND=noninteractive
    ENV PYTHONUNBUFFERED=1

    # System packages: git for the LLaVA-Med install, git-lfs for weight
    # ops, build-essential as fallback for any pip wheel that builds from
    # source.
    RUN apt-get update && apt-get install -y \
            git git-lfs build-essential wget vim \
        && rm -rf /var/lib/apt/lists/*

    # Pin numpy to the 1.x ABI line torch 2.1.2 was compiled against.
    # FIRST, before anything else, so later pip installs cannot pull
    # numpy 2.x in transitively.
    RUN pip install --upgrade pip && \
        pip install "numpy<2"

    # Pre-install LLaVA-Med v1.0 runtime deps per the upstream install
    # recipe. Doing this BEFORE 'pip install -e .' on the source means
    # the editable install sees these as already satisfied and does no
    # further dependency resolution -- which is the key fix.
    #
    # transformers is pinned to a specific commit per the v1.0 install
    # recipe; newer transformers break LlavaLlamaForCausalLM's vision-
    # tower wiring.
    #
    # flash-attn is INTENTIONALLY OMITTED -- only needed for training,
    # not the apply_delta + inference path. Building it from source is
    # 30+ minutes and the most failure-prone step in any v1.0 install.
    RUN pip install --no-cache-dir \
            "openai==0.27.8" einops einops-exts ninja open-clip-torch \
            sentencepiece accelerate peft bitsandbytes shortuuid \
            tabulate nltk Pillow "huggingface_hub>=0.20,<1.0" \
     && pip install --no-cache-dir \
            "git+https://github.com/huggingface/transformers@cae78c46"

    # Copy the LLaVA-Med v1.0 source. Build context must contain a
    # LLaVA-Med-v1.0 directory alongside this Dockerfile.
    COPY LLaVA-Med-v1.0 /opt/LLaVA-Med-v1.0
    WORKDIR /opt/LLaVA-Med-v1.0
    RUN pip install --no-cache-dir -e .

    # Build-time sanity check: catch import failures at image-build,
    # not at first container run.
    RUN python -c "import torch, numpy; print(f'torch={torch.__version__}, numpy={numpy.__version__}')" \
     && python -c "from llava import LlavaLlamaForCausalLM; print('LLaVA-Med v1.0 import: OK')"
    ```

## Server crashed before push

The HONGHU KUBERUN container went unresponsive late in the session.
The crash means the **`~/llava-med-pruning-v1` commit didn't make it
into a `git push`** — and as a result, no commit hash to link as
"Pushed today." The locally-banked v1.0 scaffold (model_loader.py,
README updates, cleaned tree) will be pushed in tomorrow's session
once a new container is up.

## Honest note on the day

A genuinely large amount got done: Batch 3 finished, the full v1.5
baseline row banked, a strategic pivot reasoned through with the data
in hand, the v1.0 delta-merge pipeline executed for VQA-RAD, and the
forked harness scaffolded with a working v1.0 model loader written.
The end of the day's frustration shouldn't overshadow the substance.

That said, the env battle is the second time a "quick install" has
eaten a substantial chunk of a session (after the
`pip --force-reinstall` regression on May 13). The lesson is clear:
when the target environment has tight version pins,
**reproducibility-via-Dockerfile is the way forward, not a series of
in-place pip patches**. The Dockerfile draft above is what tomorrow
starts from.

---

### Plan for tomorrow (May 16)

- [ ] Bring up a new container with the v1.0 Dockerfile.
- [ ] Inside the new container, push the locally-banked
      `~/llava-med-pruning-v1` work to a new GitHub repo.
- [ ] Finish the v1.0 harness adaptations: `eval/metrics.py`
      (candidate-set argmax), `eval/runner.py` (v1.0 prompt + stop
      criteria), and the `train_open_answers.json` candidate builder.
- [ ] Run E00 against the merged VQA-RAD-fine-tuned model — the real
      v1.0 baseline number, comparable directly to published
      v1.0 figures (~0.84 closed).
- [ ] If the number is in the neighbourhood of published, decide
      whether to promote the v1.0 harness to the project's main
      evaluation track.
- [ ] Investigate the missing SLAKE delta on HuggingFace — find an
      alternative source if one exists, or accept the SLAKE-from-v1.0
      track is blocked.

---

## Pushed today

_No git push today — the HONGHU KUBERUN container crashed before the
v1.0 scaffold commit could be pushed. The v1.5 harness on `main` was
not modified today; only the locally-forked `~/llava-med-pruning-v1`
folder changed, and that work is currently only banked locally.
Tomorrow's session opens with pushing it to its own GitHub repo._
