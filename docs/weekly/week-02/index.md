# Week 2 — Pruning method first implementation

<span class="pill pill--wip">In progress</span>

**Phase 1 of 7** (Baseline & Literature, closing out) → **Phase 3
beginning** (Scoring-head v1) · **Week 2 of 12**

**Goal of the week** — close out the baseline phase (canonical
zero-shot numbers on all three datasets), then start the actual
research contribution: a question-aware visual-token pruning method
with random pruning as the comparison floor, run on VQA-RAD first.
Read at least ToMe and FastV end-to-end.

This page is the **overview** — a short summary of each day. Click
any day's heading for the full detail page.

---

### [Day 1 — Sunday, May 17, 2026](day-01.md)

The biggest day of the project so far. Morning evaluated the overnight
5-epoch full-FT: closed accuracy 0.57 vs stage-2 zero-shot 0.58 —
**memorization without generalization**, confirmed by prediction
inspection. Closed out the baseline phase with cross-validation
against Baron-GG's independently-merged stage-2 weights
(VQA-RAD 0.5772 vs our 0.58, within 0.5 pts), revised the
broken-deltas claim (VQA-RAD catastrophic, PathVQA
degraded-but-functional, SLAKE missing), wired up SLAKE end-to-end.
Afternoon shifted to the actual research contribution: built and
verified the **first working visual-token pruning method**
(in-LLM, pre-forward hooks on all 32 decoder layers, monkey-patched
`prepare_inputs_for_generation` for decode-step mask coordination,
five-iteration debugging saga). **First kr=0.75 ablation result in**:
question-similarity pruning scored 60.29 closed on VQA-RAD vs random
pruning's 56.99 (+3.30 pts) and the unpruned baseline's 57.72
(+2.57 pts) — a positive first datapoint on the project's thesis,
pending the rest of the Pareto curve.

### [Day 2 — Monday, May 18, 2026](day-02.md)

No research; full-day site cleanup pass. Rewrote `docs/project.md`
(restyled title block via a new `.project-title` CSS class, expanded
the Related Work table from 3 to 5 columns with proper venues and
links to official sources, added **MedPruner** as closest
medical-domain prior art, corrected PruMerge → ICCV 2025 and
SparseVLM → ICML 2025, restructured the Approach Mermaid diagram
into three named subgraphs). Widened the site's content area from
61rem to 80rem so wide tables and diagrams stop bleeding off-screen.
Cloned the repo to the laptop for two days of travel.

### [Day 3 — Tuesday, May 19, 2026](day-03.md)

Travel day. Read **FastV** (Chen et al., ECCV 2024) end-to-end. Two
takeaways for the project: (1) pruning at layer 2-3 is the
literature-supported sweet spot, not layer 0 — our current
single-layer-0 choice is likely suboptimal; (2) the `generate()`
integration via overriding `LlamaModel._prepare_decoder_attention_mask`
is cleaner than our hook + monkey-patch architecture and worth a
refactor on a quiet day. Also bookmarked that FastV's
attention-based scoring is the established baseline; our cosine-sim
to question is simpler but not what the field has converged on, so
an attention-based variant should be the next comparison method.

### [Day 4 — Wednesday, May 20, 2026](day-04.md)

Second travel day. Read **MedPruner** (Liu et al., 2026; CUHK +
Westlake) — closest medical-domain prior art, but 3D + attention +
hierarchical, so methodologically complementary rather than
competing. Then **SwiftVLM** (Qian et al., Tsinghua, Feb 2026) — the
most interesting paper for the project so far. Their **bypass**
paradigm holds pruned tokens in a buffer and re-evaluates them at
later layers rather than committing to early pruning decisions;
directly addresses our open "where to prune" question. Earmarked as
a Phase 3+ extension once the single-layer Pareto curve is filled
in.

### [Day 5 — Thursday, May 21, 2026](day-05.md)

The most consequential day of the project. Came back from travel to
compile the kr ∈ {0.50, 0.25, 0.10} Pareto curve and instead found
the curve's shape was anomalous — closed accuracy rising monotonically
with pruning aggressiveness up to +7.35 pts at kr=0.10 qsim, while
open recall stayed flat. Read `eval/metrics.py` carefully and found
a real **substring bug in the LLaVA-Med v1.0 closed-set scorer**
that inflates every published v1.0 closed-accuracy number by 9-12 pts
uniformly. Word-boundary scoring closes most of the gap but a residual
+6.37 pt rise remains — partly explained as verbosity-inflation on
lenient scorers. Under the strictest possible scorer (lead with
yes/no), pruning does *not* improve closed accuracy at all. Then ran
an MCQ-letter compliance smoke test against v1.0: **0/11 responses
started with a letter**, confirming v1.0's instruction-following is
fundamentally incompatible with the field's standardized eval format.
**Decision: pivot the project's base model to Qwen2.5-VL-7B-Instruct
with VLMEvalKit + lmms-eval as the evaluation backbone.** Drafted a
new Dockerfile on NGC PyTorch 25.06; first KUBERUN build failed on
a dangling `/etc/pip/constraint.txt` reference (emptied vs deleted
fix); second build's Step 1 import check surfaced a NumPy 2.x
binary-incompatibility warning that required pinning `numpy<2.0` in
the Dockerfile and a third rebuild via KUBERUN. After that, Step 1
and Step 2 verifications run clean. Step 3 (model load + 16 GB
HuggingFace weight download) started; the 4th of N safetensor shards
stopped updating its progress bar — could be a real stall, a
reporting artifact, or already-into-the-loading phase. Day ended
with the download in progress. The headline pages stay on the May 17
numbers — the research story is too in-flux to update them yet.

---

## Plan for the rest of the week (May 18 – May 23)

- [x] kr=0.75 ablation result landed Day 1 (qsim +3.30 over random)
- [x] Site cleanup (Day 2): project.md rewrite + CSS additions
- [x] FastV read end-to-end (Day 3)
- [x] MedPruner read (Day 4)
- [x] SwiftVLM read (Day 4); added to Related Work + Resources
- [x] kr ∈ {0.50, 0.25, 0.10} sweep compiled (Day 5) — anomalous
      curve shape, substring bug found in v1.0 scorer, pivot
      decision made
- [x] Substring bug in v1.0 closed-set scorer documented (Day 5)
- [x] Pivot to Qwen2.5-VL-7B-Instruct (Day 5)
- [x] Qwen2.5-VL Dockerfile drafted and image built on KUBERUN
      (Day 5) — three submissions total: original, fix for the
      constraint-file deletion error, fix for the NumPy 2.x conflict
- [x] Container running, Step 1 + Step 2 import / library
      verifications clean (Day 5)
- [ ] Confirm Step 3's HuggingFace weight download finished —
      stopped updating progress bar on safetensor 4 at end of Day 5
- [ ] Run Step 4 — MCQ-letter compliance test against Qwen2.5-VL
      (the test LLaVA-Med v1.0 failed at 0/11)
- [ ] Run zero-shot Qwen2.5-VL on VQA-RAD via VLMEvalKit — first
      reproducible baseline on the new stack
- [ ] Port `random` and `qsim` pruning to Qwen2.5-VL's decoder
      layers — the hook target changes, scoring math same
- [ ] Re-run kr ∈ {0.75, 0.50, 0.25, 0.10} ablation on the new
      stack with the correct scorer; this is the cleanest answer
      to the project's central question
- [ ] Read **ToMe** end-to-end (slipped 7+ days)
- [ ] Skim **SparseVLM** and **GAP**
- [ ] Rewrite [Bug #5](../../bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible)
      with consolidated open-recall + substring-bug findings, once
      the new baseline is stable

---

## Reflections (end-of-week)

_Write this at the end of the week. The Day-1 milestone (first
working pruning method) sets up the central research question for
the rest of Week 2: does question-awareness beat random pruning?_
