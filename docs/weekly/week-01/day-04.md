# Day 4 — Wednesday, May 13, 2026

[← Back to Week 1 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 1, Day 4 · **Day 4 of the project**

---

A long day, in chronological order: writing up the CLI bug, deploying
this site to GitHub Pages, a first read-through of the LLaVA-Med
architecture, the strategic call to skip the v1.0 reproduction,
scaffolding the evaluation harness, and downloading the three
benchmark datasets.

## CLI bug writeup

Wrote up the CLI bug formally in `bugs.md` with the full
troubleshooting trail — every hypothesis tried and eliminated, in
order — per advisor-friendly bug-report conventions.

- Status pill flipped to <span class="pill pill--done">Patched
  locally</span>. Upstream PR planned but deferred until Week 2.

## Confirmed baseline architecture

Confirmed that the visual encoder in LLaVA-Med v1.5 (Mistral) uses
CLIP ViT-L/14 at 336² → **576 visual tokens per image**, matching the
assumption in the project plan. This is the number of tokens the
pruning module will operate on.

## Deploying the site to GitHub Pages

The local site is great for editing, but a public URL is what the
advisor can bookmark and what goes on a CV.

**Step 1 — Created the empty GitHub repo.** On
<https://github.com/new>, name = `question-aware-vtp-medvlm`, public,
**all three initialise-with boxes left unchecked**. Crucial: ticking
any of those would have created an "Initial commit" on the remote
that conflicts with the local one, requiring
`--allow-unrelated-histories` and a messy manual merge.

**Step 2 — Pushed the local folder.** In PowerShell:

```powershell
git init
git add .
git commit -m "Initial commit: documentation site scaffold"
git branch -M main
git remote add origin https://github.com/Leokuan0208/question-aware-vtp-medvlm.git
git push -u origin main
```

The first `git push` opened a browser window for GitHub
authentication via the Git Credential Manager (set up during the
Git install on Day 3). Sign-in once, credentials cached, future
pushes don't ask.

**Line-ending warning.** During `git add` Git printed 15 warnings of
the form *"LF will be replaced by CRLF the next time Git touches
it"*. Not an error — it's Git's `core.autocrlf=true` setting (chosen
during install) doing its job: storing files with Unix `LF` line
endings in the repo while checking them out with Windows `CRLF` on
disk. Makes the repo cross-platform clean.

**Step 3 — Enabled GitHub Pages.** On github.com → repo →
**Settings → Pages** → **Source: Deploy from a branch** → branch
`gh-pages`, folder `/ (root)` → **Save**.

The `gh-pages` branch only existed because the `deploy.yml` GitHub
Actions workflow had already run once on the initial push (~60
seconds) and pushed the built HTML there. Without that, the branch
dropdown wouldn't have shown `gh-pages` as an option.

**Step 4 — Verified live.** Site appeared at
<https://leokuan0208.github.io/question-aware-vtp-medvlm/> within
about 30 seconds of saving the Pages config. Confirmed identical
rendering to the local preview.

## How the live deploy works (mental model)

The repo now has two branches that serve different purposes:

- **`main`** — the markdown source. This is what I edit.
- **`gh-pages`** — the built HTML, auto-generated. **I never touch
  this directly.** Every push to `main` triggers the GitHub Actions
  workflow in `.github/workflows/deploy.yml`, which runs
  `mkdocs build` inside a temporary Ubuntu container and force-pushes
  the result to `gh-pages`. GitHub Pages serves whatever's there.

So the daily loop is: edit `.md` → `git push` → wait ~60 seconds →
live site updates. No manual build, no rsync, no FTP.

## Architecture deep-dive _(partial — paused for later)_

Opened `llava/model/llava_arch.py` and read the
`prepare_inputs_labels_for_multimodal` method, which is the
conceptual core of every LLaVA-family model. Identified the **five
logical phases** of the multimodal splicing logic:

1. Take the original `input_ids` and find the position of the
   `<image>` placeholder token (one position per image).
2. Run the image through the vision tower (CLIP ViT-L/14) → 576
   visual feature vectors at 1024 dims.
3. Project those through the multimodal projector (an MLP) →
   576 vectors at 4096 dims (Mistral's hidden size).
4. Splice: replace the single `<image>` token's embedding with the
   576 projected visual-token embeddings.
5. Assign sequential position IDs across the whole resulting
   sequence (text → visual tokens → more text → ...).

Key takeaways for the pruning module:

- **Visual tokens after splicing live at contiguous positions**
  `[image_token_pos, image_token_pos + 576)` in the embedding
  sequence, where `image_token_pos` is the original index of the
  `<image>` placeholder in `input_ids`.
- **Position IDs are sequential post-splice**, with no positional
  gap reserved for visual tokens. This means naive pruning
  (dropping visual tokens before they hit the LM) will misalign all
  post-image text token positions. The GAP paper's position-ID
  correction will be required when implementing pruning.
- **Three candidate pruning hook locations**: (a) inside
  `encode_images` after CLIP, (b) right after `encode_images`
  returns but before splicing, (c) inside the LLM forward pass
  after some early layer K. Option (c) is what FastV does and what
  the project plan targets.

Got through the first read pass but decided to pause the second pass
(the print-statement instrumentation exercise) for a calmer day.
The notes above are sufficient for now; we'll come back to it before
writing the actual pruning hook.

## Strategic decision: skip full v1.0 reproduction

Originally the plan was "reproduce LLaVA-Med faithfully, then start
modifying it." Today, after some back-and-forth, decided to **scope
that down significantly**:

- Cloned the v1.0 codebase to `~/LLaVA-Med-v1.0` at git tag
  `v1.0.0` as a reference point (in case a future ablation needs
  paper-faithful baselines).
- **Skipped** running the v1.0 reproduction end-to-end.
- Will implement the pruning method **directly on v1.5**, which is
  already running and verified.

**Rationale:** the pruning method is inference-only — no retraining
is required to apply it — and architecture-agnostic. A v1.5-only
result is publishable on its own merit, and a v1.0 comparison can be
added later as an ablation if there's time. Doing the full v1.0
reproduction first would have eaten 1–2 weeks for marginal
publication-value gain.

Also expanded the evaluation plan to include a **third benchmark**:
PathVQA (pathology images), alongside the originally-planned VQA-RAD
(radiology) and SLAKE (general medical). Three benchmarks make the
results more robust and let us check whether the method generalises
across medical-imaging domains.

## Evaluation harness scaffolding

Per the research-plan principle — _"get the measurement
infrastructure working before you write any pruning code"_ — started
building the harness. New project repo: `~/llava-med-pruning/`,
intentionally separate from the LLaVA-Med codebase so the pruning
work is cleanly isolated.

**Module structure (11 files planned, 4 implemented today):**

```
~/llava-med-pruning/
├── datasets/       # VQA-RAD, SLAKE, PathVQA loaders (stubs)
├── methods/        # pruning methods, with NoOp baseline implemented
├── metrics/        # accuracy + latency + FLOPs (stubs)
├── model.py        # LoadedModel bundle (stub)
├── runner.py       # main evaluation loop (stub)
└── run_eval.py     # argparse CLI entry point (implemented)
```

**Interface contracts defined:**

- `MedVQADataset` — abstract base class with `__iter__` yielding
  `VQASample(image, question, answer, answer_type)` dataclasses.
- `PruningMethod` — has `attach(model)` and `detach(model)` lifecycle
  hooks, so a single evaluation run can swap pruning strategies
  without reloading the 15 GB model.
- `LoadedModel` — a small bundle holding `(model, tokenizer,
  image_processor, conv_template)` so the runner doesn't need to
  know the LLaVA-Med-specific loading details.

The full interface-contract code is in the
[Day 5 page](day-05.md#batch-1-metricspy-model_loaderpy-complete-verified),
where the stubs got filled in.

**Design decisions made:**

- **argparse over Hydra** for the CLI. Hydra is more powerful but
  adds a config-system learning curve I don't need for a 12-week
  project. argparse is in the stdlib and good enough.
- **JSON + JSONL outputs.** One JSON file per run with the summary
  metrics, plus a JSONL file with one line per sample (for error
  analysis and re-aggregation later).
- **NoOp pruning method** as the first implementation — it does
  nothing, just lets the model run unmodified. This is what the
  E00 baseline experiment will use.

7 files are documented stubs awaiting fill-in; the docstrings spell
out what each needs to do, so future-me can pick up where I left off
without re-deriving the architecture.

## Benchmark dataset downloads

Downloaded all three benchmark datasets via HuggingFace mirrors:

```bash
python << 'EOF'
from huggingface_hub import snapshot_download

datasets = [
    ("flaviagiammarino/vqa-rad",   "/data/dan/dataset/vqa_rad"),
    ("BoKelvin/SLAKE",             "/data/dan/dataset/slake"),
    ("flaviagiammarino/path-vqa",  "/data/dan/dataset/path_vqa"),
]

for repo_id, local_dir in datasets:
    snapshot_download(
        repo_id=repo_id, repo_type="dataset",
        local_dir=local_dir, local_dir_use_symlinks=False,
    )
EOF
```

**On-disk sizes** (under `/data/dan/dataset/`):

- `vqa_rad/` — 33 MB
- `slake/` — 207 MB
- `path_vqa/` — 750 MB
- **Total: ~990 MB**

**Format observations:** VQA-RAD and PathVQA arrived in HuggingFace
`datasets` Parquet format (images embedded as bytes inside the
parquet files). SLAKE arrived in its **original raw distribution
format**: separate JSON files for splits plus a single `imgs.zip`
that has to be extracted later. The schema is different from what
the loaders will need to normalise.

**Sample counts verified against authoritative sources** (HuggingFace
dataset cards + a peer-reviewed paper citing SLAKE):

| Dataset | Train | Val | Test | Total | Source verified |
|---|---|---|---|---|---|
| VQA-RAD | 1,793 | — | 451 | 2,244 | HF card (matches deduplicated ~2,248) |
| SLAKE (English-only) | 4,919 | 1,053 | 1,061 | 7,033 | Peer-reviewed paper (exact match) |
| PathVQA | 19,654 | 6,259 | 6,719 | 32,632 | HF card (exact match) |

All three downloads verified complete. SLAKE's bilingual total is
~14K QA pairs, of which 7,033 are English (filtered by the `q_lang`
field).

### Near-disaster: the `pip install --force-reinstall` regression

While verifying VQA-RAD and PathVQA counts, I needed to read parquet
files and didn't have the `datasets` library. The install command
I ran (`pip install datasets==2.16.1 --force-reinstall`) cascaded
through the dependency tree and **clobbered most of the NGC-pinned
stack** — including PyTorch itself. The container was broken for
~30 minutes before I recovered it.

Full writeup in
[Bugs & Issues #2](../../bugs.md#2-pip-install-force-reinstall-cascaded-and-clobbered-the-ngc-pinned-stack)
— this is exactly the kind of multi-step troubleshooting trail
worth documenting, because the recovery path is non-obvious and the
underlying lesson (never `--force-reinstall` in a Dockerfile-pinned
environment) applies to every future container session.

Resolution: deleted `~/.local/lib/python3.10/site-packages/` to
purge the user-local package overrides, then reinstalled the LLaVA-Med
editable package (`cd ~/LLaVA-Med && pip install -e . --no-deps`).
The NGC-built `torch 2.1.0a0+32f93b1`, `transformers 4.36.2`, and
`flash-attn 2.3.6` were preserved because they live in the
container's system site-packages, not in `~/.local/`. Switched the
parquet inspection to use `pyarrow` (already in the NGC image),
which sidestepped needing `datasets` at all.
