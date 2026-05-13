# Experiments

Running log of pruning experiments. Each experiment gets a short ID
(e.g. `E01`, `E02`) and follows the same template so they're easy to
compare.

!!! note "When to log an experiment"
    Anything you train, fine-tune, or benchmark gets an entry — even
    failed runs. Especially failed runs. The first ablation you'll wish
    you'd documented is the one you didn't.

## Evaluation harness

All experiments are run through a shared harness at
`~/llava-med-pruning/` (separate repo from LLaVA-Med itself, to keep
the pruning work cleanly isolated). Design decisions:

- **CLI** — `argparse` (over Hydra). Hydra is more powerful but adds a
  config-system learning curve I don't need for a 12-week project.
- **Output format** — JSON for the summary metrics of each run, plus
  JSONL with one line per sample (for error analysis and re-aggregation
  later).
- **Pruning interface** — `PruningMethod` with `attach(model)` and
  `detach(model)` lifecycle hooks, so a single evaluation run can swap
  pruning strategies without reloading the 15 GB model.
- **Datasets handled** — VQA-RAD, SLAKE (English-only), PathVQA.

Status (May 13, 2026): **4 of 11 planned files implemented** (CLI
entry point, dataclasses for samples and loaded model, NoOp baseline
pruning method). 7 documented stubs await fill-in.

## Summary table

| ID  | Date | Pruning strategy | K (drop %) | VQA-RAD acc | SLAKE acc | Latency Δ | Notes |
| --- | ---- | ---------------- | ---------- | ----------- | --------- | --------- | ----- |
| E00 | _pending_ | None (baseline) | 0%      | _pending_   | _pending_ | —         | Reference run; harness in progress |
| E01 | _TBD_ | _e.g. random_    | _25%_      | _TBD_       | _TBD_     | _TBD_     | Sanity floor |
| E02 | _TBD_ | _e.g. attention-based_ | _25%_ | _TBD_     | _TBD_     | _TBD_     | Question-agnostic baseline |
| E03 | _TBD_ | _Question-conditioned MLP v1_ | _25%_ | _TBD_ | _TBD_ | _TBD_ | First real attempt |

The cells in italics get filled in as we go. **E00** and **E01** (the
baseline and the random-pruning sanity floor) are the two reference
points every later experiment should beat.

---

## E00 — Baseline (no pruning)

<span class="pill pill--wip">Harness in progress</span>

**Goal** — establish the reference accuracy and latency numbers we'll
compare every pruning experiment against. No model changes.

**Setup**
- Model: LLaVA-Med v1.5 (Mistral-7B), off-the-shelf weights, frozen
- Datasets: VQA-RAD test split (451 samples), SLAKE English test split
  (1,061 samples), PathVQA test split (6,719 samples)
- Hardware: see [Baseline (LLaVA-Med)](setup.md#hardware)
- Pruning method: `NoOp` (implemented — does nothing, just lets the
  model run unmodified)

**Status**
- Datasets downloaded and verified (May 13, 2026)
- Harness scaffolded with NoOp method implemented (May 13, 2026)
- Dataset loaders, metrics module, and runner still stubs — to be
  completed before this experiment can run

**Results**
- VQA-RAD closed-form accuracy: _pending_
- VQA-RAD open-form accuracy: _pending_
- SLAKE closed-form accuracy: _pending_
- SLAKE open-form accuracy: _pending_
- PathVQA closed-form accuracy: _pending_
- PathVQA open-form accuracy: _pending_
- Mean inference latency: _pending_ ms / query
- Peak VRAM: _pending_ GB

**Notes**

_Anything surprising, anomalous, or worth flagging — fill in after the
first run._

---

## E01 — Random pruning (sanity floor)

<span class="pill pill--planned">Planned</span>

**Goal** — drop K% of visual tokens uniformly at random. This is the
floor: any "smart" pruning strategy must beat this. If it doesn't, we
haven't actually learned anything.

**Setup**
- Same as E00, plus: at the projector output, randomly drop K of the 576
  visual tokens (independent uniform sampling per forward pass).
- Run for K ∈ {10%, 25%, 50%, 75%}.

**Results**

| K   | VQA-RAD | SLAKE | PathVQA | Latency |
| --- | ------- | ----- | ------- | ------- |
| 10% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |
| 25% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |
| 50% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |
| 75% | _TBD_   | _TBD_ | _TBD_   | _TBD_   |

**Conclusion**

_Fill in after running._

---

## Template for new experiments

Copy this block, paste it above the previous experiment, and bump the ID.

```markdown
## EN — Short descriptive name

<span class="pill pill--planned">Planned</span>

**Goal** — one sentence.

**Setup**
- Model:
- Dataset:
- Pruning strategy:
- K:
- Training config (if applicable):

**Results**
- Metric 1:
- Metric 2:
- Latency:

**Conclusion**
- What did this tell us?
- What's the next experiment?
```
