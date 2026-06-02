# Day 2 — Monday, June 1, 2026

[← Back to Week 4 overview](index.md)

**Pivot phase** (visual-grounding feasibility) · Week 4, Day 2 ·
**Day 23 of the project**

---

The day the Direction-D router met its own bar — and the honest read
is that, on the signals tested so far, it doesn't clear it. Two
analyses, both offline on data already on disk: the **budget×layer
grid probe** launched
[yesterday](day-01.md#phase-8-the-budgetlayer-grid-probe-launched)
finished and was analyzed, and the **parked two-feature check** ran.
The grid says the routable confidence signal is genuine but **modest
and late** — it peaks at AUROC 0.756 at the final layer, with no
cheap early-layer cell to exploit. The two-feature probe says
combining confidence features gives **no meaningful lift** over the
best single feature (0.762 → 0.758). Together they're clean evidence
that a single-point, confidence-based Direction-D router doesn't
close the realized-cost math that
[yesterday's Approach 2](day-01.md#phase-9-approach-2-width-router-an-honest-negative)
already flagged. The decisive next test — whether *evidence-stability*
(the axis genuinely orthogonal to confidence) adds signal — is teed
up rather than run, so the verdict is honestly **partial**: the
confidence half of Direction D is a clean negative; the
evidence-stability half is the open question.

---

## Phase 1 — Grid probe: valid, and the gate passed

The budget×layer grid finished cleanly: all five budgets wrote full
files at n=17,303, the probe processes were done, and GPUs idle. The
load-bearing check is the logit-lens sanity gate — at kr=1.0 the
final-layer lens entropy must reproduce the stored `option_entropy`,
or every early-layer cell is silently corrupted by a missing RMSNorm.
It reproduced almost exactly (**`0.2213` vs `0.2213011…`**), so the
lens wiring is correct and every cell in the grid is trustworthy.

(The five extra `__partial.json` files are just the incremental
1000-sample checkpoints — that's why a naive count read "10/5," not a
problem. One uniform OmniMedVQA `.tif` "image is wrong" warning
appears across all cells, so it doesn't bias the grid — but it's
flagged for the day a per-dataset router is built.)

---

## Phase 2 — The grid result: the signal is real, modest, and late

The headline is an honest near-negative. The primary deployable
proxy, **`lens_entropy`, peaks at AUROC 0.756 at layer 28** (the
final layer). That *confirms* — does not beat — the ~0.74 from
yesterday's quick feasibility probe. The important new fact is the
*shape* across depth:

- Layers 1–20: AUROC just oscillates around chance (~0.45–0.62), no
  stable plateau.
- Layers 25–28: ramps hard, L25 0.727 → L28 0.756.

So **there is no cheap early-layer cell with usable signal.** The
whole point of the grid was to find the cheapest *early* place on the
depth axis a router could read — and for the deployable proxies, one
doesn't exist. Reading the signal costs a full forward pass.

Reading the three proxies against that shape:

- **`lens_entropy`** — the winner and the one to take seriously.
  0.756 at L28, and critically it barely degrades on the *budget*
  axis: at the same layer, kr=0.5 gives **0.748**, only 0.008 below
  full budget. So the one real compute lever the grid hands you is
  the budget axis — you can read this signal off a half-budget
  prefill — not depth.
- **`h_norm`** (hidden-state norm) — the same story one notch weaker
  (0.730 at L28), with isolated mid-layer bumps (L13 0.651, L20
  0.654, L25 0.693) that never form a usable early plateau. Strictly
  dominated by `lens_entropy`; not worth its own router.
- **`cos_final`** (cosine to the final-layer state) — looks high
  early (0.659 at L6, decaying to noise by L28), and the analysis
  script's "cheapest cell" line literally recommended "route by
  reading cos_final at layer 6." **That cell is a trap, not a
  router** — see Phase 3.

The takeaway for Direction D: the grid set out to find a cheap early
signal and the verdict is that there isn't one. The signal is genuine
but modest (~0.75), localized to the final layer, and the only lever
is "route on a kr=0.5 prefill" — which is exactly the kind of router
[Approach 2 tested yesterday](day-01.md#phase-9-approach-2-width-router-an-honest-negative)
and found negative on realized cost. The grid gives no reason to
expect a fresh single-feature router to flip that math; the
underlying signal strength is the same ~0.75, just pinpointed.

---

## Phase 3 — The `cos_final` early-layer trap (methodology note)

The analysis script flagged `cos_final` at layer 6 (AUROC 0.659) as
the "cheapest usable cell." It is **not deployable**, and it's worth
recording why so future-me doesn't mistake it for an early-exit
router.

`cos_final` is the cosine between layer-*k*'s hidden state and *this
same sample's* layer-28 hidden state. To compute it at layer 6 you
must already have run all 28 layers — so the "early" number is a
post-hoc diagnostic about *when the representation converges*, not a
signal available early at inference. The tell is at the other end:
`cos_final` sits at 0.51 (chance) at L28, because cos(h₂₈, h₂₈) ≡ 1
for every sample, giving zero discriminative power. So its apparent
early-layer strength is an artifact of the metric's construction, and
even at face value 0.659 is below `lens_entropy`'s 0.756. A real
observation about representation convergence; not a cheap router.

---

## Phase 4 — The two-feature probe: no lift (the go/no-go)

The decisive cheap test: does combining `lens_entropy`@L28 with the
answer **margin** and/or the option-token **logprob** push AUROC
meaningfully past 0.756 — into the low 0.80s — enough to change the
realized-cost story? The probe joins the grid's kr=1.0 dump with the
scored run's per-option logprobs (clean **17,303 / 17,303** join,
every dataset at full overlap), reproduces the entropy AUROC exactly
as a join self-check (0.756), then layers on the extra features.

```text
--- single-feature AUROC (predicting WRONG@full) ---
   entropy        0.756
   margin         0.759
   option-logprob 0.762
--- fitted combinations (logistic, 5-fold CV) ---
   entropy + margin            0.761 ± 0.004
   entropy + logprob           0.756 ± 0.005
   entropy + margin + logprob  0.758 ± 0.005
--- multi-option subset (n_opt ≥ 3, 12451 samples) ---
   entropy-only   0.814
   all three      0.813 ± 0.010
================================================================
VERDICT  best single = 0.762   best combo = 0.758   lift = ±0.004
================================================================
```

**No meaningful lift.** The three confidence features are mutually
redundant — the fitted combination (0.758) does not beat the best
single feature (0.762); the spread is within noise. This **overturns**
the working hypothesis from
[Day 19](../week-03/day-05.md#phase-6-the-feasibility-probe-zero-gpu-decisive)
that the option-token logprob would be Direction D's missing second
feature. It isn't — it's carrying the same information entropy
already had.

One genuinely useful sub-result: on the **multi-option subset**
(questions with ≥3 options, 12,451 samples) AUROC rises to **0.814**.
The signal is materially stronger where the model has a real
distribution to be uncertain over; the binary/2-option questions are
diluting the aggregate. That's a lever for *where* a router could
work, even though it doesn't rescue the feature-combination question.

---

## Phase 5 — The honest call on Direction D

Putting the two analyses together: the routable confidence signal is
real but caps at ~0.76 (~0.81 on multi-option questions), lives only
at the final layer, and gains nothing from combining the confidence
features that were supposed to strengthen it. Yesterday's Approach 2
already showed a confidence/width router at that signal strength
doesn't pay for its compute. So **a single-point, confidence-based
Direction-D router does not clear its own bar**, and building the full
`confidence_router.py` on this footing isn't justified.

But the verdict is **partial, not final** — and the distinction
matters. Everything tested so far is *confidence*. Direction D's
*defining* signal was never confidence; it was **evidence-stability**
— whether the answer flips when visual evidence is pruned — which is
the one axis genuinely orthogonal to confidence. That test has not
been run as a router feature yet. So the clean statement of today's
result is: the confidence-only path to Direction D is a clean
negative; the decisive evidence-stability test is the immediate next
step, and the A/C fallbacks (conformal risk control; per-question
compute allocation) move up the queue if it also comes back flat.

No GPU was spent today — both analyses were offline on existing
dumps. That's the discipline paying off: the cheapest decisive
experiment ran first, and it sharpened the question instead of
burning a sweep.

---

## Honest ledger of the day

1. **Grid probe valid** — lens gate passed (0.2213 = 0.2213), all 5
   budgets × 17.3k clean.
2. **Routable signal is late and modest** — `lens_entropy` 0.756 @
   L28, robust on the budget axis (0.748 at kr=0.5), no early-layer
   signal anywhere.
3. **`cos_final` early cell is a non-deployable diagnostic** — logged
   as a methodology note so it's not mistaken for a cheap router.
4. **Two-feature probe: no lift** — best single 0.762, best combo
   0.758. Overturns the option-logprob-as-second-feature hypothesis;
   the confidence features are mutually redundant.
5. **Multi-option subset is stronger** — AUROC 0.814 on ≥3-option
   questions; the binary questions dilute the aggregate.
6. **Direction-D verdict is partial** — confidence-only path is a
   clean negative; the decisive evidence-stability test is still
   pending, with A/C fallbacks queued behind it.

The day's worth is in what it ruled out cheaply: the option-logprob
second feature, and the hope of a cheap early-layer router. What
survives is a sharp, single open question — does evidence-stability
carry signal that confidence doesn't — and a stronger place to look
for it (multi-option questions).

!!! note "On the project's direction"
    The site and project name still say *question-aware visual token
    pruning*. As of Day 19 the work pivoted to training-free
    **visual-grounding / selective prediction**; Day 23 is the first
    day that result has come back partly negative, narrowing
    Direction D to its one untested axis. The rebrand stays deferred
    until the direction produces a positive headline result.

---

### Plan for tomorrow (June 2, Day 24 / Week 4 Day 3)

- [ ] **The decisive evidence-stability test** — does per-sample
      answer-flip-under-pruning carry correctness signal that
      confidence (entropy/margin/logprob) does *not*? This is the one
      axis orthogonal to what today ruled out, and it decides
      Direction D.
- [ ] If evidence-stability also comes back flat, **scope the A/C
      fallbacks concretely** — conformal risk control (A) and
      per-question compute allocation (C).
- [ ] Consider restricting any router evaluation to the
      **multi-option subset**, where the signal is materially stronger
      (0.814 vs 0.756).
- [ ] Read **ToMe** end-to-end (still pending from Week 2).

---

## Pushed today

One commit to
**[`huatuo-llava-v15-med-pruning`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning)**:

**[`04ef73c`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/04ef73c)**
— *Add confidence + stability probes (Direction-D go/no-go).*
`analysis/two_feature_probe.py` — joins the grid kr=1.0 / layer-28
dump with the scored run's option logprobs (defensive schema
inspection, reproduces the entropy AUROC as a join self-check), then
fits margin and option-logprob on top of `lens_entropy` and reports
whether the combination beats entropy alone. Verdict baked into the
run: no meaningful lift (best single 0.762, best combo 0.758), with
the multi-option subset (≥3 options) the stronger regime at 0.814.
The commit also lands the evidence-stability probe scaffolding that
sets up tomorrow's decisive test — whether answer-flip-under-pruning
carries signal orthogonal to confidence. (The grid-analysis run
itself produced the budget×layer AUROC table and
`grid_analysis_<date>.log` under `results/grid_probe/`; the probe
scripts are the day's tracked code artifacts.)
