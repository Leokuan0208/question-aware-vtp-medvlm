# Day 4 — Wednesday, May 20, 2026

[← Back to Week 2 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 2, Day 4 · **Day 11
of the project**

---

Second travel day. Read two papers: **MedPruner** (closest
medical-domain prior art) and **SwiftVLM** (cross-layer token
bypass).

## MedPruner

Liu et al., *"MedPruner: Training-Free Hierarchical Token Pruning
for Efficient 3D Medical Image Understanding in VLMs,"* arXiv 2026
(preprint). [arXiv:2603.11625](https://arxiv.org/abs/2603.11625) ·
CUHK + Westlake University collaborators.

The closest published method to ours by domain — Medical VLM,
training-free, attention-based pruning. The notable differences:

- **3D medical imaging** (CT, MRI volumes), not the 2D radiology /
  pathology / general-medical we work on. Their pruning operates
  across slices, not within single images.
- **Hierarchical selection** — they prune slice-level first, then
  patch-level within retained slices. The two-stage structure is
  motivated by the 3D shape; for 2D images the analogous
  decomposition would be patch-group → patch, which doesn't quite
  map.
- **Pure attention scoring**, similar to FastV, not question-aware.
  They don't condition on the text prompt for token selection.

**Takeaway.** It's reassuring that there *is* a medical-domain
prior art on training-free VLM pruning — having a paper that
explicitly belongs in the same neighbourhood strengthens the
"medical VLM pruning is a thing people care about" story for the
related-work section of a future writeup. But the methodological
overlap is modest: they're 3D + attention-scoring + hierarchical,
we're 2D + question-similarity + single-stage. The methods are
complementary rather than competing, which is good — we're not
duplicating their work.

## SwiftVLM

Qian et al., *"SwiftVLM: Efficient Vision-Language Model Inference
via Cross-Layer Token Bypass,"* arXiv 2026 (preprint, Feb 2026).
[arXiv:2602.03134](https://arxiv.org/abs/2602.03134) · Tsinghua
University.

The most interesting paper I've read for the project so far.

### The core idea: bypass instead of drop

Existing methods (FastV, ours, etc.) prune visual tokens at some
chosen layer and **commit** to that decision — pruned tokens never
re-enter the computation. SwiftVLM observes a real problem with
this: **a visual token's importance is not consistent across
layers.** Through layer-wise analysis they show that tokens deemed
unimportant at shallow layers can become highly relevant for
text-conditioned reasoning later in the stack. Early pruning
permanently loses that information.

SwiftVLM's fix is the **bypass paradigm**: pruned tokens at layer K
aren't dropped from the computation graph — they're held in a
"bypass buffer" and forwarded to the next pruning stage at some
later layer K′, where they're re-considered. Independent pruning
decisions at each stage; no irreversible loss.

### Why this matters to our project

This is **directly relevant to the "where in the LLaMA stack to
prune?" question** that's been an open design choice since Day 1
(see [Project Overview, Approach (sketch)](../../project.md#the-method)).
The FastV reading from yesterday already argued for "later than
layer 0" — SwiftVLM goes further and argues that *no single layer*
is the right answer, that pruning should be a multi-stage decision
across the stack with re-evaluation.

Practical implications for our codebase:

- **The current single-layer pruning architecture is a strict
  subset of SwiftVLM's design space.** Implementing bypass would be
  a substantial refactor of the hook architecture — we'd need to
  maintain a separate "bypass set" of tokens that exit the prune
  decision but stay in the cache, and re-introduce them at later
  layers with their original position IDs intact.
- **It's a natural Phase 3+ extension.** The simpler question we're
  testing now — "does question-similarity beat random pruning?" —
  doesn't need bypass to answer. But once we have the Pareto curve
  for single-layer pruning, the next experiment is "does bypass
  improve the Pareto frontier?" and SwiftVLM gives us a recipe.

### Caveats from a critical reading

A few things to be careful about before adopting bypass uncritically:

- **No medical-domain results.** SwiftVLM is evaluated on standard
  VLM benchmarks (MMBench, POPE, MME, ScienceQA, TextVQA), not on
  medical VQA. The "fine-grained visual details" they highlight as
  the regime bypass helps with sound like they'd apply to medical
  images, but that's an extrapolation.
- **Bypass has memory cost.** Holding pruned tokens in a buffer
  defeats some of the memory savings pruning was supposed to
  provide. SwiftVLM doesn't headline-report this; need to check the
  actual memory measurements before adopting.
- **The right comparison is bypass vs. "prune later."** If pruning
  at layer 5 (instead of layer 0) already captures most of the
  benefit, the marginal value of bypass over "just prune at a
  better single layer" might be small. SwiftVLM should report this
  ablation; need to look for it.

## Notes added to `resources.md`

Both papers added under the visual-token-pruning section. Both also
appear in the related-work table on the
[Project Overview](../../project.md#related-work).

---

### Plan for tomorrow (May 21, back at the desk)

- [ ] First thing: check whether the `nohup` kr ∈ {0.50, 0.25, 0.10}
      ablation sweep that launched at the end of Day 1 finished
      cleanly. Three days of travel means three days of background
      compute on the server.
- [ ] If results are in: build the Pareto curve and update the
      [Experiments](../../experiments.md) page.
- [ ] If anything went wrong: re-launch and use the time to start
      sketching an attention-based scoring variant (the FastV
      lesson from Day 3).

---

## Pushed today

_No code push — reading day. Both papers' citation entries added to
[`resources.md`](../../resources.md) and the related-work table on
[`project.md`](../../project.md)._
