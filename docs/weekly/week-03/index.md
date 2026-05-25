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

### [Day 2 — Sunday, May 25, 2026](day-02.md)

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
- [ ] Analyze the overnight sweep results; plot the Pareto curves
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
