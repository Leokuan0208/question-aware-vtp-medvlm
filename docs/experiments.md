# Experiments

Running log of pruning experiments. Each experiment gets a short ID
(e.g. `E01`, `E02`) and follows the same template so they're easy to
compare.

!!! note "When to log an experiment"
    Anything you train, fine-tune, or benchmark gets an entry — even
    failed runs. Especially failed runs. The first ablation you'll wish
    you'd documented is the one you didn't.

## Summary table

| ID  | Date | Pruning strategy | K (drop %) | VQA-RAD acc | SLAKE acc | Latency Δ | Notes |
| --- | ---- | ---------------- | ---------- | ----------- | --------- | --------- | ----- |
| E00 | _TBD_ | None (baseline)  | 0%         | _TBD_       | _TBD_     | —         | Reference run |
| E01 | _TBD_ | _e.g. random_    | _25%_      | _TBD_       | _TBD_     | _TBD_     | Sanity floor |
| E02 | _TBD_ | _e.g. attention-based_ | _25%_ | _TBD_     | _TBD_     | _TBD_     | Question-agnostic baseline |
| E03 | _TBD_ | _Question-conditioned MLP v1_ | _25%_ | _TBD_ | _TBD_ | _TBD_ | First real attempt |

The cells in italics get filled in as we go. **E00** and **E01** (the
baseline and the random-pruning sanity floor) are the two reference
points every later experiment should beat.

---

## E00 — Baseline (no pruning)

<span class="pill pill--planned">Planned</span>

**Goal** — establish the reference accuracy and latency numbers we'll
compare every pruning experiment against. No model changes.

**Setup**
- Model: LLaVA-Med, off-the-shelf weights, frozen
- Datasets: VQA-RAD test split, SLAKE test split
- Hardware: see [Baseline (LLaVA-Med)](setup.md#hardware)

**Results**
- VQA-RAD closed-form accuracy: _TBD_
- VQA-RAD open-form accuracy: _TBD_
- SLAKE closed-form accuracy: _TBD_
- SLAKE open-form accuracy: _TBD_
- Mean inference latency: _TBD_ ms / query
- Peak VRAM: _TBD_ GB

**Notes**

_Anything surprising, anomalous, or worth flagging._

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

| K   | VQA-RAD | SLAKE | Latency |
| --- | ------- | ----- | ------- |
| 10% | _TBD_   | _TBD_ | _TBD_   |
| 25% | _TBD_   | _TBD_ | _TBD_   |
| 50% | _TBD_   | _TBD_ | _TBD_   |
| 75% | _TBD_   | _TBD_ | _TBD_   |

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
