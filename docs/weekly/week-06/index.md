# Week 6 — From gate to structure: the Adaptive-Compute Cascade (ACC)

<span class="pill pill--wip">In progress</span>

**Structural-pivot phase** (the gate axis is closed → the strong-leg compute
mode is the real lever) · **Week 6 of 12**

**Goal of the week** — [Week 5](../week-05/index.md) closed with a
reviewer-grade audit that left the **gate axis** looking exhausted: no learned
or conformal router beats a one-line margin gate, because the rescue event is
near-unpredictable from any cheap 7B signal. Week 6 opens by asking the obvious
follow-up — *if the gate can't be improved, where is the remaining compute
lever?* — and finds the answer on a completely different axis: the **strong
leg's reasoning mode**. The week's job is to turn that into a defensible method
(**ACC**) with honest, measured accounting, and to position it against the
cascade/routing literature.

---

### [Day 1 — Wednesday, June 17, 2026](day-01.md)

A two-part day and a genuine turn in the project. The morning fixed the
**literature position**; the afternoon (run in **Claude Code**, captured in
`progress_June_17.md`) produced the result that reframes the contribution.

- **Literature positioning.** The method is a **post-generation cascade** (not
  a router); the field's eval unit is a swept cost–quality curve (**AIQ /
  nAUC**); the "74% at parity" result maps to the established metric
  **Quality-Neutral Cost (QNC)**; **LLMRouterBench** (Jan 2026) corroborates
  "simple beats complex"; and **no training-free cascade for medical VLMs
  exists** — the gap is confirmed. Output: a tiered **18-paper reading list**
  (FrugalGPT, AutoMix, Cascade Routing, RouteLLM, RouterBench, CP-Router,
  LLMRouterBench, the 2026 survey, + VLM/confidence tiers) with code repos.
- **The gate axis is closed** — ~63% of 7B errors are futile to escalate (32B
  also wrong), recoverability ≈0.6 AUROC from any cheap signal, and plain
  margin beats/ties every fancier gate. A clean, publishable negative result.
- **No-think over-thinks perception** — the real lever: 32B-no-think beats
  32B-think by **+7.7 (SLAKE) / +11.7 (VQA-RAD)** at ~2 vs ~477 decode tokens.
- **ACC (Adaptive-Compute Cascade)** — 3 tiers from 2 checkpoints (7B-nt →
  **32B-no-think** → 32B-think) matches always-32B-think at **−72% latency /
  −75% energy / ~½ FLOPs** on ALL-6, guardrail-clean (0.35 → 0.00), ~97%
  latency cuts on the perception pools.
- **ACC-v2** — a free 7B/32B-**disagreement** gate strictly Pareto-improves;
  holding the structure fixed, all real gates cluster (51–62% FLOPs) and only
  random collapses — the win is **structure, not gate**. VADR honestly retired
  as non-novel.

Framed as an **efficiency-systems** contribution (NVML-calibrated, R²=0.99,
perception-scoped). Deliverable: a readable **13-page Word report**
(`Progress_June_17.docx`). No code pushed.

---

## Plan for the week (Jun 14 – Jun 20)

- [x] **Literature positioning** (Day 1) — name the method (post-generation
      cascade), the eval unit (AIQ/nAUC, QNC), and the gap (training-free
      medical-VLM cascade); 18-paper tiered reading list.
- [x] **Close the gate axis** (Day 1) — the saturated-gate negative result
      (~63% futile, ≈0.6 AUROC, margin beats all).
- [x] **Find and validate the real lever → ACC** (Day 1) —
      no-think-overthinks-perception → the 3-tier ACC cascade and the free
      ACC-v2 agreement gate, with measured latency/energy/FLOPs.
- [ ] **Draft the higher-tier paper around "structure + agreement gate"** —
      lead with the no-think finding; saturated-gate result as the motivating
      negative finding.
- [ ] **Mixed-set calibration of the think threshold** — make the ALL-6
      (reasoning-inclusive) deployment honest, not perception-only.
- [ ] **Stand up the AutoMix baseline** and begin the Tier-1 reading.

---

## Reflections (end-of-week)

_Write this at the end of the week. The question Day 1 forces: now that ACC has
relocated the contribution from the (exhausted) gate axis to the strong-leg
structural axis, does the rest of the week go into making ACC airtight and
written up for a higher-tier venue — the mixed-set calibration, the AutoMix
baseline, the paper draft — or does a new compute lever appear worth chasing?
Day 1 turned a stack of negative gate results into a positive structural method;
the week decides how far to harden it._
