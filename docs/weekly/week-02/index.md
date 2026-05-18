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

---

## Plan for the rest of the week (May 18 – May 23)

- [x] kr=0.75 ablation result landed Day 1 (qsim +3.30 over random)
- [ ] Run the rest of the Pareto curve on VQA-RAD: random vs qsim
      at kr ∈ {0.50, 0.25, 0.10}, ~60 min total
- [ ] Build the Pareto-frontier table (accuracy vs keep-ratio) for
      the Experiments page
- [ ] Push the Day 1 changes to GitHub (`llava-med-pruning-v1`)
      after splitting into coherent commits
- [ ] Read FastV end-to-end (closest prior art; same decode-step
      coordination problem solved)
- [ ] Read ToMe end-to-end (token merging vs pruning framework)
- [ ] Skim SparseVLM and GAP
- [ ] If kr ablation shows qsim ≈ random, design a second pruning
      method (cross-attention scoring, or FastV-style layer-K
      attention scoring)
- [ ] Repeat the VQA-RAD ablation on SLAKE and PathVQA (the two
      additional benchmarks) — assuming Day-1 results are encouraging
- [ ] Update [Bug #5](../../bugs.md#5-llava-med-v10-published-per-dataset-fine-tuned-deltas-are-not-paper-reproducible)
      with the revised broken-deltas narrative

---

## Reflections (end-of-week)

_Write this at the end of the week. The Day-1 milestone (first
working pruning method) sets up the central research question for
the rest of Week 2: does question-awareness beat random pruning?_
