# Week 1 — Baseline setup & first contact

<span class="pill pill--wip">In progress</span>

**Phase 1 of 7** (Baseline & Literature) · **Week 1 of 2 in this phase**

**Goal of the week** — get the LLaVA-Med baseline running end-to-end,
document the environment reproducibly, find and fix any blockers, and
start reading the visual-token-pruning literature.

## Summary so far

- Dockerfile authored and image built on HONGHU KUBERUN (NGC PyTorch
  23.10 base, all LLaVA-Med pinned deps, flash-attn 2.3.6 from source).
- Stack sanity-check passes: PyTorch 2.1, CUDA 12.2, A100 80GB PCIe
  visible, transformers / accelerate / peft / bitsandbytes / flash-attn
  all importable.
- LLaVA-Med cloned, editable-installed, model weights downloaded
  (~15 GB) to `/data/dan/weights/llava-med-v1.5-mistral-7b/`.
- Discovered a moderate bug in `llava/serve/cli.py`: stop-criterion
  selection truncates Mistral-template generation to a single token.
- Patched the bug; CLI now returns full multi-turn medical responses.
- Bug write-up filed in [Bugs & Issues](../bugs.md), patch ready for
  upstream PR.
- This documentation site set up locally and deployed live to GitHub
  Pages at <https://leokuan0208.github.io/question-aware-vtp-medvlm/>.

---

## Day 1 — Sunday, May 10, 2026

Environment setup day. Goal: have a working container with the right
PyTorch/CUDA/flash-attn versions, with GPU and `/data` both visible.

### Container build

Drafted a Dockerfile targeting `nvcr.io/nvidia/pytorch:23.10-py3` and
adding:

- Ubuntu packages: `git`, `git-lfs`, `python3-pip`.
- JupyterLab (required by the KUBERUN VM launch interface).
- LLaVA-Med's pinned Python dependencies in one `pip install` layer.
- `flash-attn==2.3.6 --no-build-isolation` (compiled from source —
  the slow step, roughly 15 minutes).

Full Dockerfile is in [Baseline (LLaVA-Med)](../setup.md#the-dockerfile).

### `/data` mount not visible in JupyterLab — fix

After the first build, `/data` was reachable by `cd /data` but didn't
appear in the JupyterLab file browser sidebar. Root cause: Jupyter only
shows files underneath its starting directory, and the KUBERUN
container starts inside `/root` while `/data` is at the filesystem
root.

Fix: added `RUN ln -s /data /root/data` to the Dockerfile and rebuilt.
The flash-attn layer cached, so the rebuild finished in under a minute.
`~/data` then showed up in the sidebar as expected.

### Stack sanity check

Ran a Python one-liner that imports torch, transformers, accelerate,
peft, bitsandbytes, flash-attn, and confirms the `flash_attn_varlen`
API. Full script and expected output are in
[Baseline (LLaVA-Med)](../setup.md#2-sanity-check-the-stack).

**First gotcha — `AttributeError: module 'bitsandbytes' has no
attribute '__version__'`.** bitsandbytes 0.41.0 doesn't expose
`__version__` as a module attribute. Switched to
`importlib.metadata.version('bitsandbytes')`, which reads pip metadata
directly. Lesson: `__version__` is a convention, not a guarantee — for
robust version checks across packages, use `importlib.metadata`.

Confirmed GPU is **NVIDIA A100 80GB PCIe** (PCIe variant, not SXM4 — the
form factor matters for inter-GPU bandwidth but is irrelevant on a
single card).

## Day 2 — Monday, May 11, 2026

The "actually run the model" day. Cloned the repo, downloaded weights,
got inference going, found and fixed the CLI bug.

### Code install

```bash
cd ~
git clone https://github.com/microsoft/LLaVA-Med.git
cd LLaVA-Med
pip install -e . --no-deps
```

`pip show llava_med` confirmed `Version: 1.5.0` and editable install
pointing at `/root/LLaVA-Med/llava/`.

### Model weight download

`/data` is shared, so created `/data/dan/` as a personal namespace
with `weights/` and `dataset/` subfolders. Verified writability with
`touch /data/dan/weights/.write_test && rm` — passed.

```bash
cd /data/dan/weights
git lfs install
git clone https://huggingface.co/microsoft/llava-med-v1.5-mistral-7b
```

End state: 3 safetensors shards (~5 GB each, total 15 GB), index file,
tokenizer files. Confirmed with `du -sh` and `ls -lh`.

### First inference attempt

Originally tried the upstream LLaVA entry point:

```bash
python -m llava.eval.run_llava \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./images/xray.jpg \
    --query "Describe this medical image."
```

Got `No module named llava.eval.run_llava` — LLaVA-Med doesn't ship
that module (it's upstream-only). Switched to `llava.serve.cli` (the
interactive equivalent).

Also discovered that the `./images/` directory only contains paper
branding assets (logos, pipeline diagrams). The actual sample
biomedical images live in `./llava/serve/examples/`. Used
`bio_patch.png` from there.

### The CLI bug

CLI loaded the model cleanly but produced **single-word responses** to
every question. Full diagnostic trail is in
[Bugs & Issues #1](../bugs.md#1-llavaservecli-stops-generation-immediately-for-the-mistral-variant).

In one paragraph: the stopping-criteria construction in `cli.py` does

```python
stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
```

For the `mistral_instruct` template, `sep_style` is `LLAMA_2` and `sep`
is the empty string, so `stop_str = ''`. The
`KeywordsStoppingCriteria` halts on the first generated token because
the empty string is trivially present in any output. Patched with:

```python
stop_str = conv.sep2 if conv.sep_style in (SeparatorStyle.TWO, SeparatorStyle.LLAMA_2) else conv.sep
```

After the patch, the CLI returns full multi-turn medical responses.

### Snippet to remember

```bash
# The minimum-viable end-to-end inference command, post-patch:
cd ~/LLaVA-Med
python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png \
    --conv-mode mistral_instruct
```

## Day 3 — Tuesday, May 12, 2026

Built this documentation site locally on Windows. Goal: have a
markdown-based progress log running on `mkdocs serve` so daily edits
auto-render in the browser.

### Why MkDocs Material

Picked **MkDocs** with the **Material** theme over alternatives like
Jekyll, Hugo, or a hand-rolled React/HTML site. Reasons:

- **Source files are plain Markdown.** No HTML, no build pipeline to
  maintain over 12 weeks. The format won't fight me when I want to
  write fast.
- **One-time setup, then write-only.** Editing for the rest of the
  project is just opening a `.md` file and typing.
- **It's what most research labs and OSS projects actually use** —
  muscle memory transfers, examples are everywhere.
- **Excellent technical content support out of the box** — code
  highlighting, admonitions, math, Mermaid diagrams.

### Prerequisites on Windows

- **Python 3.9+** — verified with `python --version`.
- **Git** — newly installed; chose VS Code as Git's default editor,
  set the default branch to `main`, picked "Git from the command line
  and also from 3rd-party software" for PATH integration, kept all
  other Git installer defaults.

### Local install

```powershell
# Inside the project folder, in PowerShell:
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**PowerShell execution-policy gotcha.** First attempt at
`.venv\Scripts\Activate.ps1` failed with a red
`UnauthorizedAccess` / "scripts are disabled on this system" error
(in Traditional Chinese). Root cause: Windows' default execution
policy blocks all local scripts.

Fix (one-time):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

After confirming with `Y`, the venv activated normally (the `(.venv)`
prefix appeared in the prompt). Verified with `where.exe pip` that the
first pip on PATH now pointed inside `.venv\Scripts\`.

**Cleanup:** the first install attempt (before noticing the venv
hadn't activated) had landed in system Python. Used
`pip uninstall -y mkdocs mkdocs-material pymdown-extensions
mkdocs-git-revision-date-localized-plugin` to remove them, then
re-installed inside the active venv.

### Verifying the local site

```powershell
mkdocs serve
```

Opened <http://127.0.0.1:8000/question-aware-vtp-medvlm/> — site
rendered correctly. Confirmed live-reload works: edits to any `.md`
file trigger an automatic browser refresh within ~1 second.

### Iteration: colour scheme and code-block presentation

Spent the afternoon refining the visual design rather than just
accepting defaults:

- **First palette** was teal + warm amber on cool slate. Felt too
  clinical / dreary for a 12-week project I'd be staring at every
  day.
- **Second iteration** was warm amber on warm charcoal — better, but
  ultimately wanted something more familiar.
- **Final palette** is the GitHub / Facebook blue family — medium
  blue (`#2f7fea`) for solid elements, lifted blue (`#58a6ff`) for
  links on dark backgrounds, dark slate (`#0d1117`) canvas. Same
  family in light mode, darkened for contrast.
- **Code blocks** now render with a language label at the top-left
  ("BASH", "PYTHON", "DOCKERFILE"), a copy button at the top-right,
  syntax colouring via Pygments, and a bordered "card" container.
  Required enabling `auto_title: true` under
  `pymdownx.highlight` and writing a few rules in `extra.css` to
  style the label bar.
- **Admonition font sizes** were inconsistent — Material's default
  admonition body (0.64rem) made plain text feel cramped while
  inline code at a fixed `rem` size looked oversized. Fixed by
  bumping admonition body to 0.72rem and switching inline code from
  `rem` to `em` units so it scales with whatever container it sits
  in.

### Snippet to remember

```powershell
# Daily startup for editing the site locally:
cd C:\Users\d3896\Downloads\question-aware-vtp-medvlm
.venv\Scripts\Activate.ps1
mkdocs serve
```

## Day 4 — Wednesday, May 13, 2026 &nbsp; _(today)_

Two big things today: deploying the site publicly to GitHub Pages,
and writing up the CLI bug formally.

### Bug writeup

- Wrote the full 10-step troubleshooting trail in
  [Bugs & Issues](../bugs.md) — every hypothesis tried, eliminated,
  and the path to root cause.
- Status pill flipped to <span class="pill pill--done">Patched
  locally</span>. Upstream PR planned but deferred until Week 2.

### Confirmed baseline architecture

Confirmed that the visual encoder in LLaVA-Med v1.5 (Mistral) uses
CLIP ViT-L/14 at 336² → **576 visual tokens per image**, matching the
assumption in the project plan. This is the number of tokens the
pruning module will operate on.

### Deploying the site to GitHub Pages

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

### How the live deploy works (mental model)

The repo now has two branches that serve different purposes:

- **`main`** — the markdown source. This is what I edit.
- **`gh-pages`** — the built HTML, auto-generated. **I never touch
  this directly.** Every push to `main` triggers the GitHub Actions
  workflow in `.github/workflows/deploy.yml`, which runs
  `mkdocs build` inside a temporary Ubuntu container and force-pushes
  the result to `gh-pages`. GitHub Pages serves whatever's there.

So the daily loop is: edit `.md` → `git push` → wait ~60 seconds →
live site updates. No manual build, no rsync, no FTP.

### Practising the workflow

Today's site update (this very entry, plus the Day 3 expansion) is
the first real exercise of the edit-and-push loop on substantive
content rather than scaffolding. Worth getting the rhythm right
before Week 2's more research-heavy entries.

### Plan for the rest of the week (May 14 – May 16)

- [ ] Read ToMe end-to-end; take structured notes in `resources.md`.
- [ ] Skim FastV (closest prior art) to understand their pruning
      insertion point inside the LM.
- [ ] Skim SparseVLM (text-aware pruning, closest in *spirit* to this
      project).
- [ ] Skim GAP (position-ID correction after token drop — important
      for RoPE-based Mistral).
- [ ] Sketch the Week 2 plan: profile the baseline (latency, VRAM,
      token-count breakdown), locate the visual-token pipeline in the
      LLaVA-Med code, identify candidate pruning insertion points.
- [ ] File the CLI fix upstream on `microsoft/LLaVA-Med` (deferred
      from earlier in the week; not blocking).

---

## Reflections (end-of-week)

_Write this at the end of the week. A few sentences on what went well,
what was harder than expected, what to do differently next week. The
cumulative habit is the highest-value thing in a research log._
