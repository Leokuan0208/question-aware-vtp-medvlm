# Day 3 — Tuesday, June 2, 2026

[← Back to Week 4 overview](index.md)

**Clean-slate pivot** (image-difficulty-driven adaptive compute) ·
Week 4, Day 3 · **Day 24 of the project**

---

A reset day, on purpose. With Direction D
[closed yesterday](day-02.md) and every prior path having dead-ended,
the question this morning was deliberately radical: *if we forgot
everything we've done and started from scratch, what would the
research direction be?* Same constraints — 3 months, medical VLM, 2×
A100 80GB — and one hard requirement: find a **method**, not an
analysis paper. The day ran a full literature hunt through recent
medical-VLM work and its future-work sections, tore down the two
surviving candidates, landed on a genuinely empty cell —
**image-difficulty-driven adaptive reasoning-compute allocation**
(an input-side router that maps each `(image, question)` to a
reasoning-budget bucket, where the novelty is that the difficulty
signal comes from the *image*, computed before generation) — and then
did the cheapest possible thing: a one-day falsification test of the
premise *before* committing a month to it. The test came
back **REFINE** (real signal, but weak and with a surprising sign),
which sharpened the idea rather than killing it; a new base model
(**MedVLThinker**) was selected and stood up in a new isolated,
training-capable Docker image, and the definitive 3B gate — after a
caught-and-fixed `--limit` sampling trap — was sharded and left
**running inference across both VMs** overnight.

No code was pushed today — the new repo's scripts are written and the
gate is mid-run; the push comes once the verdict lands.

---

## Phase 1 — Clean-slate direction hunt

The brief: ignore sunk cost, scan recent medical-VLM literature and
its future-work sections, and find an *under-executed method* that
fits the constraints. The scan ruled a lot out fast — RL/GRPO for
medical VLMs is now crowded (Med-R1, MedVLM-R1, RadVLM,
ChestX-Reasoner, MedGR², RARL), and a pure analysis contribution was
off the table by requirement. Two candidates survived:

- **Direction B** — a question-aware version of MedPruner-style visual
  token scoring, evaluated on lesion-sensitive 3D benchmarks. Reuses
  the existing pruning code.
- **The lead** — **question-conditioned *adaptive compute***: spend
  more reasoning on hard cases, less on easy ones, for medical VLMs.

---

## Phase 2 — Tearing down Direction B

The check that mattered for B: is there room left in it? The
**MedPruner teardown** said not much. MedPruner's two mechanisms —
IAF (adaptive but *question-blind* slice filtering) and DINS
(vision-self-attention nucleus selection, also *question-blind*) — are
evaluated on M3D / 3D-RAD / AMOS-MM with Acc/BLEU/ROUGE/METEOR on
8×H20, and notably report a <5% MedGemma result (explained by skewed
attention). The fatal problem for B isn't MedPruner specifically — it's
that **B re-enters the exact arena where random already beat our
clever method once** (token scoring under retention-rate curves,
[Phase 4–5](../week-03/day-05.md)). Its one novel axis,
cross-attention question scoring, is also already on record as a known
idea, and runs into the same obstacle flagged back in Week 3:
LLaVA-style models have no separate text encoder to cross-attend from.
B is viable *only* as the cross-attention-question-aware-on-lesion-
benchmarks version, and even then it's a coin-flip race.

---

## Phase 3 — The wedge: image-derived, pre-generation difficulty

The honest reframing of the lead approach, after three rounds of
narrowing: **the mechanism of adaptive compute is fully
commoditized.** SFT-cold-start → difficulty-aware-GRPO is a recipe
anyone can run; "adaptive thinking on a medical VLM" collides with
AdaThink-Med, ARM, AdaCtrl, MedVLThinker, LLRM. So the novelty cannot
live in the mechanism — it has to live in the **difficulty signal.**

What's taken: adaptive reasoning length from query/sampling difficulty
(AdaThink-Med, text; ARM/AdaCtrl, general); adaptive visual *tool* use
from rollout difficulty (LLRM, general, HR-Bench); pass-count/entropy
difficulty estimation in medical VLMs (MedVLThinker); easy/hard
*lesion* curricula for *training* (MedCLM). Every one of these derives
difficulty from the **text/answer side** — token entropy, pass-counts,
query phrasing, rollout success.

What's **not** taken, and is the wedge:

> A difficulty signal derived from the **visual content itself**
> (lesion subtlety / image complexity), computed **before
> generation**, used to **allocate reasoning compute**, in the
> **medical VLM** setting.

There's published support that the visual signal is real: a 2025 study
defines visual complexity via texture/color, finds it positively
correlates with vision-encoder attention entropy, and shows attention
entropy negatively correlates with reasoning accuracy — i.e. image
complexity predicts when the model will struggle, independent of the
question. Nobody has turned that into a compute-allocation controller,
and medical imaging is its natural home: the same question ("is there
a nodule?") flips from trivial to brutal based purely on the image (a
clean scan vs. a subtle 5 mm ground-glass opacity). Candidate venue:
the CVPR 2026 Med-Reasoner workshop.

The residual risk, stated plainly: this space moves monthly and the
idea is natural enough that someone could be drafting it now. The
protection is to move fast on the falsification test and, if it holds,
plant a flag — not to keep re-searching, which past a point is just
avoidance.

---

## Phase 4 — The method: a difficulty→compute router, and how the dead end becomes the motivation

The mechanism is deliberately the *commoditized* part — the novelty is
the signal — but it's worth pinning down concretely, because it also
resolves why the prior negative results were not wasted.

**The control mechanism (the "router").** Difficulty is *manufactured
externally* by sampling: for each training question, sample N
completions (≈8–16), score correctness, and record a **pass-count
difficulty** (and answer-entropy). That label then drives one of two
controllers:

- **(a) Input-side budget router** *(start here)* — a small predictor
  that maps `(image, question) → reasoning-budget bucket`
  {answer-now / short-CoT / long-CoT}, supervised by the difficulty
  labels. Cheap, and it tests the core hypothesis before any RL.
- **(b) Difficulty-aware GRPO** — a length-penalized, clinically-
  asymmetric reward (penalize length on easy-correct, allow extension
  on hard, weight a confident-wrong worse than an abstain). The RL
  route, once (a) confirms the signal.

**Why the dead ends become the motivation.** The Direction-D failure
was that *internal forward-pass* confidence signals aren't readable
(transformer internal confidence is famously uncalibrated — the signal
wasn't there to be read). This approach **doesn't read internal
signals at all** — it works at the output/generation level (how many
reasoning tokens to emit) and *externalizes* the difficulty label by
sampling. So "internal signals don't exist" stops being a frustrating
null result and becomes the written justification for externalizing
difficulty and predicting it from the input. Likewise the early-exit
and tokens-retained dead ends motivate switching the unit of
competition to the **accuracy-vs-compute frontier** (a two-axis story:
length-reduction at iso-accuracy, and accuracy at matched budget,
reusing the prune/prefill/decode latency instrumentation for the
compute axis) — harder to tie than "tokens retained."

**The genuine cost, named.** HuatuoGPT-Vision has no `<think>` mode, so
you can't control reasoning length on it — hence the base-model switch
to a thinking model ([Phase 7](#phase-7-new-base-model-medvlthinker)).
(A *visual*-compute-budget variant — adaptive number of visual tokens
per question — would stay on HuatuoGPT and closer to the existing code,
but it's riskier on novelty since GlimpsePrune / E-AdaPrune already do
learned adaptive visual budgets in the general domain.)

---

## Phase 5 — The day-one falsification test

Before committing a month, the cheapest possible kill-or-confirm — and
it needs **zero new models**, running on the HuatuoGPT-Vision-7B and
2D benchmarks already on the VM (the reasoning model only matters
later, for *allocating* compute).

**The one idea that makes or breaks it.** Correlating image-complexity
with difficulty across the whole dataset would give a positive result
*for the wrong reason* — "disease diagnosis" questions are both harder
and come with busier images, so complexity would look predictive when
really the *question type* is doing the work (and that's already
captured by every question-side method). So the entire test is:
**does image-complexity predict difficulty with question type held
fixed?** Stratify by question type + modality; look at the *within-
stratum* correlation. If "is there an abnormality?" across 200
different chest X-rays shows harder cases on more complex images —
question identical — that's the signal nobody else captures.

**What's computed** (two numbers per case, then a controlled
correlation):

- **Difficulty** (the target): sample the model G times per
  (image, question) at temperature, parse each answer,
  difficulty = fraction wrong (standard pass-count difficulty,
  closed-ended only so "correct" is unambiguous).
- **Image complexity** (the predictor, computed with **no question,
  before generation**): model-free proxies first — grayscale entropy,
  JPEG-compressibility, gradient energy, Laplacian variance — plus the
  mechanistic confirmer, vision-encoder attention entropy (which needs
  `attn_implementation="eager"`/`"sdpa"`, never flash, since flash
  doesn't return attention matrices).

The pipeline is four scripts run in order — `build_subset.py`
(SLAKE + VQA-RAD closed-ended, stratified by question_type + modality)
→ **`difficulty_medvlthinker.py`** → `complexity.py` → `analyze.py`.
`difficulty_medvlthinker.py` is the workhorse: `load_model` /
`sample` (G completions at temperature) / `parse_yes_no`, emitting the
per-case pass-count difficulty — which doubles as the **training
labels** for the eventual router, so the gate and the label-generation
are one pass. (The today-only HuatuoGPT cross-check used a sibling
trio `exp_difficulty.py` / `exp_complexity.py` / `exp_analyze.py` with
the same logic wired to the existing HuatuoGPT loader.) The decision
rule was fixed *before* looking: positive control (Kruskal–Wallis that
difficulty varies by question type) first, then **GO** at partial
Spearman ρ ≥ 0.25 (p < 0.05, same sign across ≥2 strata), **REFINE**
at 0.10 ≤ |ρ| < 0.25, **NO-GO** below 0.10. (ρ ≈ 0.3 is modest in the
absolute but genuinely publishable for "image alone predicting
difficulty with the question held constant" — not expecting 0.7.)

---

## Phase 6 — The result: REFINE, and the sign is the story

The gate ran on **2,394 cases**:

```text
2394 cases | proxies: ['comp_entropy', 'comp_jpeg', 'comp_grad', 'comp_lap']

[control] difficulty differs by question_type: H=215.70, p=8.588e-44  OK

comp_entropy   within-strata rho=-0.123 (n=16)  partial rho=-0.113 p=3.28e-08  -> REFINE
comp_jpeg      within-strata rho=-0.092 (n=16)  partial rho=-0.083 p=5.3e-05   -> weak
comp_grad      within-strata rho=-0.085 (n=16)  partial rho=-0.082 p=6.44e-05  -> weak
comp_lap       within-strata rho=-0.019 (n=16)  partial rho=+0.008 p=0.692     -> weak

==> VERDICT: REFINE
```

Three readings:

1. **Positive control is clean** — difficulty genuinely varies by
   question type (p ≈ 9e-44), so the difficulty measure is valid, not
   noise. The test can be trusted.
2. **Image properties *do* predict per-case difficulty with the
   question held fixed**, and highly significantly (entropy p = 3e-8,
   consistent across three of four proxies). So the premise isn't
   empty — the signal is real.
3. **But it's weak (|partial ρ| ≈ 0.08–0.11) and negative.** Negative
   is the surprising, useful part: busier / higher-texture images are
   slightly *easier*, the opposite of the naive "complex image =
   harder."

The working interpretation (a hypothesis, held loosely): whole-image
texture is measuring **evidence-richness**, not **lesion subtlety**. A
busy abdominal CT gives a yes/no organ question more to go on (easier);
a sparse image gives less (harder). That's exactly why the REFINE path
is **lesion-aware complexity** — region size/contrast from SLAKE's
organ masks (`complexity_lesion.py`), where the prediction is that
difficulty rises as the region gets *small/faint* (a negative ρ, but
stronger than whole-image texture, and for the right reason). The weak
whole-image result doesn't kill the wedge; it says the crude proxy is
the wrong proxy.

---

## Phase 7 — New base model: MedVLThinker

The lead approach needs a *reasoning* model (one that emits a thinking
trace whose length can be allocated), which HuatuoGPT-Vision is not. So
the project takes a new base model: **MedVLThinker** (UCSC-VLAA,
Qwen2.5-VL, Apache-2.0). It's the right pick because it solves three
problems at once:

- It ships a **fully open stack** — code, difficulty-filtered datasets,
  checkpoints, and evaluation scripts.
- Its checkpoints emit `<think>…</think>` then `<answer>…</answer>` —
  the two-axis (accuracy *and* compute) eval format, built in.
- Its training data is **auto-filtered by pass-count difficulty** — the
  exact difficulty signal this method needs, already computed.

Training target would be `UCSC-VLAA/MedVLThinker-7B-RL_m23k`, with the
**3B** used for fast iteration first (prove the loop, then re-run on
7B). Loading uses `Qwen2_5_VLForConditionalGeneration` +
`qwen_vl_utils`.

This also changes the *unit of competition* in the project's favour:
away from "tokens retained" (a saturated, easily-tied pruning metric)
and toward the **accuracy-vs-compute frontier** — a two-axis story
that's much harder to tie.

---

## Phase 8 — Isolated environment, the Dockerfile, and the new repo

**The one real setup risk:** MedVLThinker is Qwen2.5-VL, which needs
transformers ≥ 4.49; the HuatuoGPT repo is pinned to transformers
4.37.2 (LLaVA-v1.5 era). Those cannot coexist. So the working
HuatuoGPT environment is **not touched** — the new model goes in an
**isolated venv / freshly built image**, sidestepping the dependency
wars of the v1 days while keeping the baseline intact.

New experiment repo: **`medvlthinker-imgdiff-compute`** (code lives in
the experiment folder under home, *not* in `/data`, which stays
datasets + weights only — a convention correction made today). The
MedVLThinker training repo was cloned into
`~/medvlthinker-imgdiff-compute/MedVLThinker/` (code with code). The
3B checkpoint was downloaded. Environment notes captured: the
JupyterLab `root_dir` fix is deferred to the next rebuild via
`--ServerApp.root_dir="$HOME"`.

**The Dockerfile.** This is a *new, training-capable* image — the same
NGC 25.06 / Qwen2.5-VL base as the earlier eval image
([transformers 4.49, qwen-vl-utils, flash-attn 2.7.4](../../baseline/huatuo-vision.md))
but extended for the SFT/GRPO path, with three June-2-specific
decisions baked in:

- **`trl` + `peft` added** — the training stack (GRPO via `trl`, LoRA
  via `peft`); MedVLThinker's RL path uses VERL + flash-attn.
- **flash-attn is *verify-first*, not blindly reinstalled** — the
  install line is left commented, with an instruction to first run
  `python3 -c "import flash_attn, torch; print(...)"` in the running
  container and only reinstall if the import fails. Blindly
  reinstalling flash-attn from a wheel is the #1 ABI-import-error cause
  on NGC images (a lesson from the v1 days).
- **HF caches pinned to `/data`** — `ENV HF_HUB_ENABLE_HF_TRANSFER=1`
  for fast downloads and `ENV HF_HOME=/data/hf_home` so the large
  model caches land on the shared `/data` volume, not the small root
  filesystem.

??? note "`Dockerfile` — MedVLThinker (Qwen2.5-VL) training image, NGC 25.06"

    Built and submitted through the HONGHU KUBERUN web interface
    (paste → platform builds → JupyterLab terminal is the entrypoint).
    One deviation from the canonical KUBERUN format, flagged rather
    than hidden: the per-package purpose notes sit in a comment block
    *above* each `RUN` instead of inline, because inline `#` notes
    between `\`-continued lines can break the build on some parsers —
    and a failed build is the last thing wanted on a setup day.

    ```dockerfile
    # Dockerfile — MedVLThinker (Qwen2.5-VL) image-difficulty adaptive-compute
    # Base: NGC PyTorch 25.06-py3  ->  Python 3.12, CUDA 12.9.1, PyTorch 2.8
    FROM nvcr.io/nvidia/pytorch:25.06-py3

    # --- (1) OS packages --------------------------------------------------------
    # git-lfs: pull HF checkpoints; libgl1/libglib2.0-0: opencv (qwen_vl_utils)
    RUN apt update -y && apt install -y \
        git git-lfs python3-pip libgl1 libglib2.0-0 \
        && rm -rf /var/lib/apt/lists/*

    # --- (2) empty NGC's pip constraint (pins transformers < 4.49) --------------
    # empty, do NOT delete -- pip.conf still references the path; deleting it
    # breaks every later pip call.
    RUN mkdir -p /etc/pip && echo "" > /etc/pip/constraint.txt

    # --- (3) JupyterLab (KUBERUN launch interface) ------------------------------
    RUN pip3 install --no-cache-dir jupyter jupyterlab

    # --- (4) core inference deps (Qwen2.5-VL) -----------------------------------
    # numpy<2.0: NGC torch built against numpy 1.x; 2.x is binary-incompatible
    RUN pip3 install --no-cache-dir \
        "numpy<2.0" \
        "transformers==4.49.0" \
        "qwen-vl-utils[decord]==0.0.10" \
        "accelerate" "pydantic>=2.0" "pillow" "opencv-python" "tifffile"

    # --- (5) training stack -----------------------------------------------------
    # trl (GRPO), peft (LoRA), vllm (fast 8-16x sampling for difficulty labels)
    RUN pip3 install --no-cache-dir trl peft vllm

    # --- (6) flash-attn: VERIFY FIRST, reinstall ONLY if the import fails -------
    #   Reinstalling from a pip wheel is the #1 ABI-import-error cause on NGC.
    #   In the running container run:
    #     python3 -c "import flash_attn, torch; print(flash_attn.__version__, torch.__version__)"
    #   Only if that FAILS, uncomment and rebuild:
    # RUN pip3 install --no-cache-dir flash-attn==2.7.2.post1 --no-build-isolation

    # --- (7) data mount ---------------------------------------------------------
    RUN ln -s /data /root/data

    # --- env: fast downloads + keep big HF caches on /data (not the small root FS)
    ENV HF_HUB_ENABLE_HF_TRANSFER=1
    ENV HF_HOME=/data/hf_home

    # --- (8) launch -------------------------------------------------------------
    CMD ["jupyter", "lab", "--port=8888", "--ip=0.0.0.0", "--allow-root", "--no-browser"]
    ```

**Setup after the image is up** (verify → clone recipe → pull 3B):

```bash
# 1) verify the stack built correctly
python3 -c "import torch,transformers,trl,peft,accelerate; print(transformers.__version__, trl.__version__)"
python3 -c "import flash_attn,torch; print('flash',flash_attn.__version__)"   # if FAILS, see Dockerfile step (6)

# 2) clone the recipe INTO the experiment folder (code with code, not /data)
cd ~/medvlthinker-imgdiff-compute && git clone https://github.com/UCSC-VLAA/MedVLThinker.git

# 3) pull the 3B RL checkpoint (fast-iteration model; 7B once the loop is proven)
huggingface-cli download UCSC-VLAA/MedVLThinker-3B-RL_m23k --local-dir /data/models/MedVLThinker-3B-RL_m23k
```

The staged route once the gate clears: (1) MedVLThinker inference +
reproduce its accuracy on SLAKE/VQA-RAD via its own harness (sanity +
comparability), (2) difficulty extraction on *this* model — the
definitive gate **and** the training labels in one pass, (3) launch
the first training run. "Training launched and stepping" is achievable
once the env cooperates; a *finished* GRPO run is hours-to-days of
compute.

---

## Phase 9 — The definitive 3B gate: a `--limit` trap, then sharded inference across two VMs

The three gate scripts were written/finalized for the new model —
**`build_subset.py`** (SLAKE yes/no closed, stratified),
**`difficulty_medvlthinker.py`** (the inference workhorse — `load_model`
/ `sample` / `parse_yes_no`, emitting pass-count difficulty), and
**`complexity.py`** (the question-free image-complexity features) —
with `analyze.py` and `complexity_lesion.py` as the downstream decision
step for next session. Then the definitive gate was run on the
MedVLThinker 3B, and it took two corrections to get to a trustworthy
launch.

**The `--limit 800` trap (caught, owned).** The first 3B run used
`difficulty_medvlthinker.py --limit 800` for speed and came back
NO-GO — but it was a **sampling artifact, not a real null.**
`subset.csv` is written *grouped by stratum* (`build_subset.py` orders
rows by `(question_type, modality)`, and Organ/CT alone is 878 rows),
so the first 800 rows were almost entirely a single stratum: only 220
unique images, just **n=6** strata clearing the threshold (vs n=16 on
the full HuatuoGPT run), and the positive control collapsed from
**H=215 to H=32.** Within a near-homogeneous slice the within-stratum
test has nothing to discriminate on. Logged honestly as Claude's
mistake — the `--limit` shortcut was wrong for a stratum-sorted file —
and explicitly *not* counted as a result.

**The fix.** Reissue `build_subset.py` with a seeded
`random.shuffle(out)` (seed=42) right before the write, so any
`--limit` samples across all strata and the full run is order-robust.
Counts are unchanged (shuffling only reorders); the stale biased
`difficulty.csv` is overwritten cleanly by the rerun.

**Sharding across two VMs.** With the full run at ~1.5–2 hr, and two
A100s available, `difficulty_medvlthinker.py` got a **`--num_shards 2
--shard {0,1}`** flag — an every-Nth-row stride split, each shard
writing a distinct file (`difficulty_shard0of2.csv` /
`difficulty_shard1of2.csv`). Shard 0 runs on VM-A, shard 1 on VM-B, and
because the two VMs **share one filesystem** (home *and* `/data` — they
clarified there's genuinely a single filesystem with two compute
attachments), both shard files land in the same folder with no copying.
The one real risk the shared filesystem introduces is a write race, so
the rule is: build `subset.csv` **once** (let it finish), then launch
both shards; the distinct per-shard filenames mean they never collide.

```bash
# ONCE, on either VM — the single shared subset.csv (seed=42 shuffled):
python3 build_subset.py            # -> "wrote subset.csv: 2394 ..."

# VM-A:                            # VM-B (after subset.csv exists):
python3 difficulty_medvlthinker.py --num_shards 2 --shard 0
python3 difficulty_medvlthinker.py --num_shards 2 --shard 1
```

Both shards were **left running inference on the 3B across the two
VMs** at end of day — each sampling the model G times per case to
build the pass-count difficulty (which is also the eventual training
label). When both print their final `wrote … rows` line, the next
session merges them (de-dup by `qid`, expect ~2394) into
`difficulty.csv`, then runs `complexity.py` → `complexity_lesion.py`
(SLAKE organ masks — the real REFINE input) → `analyze.py` for the
GO / stop-and-reconsider verdict. The deal stands: a clean, full,
shuffled run *with lesion features* governs the decision — a NO-GO on
texture-only on a biased subset decides nothing.

---

## Honest ledger of the day

1. **Clean-slate hunt done** — RL/GRPO crowded; two survivors (B; the
   adaptive-compute lead).
2. **Direction B torn down** — re-enters the saturated token-scoring
   arena where random already won; viable only in a narrow
   cross-attention-on-lesion-benchmarks form, and even then a
   coin-flip.
3. **The wedge identified** — image-derived, pre-generation difficulty
   → reasoning-compute allocation in medical VLMs. Mechanism is
   commoditized; novelty lives in the *signal*.
4. **The method specced** — externalize difficulty by sampling
   (pass-count), then either an input-side **budget router**
   `(image, question) → {answer-now / short-CoT / long-CoT}` (start
   here) or difficulty-aware GRPO. The Direction-D "no readable
   internal signal" dead end *is* the motivation for externalizing;
   the metric becomes the accuracy-vs-compute frontier.
5. **Falsification test built and run** — REFINE: image→difficulty is
   real and highly significant but weak (|ρ| ≤ 0.11) and *negative*
   (busier = easier). Whole-image texture likely measures
   evidence-richness, not lesion subtlety → refine with lesion-aware
   complexity.
6. **New base model selected** — MedVLThinker (Qwen2.5-VL, open stack,
   `<think>`/`<answer>`, pass-count difficulty data). 3B downloaded.
7. **New training-capable environment built** — isolated image
   (transformers 4.37 vs ≥4.49 conflict keeps HuatuoGPT untouched):
   Qwen2.5-VL base + `trl`/`peft`/`vllm`, flash-attn verify-first,
   HF caches pinned to `/data`. New repo `medvlthinker-imgdiff-compute`
   (code in the experiment folder, not `/data`).
8. **Definitive 3B gate launched, sharded across two VMs.** Wrote the
   three gate scripts (`build_subset.py`, `difficulty_medvlthinker.py`,
   `complexity.py`); the first `--limit 800` 3B run was caught and
   discarded as a sampling artifact (stratum-sorted subset → one
   stratum, positive control collapsed H=215→32); fixed by seed-shuffling
   `build_subset.py`, sharded `difficulty_medvlthinker.py`
   (`--num_shards 2 --shard 0/1`), and left **inference running on the
   3B across both VMs** overnight. Next session merges → complexity →
   lesion → analyze for the GO/stop verdict.

This is the first direction in weeks that isn't a salvage of a dead
path — it reuses the *infrastructure and the lessons* (the early-exit
dead end becomes the motivation; the saturated tokens-retained metric
is abandoned for an accuracy-vs-compute frontier) without inheriting
the failures.

!!! note "On the project's direction"
    The site and project name still say *question-aware visual token
    pruning*. Today is a clean-slate pivot to **image-difficulty-driven
    adaptive reasoning-compute allocation** on a new base model
    (MedVLThinker). It is the most decisive direction change of the
    project — a new repo, a new model, a new metric — but the rebrand
    stays deferred until the falsification gate fully clears and
    training is underway, on the same discipline that's governed every
    pivot here.

---

### Plan for tomorrow (June 3, Day 25 / Week 4 Day 4)

- [ ] **Merge the two difficulty shards** (`difficulty_shard0of2.csv`
      + `…1of2.csv`, expect ~2394 with qid de-dup) once both print
      their final `wrote … rows` line.
- [ ] **Run the lesion-aware refinement** —
      `complexity.py` → `complexity_lesion.py` (SLAKE organ-mask region
      size/contrast) → `analyze.py`. The lesion-augmented verdict on
      the full set is the real decision point: **GO** vs.
      stop-and-reconsider.
- [ ] If GO: MedVLThinker 3B inference + reproduce its SLAKE/VQA-RAD
      accuracy via its own harness (sanity + comparability), then
      difficulty extraction on the 3B as the training labels.
- [ ] Commit the `medvlthinker-imgdiff-compute` scaffold (base scripts
      + README) once the gate verdict is in.

---

## Pushed today

**No code push.** The new-direction scripts (`build_subset.py`,
`difficulty_medvlthinker.py`, `complexity.py`, `complexity_lesion.py`,
`analyze.py`, `README.md`) live in the freshly created
`medvlthinker-imgdiff-compute` repo, and the definitive 3B difficulty
gate is still **running inference sharded across both VMs**
(`difficulty_shard0of2.csv` / `difficulty_shard1of2.csv`). The commit
and push come once both shards finish, the lesion-aware verdict lands,
and the scaffold is finalized — Leo explicitly held the push until
then.
