# Week 3 — Baseline selection & paper reproduction setup

<span class="pill pill--wip">In progress</span>

**Phase 1 of 7** (Baseline & Literature, closing out) · **Week 3 of
12**

**Goal of the week (as planned May 23)** — establish the canonical
unpruned Qwen2.5-VL baseline on VQA-RAD / SLAKE / PathVQA via
VLMEvalKit, then start porting the `random` and `qsim` pruning
methods.

**Goal of the week (as revised May 25)** — set up HuatuoGPT-Vision-7B
(LLaVA-v1.5 architecture) as the active baseline and reproduce its
published Table 4 numbers across six benchmarks. The May 21 →
May 24 → May 25 pivot chain landed on a base model where
*reproducibility comes first*: the authors publish weights, eval
data, a one-command pipeline, and a target Table.

This page is the **overview** — a short summary of each day. Click
any day's heading for the full detail page.

---

### [Day 1 — Sunday, May 24, 2026](day-01.md)

Pivot validation day. Confirmed the Qwen2.5-VL weight download
completed cleanly (16 GB, 5 shards, all config/tokenizer/processor
files present); load smoke test passed (8.29B params, bf16,
flash-attn 2, ~16.6 GB GPU mem, 8.8s cold load); processor and
tokenizer come up with `Qwen2VLImageProcessor` and `Qwen2TokenizerFast`.
**The decisive test: 20/20 strict MCQ-letter compliance** on a 20-sample
VQA-RAD smoke test, against LLaVA-Med v1.0's 0/11 on the equivalent
test on May 20. Side observation: 75% letter-correct on the same 20
samples — in the ballpark of published Qwen2.5-VL VQA-RAD closed
numbers. **The pivot is validated.** Then a brief detour reorganizing
the project's repos: tried Option A (single repo with `llava_med_v1/`
+ `qwen25vl/` subfolders), reverted to Option B (two separate repos)
— `llava-med-pruning-v1` frozen with a status-notice README commit on
top of `14a62d3`, fresh `medical-vlm-pruning` repo initialized with a
flat `scripts/ pruning/ eval/` layout. First artifact committed:
`scripts/mcq_compliance_smoke.py`, polished to silence both transformer
warnings and write durable per-run JSON.

### [Day 2 — Monday, May 25, 2026](day-02.md)

A "decision day" that became a four-milestone execution day. Came
in planning the VLMEvalKit setup, ended with a **second pivot** —
to **HuatuoGPT-Vision-7B (LLaVA-v1.5 architecture)** for
reproducibility — *and* paper Table 4 reproduced same-day. Discovery
chain: literature survey for expected Qwen2.5-VL baselines →
preprocessing isn't reproducible → checked VLMEvalKit/lmms-eval
registry and discovered (correcting the May 21 claim) **neither
harness has VQA-RAD/SLAKE/PathVQA built in** → surveyed published
test suites → considered HuatuoGPT-Vision-7B as base model →
**final decision** based on its published weights / bundled eval data
/ one-command pipeline / target Table. Two repo transitions today:
`medical-vlm-pruning` renamed → `Qwen-v25-vl-med-pruning` frozen at
`c5ce256` (Qwen2.5-VL 20/20 smoke test preserved as artifact); new
`huatuo-llava-v15-med-pruning` initialized + pruning framework pushed
at `c216bbe`. HuatuoGPT-Vision Dockerfile drafted and **image built
cleanly on KUBERUN first attempt** (the constraint-file and NumPy-pin
lessons from Day 5 carried over). After two runtime dependency
patches (`hf_transfer`, `datasets==2.16.1`), `accelerate launch
eval.py` ran end-to-end: **5 of 6 benchmarks within 0.55 pts of
paper** (VQA-RAD 61.35, SLAKE 76.44, PathVQA 57.67, PMC-VQA 54.20,
OmniMedVQA 73.46, MMMU H&M 50.34). With baseline reproduction
validated, wrote the pruning framework (RandomPruner + QSimPruner +
LatencyTracker, integrated via `Qwen2Model.forward` override +
layer-0 KV cache slicing), verified by 5 unit smoke tests + a
1,500-sample real-model match at kr=1.0 (100% identical to baseline).
Closed the day with an **8-run overnight sweep** launched in tmux
(4 keep-ratios × 2 methods, ~12 hours).

### [Day 3 — Tuesday, May 26, 2026](day-03.md)

A debugging-and-rewrite day. Morning smell-test of yesterday's
sweep found **bit-identical scores across all 8 configurations** —
yesterday's 8-run sweep was a no-op. Root cause: HuatuoGPT-Vision
forks LLaVA's `prepare_inputs_labels_for_multimodal` into a
`_new`-suffixed variant and routes everything through it; our
patcher wrapped the original, which exists on the class but is
dead code in HuatuoGPT's path. One-line fix exposed two more bugs
in sequence — **the v1 fix cascade**: attention-mask frame
reconciliation between HF generate's unpruned-frame state and our
pruned-frame KV cache, then position_ids RoPE index-out-of-bounds
from HF passing unpruned-frame indices into our pruned-frame
rotary tables. All three fixed; v1 ran 545+ samples cleanly.
Then the architectural lesson surfaced: trunk-modification has a
fragile integration tax that doesn't actually buy anything for
QSim under causal attention (visual tokens can't attend forward to
question tokens at any layer). Rewrote as **v2: prune visual
tokens BEFORE the LLM trunk runs**, dropping code from 280 → 130
lines and ~30% of inference latency at kr=0.5. v2 smoke-tested,
both patcher commits pushed
([`72bdd28`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/72bdd28),
[`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249)),
the **8-run v2 sweep** relaunched and completed cleanly in ~4-5
hours. Result files committed at
[`24ef568`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/24ef568);
numerical analysis deferred to Day 4 with a fresh head. In parallel,
two thick literature surveys: **(1)** cosine-similarity scoring
positioned against ZSPAPrune (uses our formula as the "relevance"
phase) and ResPrune (evaluates our formula as their Setting-3
baseline, the weakest of three formulations); **(2)** token
merging vs pruning and three medical-VQA properties
(background-to-signal, lesion localization, question-type structure)
that shape a new **Methods Roadmap (Tier 1/2/3)** added to the
project page.

### [Day 4 — Wednesday, May 27, 2026](day-04.md)

An analysis-and-pivot day. Crunched yesterday's v2 sweep into
proper tables and Pareto plots — and got a result that's the
*opposite* of what the central thesis predicted: **Random pruning
beats mean-pooled QSim at every keep-ratio**, and the gap *grows*
as pruning becomes more aggressive (+0.84 → +1.92 → +2.77 → +3.11
pts on the total score as kr drops from 0.75 to 0.10). The
afternoon's same-day **qsim_max ablation** (max-reduction instead
of mean-pool, motivated by ResPrune's Setting-1 ≈ 98.4% vs
Setting-3 ≈ 95.4% published gap) returned the *third* outcome —
qsim_max is uniformly *worse* than qsim_mean, which is itself
uniformly worse than Random. No exceptions, no crossovers. The
mean-pool was acting as a weak diversity regularizer; removing it
made things worse. Diagnosis: **the failure mode is structural to
text-only scoring on pre-LLM embeddings**, not specific to the
reduction operator. The LLM doesn't care which visual tokens
*look like* question words — it cares which it would have
*attended to*. Random beats both because it doesn't try to be
clever in a space that doesn't reward cleverness. The fix points
at two directions, both implemented and queued for tonight's
overnight: **GridPrune** (zonal-budget coverage-aware selection,
faithful to Duan et al., arXiv:2511.10081) and **FASP+GridPrune**
(composed method: FASP anatomy filter → zone budget by fused
text-relevance + saliency → local top-K within each zone). The
patcher also got a latency-decomposition rewrite tonight — prune
/ prefill / decode brackets land automatically for any method.
Re-running Random alongside tonight's two new methods provides
both a phase-decomposed baseline and a drift check on yesterday's
accuracy numbers. Three commits pushed:
[`43fca4d`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/43fca4d)
(gitignore tighten),
[`54121f2`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/54121f2)
(qsim_max sweep results),
[`cd1ef3c`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/cd1ef3c)
(analysis script + tables + 3 Pareto plots). Plus an hour spent
reading MedPruner (Liu et al., March 2026) — confirmed orthogonal
(3D volumes vs our 2D single-image), good positioning for the
future writeup.

---

## Plan for the rest of the week (May 26 – May 30)

- [x] Verify Qwen2.5-VL weight download integrity (Day 1)
- [x] Qwen2.5-VL load smoke test on A100 (Day 1)
- [x] MCQ-letter compliance smoke test — **20/20 strict** validates
      the pivot (Day 1)
- [x] Repo reorganization — freeze old, init new (Day 1)
- [x] Literature survey for expected baseline numbers (Day 2)
- [x] Final base-model decision: HuatuoGPT-Vision-7B (LLaVA-v1.5
      architecture) (Day 2)
- [x] Repo transition: `Qwen-v25-vl-med-pruning` frozen,
      `huatuo-llava-v15-med-pruning` initialized (Day 2)
- [x] HuatuoGPT-Vision Dockerfile drafted and image built on KUBERUN
      (Day 2)
- [x] Clone HuatuoGPT-Vision repo; download weights (~14 GB) (Day 2)
- [x] Download `Medical_Multimodal_Evaluation_Data` (Day 2)
- [x] **Paper Table 4 reproduction: 5/6 within 0.55 pts** (Day 2)
- [x] Port `RandomPruning` and `QuestionSimilarityPruning` onto
      HuatuoGPT-Vision-7B's decoder layers (Day 2; commit `c216bbe`)
- [x] Verify pruning framework: 5 unit smoke tests + 1500-sample
      real-model match at kr=1.0 (Day 2)
- [x] Launch overnight sweep: 4 keep_ratios × 2 methods = 8 runs in
      tmux (Day 2; results land Day 3)
- [x] Smell-test the overnight sweep — **caught a no-op bug**: all
      8 runs produced bit-identical scores. Diagnosed as the wrong
      monkey-patch target (Day 3)
- [x] **v1 fix cascade** — three real bugs fixed: method rename to
      `_new` variant, attention-mask frame reconciliation,
      position_ids RoPE index-out-of-bounds (Day 3; archived as
      `pruning/archive/patcher_v1_post_layer0.py` at
      [`72bdd28`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/72bdd28))
- [x] **v1 → v2 architectural rewrite** — pre-LLM pruning instead
      of post-layer-0; 130 lines vs 280, ~30% speedup at kr=0.5
      (Day 3; commit
      [`85cb249`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/85cb249))
- [x] **8-run v2 sweep completed** — first successfully-pruned
      sweep on this codebase; results committed at
      [`24ef568`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/24ef568)
      (Day 3; numerical analysis deferred to Day 4)
- [x] Cosine-similarity literature positioned against ZSPAPrune,
      ResPrune, SparseVLM, FastV, FasterVLM, VisionZip,
      LLaVA-PruMerge, HoloV (Day 3)
- [x] Token-merging literature surveyed; hybrid prune+merge frameworks
      (PuMer, LLaVA-PruMerge, AIM) characterized; medical-VQA
      properties → Methods Roadmap Tier 1/2/3 written (Day 3)
- [x] **Numerical analysis of the v2 sweep** — Pareto curves
      (accuracy vs keep-ratio, accuracy vs latency), 12-row
      comparison table with deltas, headline finding: **Random
      beats QSim at every kr; gap grows monotonically with
      aggressiveness** (Day 4)
- [x] **Tier-1 follow-up: max-similarity scoring** — qsim_max
      sweep ran the same afternoon. Result: qsim_max is uniformly
      *worse* than qsim_mean, which is uniformly worse than
      Random. Diversity-collapse hypothesis strengthened (Day 4;
      commit
      [`54121f2`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/54121f2))
- [x] **`results/` gitignore tightening** — narrow the blanket
      rule to large per-run files only, so future sweep commits
      pick up scores/latency/eval.log without `git add -f` (Day 4;
      commit
      [`43fca4d`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/43fca4d))
- [x] **Analysis pipeline landed** — `analyze_v2_sweep.py` with
      schema-discovery dump, 12-row table, 3 Pareto plots (Day 4;
      commit
      [`cd1ef3c`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/cd1ef3c))
- [x] **Latency decomposition added to the patcher** —
      `prune_time_s` / `prefill_time_s` / `decode_time_s` fields
      bracketed automatically for any method; instrumentation
      lands in tonight's sweep (Day 4)
- [x] **GridPrune implemented** as a standalone baseline (Wang
      et al. 2025; zonal budget + fused text-relevance + saliency)
      (Day 4)
- [x] **FASP+GridPrune implemented** — our composed method:
      anatomy filter → zone budget by fused score → local top-K
      within each zone (Day 4)
- [x] **MedPruner read** (Liu et al., March 2026) — confirmed
      orthogonal (3D volumes vs our 2D single-image); clean
      complementary positioning for the writeup (Day 4)
- [ ] **Tonight's overnight sweep results land Day 5** — 12 runs
      = {random, gridprune, fasp_gridprune} × {kr=0.75, 0.5, 0.25,
      0.1}, ~15 hours total
- [ ] Write up E2 (qsim_mean / qsim_max sweep) on the
      [Experiments page](../../experiments.md)
- [ ] Begin E3 entry (GridPrune / FASP+GridPrune sweep) once Day
      5's analysis lands
- [ ] Fold `hf_transfer` and `datasets==2.16.1` into the Dockerfile
      so the next image rebuild doesn't need runtime patching
- [ ] Read **ToMe** end-to-end (still pending from Week 2)
- [ ] Skim **SparseVLM** and **GAP**

---

## Reflections (end-of-week)

_Write this at the end of the week. Two pivots in two days felt like
flailing on Day 2; whether it was actually flailing or whether it
was the right call gets decided by whether the HuatuoGPT-Vision
reproduction lands cleanly. If Table 4 reproduces within ~2 pts, the
pivot chain was navigation; if it doesn't, the pivot chain was
churn._
