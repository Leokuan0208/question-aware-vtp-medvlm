# Day 3 — Tuesday, May 19, 2026

[← Back to Week 2 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 2, Day 3 · **Day 10
of the project**

---

Travel day. No coding — read **FastV** end-to-end on the plane.

## What FastV does

Chen et al., *"An Image is Worth 1/2 Tokens After Layer 2,"* ECCV
2024 (Oral, top-2%).
[ECVA PDF](https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/10478.pdf)
· [arXiv:2403.06764](https://arxiv.org/abs/2403.06764)

Training-free visual-token pruning for VLMs. The core observation:
**inside the LLM, after the first 1-2 decoder layers, attention from
generated tokens to visual tokens collapses dramatically** — most
visual tokens receive negligible attention from then on. So you can
identify which visual tokens *will* be ignored and drop them after
layer K (typically K=2-3 for LLaVA-1.5) with minimal accuracy loss.
The selection is done by averaging attention weights from all
non-visual tokens to each visual token at layer K, and keeping the
top-K' by attention.

## Why I cared about this paper specifically

Two reasons. First, it's the *canonical* prior art for this style of
method — anyone working on visual-token pruning has to address it.
Second, my Day 1 implementation hit a real engineering problem
around `generate()` and decode-step `attention_mask` coordination
(the five-iteration debugging saga in
[Week 2, Day 1, Phase 12](day-01.md#phase-12-the-decode-step-debugging-saga-5-iterations));
FastV's published implementation solves the same problem and I
wanted to see how cleanly.

## Takeaways relevant to our method

The reading shifted my thinking on a few of the open design
questions:

- **Pruning at layer 0 (our current choice) is probably suboptimal.**
  FastV explicitly argues against early pruning — at layer 0 the
  question representation hasn't yet formed in the residual stream,
  so the question-conditioned scoring has weaker signal than it
  would at layer 2-3. They run an ablation across K ∈ {0, 1, 2, 3,
  4, 5} and find K=2 is the sweet spot. This is consistent with the
  "Open design choices" note already on the
  [Project Overview](../../project.md#approach-sketch) page —
  but the FastV reading promotes it from "thing to consider" to
  "thing the literature has already settled."
- **Attention-based scoring is the established baseline.** FastV
  scores visual tokens by *received attention from non-visual
  tokens at layer K*, not by similarity to a pooled question
  embedding. Our cosine-similarity-to-question approach is simpler
  but it's not what the field has converged on. A clean attention-
  based scoring variant should be the next pruning method we
  implement and put on the comparison plot.
- **The `generate()` integration is cleaner than ours.** FastV
  overrides `LlamaModel.forward` and `LlamaModel._prepare_decoder_attention_mask`
  directly rather than using hooks + monkey-patching
  `prepare_inputs_for_generation`. The result is fewer indirections,
  no per-sample state, and (presumably) lower overhead. Worth a
  refactor when we have a quiet day; not urgent because our current
  approach works.
- **Position-ID handling is glossed over.** FastV doesn't discuss the
  position-ID re-alignment problem in detail. That's exactly what
  [GAP](../../resources.md#visual-token-pruning-the-actual-core-of-this-project)
  (Chien et al., arXiv 2025) fixes — and FastV is one of the methods
  GAP explicitly argues was *wrong* about position IDs. Reading GAP
  next would be a natural complement.

## Notes added to `resources.md`

Added a "Read May 19" marker and the takeaway about layer 2-3 being
the FastV sweet spot to the
[Resources page](../../resources.md#visual-token-pruning-the-actual-core-of-this-project)
entry for FastV.

---

### Plan for tomorrow

- [ ] Read **MedPruner** (Liu et al., 2026) — closest medical-domain
      prior art; 3D-focused but attention-based selection in a
      Medical VLM.
- [ ] Read **SwiftVLM** (Qian et al., 2026) — the "bypass" paradigm,
      where unselected tokens are forwarded to later layers for
      re-evaluation rather than committed-pruned early.

---

## Pushed today

_No code push — reading day, on a plane._
