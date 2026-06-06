# Day 5 — Saturday, June 6, 2026

[← Back to Week 4 overview](index.md)

**Direction revived** (compute-router: think×rag heterogeneity) ·
Week 4, Day 5 · **Day 28 of the project**

---

The day the direction came off life support — not because the numbers got
better, but because the *right lens* finally got applied to them. The 7B
confound-check from [Thursday](day-04.md) finished overnight, and read as
fixed-policy aggregates it looked like a second NO-GO: RAG hurts 5pp,
thinking helps on only two of four subsets. But the aggregate is the wrong
lens for a *router* — and the per-question confusion told a different
story: ~25% of questions flip between policies, with a per-question oracle
ceiling ~9–10pp above any single fixed policy. The heterogeneity a router
needs to exist *does* exist. That reframed the project from "is one policy
best" (no) to "are different questions best served by different policies"
(yes), and the rest of the day was spent making that measurable: a
published-baseline sanity check (the 7B's 0.30 on MedXpert is *on spec*,
not a bug), a full probe rebuild to capture everything a router experiment
needs (raw output, parse flag, option logprobs, token counts, latency), a
unified `gate_router.py`, a real second retrieval corpus (StatPearls), and
a large sharded baseline (**n=500 × 6 cells × 2 corpora**) launched across
both VMs and running into the night.

No code was pushed today — the rebuilt scripts and the n=500 run are
mid-flight; the push waits for the full SUMMARY blocks and the merge +
analysis, as it has all week.

!!! note "Day count and the off-day"
    June 5 (Day 27) was off, so this session picked up from the
    [June 4](day-04.md) 7B launch. Global day numbers track the calendar
    (Day 1 = May 10), so an off-day still consumes a number — same
    convention as [Days 20–21](day-01.md) and [Day 25](day-04.md). Hence
    June 6 is **Day 28**, the **5th working session** of Week 4 and its
    last calendar day.

---

## Phase 1 — The 7B verdict: aggregate says NO-GO, the router lens says GO

The [pre-registered 7B confound-check](day-04.md#phase-8-the-fork-and-the-pre-registered-7b-confound-check)
came back. Read as fixed-policy aggregates — the lens Thursday's +0.03
gate used — both axes look dead:

| Axis · dataset | arm A | arm B | Δ (A−B) |
| -------------- | :---: | :---: | :---: |
| Reasoning · MedXpert-ALL | think 0.300 | nothink 0.220 | <span class="cell-good">+0.080</span> |
| Reasoning · MedXpert-Reasoning | think 0.250 | nothink 0.270 | <span class="cell-bad">−0.020</span> |
| Reasoning · MedXpert-Understanding | think 0.280 | nothink 0.240 | <span class="cell-warn">+0.040</span> |
| Reasoning · PMC-VQA | think 0.550 | nothink 0.550 | 0.000 |
| Retrieval · MedXpert-ALL (both think) | norag 0.300 | rag 0.250 | <span class="cell-bad">−0.050</span> |

Stop at the aggregate and it's a NO-GO — RAG hurts, "think" only clearly
helps on two of four, and on the reasoning subset *nothink* edges it. But
the pre-registered gate was built for a single-best-policy question, and
that is **not** what a router needs. A router doesn't need one policy to
win on average; it needs **different questions to want different
policies**. So the analysis switched to the per-question confusion on
MedXpert-ALL (the one cell with both halves present):

- **Reasoning (think vs nothink):** both right 13, think-only 17,
  nothink-only 9, both wrong 61 → **26% of questions flip**; oracle ceiling
  **0.39** vs best fixed **0.30**.
- **Retrieval (norag vs rag):** both right 15, norag-only 15, rag-only 10,
  both wrong 60 → **25% flip**; oracle ceiling **0.40** vs best fixed
  **0.30**.

That's the real signal. Each knob is net-flat-to-negative *on average* but
rescues ~10–17 questions the other policy gets wrong. A perfect
per-question router over either axis alone adds **~9–10pp**. The
heterogeneity the whole idea depends on is present — which is exactly the
property the dead directions lacked, and it's why this survives where the
+0.03 fixed-policy gate would have killed it.

This is also the honest reframe of the project's spine: it is the
**evidence-&-compute router** — route each question to a
{think/nothink}×{rag/norag} policy on a cheap pre-signal. Today's gate
clears the **first** hurdle (routable heterogeneity exists). It does
**not** yet clear the real one: *is the flip predictable?* The oracle is
only a ceiling; a router needs a signal to approach it. That's the next
experiment, not this one.

**Three caveats logged, not buried:**

1. **n=100.** A 5pp delta is ≈ ±8.5pp at 95% CI, so the think/nothink and
   RAG deltas are mostly *inside* noise. The +9/+10pp oracle gaps are the
   robust part but still want larger n.
2. **Parse confound.** The think/rag arms have truncated `<think>…` outputs
   that never reach a clean letter and default to `pred=A` (RAG entries
   18/20/95/100 all parse `<think>…` → A). That mechanically depresses
   those arms and may *inflate* the apparent flip — some "disagreement" is
   format failure, not reasoning. Must separate the two before trusting the
   oracle.
3. **Missing cell.** Retrieval was only probed with think on; the full 2×2
   (rag+nothink) was unrun, so there's no 2-D oracle yet.

---

## Phase 2 — "Why is a 7B only at 0.30?" — the published-baseline sanity check

A fair alarm: the 7B has double the parameters and still sits at ~0.30 —
is something broken? A search for the published numbers settled it. **Not
a bug — the model is performing on spec, arguably a hair above it.**

| Model | MedXpert-MM acc | Source |
| ----- | :---: | ------ |
| **MedVLThinker-7B** (our base) | **24.43%** | paper text |
| HuatuoGPT-Vision-7B | 22.00% | same |
| Qwen2.5-VL-72B | ~22–23% | MedXpertQA Table 4 |

Our gate's 0.30 / 0.25 / 0.28 on MedXpert-ALL / Reasoning / Understanding
all straddle or sit slightly above the published 24.43 at n=100 — if
anything the harness is mildly generous. The intuition that "7B should
crush this" is the thing that's wrong: MedVLThinker's headline **54.9%** is
an *average* across six benchmarks (VQA-RAD, SLAKE, PathVQA, PMC-VQA,
OmniMed, MMMU), mostly easy caption-style sets. **MedXpertQA-MM is the one
deliberately-brutal benchmark** in the suite and it drags the average down
hard — its authors built it so that low accuracies expose how much SOTA
models struggle (pre-licensed human experts ~42.6%, o1 ~44.7%, even 72B
open models in the low 20s on the multimodal split).

The internal consistency check confirms the harness is sane: the **same
run** gave PMC-VQA **0.55** and MedXpert **0.30** — exactly the published
shape (easy benchmark ≈ 2× the hard one). A silently-broken harness
wouldn't land PMC-VQA at a healthy 0.55.

**The honest tension this surfaces:** the routable heterogeneity rides on
top of a benchmark where **61/100 are wrong under both policies**, which
caps the oracle ceiling at ~0.39 and leaves the router only a ~25-question
band to work in. Not fatal, but it argues for proving the router idea on
datasets with more reachable questions (PMC/SLAKE) rather than on the
hardest one. We did *not* burn compute reproducing the full 2000-sample
MedXpert number — the published 24.43 is the anchor and n=100 already
matches it.

---

## Phase 3 — Fix the probes first: capture everything a router needs

The decisive realization: the existing checkpoints store only
`idx/gold/pred/ok` — no raw text, no logprobs — so the "clear difference"
in the first 100 *could be reasoning or could be format failure, and we
can't tell which.* Until raw output is logged, every delta and every flip
is suspect. So the probe rebuild isn't polish; it's the **precondition for
trusting any number**. Fields added per sample:

- `raw_output` — full decoded string (audit parse failures, recompute
  `pred` under a fixed extractor)
- `parse_ok` — clean letter vs. fell back to default
- `opt_logprobs{A..J}` — logprob over the option letters at the answer
  position; cheap, and it's the **confidence signal the router pilot
  needs** (without it there's no router *experiment*, only an oracle
  ceiling)
- `gen_tokens` — output length, the **cost** side of the tradeoff (`think`
  only "wins" if its accuracy gain beats its token cost)
- `latency_s` — wall time per sample

On the question of a full both-axis baseline on all six datasets at full
n: **not yet, and not necessary for the go/no-go.** Committing ~2 days of
compute to a phenomenon that might partly evaporate once parse is clean is
backwards — confirm on one clean run first. And "absolutely sure" is a
statistics problem, not a full-n problem: at n=100 the CI is ±8.5pp; n≈400–500
per dataset drops it to ~±5pp and makes the +9–10pp oracle gap unambiguous.
No need for 2000.

---

## Phase 4 — `gate_router.py`: one unified runner, three design decisions

The two separate probes (`gate_probe.py`, `gate_rag.py`) were merged into a
single **`gate_router.py`** that runs each *(reasoning × retrieval)* policy
cell on a fixed seed-42 slice per dataset and logs the rich per-sample
records above. Three decisions shaped it:

- **Visual arm dropped.** The visual axis already cleared on the 3B and
  again here; re-running it isn't needed for the router go/no-go, so the
  runner focuses on the two contested axes (think/nothink × rag/norag).
- **Cell de-duplication.** The `(think,norag)` cell is shared by *both* the
  reasoning and retrieval axes, so it's generated **once** and reused — the
  default run is the three cells `(nothink,norag) (think,norag)
  (think,rag)`, with a `--full_grid` flag that adds `(nothink,rag)` for the
  complete 2×2 oracle and a `--cells` selector to run a single cell (used
  for the smoke test).
- **Multi-VM sharding built in.** `--shard k/N` row-stride splits the fixed
  slice across machines, each shard writing its own checkpoint file
  (`_s{k}of{N}`); shards merge by simple per-cell concatenation offline.

??? note "`gate_router.py` — cell construction & the shared-cell de-dup"

    The master grid is the full 2×2; the default run drops `(nothink,rag)`,
    and the shared `(think,norag)` cell is computed once and serves both
    axes. `--cells` runs an explicit subset (the smoke path).

    ```python
    MASTER = [("nothink","norag"), ("think","norag"), ("think","rag"), ("nothink","rag")]
    if A.cells:                                  # explicit subset, e.g. --cells think_rag
        want = set(A.cells)
        CELLS = [(r,g) for (r,g) in MASTER if f"{r}_{g}" in want]
        assert CELLS, f"no valid cells in {A.cells}"
    else:                                        # default: three cells (shared think_norag)
        CELLS = [("nothink","norag"), ("think","norag"), ("think","rag")]
        if A.full_grid: CELLS.append(("nothink","rag"))   # full 2x2 oracle

    SYS_THINK   = ("You will solve a problem/request. You should provide your thoughts "
                   "within <think> </think> tags before providing the answer.")
    SYS_NOTHINK = "Answer with only the correct option letter (e.g. 'A'). Do not explain."
    # per-sample record: idx, gold, pred, ok, parse_ok, opt_logprobs{A..J},
    #                    gen_tokens, latency_s, raw_output
    ```

On **7B vs 3B for the confirmation run — stay on 7B.** The 3B is ~2× faster
on the think arm, but speed is the wrong thing to optimize here: the thing
that kills a router is the **both-wrong fraction**, and the weaker 3B has
*more* unanswerable-by-any-policy questions → lower oracle ceiling, thinner
routable band. Running the proof-of-existence gate on the weaker model
makes the router's job harder to demonstrate, not cheaper — and 7B is the
published SOTA anchor and the model a paper would build on. The compute is
saved elsewhere (n=500 not 2000, 3-cell collapse, two datasets first).

On the longer-term **"one router across 3B/7B/32B"** question: yes, but not
as a single *frozen* router. The routing frontier moves with scale — as the
model grows, the both-wrong set shrinks and questions that needed `think`
at 3B become trivially right at 32B with no think. So the optimal
per-question policy is size-dependent; a literally-identical router would
be suboptimal at the extremes. (Logged as a design note for later, not
today's work.)

---

## Phase 5 — A second retrieval corpus, and the RAG-literature verdict

The retrieval axis needed a **corpus comparison** — does the RAG sign hold
across knowledge bases, or is it an artifact of one corpus? Thursday's run
used MedRAG **Textbooks**; today added **StatPearls** as a second corpus
(auto-fetched, ~2 GB, MedCPT index hand-built this session — the StatPearls
build plus a `db_dir` path-contract fix). PubMed was considered and
**parked**: the RAG-literature read is that retriever/corpus choice is only
a ~1–2pt lever at 7B — the real bottleneck is *evidence use*, not evidence
availability — and PubMed's heavier download isn't worth it against that
ceiling. That same verdict is the motivation for the **router**: if better
retrieval is a small fixed lever, the leverage is in deciding *per question
whether to retrieve at all*.

The plan: StatPearls all three cells, then Textbooks `--cells think_rag`
only (the norag/think cells are corpus-independent and resume from cache),
so both corpora produce a directly comparable `think_rag` arm on the same
seed-42 slice.

---

## Phase 6 — The silent-empty-context bug (caught before it cost the night)

The Textbooks `think_rag` smoke run had quietly returned `0.080` — and the
cause was a **silently empty retrieval**, the most dangerous kind of bug
because it produces plausible numbers from nothing. Diagnosis:

- `retrieved_MedXpert-Reasoning_Textbooks_n500.jsonl` was **0 lines**.
- The Textbooks **MedCPT index did not exist** in this `db_dir` —
  `textbooks/chunk/` was fully populated (all the textbook JSONLs) but
  `textbooks/index/MedCPT-Article-Encoder/` was missing.
- So every `rs.retrieve()` threw, and `retrieve.py`'s `try/except` swallowed
  it with a plain `print` to **stdout** (not stderr) — which is why the
  `2>&1 | grep err` check found nothing and the run looked merely "slow"
  rather than failed.

The consequence worth stating plainly: the earlier n=25 Textbooks smoke
that "worked" had written 25 *empty-context* rows, so its
`think_rag_Textbooks = 0.080` was meaningless and was **discarded
entirely**. (The "it worked at n25/n400 before" intuition was an honest
mis-attribution — the n500 files were simply overwritten over an
un-built index.)

The fix is the same embedding pass used for StatPearls, but faster
(chunks already present, no download): trigger the MedCPT index build over
the existing `textbooks/chunk/` JSONLs (~2–4 min on the A100 over 125.8k
snippets), then re-run retrieval and **verify non-zero line counts and a
non-empty `snippets` list** before launching. Safeguard noted for later:
`retrieve.py` should fail loudly (abort if the first few retrievals come
back empty) rather than write empty files — cheap insurance against another
silent-empty night.

---

## Phase 7 — The n=500 sharded baseline: launched and running

With the probe rebuilt, corpora real, and the smoke test clean, the full
run launched. Scope: **n=500** per dataset, three datasets
(MedXpert-Reasoning, MedXpert-Understanding, PMC-VQA), three default cells +
the Textbooks `think_rag` add-on, sharded across both VMs by row-stride
(250 samples/shard). Retrieval was rebuilt at n=500 first (the gate's
`load_retr` keys on `_n500`, so the n400 files would have silently
`[skip]`-ped — the same failure class as Phase 6, pre-empted).

```bash
# retrieval at n=500, split by corpus across the two VMs (shared FS, distinct files):
# VM-A:  python scripts/retrieve.py --n 500 --corpus StatPearls --datasets MedXpert-Reasoning MedXpert-Understanding PMC-VQA
# VM-B:  python scripts/retrieve.py --n 500 --corpus Textbooks  --datasets MedXpert-Reasoning MedXpert-Understanding PMC-VQA
# barrier: confirm 6 files (3 datasets × 2 corpora):
ls -la /data/dan/retrieval_kb/retrieved_*_n500.jsonl

# chained sharded gate, both VMs in parallel — StatPearls (3 cells) then Textbooks (think_rag only):
# VM-A (shard 0/2):
python scripts/gate_router.py --n 500 --shard 0/2 --rag_corpus StatPearls \
      --datasets MedXpert-Reasoning MedXpert-Understanding PMC-VQA && \
python scripts/gate_router.py --n 500 --shard 0/2 --rag_corpus Textbooks --cells think_rag \
      --datasets MedXpert-Reasoning MedXpert-Understanding PMC-VQA
# VM-B (shard 1/2): identical with --shard 1/2
```

A note on how it's running: the launch was switched from `nohup` to a plain
**foreground** run so the per-sample lines stream live in the terminal —
with the explicit tradeoff that the SSH session must stay alive for the
full **~10–11 hr/VM** or the run dies and resumes only on manual relaunch
(the checkpoint-resume preserves completed samples). The `&& \` chains
StatPearls → Textbooks so the second pass fires only if the first exits
clean. Post-launch sanity checks: shards on different `idx` (row-stride
working), and the `think_rag_StatPearls` cell emitting real `g=/p=` lines
rather than `[skip]` (the empty-context guard from Phase 6).

**End-of-day state:** the full runs are up, no errors so far, progressing
through the **MedXpert-Reasoning `[nothink_norag]`** cell. When both VMs
finish, the next session merges the `s0of2`/`s1of2` checkpoints per cell and
runs the **confusion / oracle / confidence-pilot** analysis on the merged
n=500 records — the step that finally measures whether the routable gap is
not just *real* but *predictable*.

---

## Honest ledger of the day

1. **7B verdict, reframed.** Fixed-policy aggregates read as NO-GO (RAG
   −5pp, think helps 2/4), but the per-question confusion shows **~25%
   policy-flip and a +9–10pp oracle ceiling** on each axis. The
   heterogeneity a router needs exists — the project survives as the
   **evidence-&-compute router**, with the real test (is the flip
   *predictable*?) still ahead.
2. **0.30 is on-spec, not a bug.** Published MedVLThinker-7B MedXpert-MM =
   24.43; our n=100 matches/slightly exceeds it. PMC-VQA 0.55 in the same
   run confirms the harness is sane (easy ≈ 2× hard). MedXpert is just a
   wall — which thins the routable band and argues for PMC/SLAKE as the
   proving ground.
3. **Probes rebuilt — the precondition for trust.** Old checkpoints stored
   only `idx/gold/pred/ok`; added `raw_output`, `parse_ok`,
   `opt_logprobs`, `gen_tokens`, `latency_s`. Identified the **parse
   confound** (truncated `<think>…` → default `pred=A`) that can fake both
   accuracy loss and flips.
4. **`gate_router.py` unified** — visual arm dropped, shared
   `(think,norag)` cell de-duplicated, `--cells`/`--full_grid` selectors,
   built-in `--shard k/N`. Decision: run the confirmation on **7B** (weaker
   3B would shrink the oracle band) and a design note that one router can't
   be *frozen* across 3B/7B/32B (the frontier moves with scale).
5. **Second corpus + RAG-lit verdict.** Added StatPearls alongside
   Textbooks for a corpus comparison; PubMed parked. Retriever/corpus is a
   ~1–2pt lever at 7B — the bottleneck is evidence *use*, which is the
   motivation for the router.
6. **Silent-empty-context bug caught.** Textbooks MedCPT index was never
   built in this `db_dir`; `retrieve.py` swallowed the error and wrote
   0-line / empty-snippet files. The earlier `think_rag_Textbooks = 0.080`
   smoke ran on empty context and was **discarded**. Fixed by building the
   index over existing chunks (~2–4 min) and verifying non-zero retrieval.
7. **n=500 sharded baseline launched** — 3 datasets × (3 cells + Textbooks
   `think_rag`), row-stride across both VMs, ~10–11 hr/VM, foreground/live.
   Running clean through `MedXpert-Reasoning [nothink_norag]` at end of day.

This is the first time in the pivot that a result *survived* contact with
the gate — by changing the lens (router heterogeneity, not fixed-policy
average) rather than by lowering the bar. The next session's merge +
predictability analysis is the one that decides whether the router is
buildable or whether the oracle ceiling stays a ceiling.

!!! note "On the project's direction"
    The site name still says *question-aware visual token pruning*. The
    working direction is now the **evidence-&-compute router** — per-question
    {think/nothink}×{rag/norag} allocation on MedVLThinker-7B. Today it
    cleared its *first* gate (routable heterogeneity exists); it has **not**
    cleared the decisive one (is the flip predictable from a cheap signal),
    so the rebrand stays deferred, on the same discipline that's governed
    every pivot here.

---

### Plan for next session

- [ ] **Collect both `===== SUMMARY =====` blocks** from `gate_s0`/`gate_s1`
      once the n=500 run finishes (~10–11 hr/VM).
- [ ] **Merge the shard checkpoints** (`_s0of2` + `_s1of2`, per cell,
      simple concatenation) into the n=500 record set.
- [ ] **Run the confusion / oracle / confidence-pilot analysis** on the
      merged records — recompute Δ and oracle **after the parse fix**, and
      test whether `opt_logprobs`-based confidence *predicts* the
      think-vs-nothink and rag-vs-norag flip (the decisive question: oracle
      ceiling is necessary, predictability is sufficient).
- [ ] **Corpus comparison:** StatPearls vs Textbooks `think_rag` on the
      identical slice — does the RAG sign hold across corpora?
- [ ] If predictable signal exists → spec the router + design the full 2×2
      (`--full_grid`) oracle on PMC/SLAKE (more reachable questions).
- [ ] **June 8:** present **m1** (deck ready).
- [ ] Commit the `medvlthinker-imgdiff-compute` scripts (`gate_router.py`,
      `retrieve.py`, the index-build helper) once the analysis lands.

---

## Pushed today

**No code push.** The rebuilt `gate_router.py` / `retrieve.py` and the
Textbooks index-build helper live in the `medvlthinker-imgdiff-compute`
repo, and the **n=500 sharded baseline is still running across both VMs**
(`logs/gate_s0.log` / `gate_s1.log`, checkpoints under
`ckpts/gate_7b_v2/`). The commit and push come once both shards finish, the
shard-merge + confusion/oracle/confidence analysis is written, and the
routable gap is measured for *predictability* — the push held until then,
on the week's standing rule.
