# Day 1 — Wednesday, June 17, 2026

[← Back to Week 6 overview](index.md)

**The wrong axis: the gate is closed, and the real lever is the strong leg's
compute mode → ACC** · Week 6, Day 1 · **Day 39 of the project**

---

A two-part day, and a genuine turn in the project. The morning established
*where this work sits* in the cascade/routing literature; the afternoon (run
in **Claude Code**, captured in `progress_June_17.md`) produced the result
that reframes the whole contribution: **the escalation gate is a dead axis —
it cannot be improved beyond plain margin — and the real compute lever is the
*strong leg's reasoning mode*.** The 32B's "thinking" actively *over-thinks*
perception VQA, so turning its fast no-think mode into an intermediate cascade
tier yields **ACC** (Adaptive-Compute Cascade): a 3-tier cascade built from
just two model checkpoints that matches always-32B-think accuracy at **−72%
latency / −75% energy / ~½ FLOPs** on the full pool, guardrail-clean. The
gate-improvement work from the prior weeks doesn't vanish — it becomes a clean,
publishable *negative result* that motivates the structural move.

!!! note "Day count, machine, and the Claude Code switch"
    June 14–16 had no tracked research session, so this opens Week 6 and is the
    **1st working session** of the week; June 17 is **Day 39** of the project
    (calendar count from May 10). The literature work was done in chat; the
    experimental work was run in **Claude Code** and handed back as a Markdown
    log (`progress_June_17.md`), which was rebuilt into a readable 13-page Word
    report (`Progress_June_17.docx`).

---

## Phase 1 — Where this work sits: the literature positioning

A deep cascade/routing literature search to establish domain fluency,
evaluation conventions, and the baselines to beat. The useful results:

- **The method has a precise name.** The confidence-margin gate is a
  **post-generation cascade**, *not* a router (routers decide before
  generating; cascades decide after the cheap model has answered).
- **The evaluation unit is a curve.** The field reports a swept cost–quality
  curve summarized by **AIQ** or **nAUC** — not a single operating point — and
  the project's "74% at parity" maps directly onto the established metric
  **Quality-Neutral Cost (QNC)**.
- **The simplicity result is corroborated.** **LLMRouterBench** (Jan 2026)
  independently finds that *simple baselines routinely beat complex learned
  routers* — exactly the project's own internal finding.
- **The gap is real and unoccupied.** No published **training-free cascade for
  medical VLMs** exists; the intersection of *training-free × cascade × medical
  VLM × prefill-inclusive honest accounting* is open ground.

Output: a tiered **18-paper reading list** with runnable-baseline code repos
identified. The Tier-1 must-reads — **FrugalGPT** (2305.05176), **AutoMix**
(2310.12963), **Cascade Routing** (2410.10347), **RouteLLM** (2406.18665),
**RouterBench** (2403.12031), **CP-Router** (2505.19970), **LLMRouterBench**
(2601.07206), and the **2026 routing survey** (2603.04445) — plus VLM-specific
neighbors (AVR, SGL, VL-RouterBench, MMR-Bench), confidence mechanics (Hybrid
LLM, GATEKEEPER), and skim-tier context. If only four this week: **Cascade
Routing, AutoMix, RouteLLM, LLMRouterBench** (strongest baseline, closest
analog, transfer framing, best corroborating cite).

---

## Phase 2 — The gate axis, closed (a clean negative result)

The afternoon began by attacking the *gate* — the escalation decision — and
proved, with a stack of negative results, that it is **signal-limited and not
improvable**:

- **~63% of the 7B's errors are futile to escalate** — the 32B is *also* wrong
  on them, so no gate can rescue them.
- **Recoverability is only ≈0.6 AUROC** from any cheap signal — the rescue
  event is near-unpredictable from anything the 7B exposes.
- **Plain margin already beats or ties every fancier gate** — conformal /
  MSP / Chow (≡ CP-Router), learned-correctness (FrugalGPT scorer),
  learned-deferral (Jitkrittum-style), self-verification, entropy, and
  Gini / DOCTOR all cluster at or below it.

This cleanly rules out the large family of "smarter router" approaches the
current literature keeps proposing — a result worth publishing in its own
right. The corollary: **any further compute savings must come from somewhere
other than the gate.**

---

## Phase 3 — The real lever: no-think *over-thinks* perception

The somewhere-else turned out to be the **strong leg's compute mode**. The
32B's chain-of-thought "thinking" — assumed to be strictly better — actually
*hurts* on perception VQA, because it talks itself out of correct
quick-glance answers:

- **32B-no-think beats 32B-think by +7.7 on SLAKE and +11.7 on VQA-RAD**, at
  **~2 decode tokens instead of ~477.**

So on the competent perception benchmarks, the expensive reasoning mode is both
*slower* and *less accurate*. That single observation is the lever the gate
work was missing.

---

## Phase 4 — ACC: the Adaptive-Compute Cascade

Reframing the strong-leg axis as a proper cascade method gives **ACC** — three
tiers built from only **two** model checkpoints, stopping at the first
confident answer, each tier gated by its own margin:

- **Tier 0** — 7B-no-think @ cap320 (~0.18 s / 25 J)
- **Tier 1** — **32B-no-think** @ cap320 (~0.34 s / 65 J; exposes logprobs)
- **Tier 2** — 32B-think @ full-res (~28 s / 6994 J)

The big model's **fast no-think mode is the intermediate workhorse**; slow
reasoning fires only on the residual that genuinely needs it. (Per-config
batch-1 latency/energy is calibrated against real NVML measurements at
**R² = 0.99** — 0.0716 s and 18.17 J per think token.)

**Honest held-out result** (50/50 split, 20 seeds, at parity accuracy):

| Pool | Metric | Deployed / standard | ACC |
| ----- | ----- | --: | --: |
| ALL-6 | latency | 20.0 s | **5.7 s (−72%)** |
| ALL-6 | FLOPs | 81% | **55%** |
| ALL-6 | energy | 7049 J | **1505 J (−75%)** |
| ALL-6 | guardrail-fails | 0.35 | **0.00** |
| ALL-5 | latency | 9.1 s | **0.28 s (−97%)** |
| COMP-4 | latency | 8.2 s | **0.39 s (−97%)** |

**Head-to-head vs. standard reasoning cascades** (ALL-6, parity acc 0.5723;
M2 = standard 2-tier 7B-think→32B-think; M3 = standard 3-tier
7B-nt→7B-think→32B-think):

| Method | acc | esc→think | FLOPs% | latency | energy | guard |
| ----- | --: | --: | --: | --: | --: | --: |
| M2 — std 2-tier (think) | 0.5725 | 86% | 105% | 29.8 s | 7049 J | 0.35 |
| M3 — std 3-tier | 0.5697 | 65% | 89% | 23.2 s | 5499 J | 0.25 |
| **M1 — ACC (margin)** | 0.5694 | 19% | **54.7%** | **5.93 s** | **1505 J** | **0.00** |
| **M1b — ACC + agreement** | 0.5710 | 14% | **53.5%** | **4.86 s** | **1220 J** | **0.00** |

ACC dominates every efficiency axis at matched accuracy. (M2 exceeds 100%
FLOPs because a 7B-*think* cheap leg is both slow and weaker on perception, so
it still escalates 73–86% of the time to the think tier.)

---

## Phase 5 — ACC-v2, and proof that the win is the structure, not the gate

ACC-v2 adds the one cascade-native gate improvement that survives scrutiny:
because **both** models have already run at the middle tier, their
**disagreement** is a *free* query-by-committee signal — escalate to the think
tier only when 7B and 32B disagree. It strictly Pareto-improves ACC (the M1b
row above: 53.5% FLOPs, 4.86 s, 1220 J at slightly *higher* accuracy).

Holding the ACC 3-tier structure fixed and swapping only the gate proves the
win is **structural**: every real gate lands in a tight band; only the
signal-free random router collapses.

| gate (ALL-6, parity 0.5723) | acc | esc→think | FLOPs% | latency | energy | guard |
| ----- | --: | --: | --: | --: | --: | --: |
| margin (Chow; ACC v1) | 0.5694 | 19% | 54.7% | 5.93 s | 1505 J | 0.00 |
| MSP / Chow ≡ CP-Router | 0.5704 | 19% | 57.8% | 6.60 s | 1675 J | 0.00 |
| entropy | 0.5695 | 21% | 62.2% | 7.99 s | 2033 J | 0.00 |
| Gini / DOCTOR | 0.5705 | 21% | 61.6% | 7.82 s | 1991 J | 0.00 |
| learned-correct (FrugalGPT) | 0.5679 | 19% | 60.5% | 7.61 s | 1934 J | 0.10 |
| learned-defer (VADR) | 0.5673 | 14% | 51.0% | 5.01 s | 1260 J | 0.00 |
| **agreement (ACC-v2, ours)** | 0.5710 | 14% | 53.5% | 4.86 s | 1220 J | 0.00 |
| random (no signal) | 0.5689 | 86% | 130.2% | 23.44 s | 6105 J | 0.05 |

All real gates cluster at **51–62% FLOPs / 5.0–8.0 s**; random collapses to
**130% / 23.4 s**. (Aside: CP-Router's conformal set-size is monotone in
top-1 probability for ≤5-option MCQ, so it reduces to MSP/Chow here.) The
spread among gates is small; the structural lever is what moves the needle.

---

## Phase 6 — Novelty, honesty, and what to claim

- **VADR was honestly retired.** The one idea that didn't hold up — a
  bidirectional learned-deferral signal (VADR) — was abandoned after an
  adversarial prior-art check and a failed load-bearing claim, rather than
  quietly dropped.
- **The accounting is the differentiator.** FLOPs are exact and
  prefill-inclusive; latency and energy are calibrated against real batch-1
  NVML at R² = 0.99; scope is explicitly the **four competent perception
  benchmarks** (MMMU and MedXpert excluded — both models near chance there).
- **What to claim:** an **efficiency-systems** contribution, not an accuracy
  one. The defensible novelty is narrow but real — *a three-tier-from-two-models
  cascade that uses the large model's no-think mode as the intermediate
  workhorse tier*, applied to medical VQA with measured latency and energy, an
  intersection the 2026 routing survey flags as an open gap. Foreground the
  **structure + the free agreement gate**; cite CAR and margin-gated-CoT for the
  self-gating precedent; present the **saturated-gate finding as a deliberate
  negative result** that motivates the structural move.

---

## Deliverable — `Progress_June_17.docx`

The Claude Code Markdown log was rebuilt into a readable **13-page Word
report**: the full content reorganized, with three rendered charts (think vs
no-think by benchmark; the ACC latency/FLOPs/energy headline; the gate
bake-off), cleanly shaded/zebra tables with the "ours" rows highlighted,
properly typeset equations (margin, softmax/entropy/Gini, the agreement gate,
expected per-query cost, FLOPs/backbone, and the energy trapezoid), callout
boxes, and a conclusion. Every number traces back to the log — nothing
fabricated.

---

## Honest ledger of the day

1. **Literature position fixed** — the method is a *post-generation cascade*;
   the eval unit is a swept curve (AIQ/nAUC); "74% at parity" = the established
   **QNC** metric; **LLMRouterBench** corroborates "simple beats complex"; and
   the training-free-medical-VLM-cascade gap is confirmed unoccupied. 18-paper
   tiered reading list with code repos.
2. **The gate axis is closed** — ~63% of 7B errors are futile, recoverability
   ≈0.6 AUROC, and plain margin beats/ties every fancier gate. A clean negative
   result that rules out the "smarter router" family.
3. **No-think over-thinks perception** — 32B-no-think beats 32B-think by **+7.7
   (SLAKE) / +11.7 (VQA-RAD)** at ~2 vs ~477 decode tokens. The lever the gate
   work was missing.
4. **ACC** — a 3-tier-from-2-checkpoints cascade (7B-nt → **32B-nt** →
   32B-think) matching always-32B-think at **−72% latency / −75% energy /
   ~½ FLOPs** on ALL-6, guardrail-clean, ~97% latency cuts on perception pools.
5. **ACC-v2** — the free 7B/32B-disagreement gate strictly Pareto-improves;
   holding the structure fixed, all real gates cluster (51–62% FLOPs) and only
   random collapses — the win is **structure, not gate**.
6. **Honest framing + VADR retired** — efficiency-systems contribution, NVML-
   calibrated (R²=0.99), perception-scoped; VADR dropped after a prior-art
   check.
7. **Deliverable** — a 13-page readable Word report of the full log.

!!! note "On the project's direction"
    This is a real evolution of the contribution. Through Week 5 the project's
    deployable result was the **frozen margin gate**; June 17 shows that gate is
    a *dead axis* (clean negative result) and relocates the win to the
    **strong-leg compute mode** — yielding **ACC** and its free agreement gate.
    The CVGIP 2026 submission stands as-is, but the higher-tier resubmission
    now has a stronger spine: lead with *no-think-overthinks-perception*, frame
    the contribution as **structure + agreement gate**, and use the
    saturated-gate result as the negative finding that motivates it. The site
    still carries its original *visual-token-pruning* name; with the work now
    centered on a named method (**ACC**), the rebrand is well overdue — but
    remains Leo's call.

---

### Plan for next session

- [ ] **Draft the paper around "structure + agreement gate"** — lead with the
      no-think-overthinks-perception finding; present ACC and ACC-v2 as the
      method, and the saturated-gate result as the motivating negative finding.
- [ ] **Mixed-set calibration of the think threshold** — calibrate on a
      reasoning-inclusive mix so the **ALL-6** deployment is honest rather than
      perception-only (the current scope caveat).
- [ ] **Treat the gate axis as closed** — any further compute savings must come
      from a genuinely new signal beyond cheap-model confidence; none that is
      both free and helpful has been found.
- [ ] Begin the Tier-1 reading (Cascade Routing, AutoMix, RouteLLM,
      LLMRouterBench) and stand up the **AutoMix** baseline for comparison.

---

## Pushed today

**No code push.** The day's experimental work was run in **Claude Code** on the
research server and captured as `progress_June_17.md`; the deliverables
(`Progress_June_17.docx` and the figures) are reports, not commits to the
`medvlthinker-imgdiff-compute` repo.
