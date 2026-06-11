# Day 3 — Wednesday, June 10, 2026

[← Back to Week 5 overview](index.md)

**Resolution sweep → a cap320 efficiency ablation + a real-time cascade
harness** · Week 5, Day 3 · **Day 32 of the project**

---

A build-and-measure day with one sharp methodological catch and one honest
walk-back. Two things were on the table at the open: analyze the overnight
resolution-budget sweep (does shrinking the 7B's vision tokens buy a real
improvement?), and push the previous session's uncommitted code. The sweep
answered cleanly — **no accuracy to be had** (lower resolution is a cost
lever, not an accuracy lever; the familiar "no visual cliff"), but a real
**efficiency** lever: the cheap leg tolerates 2–4× fewer vision tokens at
≤0.001 pooled accuracy loss, and a first cascade-simulation looked
tantalizing until it was caught **choosing its threshold on the test set** —
an invalidity that, once fixed with a held-out τ grid, landed on a clean,
modest result: **serve the 7B at cap320 and the cascade holds 32B-level
accuracy (0.572) at 74% of always-32B compute**, down from 79% at full
resolution, for free. The back half built the **real-time cascade harness**
(live 7B→gate→32B with per-GPU power, energy, VRAM, latency) to produce the
empirical wall-clock analog of that 74% FLOPs figure — and a smoke run threw
a scare (cascade *below* its own cheap leg) that a built-in faithfulness
check exonerated as a hard-slice + engine-numerics artifact, not a bug,
walking back a too-quick "the 32B leg is broken" call. The day ends with the
full cap320 real-time run launched across all six benchmarks, churning
overnight.

!!! note "Builds on the June 9 evening work (now on Day 2)"
    This day builds directly on the deployable artifact locked the previous
    evening — the contamination-clean frozen margin gate (`router_margin.pkl`),
    the honest prefill-inclusive FLOPs (**~75%**), the finding that no learned
    or conformal router beats the simple 1-D gate, and the resolution-sweep
    launch. That stretch is written up in
    [Day 2, Phases 7–10](day-02.md#phase-7-locking-the-deployable-gate-a-contamination-clean-frozen-margin).

!!! note "Day count"
    June 10 is **Day 32** of the project (calendar count from May 10),
    **Day 3 of Week 5**. No off-day since [Day 2](day-02.md).

---

## Phase 1 — The resolution sweep: no visual cliff, an efficiency lever only

The sweep lowers `max_pixels` to shrink the number of vision tokens
Qwen2.5-VL emits per image. Vision tokens are **~90%** of the 7B leg's input,
and the 7B leg runs (nothink) on *every* question in the cascade, so a
cheaper 7B prefill lowers total cascade compute directly. Two solid tables —
neither depends on any routing threshold:

**Table A — accuracy per benchmark (full-res, raw model correctness).**

| Benchmark | n | 7B | 32B | oracle | 32B−7B | competent? |
| --------- | --: | --: | --: | --: | --: | :--: |
| PMC-VQA | 2000 | 0.539 | 0.556 | 0.688 | +0.017 | ✅ |
| SLAKE | 416 | 0.733 | 0.764 | 0.870 | +0.031 | ✅ |
| VQA-RAD | 272 | 0.761 | 0.776 | 0.901 | +0.015 | ✅ |
| PathVQA | 3362 | 0.644 | 0.673 | 0.809 | +0.029 | ✅ |
| MedXpert-Reasoning | 1446 | 0.229 | 0.326 | 0.457 | +0.097 | ❌ |
| MedXpert-Understanding | 554 | 0.260 | 0.384 | 0.495 | +0.125 | ❌ |

On the four competent sets the 7B is already within +0.015 to +0.031 of the
32B, so the cascade's job is to *match* 32B cheaply, not to gain accuracy. On
MedXpert both are weak and the 32B's edge is larger (+0.10 to +0.13), so
escalation there buys accuracy but at the full 32B price.

**Table B — 7B accuracy vs. resolution (the "no visual cliff" finding).**

| Benchmark | fullres | cap640 | cap320 | cap160 | cap80 |
| --------- | --: | --: | --: | --: | --: |
| PMC-VQA | 0.539 | 0.542 | 0.543 | 0.533 | 0.520 |
| SLAKE | 0.733 | 0.757 | 0.762 | 0.757 | 0.724 |
| VQA-RAD | 0.761 | 0.772 | 0.761 | 0.761 | 0.728 |
| PathVQA | 0.644 | 0.642 | 0.641 | 0.638 | 0.631 |
| **Pooled (4 competent)** | **0.621** | **0.623** | **0.622** | **0.617** | **0.605** |

Accuracy is flat from `fullres` down to `cap160` — halving tokens
(cap640→cap320) costs −0.001, quartering (cap640→cap160) costs −0.006. Real
degradation appears only at `cap80`, and it concentrates exactly where you'd
expect: the radiology sets that must actually see the image (SLAKE −0.033,
VQA-RAD −0.044), while PathVQA / PMC-VQA barely move. (A full-res anchor
exists for the pmctrain column: yesterday's labels were ≈0.460 vs cap320
0.459 — statistically indistinguishable, so cap320 is "free" there too.)

**The honest read in two parts.** On *accuracy*: no — and you wouldn't expect
it; this is the same no-visual-cliff property that killed the
learned-token-scorer direction earlier in the project. On *efficiency*:
yes — the 7B leg's cost is almost entirely vision-token prefill, which is
exactly what the cap cuts, so cap640→cap320 roughly **halves** the 7B leg's
prefill FLOPs and cap640→cap160 roughly **quarters** it. The 7B-leg overhead,
as a share of always-32B, falls deterministically: **14.1%** (fullres/cap640)
→ **7.7%** (cap320) → **4.5%** (cap160) → **2.9%** (cap80). Framing: an
**efficiency ablation that strengthens the cascade**, not a standalone method.

---

## Phase 2 — The trap: a cascade-sim that chose its threshold on the test set

The first cascade simulation across caps looked exciting — and was **invalid**,
caught before it could mislead. The tell was impossible on its face:
`fullres` and `cap640` have **identical** 7B accuracy (pooled 0.621 vs 0.623 —
the same model at essentially the same resolution), yet the sim claimed
`fullres` costs 62.8% and `cap640` costs 37.5%. *A 25-point cost gap between
two arms with the same accuracy cannot be a real effect.*

The mechanism: the script picked the cheapest τ that passes a per-dataset
accuracy bar **on the eval data itself**. For `fullres`, the binding dataset
was SLAKE, which happened to draw 7B = 0.733 (just under its bar of
0.764−0.021 = 0.743), forcing ~42% escalation just to lift SLAKE over the
line — dragging every dataset to ~48% escalation. For `cap320`, SLAKE
happened to draw 0.762 (already above the bar at zero escalation), so the
binding dataset became PathVQA, clearing at 23%. SLAKE is n=416; 0.733 vs
0.762 is **within sampling noise for the same model** — but tuning τ on the
test labels with a per-dataset constraint let that noise swing the "sweet
spot" by 25 cost points (the cap320 pick cleared PathVQA's bar by 0.001 — the
optimizer landing on the exact threshold where the noisiest dataset barely
passes; textbook overfitting to test noise).

So the Section-B/C cost numbers and the apparent "cap320 sweet spot" are
**not trustworthy as test-time performance** — not for sample-size reasons,
but because τ was chosen on the test set. The fix is a **held-out τ**: choose
the threshold on pmctrain, freeze it, then apply to eval — the honest
opposite of the invalid script.

---

## Phase 3 — The honest held-out grid → cap320 at 74%

The proper grid trains τ on pmctrain at each cap, freezes it, and applies it
to eval served at each cap (rows = where τ was trained, columns = where
served). The verbatim output:

```text
per-train-cap tau: {fullres: 0.426, cap640: 0.424, cap320: 0.428, cap160: 0.415, cap80: 0.404}
always-32B pooled acc (parity reference) = 0.572  (n=8220, all six benchmarks)
always-7B pooled acc by infer cap: fullres=0.526 cap640=0.526 cap320=0.526 cap160=0.525 cap80=0.514
=== cascade accuracy (pooled over six) ===
  trainX\inferY  fullres  cap640  cap320  cap160   cap80
  fullres         0.572   0.571   0.572   0.570   0.567
  cap640          0.572   0.571   0.572   0.570   0.567
  cap320          0.572   0.571   0.572   0.570   0.567
  cap160          0.572   0.571   0.572   0.570   0.567
  cap80           0.571   0.570   0.571   0.568   0.566
=== escalation % ===
  fullres           63%     63%     63%     64%     65%
  ...               ...
  cap80             59%     59%     60%     60%     61%
=== backbone% (prefill-incl, % of always-32B) ===
  fullres           79%     77%     74%     71%     70%
  ...               ...
  cap80             76%     73%     70%     68%     67%
ANCHOR (fullres,fullres): acc=0.572 esc=63% backbone=79%
Best at parity (acc>=0.567): train=cap80 infer=cap160  acc=0.568 esc=60% backbone=68%
```

Two things now hold up that the invalid sim faked. First, **the cascade
matches always-32B**: pooled cascade accuracy is 0.572 = always-32B 0.572
(n=8220), essentially flat down every column — τ trained at one resolution
**transfers** to serving at another. Second, **resolution is a real, monotone
cost lever**: the prefill-inclusive backbone falls 79% → 77% → 74% → 71% → 70%
as serving resolution drops, *with accuracy unchanged* (0.572 → 0.571 → 0.572).

**The operating point chosen: train τ at full-res, serve at cap320** —
cascade acc **0.572** (exact parity with always-32B), escalation **63%**,
backbone **74%** of always-32B (down from the 79% full-res anchor). cap320 is
the right pick because it is the deepest cut where Table B accuracy is still
*provably* flat (−0.001 pooled), buying a clean 5-point compute saving for
free. The grid's cheapest-at-parity cell (train cap80 / infer cap160, 68%
backbone) saves 6 points more, but at 0.568 it dips below the 0.572 parity
line and leans on the radiology-sensitive caps — not worth the risk for a
headline that lives on *matching* 32B. This refines the ~75% prefill-inclusive
estimate carried from June 9 into a held-out **74% at cap320**.

---

## Phase 4 — Why HF on separate GPUs, not vLLM pooling

A natural question: why run the live cascade with the 7B on GPU 0 and the 32B
on GPU 1 under plain HuggingFace, instead of pooling both cards into one
vLLM TP=2 engine (which intuitively seems better for VRAM)? The intuition is
the one part that's backwards, and it's worth stating precisely:

- **vLLM cannot measure VRAM.** On startup vLLM grabs `gpu_memory_utilization`
  (default 0.9) of each card and fills it with pre-allocated KV-cache blocks
  *regardless of what the model needs* — so `nvidia-smi` shows ~72 GB used
  whether the model is 7B or 32B; the number is the pool size, not the
  footprint. HF allocates on demand, so resident memory ≈ the true cost
  (7B ≈ 14–18 GB, 32B ≈ 64–68 GB). For the VRAM dimension, HF-separate is
  strictly better.
- **HF-separate also buys clean per-GPU power attribution** (GPU 0 = the 7B
  leg, GPU 1 = the 32B leg) and a simple live loop that can extract the
  margin, at the cost of latency being a **conservative upper bound**
  (single-card, no TP, no vLLM kernels).
- **Where vLLM/TP2 genuinely wins is latency** (~1.5–1.8× on the 32B). But
  the paper's claim is *relative* — cascade vs. always-32B — and vLLM would
  lower *both* latencies by a similar factor, so the headline ratio barely
  moves while honest VRAM is lost. The absolute-speed number isn't where the
  efficiency claim lives anyway; that's the engine-independent FLOPs grid
  (74%).

A legitimate choice, not a forced one — a vLLM-TP2 latency variant remains on
the table if deployment-realistic latency becomes the headline. For now:
HF-separate first.

---

## Phase 5 — The real-time cascade harness (`rt_cascade.py` / `rt_analyze.py`)

The grid's 74% is a FLOPs estimate; the real-time harness produces the
empirical wall-clock / energy analog by actually running the cascade live.
Both models sit resident — 7B on GPU 0, 32B on GPU 1 — and each query flows
through in one pass:

- **7B (nothink, `max_new_tokens=16`) answers every query** on GPU 0,
  batch-1; the frozen gate computes the margin **live** from the 7B's
  first-token option log-probs and compares it to **τ = 0.426**.
- **Only on a low-margin (escalated) query does the 32B run** (GPU 1, think,
  `max_new_tokens=2048`), and its answer becomes the final one. On a
  non-escalated query GPU 1 stays idle — which is exactly why the measured
  per-query energy reflects the *real* routing saving.
- A `DualPowerSampler` polls **both** boards every 25 ms, recording per-GPU
  power/energy plus the summed energy/query; the run is resumable (every
  query flushed), prints a startup resident-VRAM line, and a progress line
  every 20 queries.

`rt_analyze.py` is a separate, reusable pass over the JSONL (safe on a
partial file mid-run): pooled summary, a gate-discrimination check, the
escalation 2×2 (rescued / broken / wasted / redundant), latency percentiles,
energy-per-correct, a 32B-truncation proxy, and — critically — a
**faithfulness check against the validated vLLM 32B eval labels** (`gate_32b`)
on shared question IDs. (Deliberately skipped as misleading at batch-1: GPU
utilization %, peak-VRAM-during-decode, and throughput.)

---

## Phase 6 — The smoke-test scare, and the faithfulness check that cleared it

A 50-question PMC-VQA smoke run at cap320 came back alarming:

```text
===== LIVE CASCADE  cap=cap320  (50 queries, batch-1, real escalation) =====
accuracy (live routed) : 0.500          escalation rate : 62.0%  (tau=0.426)
latency mean/p50/p95   : 18.35 / 21.62 / 39.45 s   (7B leg 0.18s · 32B leg 29.21s)
energy / query         : 5816.9 J    power: GPU0(7B) 84W · GPU1(32B) 245W
VRAM resident          : GPU0(7B) 18014 + GPU1(32B) 68321 = 86335 MB
  always-7B 0.660 · cascade 0.500 · 1.59x faster than always-32B
```

The cascade scored **0.500 while always-7B scored 0.660 on the same 50** —
backwards: escalating ~62% to the 32B made accuracy *worse* than the cheap
leg alone, which a working cascade can't do. The measurement harness itself
was internally consistent (energy reconciled with the per-GPU watts and
latencies), so suspicion fell on the 32B leg's *answers*, and the full run was
killed before committing ~20 hours to a possibly-garbage headline (the buggy
partial renamed aside so the resume logic couldn't append clean rows onto it).

The faithfulness check then **walked the alarm back** — a good catch against a
too-quick "the leg is broken" call:

```text
ESCALATION OUTCOME (escalated only):  rescued 3 (10%) · broken 11 (35%)
                                      wasted 9 (29%) · redundant 8 (26%)   NET = -8
32B GENERATION: mean gen_tokens=397  max=677  hit cap(2048)=0%
FAITHFULNESS vs vLLM 32B eval (n=31): agreement 0.839
   HF-32B acc 0.355   vs   vLLM-32B acc 0.387   (same questions)
```

The decisive line is the faithfulness accuracy: the **validated** vLLM 32B —
the one in the grid that reproduced the paper — *also* scores only 0.387 on
these exact escalated questions. If the HF leg were genuinely broken, vLLM
would ace them and HF would flunk; instead they're 0.355 vs 0.387 and agree
84%. `hit cap(2048)=0%` rules out the truncation hypothesis (the 32B emits
complete answers, ~397 tokens). The 16% HF-vs-vLLM divergence is **engine
numerics** — greedy decoding over ~400-token reasoning chains is chaotic, and
different kernels flip an early token that cascades to a different final
answer. And the slice is **adversarially hard by construction**: these are
exactly the PMC questions the 7B was *unsure* about (hence escalated), where
even the 32B sits near 0.36 — so a 50-question cascade-below-7B is a sampling
artifact. The grid already showed cap320 holds parity (0.572) on the full
8,220. Not a bug; safe to launch.

(The harness's latency/power/VRAM lines are real and useful regardless: 7B
leg ~0.18 s, escalated 32B leg ~29 s, GPU0 18 GB / GPU1 68 GB resident, ~245 W
on the 32B while active — the live numbers the full run will report at scale.)

---

## Phase 7 — The full cap320 real-time run, launched

With the leg exonerated, the full run went out: **cap320, all six benchmarks,
every one of the 8,220 questions**, unattended and resumable —

```bash
nohup python scripts/rt_cascade.py --cap cap320 --n 0 --out rt_cascade_cap320.jsonl \
      > logs/rt_cascade.log 2>&1 &
# tail -f logs/rt_cascade.log   (resumes from the JSONL if it dies; ~15–28 h)
```

The confirmation to watch as it fills: the live pooled accuracy should track
the offline grid's **0.572**, proving the live HF system reproduces the
offline result — at which point the harness yields the real wall-clock and
energy analogs of the 74% FLOPs figure (including energy-per-correct, the
iso-quality headline, to report side by side with the FLOPs number). It's
running into the night.

---

## Honest ledger of the day

1. **Resolution sweep — no visual cliff.** 7B accuracy is flat fullres→cap160
   (pooled 0.621→0.617), degrading only at cap80, concentrated in the
   radiology sets (SLAKE −0.033, VQA-RAD −0.044). An efficiency lever, not an
   accuracy one.
2. **A τ-on-test trap, caught.** The first cascade-sim chose its threshold on
   the eval data, faking a 25-point cost gap between two equal-accuracy arms
   (fullres 62.8% vs cap640 37.5%) — overfitting to SLAKE sampling noise.
   Replaced with a held-out τ grid.
3. **Held-out grid → cap320 at 74%.** τ trained on pmctrain transfers across
   serving resolution; the cascade holds **0.572 (= always-32B parity)** at
   **74%** prefill-inclusive backbone (down from 79% full-res), serving at
   cap320 — a free 5-point compute saving. Refines the ~75% carried from
   June 9.
4. **HF-separate over vLLM-pooling** for the live harness — true VRAM
   (7B ≈ 18 GB / 32B ≈ 68 GB) and clean per-GPU power, accepting a
   conservative (upper-bound) latency; the relative cascade-vs-32B claim is
   what matters and the FLOPs 74% is engine-independent.
5. **Real-time harness built** (`rt_cascade.py` + `rt_analyze.py`) — live
   7B→gate→32B, per-GPU power/energy/VRAM/latency, resumable, with a
   faithfulness check vs the validated vLLM labels baked in.
6. **A smoke-test scare, honestly walked back.** Cascade 0.500 < 7B 0.660 on
   a 50-question slice looked like a broken 32B leg; the faithfulness check
   (HF 0.355 vs vLLM 0.387, 84% agreement, 0% truncation) showed it was a
   hard slice + engine numerics, **not a bug** — correcting a too-quick call.
7. **Full cap320 real-time run launched** — all six benchmarks, 8,220
   queries, overnight, tracking the offline 0.572.

!!! note "On the project's direction"
    The committed result stands: a **7B→32B confidence-margin efficiency
    cascade** for medical VQA, matching a 32B medical VLM at a fraction of
    its cost. Today sharpened the cost number (held-out **74%** at cap320,
    prefill-inclusive) and added the resolution ablation and a real-time
    measurement harness on top of it. The site name still says *question-aware
    visual token pruning*; the rebrand stays deferred until the real-time
    numbers are in and the write-up is drafted.

---

### Plan for next session

- [ ] **Read the full cap320 real-time run** — confirm live pooled accuracy
      tracks **0.572**, then pull the per-benchmark latency / power / VRAM /
      energy-per-correct table from `rt_analyze.py`; report the cascade's
      **energy as % of always-32B** beside the FLOPs **74%**.
- [ ] Optionally queue the **cap160** real-time run (and/or a vLLM-TP2 latency
      variant) for a cost/accuracy point below cap320.
- [ ] **Leave-one-dataset-out** generalization test of the frozen gate (still
      pending from Day 2) — the "deployable method" check.
- [x] **Commit the previous session's backlog** — done today as
      [`d474015`](https://github.com/Leokuan0208/medvlthinker-imgdiff-compute/tree/d474015).
      Push the day's real-time scripts (`rt_cascade.py`, `rt_analyze.py`, the
      held-out τ grid) once the cap320 run's numbers are in.

---

## Pushed today

**Pushed — [`d474015`](https://github.com/Leokuan0208/medvlthinker-imgdiff-compute/tree/d474015).**
Today's session cleared the previous session's backlog of uncommitted code —
the frozen-gate training, the prefill-inclusive FLOPs analysis, the
learned-router / conformal comparisons, and `run_7b_prune_sweep.py` — as
`751f042..d474015` on `main`. The day's own real-time scripts (`rt_cascade.py`,
`rt_analyze.py`, the held-out τ grid, and the cascade simulation) live in the
same repo; the headline real-time numbers come once the cap320 run finishes.
