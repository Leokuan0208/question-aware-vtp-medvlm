# Week 3 — Qwen2.5-VL baseline and codebase deep-dive

<span class="pill pill--wip">In progress</span>

**Phase 1 of 7** (Baseline & Literature, closing out) → **Phase 2
beginning** (Codebase deep-dive) · **Week 3 of 12**

**Goal of the week** — establish the canonical unpruned Qwen2.5-VL
baseline on VQA-RAD / SLAKE / PathVQA via VLMEvalKit (the standardized
evaluation backbone the field has converged on), and start porting
the `random` and `qsim` pruning methods from the frozen v1.0 codebase
onto Qwen2.5-VL's decoder layers. The May 21 pivot decision now needs
to be paid off with real numbers on the new stack.

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

---

## Plan for the rest of the week (May 25 – May 30)

- [x] Verify Qwen2.5-VL weight download integrity (Day 1)
- [x] Qwen2.5-VL load smoke test on A100 (Day 1)
- [x] MCQ-letter compliance smoke test — **20/20 strict** validates
      the pivot (Day 1)
- [x] Repo reorganization — freeze old, init new (Day 1)
- [ ] Install **VLMEvalKit** into the container, pinned for
      reproducibility
- [ ] Wire up Qwen2.5-VL as a VLMEvalKit model with the cached
      weights path
- [ ] Run VLMEvalKit on **VQA-RAD closed** (full 272-question
      canonical set) — produces the **unpruned-baseline number** every
      pruning experiment will be measured against
- [ ] Repeat for **SLAKE** and **PathVQA** closed
- [ ] Port `RandomPruning` from the frozen v1.0 code onto Qwen2.5-VL's
      decoder layers — the scoring math is the same; only the hook
      target changes from `LlavaLlamaModel.model.layers` to
      Qwen2.5-VL's equivalent
- [ ] Port `QuestionSimilarityPruning` the same way
- [ ] First kr=0.75 ablation on the new stack — comparable, finally,
      to the literature
- [ ] Read **ToMe** end-to-end (still pending from Week 2)
- [ ] Skim **SparseVLM** and **GAP**

---

## Reflections (end-of-week)

_Write this at the end of the week. The Day-1 milestone (pivot
validated) opens up the rest of Phase 1 — establishing a real,
defensible baseline on Qwen2.5-VL — and the transition into
Phase 2 (codebase deep-dive into Qwen2.5-VL's architecture)._
