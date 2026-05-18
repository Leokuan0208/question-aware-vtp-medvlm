# Project Overview

## Title

**Question-Aware Visual Token Pruning for Medical VLMs.**

## People

| Role | Person |
| ---- | ------ |
| Researcher | Li-Wen Kuan (關力文) — Leo Kuan |
| Advisor    | Yuan-Kai Wang (王元凱) |
| Institution | Fu Jen Catholic University (輔仁天主教大學) |

## Motivation

Medical vision–language models like LLaVA-Med work by:

1. Passing an image through a vision encoder (typically a CLIP ViT)
   that produces a sequence of **visual tokens** — one per image patch
   plus a global token. For a standard 336×336 input with patch size
   14, that's 576 tokens.
2. Projecting those tokens into the language model's embedding space.
3. Prepending them to the user's text question and letting the LM
   generate an answer.

Most of those 576 tokens are not relevant to any given question. A
question like *"Is there a pneumothorax in the right lung?"* depends on
a small region of the image; the rest is noise that the model must
nonetheless attend over at full cost.

**The opportunity:** if we can identify which visual tokens matter
*for the specific question being asked* and drop the rest, we can:

- Reduce inference compute (fewer tokens through the LM).
- Potentially improve answer quality (less distractor signal).
- Make the model more interpretable (we can visualise which patches it
  kept).

## Research question

> Can a question-conditioned token-pruning mechanism preserve — or
> improve — medical VQA accuracy on standard benchmarks while
> meaningfully reducing inference cost on the LLaVA-Med baseline?

## Hypothesis

A lightweight scoring head, conditioned on the question embedding, can
rank visual tokens by relevance and prune the bottom K% with negligible
accuracy loss. We expect:

- **Lower bound:** at K = 25%, accuracy on VQA-RAD / SLAKE drops by
  less than 1 absolute point.
- **Upper bound:** at K = 50%, accuracy may drop by 2–4 points but
  latency drops more than proportionally because attention cost is
  quadratic in token count.
- **Sweet spot:** somewhere in between, ideally with a regime where
  accuracy *improves* on questions that target small image regions.

This is a hypothesis, not a result — the experiments will tell us
whether the shape of the trade-off actually looks like this.

## Related work (skim list — to read properly in Week 1–2)

| Work | What it does | Why it's relevant |
| ---- | ------------ | ----------------- |
| LLaVA-Med (Li et al., 2023) | Medical instruction-tuned VLM | Our baseline |
| ToMe (Bolya et al., ICLR 2023) | Token merging in ViTs | Pruning at the vision encoder level |
| FastV (Chen et al., ECCV 2024) | Drops visual tokens inside the LM after early layers | Closest prior art for question-agnostic VLM pruning |
| PruMerge (Shang et al., 2024) | Adaptive visual token reduction | Another VLM-side pruning approach |
| SparseVLM (2024) | Text-aware visual token pruning | Question-aware angle in general VLMs |
| GAP — Grounding-Aware Pruning | Position-ID fix after token drop | Critical correction for RoPE models |
| _Add as you read._ |  |  |

The key gap: most prior work prunes tokens **without** reference to the
question — they're question-agnostic. Our angle is making pruning
question-aware *in the medical domain*, where the question encodes
strong spatial priors (anatomy + finding type).

## Approach (sketch)

```mermaid
flowchart LR
  IMG[Input image] --> VE[Vision encoder<br/>CLIP ViT-L/14]
  VE --> VT[256 visual tokens]
  Q[Question text] --> TOK[Tokenize + embed<br/>via LM input embedding]
  VT --> PROJ[Projector<br/>Linear 1024→4096]
  PROJ --> EMB[Inject visual tokens<br/>between im_start / im_end]
  TOK --> EMB
  EMB --> L0[Layer 0 of LLaMA<br/>+ pruning hook]
  TOK -.->|question vector<br/>for scoring| L0
  L0 --> SCORE[Score visual tokens<br/>cosine sim vs question]
  SCORE --> KEEP[Top-K kept<br/>in original order]
  KEEP --> L1[Layers 1-31<br/>+ attention_mask slice]
  L1 --> ANS[Answer]
```

The pruning logic is the new component; everything else is reused
from LLaVA-Med v1.0. Each component, briefly:

- **Vision encoder + projector** are unmodified. CLIP-ViT-L/14 at
  224×224 produces 256 visual tokens at the projector output, each in
  the LLM's 4096-dim embedding space.
- **Pruning runs inside the LLM, at the input to layer 0.** This is a
  reversal of an earlier design choice — pre-projector pruning was
  attempted first but is incompatible with LLaVA-Med v1.0's forward
  pass, which validates that the number of visual feature vectors
  matches the count of `<im_patch>` placeholder tokens in the prompt.
  Pruning *after* the visual tokens are injected into the LLM's input
  sequence sidesteps the validation. This is the same insertion point
  FastV uses.
- **Scoring is cosine similarity against the pooled question
  embedding.** The question text gets tokenized and embedded through
  the LLM's input embedding layer (the only space where it's directly
  comparable to projected visual tokens), then mean-pooled to a single
  4096-dim vector. Each visual token is scored against that vector via
  cosine similarity; the top-K are kept in their original spatial
  order.
- **Hook architecture spans all 32 LLaMA decoder layers.** Layer 0's
  pre-forward hook performs the scoring, the selection, and slicing
  of `hidden_states` and `attention_mask`. Layers 1-31 each have a
  pre-forward hook that re-slices `attention_mask` to match the pruned
  sequence length the cache now holds. A monkey-patched
  `prepare_inputs_for_generation` keeps the externally-maintained
  decode-step `attention_mask` consistent with the pruned KV cache.
  All of this is hook-based and training-free — no model surgery.
- **Random pruning is the comparison floor.** Same hooks, same hyper-
  parameters, same machinery; indices drawn from a seeded
  `torch.Generator` instead of question similarity. The ablation
  isolates the contribution of question-awareness specifically.

**First result (May 17, kr=0.75 on VQA-RAD):** question-aware pruning
beats the unpruned stage-2 baseline by +2.6 pts closed accuracy
(60.29 vs 57.72) while removing 25% of visual tokens; random pruning
at the same ratio is within noise of baseline (56.99). One ratio is
one datapoint — the full Pareto curve (kr ∈ 0.50, 0.25, 0.10) is
what tests whether the +3.3 pt qsim-over-random gap holds, grows, or
disappears. Full writeup:
[Week 2, Day 1](weekly/week-02/day-01.md#phase-14-kr075-ablation-result-question-aware-pruning-beats-baseline).

**Known limitations of the current approach**, flagged up front:

- **Position-ID re-indexing** — when visual tokens are dropped, the
  remaining tokens get re-indexed contiguously. This is the
  FastV-style convention and is accepted in the literature, but it's
  worth noting that GAP-style positional preservation is an
  alternative we haven't tested.
- **Latency overhead at low pruning ratios.** Hook fixed-cost
  (32 layer hooks + the `prepare_inputs_for_generation` patch + the
  scoring computation) currently dominates the compute saved by
  dropping 64 of 256 tokens. Speedup is expected to emerge at
  kr ≤ 0.5 where the visual-token reduction is more substantial.
- **VQA-RAD only so far.** SLAKE and PathVQA repeats follow once the
  VQA-RAD Pareto curve is filled in.

Open design choices not yet explored (will be Phase 4+):

- **Alternative scoring functions** — cross-attention rather than
  cosine similarity, FastV-style layer-K attention scoring, or a
  small learned MLP.
- **Pruning at a later LLaMA layer** — FastV finds that pruning after
  layer 2-3 often outperforms pruning at layer 0 because early layers
  contribute to the question representation that scoring depends on.
- **Per-question keep-ratio** — easy questions don't need many tokens;
  hard ones do. An adaptive kr could improve the Pareto curve.

## 12-week plan

| Phase | Weeks | Focus | Deliverable |
| :---: | ----- | ----- | ----------- |
| 1 | 1–2  | Baseline & literature | Reproduced LLaVA-Med, lit-review notes, profiling numbers |
| 2 | 3–4  | Codebase deep-dive    | Diagram of LLaVA-Med's forward pass, identified pruning insertion points |
| 3 | 5–6  | Scoring-head v1       | First trainable pruning module, sanity-check results |
| 4 | 7–8  | Training & ablations  | K-sweep, head-architecture ablations |
| 5 | 9–10 | Full evaluation       | VQA-RAD / SLAKE numbers, latency benchmarks |
| 6 | 11   | Write-up              | Draft report, figures |
| 7 | 12   | Final report & demo   | Polished report, code release |

These dates will shift; the [Weekly Log](weekly/index.md) tracks what
actually happens.

## Success criteria

The project is a success if **any** of the following are true:

1. We achieve ≥40% token reduction with <1pt accuracy drop on VQA-RAD
   and SLAKE.
2. We find a question-type regime where pruning *improves* accuracy.
3. We produce a clean, reusable pruning module that other researchers
   can plug into LLaVA-Med or similar VLMs.

The project is **not** a failure if pruning doesn't help — a careful
negative result with proper ablations is also a useful contribution.
