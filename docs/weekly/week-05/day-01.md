# Day 1 — Sunday, June 7, 2026

[← Back to Week 5 overview](index.md)

**Breakthrough + reframe** (single-model routing closed → 7B→32B
cross-model cascade) · Week 5, Day 1 · **Day 29 of the project**

---

The biggest single day of the project: a direction audited to death and a
genuine breakthrough reached in the same session. It opened on the n=500
results launched [Friday](../week-04/day-05.md) and asked the decisive
question Week 4 had deferred — *is the routable oracle headroom real, or a
statistical mirage?* A luck-floor control answered cleanly: **mirage.** The
four single-model policies make *correlated* errors, so their "oracle" is
an artifact of taking the best of four. A forensic audit and a competent-regime
control (PMC-VQA) confirmed it from two more angles, and **single-model
routing was definitively closed** — the fourth direction to die in the
pivot. But the diagnosis carried its own prescription: complementarity
requires *different models*, not different policies on one model. That drove
the pivot to a **7B→32B cross-model cascade**, a 63 GB model download, a new
vLLM container, and an overnight paired-label run — and the cascade is the
first thing all week where the core ingredient (complementarity) **actually
exists**: the cheap 7B rescues 20–27% of the questions the 32B misses,
oracle +12.5pp over always-32B. The catch, confirmed two ways: that accuracy
headroom is **not reachable** from a cheap escalation signal (the margin gate
escalates 96% on hard sets; a layer-14 hidden-state probe is *worse* than the
margin). What *is* reachable, and is the day's real result, is a **working
efficiency cascade on competent medical VQA** — 32B-level accuracy at 30–60%
of 32B cost across four benchmarks.

No code was pushed today — every script (`pmcvqa_recoverability.py`,
`run_32b_vllm.py`, `router_escalate.py`, the cascade analysis, the vLLM 25.09
Dockerfile) lives in the `medvlthinker-imgdiff-compute` repo; the push waits
until the framing is committed, on the week's standing rule.

!!! note "Day count and a new week"
    June 7 is the first day of **Week 5** (the weekly log runs Sun–Sat;
    Week 5 = Jun 7 – Jun 13). Global day numbers track the calendar
    (Day 1 = May 10), so June 7 is **Day 29**.

---

## Phase 1 — Reading the n=500 gate: the oracle was a mirage

The [n=500 sharded run](../week-04/day-05.md#phase-7-the-n500-sharded-baseline-launched-and-running)
finished clean on both VMs; the `_s0of2` / `_s1of2` checkpoints merged by
per-cell concatenation into a 1500-sample (3-dataset) record set. Week 4
ended on an exciting-looking number — a per-question oracle ~9–10pp above
the best fixed policy. Before trusting it, it needed the control Week 4
flagged as decisive: **is that oracle genuine complementarity, or just the
inflation you always get from taking the best of K noisy arms?**

The control is a **luck-floor permutation test** (`oracle_luckfloor.py`,
2000 permutations, seed 42). The idea: the oracle is a *maximum over four
cells*, and maxima inflate by chance — four arms each ~25–50% accurate will
have *some* arm right on most questions purely because four independent
draws rarely all miss. The luck floor is exactly that expected value, the
oracle you'd see **if the four arms made independent errors** at their
measured accuracies:

```text
luck floor = 1 − (1−acc₁)(1−acc₂)(1−acc₃)(1−acc₄)
```

The permutation version shuffles each cell's correctness pattern across
questions (preserving each cell's accuracy, destroying any per-question
relationship) and recomputes the oracle 2000× — same floor, plus a spread
to express the gap in σ. The reads: real ≈ luck → artifact; real ≫ luck →
genuine complementarity; **real ≪ luck → the arms are *redundant*
(correlated errors).** The result landed on that third branch, hard:

| Dataset | nothink·norag | think·norag | rag·StatPearls | rag·Textbooks | best fixed | real oracle | luck floor | gap (σ) |
| ------- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| MedXpert-Reasoning | 0.228 | 0.230 | 0.208 | 0.200 | 0.230 | 0.458 | 0.623 | <span class="cell-bad">−0.165 (−13.2σ)</span> |
| MedXpert-Understanding | 0.266 | 0.268 | 0.276 | 0.242 | 0.276 | 0.502 | 0.705 | <span class="cell-bad">−0.203 (−15.8σ)</span> |
| PMC-VQA | 0.516 | 0.494 | 0.474 | 0.462 | 0.516 | 0.690 | 0.930 | <span class="cell-bad">−0.240 (−25.1σ)</span> |
| **Pooled** | **0.337** | — | — | — | **0.341** | **0.550** | **0.753** | <span class="cell-bad">**−0.203 (−29.3σ)**</span> |

The real oracle sits **20 points below** the independent-errors floor at
**−29σ pooled**. That's not "near the floor" (independent, nothing special)
— it's far *below* it, the signature of arms whose errors are **positively
correlated**: the four policies tend to be right together and wrong
together. Which is exactly what they are mechanically — not four different
models, but one 7B lightly perturbed by think/nothink and a retrieved
passage. They share the same knowledge and perception, so they share most
of their successes *and* failures. The Week-4 oracle headroom was real as a
number but was a max-of-K mirage, not a signal any router could reach.

---

## Phase 2 — The forensic audit, and the PMC-VQA recoverability control

That demanded a full reckoning with *why* the routing direction kept
failing across experiments. The audit named two structural root causes —
not bad luck, design errors:

1. **Wrong tool for the job.** think / nothink / RAG are *efficiency*
   methods — proven to save compute while *preserving* accuracy. They were
   being used as *accuracy* methods. Routing among configurations can't
   conjure correctness that none of them possesses.
2. **Same brain, same blind spots.** The 7B is RL-trained to think, so
   "nothink" is a *hobbled version of the same model*; RAG just prepends a
   passage. All four arms share one knowledge base, so they fail on the
   **same** questions. Routing needs *complementary* errors; these are
   *redundant* — precisely what the −29σ measured.

The honest stress-test was to run the control on the benchmark where
routing should work if it works anywhere: **PMC-VQA**, the competent regime
(0.516, well off the floor), via `pmcvqa_recoverability.py`. If the arms
are redundant *even here*, single-model routing is dead, not merely weak:

```text
PMC-VQA RECOVERABILITY CHECK  (N=500)
(1) ORACLE vs LUCK FLOOR
    nothink_norag 0.516 · think_norag 0.494 · think_rag_StatPearls 0.474 · think_rag_Textbooks 0.462
    best-fixed = 0.516   oracle = 0.690   luck floor = 0.931 ± 0.010
    >> oracle − luck = −0.241  (z = −25.1)   >>> NOT above floor: redundant arms
(2)+(3) PREDICTABILITY + ROUTED GAIN  (scalar confidence features)
    per-arm AUROC: noth.nor 0.72 · thin.nor 0.70 · thin.Sta 0.71 · thin.Tex 0.72
    routed = 0.498   best_fixed = 0.516
    >> routed − best_fixed = −0.018 ± 0.033     >> shuffle control = 0.498
```

Two things worth separating here. The per-arm **AUROC ~0.70–0.72** means
confidence *does* predict whether a given arm is right — the signal exists.
But a **trained router still scores 0.498, *below* the 0.516 of just always
using the best single arm.** That's the crux: a predictive confidence
signal can't manufacture complementarity that isn't in the arms. When every
arm is wrong on the same question, knowing *which* arm is most confident
buys nothing. **Single-model routing definitively closed** — the fourth
direction killed in the pivot (after Direction D, image-difficulty, and the
joint perception+knowledge framing).

The prescription falls straight out of the diagnosis: if the failure is
"same model → correlated errors," the fix is **genuinely different models**.

---

## Phase 3 — The pivot: a 7B→32B cross-model cascade (and the infrastructure)

The new direction: a **cascade** — run the cheap 7B by default, escalate
the hard questions to a larger, *architecturally different* model (the 32B),
and measure both the accuracy headroom (does the pair complement?) and the
realizable cost saving (can a cheap gate decide when to escalate?). Standing
up the 32B was most of the day's engineering:

- **Model.** Downloaded `MedVLThinker-32B-RL_m23k` to
  `/data/dan/weights/` — ~63 GB, 14 bf16 shards, split across **both A100s**
  via `device_map="auto"` (layer split 32/37).
- **Container.** Built a fresh **NGC vLLM 25.09** image in KUBERUN format
  (vLLM 0.10.1.1, torch 2.9.0a0, transformers 4.55.2, Python 3.12, CUDA
  13.0), this time with **code-server** as the UI instead of JupyterLab
  (`--bind-addr 0.0.0.0:8888 --auth none "$HOME"`), and the JupyterLab
  `root_dir` fix baked permanently into `CMD`.
- **Three bugs fixed in `run_32b_vllm.py`** — the ones that would have
  silently corrupted the labels:
    - `max_tokens=2048` — the default 512 truncated **80% of think traces**
      before the answer letter, collapsing accuracy to ~10%. (The same
      truncation class that's bitten before.)
    - `limit_mm_per_prompt={"image": 8}` — fixes a hard crash on MedXpert's
      6-image samples (vLLM's default per-prompt image cap was too low).
    - per-chunk `try/except` → one-by-one fallback, so one bad sample can't
      kill a whole batch.

??? note "`run_32b_vllm.py` — the label-corrupting defaults that had to change"

    The two `max_tokens` / image-cap fixes are the difference between
    trustworthy 32B labels and a silently broken run. The 32B serves think
    mode; the cheap-7B baseline runs nothink with a 16-token cap.

    ```python
    llm = LLM(model="/data/dan/weights/MedVLThinker-32B-RL_m23k",
              tensor_parallel_size=2,                 # split across both A100s
              limit_mm_per_prompt={"image": 8},        # MedXpert has 6-image items
              dtype="bfloat16", gpu_memory_utilization=0.92)
    sp = SamplingParams(temperature=0.0, max_tokens=2048)   # 512 truncated 80% of traces

    def run_chunk(batch):
        try:
            return llm.generate(batch, sp)            # fast path
        except Exception:
            return [llm.generate([b], sp)[0] for b in batch]   # resilient one-by-one
    ```

- **Overnight paired-label job.** Generated complete, paired labels across
  **all six datasets** for both the **32B (think)** and the **cheap-7B
  (nothink, 16 tokens)**, plus **layer-14 hidden-state features**
  (`feats_full/`) for the escalation probe in Phase 6.

---

## Phase 4 — Cross-model complementarity is real

With paired 7B/32B labels in hand, the cascade complementarity test
(`cascade_complementarity.py`). The question: do the cheap 7B and the 32B
have a non-trivial `only-7B` cell — questions the small model gets that the
big one misses? Unlike the single-model arms, the answer is **yes**:

| Dataset (n=500) | 7B cheap | 32B | both | **only-7B** | only-32B | neither | oracle(7B∣32B) | gain vs 32B | 7B rescues |
| --------------- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| MedXpert-Reasoning | 0.228 | 0.314 | 0.190 | <span class="cell-good">0.268</span> | 0.124 | 0.418 | 0.582 | <span class="cell-good">+0.268</span> | 134 (26.8%) |
| MedXpert-Understanding | 0.266 | 0.382 | 0.250 | <span class="cell-good">0.252</span> | 0.132 | 0.366 | 0.634 | <span class="cell-good">+0.252</span> | 126 (25.2%) |
| PMC-VQA | 0.516 | 0.550 | 0.482 | <span class="cell-good">0.208</span> | 0.068 | 0.242 | 0.758 | <span class="cell-good">+0.208</span> | 104 (20.8%) |
| **Pooled** | **0.337** | **0.415** | — | — | — | — | **0.658** | **+0.243** | **24.3%** |

The `only-7B` pool is **20.8–26.8%** — the cheap 7B genuinely rescues
104–134 questions per dataset that the 32B gets wrong. A perfect router over
the pair would beat always-32B by **+0.125 pooled** (this headroom built on
the *realistic* cheap-7B, not the inflated best-of-4). This is
**fundamentally different** from the morning's redundant single-model arms:
there's a real `only-7B` cell because the two models are genuinely
different architectures with different failure modes. The 32B pivot was the
right call. (The luck-floor z is still mildly negative, −4.5 to −12.2 — the
two models share *some* correlated errors, as any two medical VLMs would —
but the existence of a substantial `only-7B` pool is the part that matters
for a cascade.)

---

## Phase 5 — …but a naive margin gate can't reach it on hard benchmarks

The oracle is the *ceiling*. The *implementable* version routes on a cheap
signal: keep a question on the 7B when its confidence margin (top1 − top2
logprob) is high, escalate to the 32B when it's low. That realistic cascade:

- **Pooled gated = 0.415, identical to always-32B (0.415) — escalating
  96%.** The margin gate essentially gave up on the 7B and sent almost
  everything to the big model, so it just reproduces the 32B's accuracy at
  the 32B's cost. On the two near-chance MedXpert sets the 7B's confidence
  is noise (it can't tell which questions it actually knows), so the gate
  can't keep anything on the cheap model. **The same predictability wall
  from the morning, confirmed a third time.**
- **PMC-VQA is the exception, and the seed:** gated **0.528** escalating
  only **58%** — within ~2pp of always-32B (0.550) while sending **42% of
  questions to the cheap model.** That's not an accuracy win, it's an
  *efficiency* one: ~96% of 32B accuracy at ~58% of 32B compute. It works
  here precisely because PMC-VQA is the competent regime where the 7B's
  confidence is predictive (AUROC ~0.72), not noise.

So the naive confidence cascade is a clean **NO on accuracy** for the hard
sets — the +12pp the oracle promises is not reachable from the cheap margin
— but it hints at a real efficiency play wherever the 7B's confidence
carries signal.

---

## Phase 6 — Overnight: the hidden-state escalation probe, and the real result

One pre-registered question remained: is the *margin* simply too crude — would
a **trained probe on the 7B's layer-14 hidden states** identify the keep-vs-escalate
boundary better, and so reach some of that +12pp headroom?
`router_escalate.py` tested it across **all six datasets** overnight
(margin gate vs. `hidden_last` / `hidden_mean` / `hidden+margin` probes).
The answer is a clean, pre-registered **no** — and underneath the negative
sits the day's actual result.

**The hidden state lost to the margin.** Compared at accuracy-for-a-given-escalation-cost,
the raw margin is better or equal everywhere, and its **7B-correctness AUROC
is consistently *higher* than the trained hidden-state probe's**: VQA-RAD
0.76 vs 0.55, SLAKE 0.74 vs 0.63, PMC-VQA 0.71 vs 0.63, PathVQA 0.63 vs 0.62.
The fancy signal is the *weaker* one. The +12.5pp oracle headroom is **not
reachable from layer-14 features** — the margin was already the better gate,
and it can't reach it either.

**But the margin gate is a working efficiency cascade on competent medical
VQA** — this is the finding to carry forward. On the four closed-form
benchmarks, the simple margin gate gets 32B-level accuracy (sometimes
*better*) while sending 30–60% of questions to the cheap 7B:

| Dataset | margin cascade | escalates | always-32B | 7B-pred AUROC | read |
| ------- | :---: | :---: | :---: | :---: | ---- |
| VQA-RAD | <span class="cell-good">0.781</span> | **28%** | 0.776 | 0.76 | beats 32B at <⅓ the cost |
| PathVQA | <span class="cell-good">0.680</span> | 60% | 0.673 | 0.63 | beats 32B at 60% cost |
| SLAKE | 0.762 | 63% | 0.764 | 0.74 | matches 32B at 63% cost |
| PMC-VQA | 0.554 | 56% | 0.556 | 0.71 | matches 32B at ~half cost |
| MedXpert ×2 | — | 96–97% | — | ~0.50 | fails (near-chance, nothing predictable) |

The two MedXpert sets fail cleanly and *for a stated reason* — near-chance
accuracy means the 7B's confidence is uninformative (AUROC ~0.5), so there's
nothing to gate on. That's a boundary, not an embarrassment.

---

## The honest conclusion

Both halves, stated without spin:

1. **The hidden-state gate hypothesis is falsified** — layer-14 features are
   a *worse* escalation signal than the raw confidence margin (lower AUROC
   on every dataset). A clean, pre-registered negative.
2. **The simple confidence-margin cascade is a real efficiency method on
   competent medical VQA** — it matches or beats a 32B medical VLM at 30–60%
   of its inference cost across four datasets. Framed honestly as
   **efficiency, not accuracy**: "match 32B quality at ~60% cost via
   confidence-gated cross-model cascading."
3. **Cross-model complementarity is real but its accuracy headroom is
   unreachable from cheap signals.** The `only-7B` pool exists (+12.5pp
   oracle), but neither the margin nor layer-14 hidden states can find it on
   the hard benchmarks — that is the precise, well-defined open problem.

This is the most coherent the project has been: a **working method** (the
margin cascade on competent VQA) plus a **clean set of negatives** that
draw its boundaries (no accuracy gain on near-chance MedXpert; hidden states
don't beat the margin). The first direction in the entire pivot whose core
ingredient — complementarity — actually exists.

!!! note "On the project's direction"
    The site name still says *question-aware visual token pruning*. The
    working direction is now a **7B→32B cross-model efficiency cascade** on
    MedVLThinker. Unlike every prior pivot, this one has a *positive*
    result to point at (the competent-regime efficiency cascade), so the
    rebrand is closer — but it stays deferred until the framing (efficiency
    vs. a further reach for the accuracy headroom) is committed and the
    accuracy-vs-cost curves are built.

---

## Honest ledger of the day

1. **The June-6 oracle was a max-of-K mirage** — luck-floor control: real
   oracle ≪ independent-errors floor on every dataset (pooled 0.550 vs
   0.753, **−29.3σ**); the four single-model arms make positively
   correlated errors.
2. **Forensic audit → single-model routing definitively closed** — two root
   causes (efficiency knobs misused as accuracy knobs; one model's arms
   share blind spots). PMC-VQA recoverability control (competent regime)
   confirmed it: oracle 0.690 ≪ luck floor 0.931 (**z = −25.1**), trained
   router **0.498 < best-fixed 0.516**. The fourth dead direction of the
   pivot.
3. **Pivot to a 7B→32B cross-model cascade** — complementarity needs
   different *models*. Downloaded the 32B (63 GB, 14 shards, both A100s),
   built a vLLM 25.09 / code-server container, wrote `run_32b_vllm.py` with
   three label-saving fixes, generated paired 32B/cheap-7B labels + layer-14
   features across all six datasets.
4. **Cross-model complementarity is real** — `only-7B` cells **20.8–26.8%**,
   oracle **+12.5pp** over always-32B; the cheap 7B rescues 104–134
   questions/dataset the 32B misses.
5. **Naive margin gate can't reach the headroom on hard sets** — escalates
   **96%**, reproduces 32B; the predictability wall a third time. PMC-VQA is
   the efficiency seed (0.528 @ 58% esc).
6. **Hidden-state probe falsified** — layer-14 AUROC *worse* than the margin
   everywhere; the +12.5pp headroom isn't reachable from 7B internals.
7. **The defensible result: a working efficiency cascade on four competent
   benchmarks** — 32B-level accuracy at 30–60% cost (VQA-RAD 0.781 @ 28%;
   PathVQA 0.680 @ 60%; SLAKE 0.762 @ 63%; PMC-VQA 0.554 @ 56%); MedXpert
   fails cleanly.

---

### Plan for next session

- [ ] **Commit the day's scripts** to `medvlthinker-imgdiff-compute` once the
      framing is set — `pmcvqa_recoverability.py`, `oracle_luckfloor.py`,
      `run_32b_vllm.py`, `cascade_complementarity.py`, `router_escalate.py`,
      and the vLLM 25.09 Dockerfile.
- [ ] **Decide the framing:** Path B (efficiency cascade — the defensible
      result *now*) vs. Path A (hunt a stronger escalation signal — the 7B's
      full logprob distribution, or a different layer — to reach the +12.5pp
      headroom; a real experiment that could fail).
- [ ] If Path B: build **accuracy-vs-cost curves** across VQA-RAD / SLAKE /
      PathVQA / PMC-VQA, with a real cost axis (escalation % → FLOPs or
      wall-clock), and position against efficiency-cascade literature.
- [ ] **June 8:** present **m1** (arXiv 2504.00869) — deck ready.

---

## Pushed today

**No code push.** All of the day's scripts —
`pmcvqa_recoverability.py`, `oracle_luckfloor.py`, `run_32b_vllm.py`,
`cascade_complementarity.py`, `router_escalate.py`, and the **vLLM 25.09
Dockerfile** — live in the `medvlthinker-imgdiff-compute` repo, alongside the
overnight paired labels (`feats_full/`) and the merged n=500 records. The
commit and push come once the efficiency-vs-accuracy-headroom framing is
committed and the accuracy-vs-cost curves are built — the push held until
then, on the week's standing rule.
