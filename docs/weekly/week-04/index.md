# Week 4 — Direction-D feasibility (visual-grounding pivot)

<span class="pill pill--wip">In progress</span>

**Pivot phase** (visual-grounding / selective prediction) ·
**Week 4 of 12**

**Goal of the week** — pressure-test the
[Day 19 pivot](../week-03/day-05.md): now that training-free visual-token
*pruning* is closed as a method, does the repurposed direction —
a training-free **evidence-sensitivity router** for medical VQA
(Direction D) — have a real, measurable signal to build on? Establish
the per-dataset evidence-dependence gradient, the confidence→correctness
signal, and the budget-router headroom *before* committing to building
the router.

!!! note "The 12-week plan and the pivot"
    The original plan had Week 4 as "Phase 2 — identify pruning
    insertion points." The Day 19 negative result closed pruning as a
    method, so Week 4's actual focus is the visual-grounding
    feasibility work instead. The site name and the 7-phase plan are
    left as-is for now; the rebrand is deferred until the new
    direction produces a headline result.

This page is the **overview** — a short summary of each day. Click any
day's heading for the full detail page.

---

### [Day 1 — Sunday, May 31, 2026](day-01.md)

The first full day on the new direction. Days 20–21 (May 29–30) were
off while the
[18-run scored sweep](../week-03/day-05.md#phase-7-instrumentation-built-overnight-sweep-launched)
ran. The nested arm had failed overnight on an argparse bug; fixed it,
rebalanced a 4+4 two-VM relaunch, and the 18/18 gate passed (nesting
verified offline). The afternoon was a four-way Direction-D feasibility
study, and the verdict is **go, with the thesis sharpened**:

- **Robustness curve** reproduces Day 19 on clean instrumentation —
  halving visual tokens costs ~0.6–0.8 pts, 90% removal ~4 pts.
- **Per-dataset evidence-dependence gradient** (the gold), triangulated
  across accuracy drop *and* flip rate: PMC-VQA most evidence-dependent
  (−7.0 pt, 30.5% flips), **PathVQA least** (−0.3 pt, 11.0% flips) —
  confirming Day 19's locked-in-wrong observation.
- **Flip direction** (GT recovered exactly): evidence-loss rate per
  dataset is the router target — PMC-VQA 10.7% → PathVQA 4.4%.
- **Router signal real** — confidence predicts correctness at
  **AUROC ≈ 0.74**; offline budget-router headroom positive at every
  budget pair (peak ~1.6 pt).
- **Approach 2 (width router) is a clean negative on compute** —
  double-pass overhead exceeds fixed-high; documented, not hidden.
- **Grid probe launched** (budget×layer logit-lens, 5 budgets × 28
  layers × 17.3k samples) to locate the cheapest early signal; results
  land next session.

Two methodology traps logged: the aggregate nested-vs-independent
agreement is a consistency check not a result, and the identical
flip-direction counts are a shared-seed artifact
([Bug #11](../../bugs.md#11-nested-vs-independent-random-pruning-cannot-be-an-independent-check)).
Committed the fix and the whole feasibility suite at
[`df0a3c4`](https://github.com/Leokuan0208/huatuo-llava-v15-med-pruning/commit/df0a3c4).

---

## Plan for the week (May 31 – Jun 6)

- [x] Fix the failed nested arm and re-run; pass the 18/18 gate
      (Day 1)
- [x] Robustness curve on the scored harness (Day 1)
- [x] Per-dataset evidence-dependence gradient — accuracy + flip
      rate (Day 1)
- [x] Flip-direction (evidence-loss) split with recovered ground
      truth (Day 1)
- [x] Router feasibility probe — confidence AUROC ≈ 0.74 (Day 1)
- [x] Budget-router headroom (offline upper bound) (Day 1)
- [x] Approach 2 realized-cost width router — negative on compute
      (Day 1)
- [x] Launch budget×layer grid probe (Day 1)
- [ ] Gather `grid_kr*.json`, run `grid_analysis.py` — budget×layer
      AUROC table + cheapest-usable-cell
- [ ] The parked ~12% entropy/margin two-feature check
- [ ] Recreate `confidence_router.py` if the grid says it's worth
      building
- [ ] Verify self-consistency doesn't degrade on medical VQA before
      composing
- [ ] Read **ToMe** end-to-end (still pending from Week 2)

---

## Reflections (end-of-week)

_Write this at the end of the week. The question: does the
Direction-D router clear its own bar — a routable signal that beats
fixed budgets on realized cost, not just on an offline upper bound?
Day 1 says the signal exists (AUROC 0.74, positive headroom) and
Approach 2 says the naive width-router doesn't pay for itself; the
week decides whether routing down (cheap-when-confident) does._
