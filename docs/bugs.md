# Bugs & Issues

A running log of bugs encountered during the project. Each entry uses
the same template so they're easy to scan, and — importantly —
documents the **full troubleshooting trail**, not just the final fix.
Bug-hunts are part of the research record; later-me will want to know
what hypotheses were eliminated, not just the answer.

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
