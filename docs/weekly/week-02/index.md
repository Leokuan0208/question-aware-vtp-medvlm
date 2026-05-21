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

---

## Plan for the rest of the week (May 18 – May 23)

- [x] kr=0.75 ablation result landed Day 1 (qsim +3.30 over random)
- [x] Site cleanup (Day 2): project.md rewrite + CSS additions
- [x] FastV read end-to-end (Day 3)
- [x] MedPruner read (Day 4)
- [x] SwiftVLM read (Day 4); added to Related Work + Resources
- [ ] Check the kr ∈ {0.50, 0.25, 0.10} sweep — launched end of Day 1,
      still running in the background through three days of travel
- [ ] Build the Pareto-frontier table (accuracy vs keep-ratio) for
      the Experiments page once results are in
- [ ] Push the Day 1 changes to GitHub (`llava-med-pruning-v1`)
      after splitting into coherent commits
- [ ] Read **ToMe** end-to-end (token merging vs pruning framework)
- [ ] Skim **SparseVLM** and **GAP**
- [ ] Design an attention-based scoring variant (FastV-style) as a
      second pruning method for comparison
- [ ] Repeat the VQA-RAD ablation on SLAKE and PathVQA (the two
      additional benchmarks) — assuming Day-1 results are encouraging
- [ ] Update [Bug #5](../../bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible)
      with the revised broken-deltas narrative

---

## Reflections (end-of-week)

_Write this at the end of the week. The Day-1 milestone (first
working pruning method) sets up the central research question for
the rest of Week 2: does question-awareness beat random pruning?_
