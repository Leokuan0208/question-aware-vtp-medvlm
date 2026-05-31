# Day 1 — Sunday, May 31, 2026

[← Back to Week 4 overview](index.md)

**Pivot phase** (visual-grounding feasibility) · Week 4, Day 1 ·
**Day 22 of the project**

---

The first full day on the new direction. Days 20–21 (May 29–30) were
off-days while the 18-run scored sweep launched
[Day 19](../week-03/day-05.md) ran on the VMs. Coming back today, the
nested arm had failed overnight on an argparse bug — so the morning
was a fix-and-relaunch, and the afternoon was the payoff: a four-way
feasibility study on whether **Direction D** (the
evidence-sensitivity router) has a real signal to stand on. The
verdict is **yes, with the thesis sharpened**. The model's
visual-evidence dependence varies sharply by dataset (PMC-VQA needs
the pixels, PathVQA essentially doesn't), a confidence signal
predicts correctness at **AUROC ≈ 0.74**, and an offline budget
router shows **positive headroom (~1.6 pts) at wide budget gaps**.
One honest negative also landed: a realized-cost *width* router
(Approach 2) loses on compute, because the double-pass overhead
exceeds just running at the fixed-high budget. The day closed with
the whole feasibility suite committed and a heavier budget×layer
grid probe launched.

---

## Phase 1 — The nested arm failed overnight; fix and relaunch

The 18-run scored sweep was supposed to produce two arms:
**independent** random pruning (a fresh random subset at each
keep-ratio) and **nested** random pruning (each lower-kr subset is a
strict subset of the higher-kr one). The nested arm had crashed on
an argparse bug, so only the independent arm survived the night.

Fixed the argument parsing, rebalanced the relaunch across the two
VMs (`run_nested_vmA.sh` / `run_nested_vmB.sh`, a 4+4 split), and
re-ran. With both arms complete, the gate passed: **18/18 runs
complete, full instrumentation present, nesting verified offline**
(`smell_test_nested.py` confirms each lower-kr token set is a strict
subset of the higher-kr one, per sample).

---

## Phase 2 — Robustness curve confirms the pivot premise

Headline totals across all six benchmarks (scored harness), both
pruning arms:

| kr | independent | nested | nested − indep |
|---|---|---|---|
| 1.00 | 0.6807 (baseline) | — | — |
| 0.75 | 0.6759 | 0.6774 | +0.0016 |
| 0.50 | 0.6749 | 0.6723 | −0.0026 |
| 0.25 | 0.6585 | 0.6615 | +0.0031 |
| 0.10 | 0.6354 | 0.6400 | +0.0045 |

The robustness curve reproduces the
[Day 19 E3 finding](../week-03/day-05.md#phase-2-e3-results-random-wins-again)
on cleaner instrumentation and is monotone: baseline 0.6807 → drop
**half** the visual tokens and you lose only ~0.6–0.8 pts → drop
**90%** and you lose ~4 pts. Halving the visual evidence is nearly
free for this model. That's the premise the whole pivot rests on.

!!! warning "Methodological note — the aggregate agreement is a consistency check, not a result"
    It's tempting to read "nested ≈ independent at every kr" as
    evidence about *quantity vs. content* of visual tokens. It
    isn't. For **random** pruning, the two arms *had* to agree: at
    any single keep-ratio both keep a uniformly random subset of the
    same size, so they share an identical marginal distribution and
    therefore identical expected accuracy. The only thing nesting
    changes is the *coupling across keep-ratios within a sample*, and
    that coupling is invisible to any per-kr aggregate. So the
    ±0.004 wobble is pure seed noise between two draws of the same
    distribution. It's a **passed health check** — had the arms
    diverged, that would have signalled the seeding accidentally
    correlated with token content (a bug) — but it cannot establish
    the quantity-vs-content story, because random selection has no
    content signal to begin with. Where the nested arm actually pays
    off is **per-sample flip analysis** (Phase 4–5), where strict
    nesting makes any answer change cleanly attributable to *losing*
    specific tokens rather than swapping in different ones.

---

## Phase 3 — Per-dataset evidence dependence (the gold)

The aggregate hides the real finding. Sorting datasets by how much
accuracy the model *loses* when stripped to kr=0.10 (nested):

| dataset | baseline | kr=0.10 | drop |
|---|---|---|---|
| PMC-VQA | 0.5480 | 0.4785 | **−7.0 pt** |
| VQA-RAD | 0.6255 | 0.5697 | −5.6 pt |
| OmniMedVQA | 0.7357 | 0.6889 | −4.7 pt |
| SLAKE | 0.7644 | 0.7284 | −3.6 pt |
| MMMU | 0.5310 | 0.5034 | −2.8 pt *(small-n, noisy)* |
| PathVQA | 0.5776 | 0.5744 | **−0.3 pt** |

**PathVQA is the headline:** stripping 90% of its visual tokens
moves accuracy by three-tenths of a point — the model answers it
almost blind, from text and priors. **PMC-VQA is the opposite
corner** — it genuinely needs the pixels. That spread is precisely
what gives Direction D's router a reason to exist: if every dataset
were uniformly evidence-dependent, there would be nothing to route.
It also confirms the
[Day 19 locked-in-wrong observation](../week-03/day-05.md#phase-6-the-feasibility-probe-zero-gpu-decisive)
(PathVQA was worst there too, at 30.0% stable-wrong).

---

## Phase 4 — Flip analysis: how often answers move

For each sample, walk the keep-ratio ladder and count whether the
predicted letter changes. (A first pass crashed — the extractor
called `.strip()` on `letter_clean`, which is a *boolean* flag in the
scored records, not the letter; the reliable predicted letter is the
argmax of `option_logprob`, or just `model_output`. Fixed.)

- any-flip across the ladder: **nested 15.4%, independent 16.4%**
- flip rate by dataset (nested): PMC-VQA 30.5%, MMMU 25.3%,
  SLAKE 17.8%, VQA-RAD 15.9%, OmniMedVQA 14.1%, **PathVQA 11.0%**

This triangulates cleanly with Phase 3's accuracy table — the two
independent measurements agree on the ordering:

| dataset | flip rate | acc drop (→kr0.10) |
|---|---|---|
| PMC-VQA | 30.5% | −7.0 pt |
| VQA-RAD | 15.9% | −5.6 pt |
| OmniMedVQA | 14.1% | −4.7 pt |
| SLAKE | 17.8% | −3.6 pt |
| MMMU | 25.3% | −2.8 pt *(small-n)* |
| PathVQA | **11.0%** | **−0.3 pt** |

PathVQA sits rock-bottom on both axes; PMC-VQA tops both. MMMU is
the one disagreement (high flips, low accuracy drop) but at n=150
that's ~38 samples and already noise-dominated — flagged small-n and
set aside.

---

## Phase 5 — Flip *direction*: evidence loss vs. churn

Flip *count* is direction-blind — a wrong→different-wrong flip counts
the same as a correct→wrong one. The interesting quantity needs
ground truth, which turned out to be exactly recoverable: the
records carry `answer` (the correct option *text*) and `options` (the
ordered list), so the GT letter is just the index of `answer` within
`options`. 100% recovered, no fuzzy matching.

```text
=== NESTED ===  n=17303, GT-recovered 100%
  any-flip                    : 2664 (15.4%)
    correct@0.75 → wrong@0.10 : 1208 (7.0%)  [EVIDENCE LOSS]
    wrong@0.75   → right@0.10 :  560 (3.2%)  [distractor removal]
    wrong        → wrong      :  894 (5.2%)  [churn, no grounding]
  evidence-loss rate by dataset:
    PMC-VQA 10.7% · MMMU 9.3% · SLAKE 8.7% · VQA-RAD 7.6%
    OmniMedVQA 7.0% · PathVQA 4.4%
```

The **evidence-loss gradient is the Direction-D payload**: PMC-VQA
loses a correct answer 10.7% of the time as evidence is stripped;
PathVQA only 4.4%. That's "the model *specifically loses correct
answers* on PMC-VQA as evidence shrinks," a stronger claim than "its
answers move more."

!!! note "Why nested and independent report identical direction counts"
    Both arms printed the *same* evidence-loss (1208) and
    distractor-removal (560) counts, to the integer, on every
    dataset. That is not the data being clean — it's structural. The
    direction split only inspects the two endpoints (kr=0.75 and
    kr=0.10), and both `RandomPruner` and `NestedRandomPruner`
    seed per-sample from the same base seed (42), so at those two
    budgets they draw identical subsets. The direction numbers are
    therefore *shared by construction* between the arms, not an
    independent replication. The per-dataset gradient is the real
    result; the cross-arm identity is a seeding artifact, logged so
    it isn't mistaken for a second confirmation. See
    [Bug #11](../../bugs.md#11-nested-vs-independent-random-pruning-cannot-be-an-independent-check).

---

## Phase 6 — Router feasibility: AUROC ≈ 0.74

`router_probe.py` asks the load-bearing question for the router: does
a cheap confidence signal predict whether the model is right?
**Confidence (from the option-logprob distribution) predicts
correctness at AUROC ≈ 0.74** — a usable, well-above-chance signal.
The entropy/keep-ratio slopes behave sensibly, and entropy vs.
margin carry only ~12% non-redundant information, so a
two-feature (stability + confidence) router is worth a check but the
features partly overlap. That ~12% two-feature check is **parked**
as the next concrete step.

---

## Phase 7 — Headroom: positive, modest

`headroom_router.py` / `headroom_pairs.py` compute an *offline upper
bound*: if an oracle routed each question to the right budget, how
much accuracy could a budget router recover? The headroom is
**positive at every budget pair, peaking around +1.6 pts at the
widest gaps**. Modest but real — and an upper bound, since it ignores
the cost of the cheap pass paid on every question (which Approach 2
accounts for next).

---

## Phase 8 — The budget×layer grid probe (launched)

The bigger question — *where is the cheapest early signal a router
can read?* — needs a budget×layer map. `grid_probe.py` runs a
hidden-states-on forward per sample and, at every one of the 28
layers, computes logit-lens confidence proxies at the last position
(option-entropy, hidden-state norm, cosine-to-final). Two correctness
choices baked in: the label is the **full-budget (kr=1.0)**
correctness (the routing target — "can the cheap cell predict the
real answer"), and the lens applies the **final RMSNorm before
`lm_head`** (the fix verification caught — raw hidden states are
pre-norm, and skipping the norm silently corrupts every early-layer
cell). It self-checks on the first kr=1.0 sample by asserting the
final-layer lens entropy reproduces the stored `option_entropy` to
1e-2, so a miswired lens dies in seconds instead of after hours.

This is heavy — 5 budgets × 28 layers × 17,303 samples — so it's
split across the two GPUs and **left running**; `grid_analysis.py`
(offline) will build the budget×layer AUROC table and find the
*cheapest cell* (lowest budget, earliest layer) whose AUROC stays
within 0.01 of the best cell. `probe_hidden_shapes.py` verified
per-layer hidden-state access first. Results land next session.

---

## Phase 9 — Approach 2 (width router): an honest negative

`approach2_width_router.py` is the realized-cost counterpart to the
headroom upper bound: route on cheap-budget confidence, escalate to
full width only when unsure, and report accuracy **and** cost
*including the cheap pass paid on every question*. The verdict is
**negative on compute** — the double-pass overhead (cheap pass on
all + full pass on the escalated fraction) exceeds just running at
the fixed-high budget. This is the predicted failure mode, now
measured rather than assumed. It's worth keeping as a documented
negative: the grid probe measures where *predictive signal* lives;
Approach 2 measures what one concrete width-router actually *saves*,
and the answer is "not enough to beat fixed-high." A budget router
that routes *down* (cheap when confident) rather than *up* may still
win — that's what the grid + headroom are scoping.

---

## Honest ledger of the day

1. **Nested arm fixed and re-run; 18/18 gate passed**, nesting
   verified offline.
2. **Robustness curve confirms the premise** on clean instrumentation
   — halving visual tokens is nearly free; 90% removal costs ~4 pts.
3. **Per-dataset evidence-dependence gradient established** and
   triangulated across two independent measures (accuracy drop +
   flip rate): PMC-VQA most evidence-dependent, PathVQA least.
4. **Flip-direction gives the router target** — evidence-loss rate
   per dataset (PMC-VQA 10.7% → PathVQA 4.4%).
5. **Router signal is real** — confidence predicts correctness at
   AUROC ≈ 0.74; budget-router headroom positive (~1.6 pt peak).
6. **Approach 2 (width router) is a clean negative on compute** —
   double-pass overhead exceeds fixed-high.
7. **Two methodology traps logged** — the nested-vs-independent
   aggregate is a consistency check not a result; the identical
   direction counts are a shared-seed artifact (Bug #11).
8. **Grid probe launched** (budget×layer logit-lens), lens self-check
   validated; results land next session.

The pivot now has a measured foundation, not just a hypothesis: there
*is* a routable signal, it *does* vary by question in a way a router
can exploit, and the cheap-confidence feature alone already clears
AUROC 0.74. What's still open is *where* the cheapest usable signal
lives (the grid) and whether routing *down* beats fixed budgets on
realized cost.

!!! note "On the project's direction"
    The site and project name still say *question-aware visual token
    pruning*. As of Day 19 the work pivoted to training-free
    **visual-grounding / selective prediction** for medical VLMs, and
    Day 22 puts a measured feasibility foundation under that pivot.
    The rebrand is still deliberately deferred until the direction is
    fully committed and producing a headline result.

---

### Plan for tomorrow (June 1, Day 23 / Week 4 Day 2)

- [ ] **Gather the five `grid_kr*.json` into one directory and run
      `grid_analysis.py`** — the budget×layer AUROC table and the
      cheapest-usable-cell, the direct answer to "where's the
      cheapest early signal."
- [ ] **The parked ~12% entropy/margin two-feature check** — does
      stability + confidence separate the regimes better than
      confidence alone?
- [ ] **Recreate `confidence_router.py`** if the grid says a router
      is worth building (intentionally not committed yet — no point
      scaffolding before the grid result).
- [ ] Verify the proven self-consistency component doesn't degrade on
      medical VQA before composing it into the router.
- [ ] Read **ToMe** end-to-end (still pending from Week 2).

---

## Pushed today

One commit to
**[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)**:

**[`df0a3c4`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/df0a3c4)**
— *Nested-run argparse fix + Direction-D feasibility suite.* The
overnight-failure fix (`nested_random_pruner` argument parsing) plus
the rebalanced two-machine relaunch (`run_nested_vmA.sh` /
`run_nested_vmB.sh`, 4+4), and the full `analysis/` feasibility
suite for the visual-grounding pivot:

- `smell_test_nested.py` — 18-run gate + offline nesting proof
- `extract_totals.py` — per-dataset / per-kr score extraction
- `flip_analysis.py` — per-dataset evidence-dependence via flip rate
- `flip_direction.py` — correct→wrong evidence-loss split (GT
  recovered from answer-text position in options)
- `router_probe.py` — confidence-vs-correctness (AUROC ≈ 0.74),
  entropy/kr slopes, entropy-vs-margin redundancy
- `headroom_router.py`, `headroom_pairs.py` — offline budget-router
  headroom (positive every pair, peak ~1.6 pt at wide gaps)
- `auroc_by_budget.py` — per-budget confidence AUROC
- `probe_hidden_shapes.py` — verify per-layer hidden-state access
- `grid_probe.py` — budget×layer logit-lens confidence grid
  (final-RMSNorm fix; self-checks final-layer entropy vs stored)
- `grid_analysis.py` — budget×layer AUROC grid + cheapest-usable-cell
- `approach2_width_router.py` — realized-cost width-router (the
  documented negative: double-pass overhead exceeds fixed-high)

The `confidence_router.py` scaffold was deliberately left out — no
point committing a router before the grid results say it's worth
building.
