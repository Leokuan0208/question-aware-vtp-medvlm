# Day 4 — Thursday, June 4, 2026

[← Back to Week 4 overview](index.md)

**Direction pivot** (joint perception + knowledge allocation) ·
Week 4, Day 4 · **Day 26 of the project**

---

The all-red day, and an honest one. It opened by reading the verdict on
[Tuesday's](day-03.md) overnight gate — the lesion-aware refinement of
the image-difficulty wedge — and it came back a clean **NO-GO**, killing
the direction that was alive 48 hours ago. Out of that the day rebuilt:
named the *pattern* behind every death so far, reframed into a genuinely
new direction (**joint perception + knowledge allocation**), and then
held that new direction to the same one-day falsification discipline that
just killed its predecessor. Two of its three candidate axes were gated
on a new model and **both came back flat** — reasoning a NO-GO, retrieval
flat at +0.01 — leaving the new direction underwater on its own bar. It
ends not on a conclusion but on a single pre-registered tiebreaker
(**a 7B confound-check, launched and running**) and a side-decision: the
June-8 literature presentation, settled on **MedVLThinker**, the paper
behind the project's own base models.

No code was pushed today — the gate scripts live in the
`medvlthinker-imgdiff-compute` repo and the 7B verdict is still mid-run;
the push waits for the verdict, as it has all week.

!!! note "Why 'yesterday' was June 2, and the day count"
    June 3 (Day 25) was off, so this session picked up directly from the
    [June 2](day-03.md) gate. Global day numbers track the calendar
    (Day 1 = May 10), so an off-day still consumes a number — the same
    convention as [Days 20–21](day-01.md) (May 29–30). Hence June 4 is
    **Day 26**, the **4th working session** of Week 4.

---

## Phase 1 — The lesion-aware verdict: NO-GO

The [June-2 gate](day-03.md#phase-9-the-definitive-3b-gate-a-limit-trap-then-sharded-inference-across-two-vms)
left two difficulty shards running on MedVLThinker-3B across both VMs; the
merge + lesion-aware refinement (`complexity_lesion.py` on SLAKE organ
masks → `analyze.py`) was the real decision point. It returned a clean,
**pre-registered NO-GO**:

```text
lesion_area      partial rho = +0.043                  -> below 0.1 floor
lesion_contrast  partial rho = +0.012   p = 0.56        -> below 0.1 floor, n.s.
                 (both wrong-signed; consistent across all 15 strata)

==> VERDICT: NO-GO
```

This is the [REFINE path](day-03.md#phase-6-the-result-refine-and-the-sign-is-the-story)
run to its honest end. The June-2 whole-image proxies were weak
(|ρ| ≤ 0.11) but real and significant; the working hypothesis was that
they measured *evidence-richness*, not *lesion subtlety*, and that
swapping to lesion-region features (size/contrast from SLAKE masks) would
recover a stronger, correctly-signed correlation. It didn't — lesion
features were even weaker than the crude proxies, wrong-signed, and not
significant. The gate did exactly its job: it killed a bad idea in a day
instead of a month.

**What the NO-GO kills, stated precisely** — and this scoping is what made
the rest of the day possible. It kills *one specific thing*: that a
**static, pre-generation image statistic predicts per-case difficulty**.
It does **not** kill adaptive compute in general, the
reliability/selective-prediction angle, or anything that uses a signal the
model actually produces *while looking at the image*.

---

## Phase 2 — The pattern behind every death, and the design rule it forces

Before picking the next thing, the morning named the failure pattern that
keeps recurring — because not naming it is how you walk into it again:

> Every method that has died here bet the entire contribution on a
> **useful natural correlation existing in the data**. QSim cosine scores,
> the GridPrune / FASP family, image-complexity → difficulty — each one
> needed nature to cooperate, and when it didn't, the method had nothing
> left.

The directions still standing don't have that fragility. So the rule for
the next pick, written down before searching: **choose a method whose
value is constructive or learned, not contingent on a correlation that may
or may not exist.** Under that lens the live menu was:

- **Direction A — evidence-graded conformal / selective prediction.** Value
  is *guaranteed by construction* (coverage holds regardless of any
  correlation). Lowest re-NO-GO risk; open question is whether the
  "evidence-graded" twist is novel enough.
- **Direction D's untested axis — an evidence-stability router.** Higher
  novelty, reuses the MedVLThinker infra already stood up, but still
  somewhat contingent on stability being predictive.

The reframe below grew out of A's "value by construction" property applied
to a two-axis allocation problem.

---

## Phase 3 — The reframe: joint perception + knowledge allocation

The new direction, and the one the rest of the day tested:

> **Per-question allocation of a *perception budget* (visual tokens) and a
> *knowledge budget* (retrieval).** Some medical questions are
> perception-bound (read the image carefully); some are knowledge-bound
> (fetch the fact). A controller decides, per question, where to spend.

**The novelty is the joint.** The visual-token-compression literature and
the medical-RAG literature are entirely separate communities — nobody
allocates "how much to see" and "how much to retrieve" together under one
compute objective. The two axes are orthogonal and interpretable.

**Why this is robust where pruning, image-difficulty, and reasoning all
broke.** Every one of those died because a *cheap signal had to predict
where to spend*, and the signal carried no information. This joint doesn't
have that fragility: both axes have net-positive or neutral *always-on*
settings (always-retrieve helps factuality; full-visual is the accuracy
ceiling). So the controller's job is to **bank efficiency on easy cases**,
not to make accuracy-critical guesses. A *wrong prune hurt accuracy*; a
*wrong "skip retrieval" just costs a little efficiency.* The thing that
keeps killing this project doesn't apply by construction.

**Honest risks, named up front:**

- *Build cost is the real one.* RAG needs a retriever plus a medical
  knowledge base — the heaviest infrastructure taken on yet. Mitigation:
  MMed-RAG and RULE are open, so integrate rather than invent; Retina-RAG
  shows the lightweight (LoRA + classifier-guided) path works on a stack
  close to ours.
- *Benchmark-fit, again.* RAG is proven on report-generation/factuality
  sets; it must be confirmed to lift MedXpertQA-MM / PMC-VQA. That's the
  gate — same discipline as the image-difficulty test.
- *Adaptive-retrieval-alone is crowded* (Adaptive-RAG, ICA-RAG/FIND). So
  the contribution leads with the **joint allocation**, not the retrieval
  trigger.

**Papers requested** (and read this afternoon): **TARG** (arXiv 2511.09803)
— a training-free, single-shot retrieve/skip decision from prefix logits,
which fits the stack better than anything needing a trained control head;
optionally **Self-Routing RAG** (2504.01018) and **Patho-AgenticRAG**
(2508.02258, joint text–image retrieval of textbook pages). MMed-RAG and
RULE were already in hand from an earlier zip and re-read for retriever/KB
mechanics.

---

## Phase 4 — The two-axis gate on MedVLThinker-3B

The plan: gate the two *contingent* axes (reasoning and visual) on the new
model before building anything. The instrument was a single script,
`gate_probe.py`, with a `--axis` switch — reasoning runs **think vs
no-think**; visual runs **full-resolution vs low-resolution** (a pixel-budget
proxy for visual-token count). The decision rule was **fixed before any
number existed** — the only thing keeping a marginal result from becoming
motivated reasoning:

- **Reasoning axis live** if `think − nothink ≥ +0.03` on MedXpert (ideally
  concentrated on the *Reasoning* slice while Understanding / PMC-VQA stay
  ~flat — that's the signature of a real effect).
- **Visual axis live** if `vis_full − vis_low ≥ +0.03` on either subset.
- **GO** for the joint controller only if **both** clear. Reasoning flat
  everywhere → the joint collapses to visual-only (the known pruning
  dead-end) and we stop and rethink rather than build.

A few infrastructure fixes cleared the runway first:

- **Trace-fix (system-prompt gating).** No-think mode is forced by
  appending an empty thinking block after the template, so the model emits
  a clean answer letter without a reasoning trace — and the audit lines
  confirmed the parser still reads gold/pred correctly through it.
- **OOM / checkpoint hardening.** `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True`
  on the 7B-sized vision encoder; per-sample checkpoint/resume keyed on
  axis/subset/mode so a crash costs one sample, not a subset, and `--n 300`
  reuses the first 100 for free if a delta lands marginal.
- **Weights consolidated** under `/data/dan/weights` (load-by-explicit-path,
  the lesson from earlier in the week).

??? note "`gate_probe.py` — the two-axis gate (think/no-think · full/low-res)"

    The no-think arm forces an empty `<think>` block; the visual arm caps
    `max_pixels` to shrink the visual-token budget. Same parser, same
    seed-42 slice, both arms share the *think* baseline so deltas are
    clean single-variable contrasts.

    ```python
    SYS = ("You will solve a problem/request. You should provide your thoughts "
           "within <think> </think> tags before providing the answer.")
    LOW_PX, MIN_PX = 256*28*28, 4*28*28          # visual-budget proxy

    def msgs(ex, mp):
        opts = ex.get("options") or {}
        assert isinstance(opts, dict) and opts, "non-MCQ sample; gate is MCQ-only"
        q = ex["question"] + "\n" + "\n".join(f"{k}) {v}" for k, v in opts.items())
        img = [{"type": "image", "image": im,
                **({"max_pixels": mp, "min_pixels": MIN_PX} if mp else {})}
               for im in (ex.get("images") or [])]
        return [{"role": "system", "content": SYS},
                {"role": "user", "content": img + [{"type": "text", "text": q}]}]

    def run(name, idxs, mode, mp=None):
        rng = random.Random(42); sel = idxs[:]; rng.shuffle(sel); sel = sel[:A.n]
        ok = 0
        for j, i in enumerate(sel):
            ex = data[i]; m = msgs(ex, mp)
            text = proc.apply_chat_template(m, tokenize=False, add_generation_prompt=True)
            if mode == "nothink":                      # trace-fix: gate the trace off
                text += "<think>\n\n</think>\n\n"
            imgs, _ = process_vision_info(m)
            inp = proc(text=[text], images=imgs, return_tensors="pt").to(model.device)
            with torch.no_grad():
                o = model.generate(**inp, do_sample=False,
                                   max_new_tokens=(512 if mode == "think" else 32))
            gen = proc.batch_decode(o[:, inp.input_ids.shape[1]:],
                                    skip_special_tokens=True)[0]
            ok += (gold(ex) == pred(gen))
        return ok / len(sel)

    for name, idxs in SUBSETS.items():
        if A.axis == "reasoning":
            t, nt = run(name, idxs, "think"), run(name, idxs, "nothink")
            print(f"### {name}: think={t:.3f} nothink={nt:.3f} DELTA={t-nt:+.3f}")
        else:
            f, l = run(name, idxs, "think"), run(name, idxs, "think", mp=LOW_PX)
            print(f"### {name}: vis_full={f:.3f} vis_low={l:.3f} DELTA={f-l:+.3f}")
    ```

An n=5 smoke run came first — pure plumbing (each "0.200" is one question
flipping; no signal at that size), and it passed: the no-think arm emits a
clean letter after the forced empty block. Then both axes ran at **n=100**,
one per GPU/VM (~1 hr each).

---

## Phase 5 — Reasoning: NO-GO. Visual: live.

The six summary lines, read against the rule fixed *before* the run:

| Axis | Subset | Arm A | Arm B | Δ | Read |
| ---- | ------ | :---: | :---: | :---: | ---- |
| Reasoning | MedXpert-ALL | think 0.270 | nothink 0.280 | <span class="cell-bad">−0.010</span> | thinking hurts |
| Reasoning | MedXpert-Reasoning | think 0.220 | nothink 0.190 | <span class="cell-warn">+0.030</span> | on the line, 1 slice |
| Reasoning | MedXpert-Understanding | think 0.250 | nothink 0.260 | <span class="cell-bad">−0.010</span> | thinking hurts |
| Reasoning | PMC-VQA | think 0.480 | nothink 0.490 | <span class="cell-bad">−0.010</span> | thinking hurts |
| Visual | MedXpert-MM | vis_full 0.270 | vis_low 0.250 | <span class="cell-warn">+0.020</span> | same direction |
| Visual | PMC-VQA | vis_full 0.480 | vis_low 0.400 | <span class="cell-good">+0.080</span> | **clears the bar** |

**Visual axis: live.** PMC-VQA shows +0.080 cleanly, MedXpert moves +0.020
the same way. Dropping from full resolution to a 256-token budget costs
real accuracy on the recall set — consistent with the whole pruning
history, now confirmed on MedVLThinker.

**Reasoning axis: NO-GO.** Three of four subsets show thinking *slightly
hurts*; the only positive is MedXpert-Reasoning at exactly +0.030 — one
slice of four, sitting right on the threshold, where at n=100 that's **3
questions out of 100**. That's the textbook multiple-comparisons trap: run
four contrasts, one grazes the line, and the temptation is to crown it the
"real" one. The pre-registered rule asked for the delta to clear +0.03
*and* concentrate on the Reasoning slice while the others stayed flat. What
came back is the opposite shape — everything flat-to-negative, one slice
marginally positive by chance-level margins. Not the signature of a real
axis; noise around zero. (Parser misses were negligible — 3 and 2
empty-ish out of 100 — so the deltas are real, not artifacts.)

This is exactly what **m1** and MedLVR warned: on this model and data,
thinking doesn't buy accuracy. The 3B either knows the answer or it
doesn't; 512 tokens of reasoning changes nothing and on the easy sets
slightly distracts.

---

## Phase 6 — Building the retrieval axis (MedCPT + MedRAG Textbooks)

With reasoning dead, **retrieval replaced it as axis two** — a knowledge
budget instead of a thinking budget. This needed real retrieval
infrastructure, the heaviest the project has stood up. The explicit
inventory of what's new versus what stays put:

**New:** a **retriever** (MedCPT — `ncbi/MedCPT-Query-Encoder` +
`-Article-Encoder`, small biomedical encoders, *not* a new generator); a
**knowledge corpus + embeddings** (MedRAG **Textbooks**, clinical textbooks
chunked into snippets with pre-computed MedCPT embeddings); and a
**`retrieve.py`** that turns each question into top-k snippets and writes
`retrieved_medxpert_n100.jsonl`.

**Not new (deliberately):** no new benchmark/eval data (same
MedVLThinker-Eval slices — MedXpertQA-MM, PMC-VQA); no new eval harness
(scoring runs back in the existing MedVLThinker env); no new generator, no
flash-attn, no vLLM.

**The environment decision — conflict diagnosed and avoided.** The original
plan was a separate, isolated retrieval Docker image. On reflection, that
was over-engineering: dense retrieval only adds `faiss` +
`sentence-transformers`, and those install cleanly into the existing
MedVLThinker env **as long as `numpy` is held `<2`** (the same NGC binary
constraint that's bitten before). So no new image, no new venv — the
dependency conflict was sidestepped by pinning, keeping one environment.

**Where the KB lives.** `df -h /data` showed **2.3 TB free at 35%**, so the
few-GB corpus went on the shared volume (both VMs read it) at a shell-safe
path — `retrieval_kb`, not "retrieval knowledge base" (spaces in paths are
a latent footgun). Final: **`/data/dan/retrieval_kb`**.

??? note "`retrieve.py` — MedCPT dense retrieval over the Textbooks corpus (+ the ordering-bug fix)"

    The retriever is keyed on **question text only** and is fully
    independent of the generator, which matters later (the 7B reuses the
    same JSONL with no re-retrieval). The first run hit a `NameError`
    because `OUT` referenced `A.n` *before* argparse ran — the fix is just
    to define `OUT` after `A = ap.parse_args()`:

    ```python
    rs = RetrievalSystem(retriever_name="MedCPT", corpus_name="Textbooks",
                         db_dir="/data/dan/retrieval_kb")

    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=100)
    ap.add_argument("--k", type=int, default=5)
    A = ap.parse_args()
    OUT = f"/data/dan/retrieval_kb/retrieved_medxpert_n{A.n}.jsonl"   # AFTER A exists
    ```

    First run pulls the corpus + embeddings into `db_dir`, then retrieves
    top-5 snippets per question. Audit lines confirmed real textbook prose
    (`InternalMed_Harrison: Clinical Presentation of Viral Myocarditis …`)
    and `wc -l` read **100 rows** — clean hand-off.

The scoring half, `gate_rag.py`, adds a retrieval contrast back in the
untouched env: it reads the JSONL, prepends the 5 snippets to each
question, and runs **RAG (think) vs No-RAG (think)** on the same seed-42
slice — so the No-RAG arm is directly comparable to the `think` numbers
already in hand. One honest design choice baked in: both arms use the
*think* prompt, isolating **one** variable (knowledge injection) rather
than confounding it with the think/no-think change.

---

## Phase 7 — Retrieval axis result: flat

```text
n=100 | norag_acc=0.270 | rag_acc=0.280                          DELTA = +0.010
RAG fixed (wrong->right): 11   RAG broke (right->wrong): 10      net = +1
on the subset norag got WRONG (n=73): RAG rescued 11 = 0.151 (15% rescue)
on the subset norag got RIGHT (n=27): RAG broke 10    = 0.370 (37% damage)
```

**Verdict against the bar: +0.01 < +0.03. Retrieval does not clear. Not
live.** And the win/loss split argues *against* the obvious "selective
retrieval will rescue it" escape, not for it:

- RAG fixed 11 of the 73 it got wrong (**15% rescue**) but broke 10 of the
  27 it had right (**37% damage**). Per case, retrieval disrupts what the
  model knew more than twice as readily as it supplies what it didn't. The
  net is ~0 only because there are more wrong cases than right ones — so
  it's not "retrieval helps but gets diluted," it's "retrieval perturbs a
  near-chance guesser roughly symmetrically."

That's the crux, and it closes the escape. The model sits at **27% on
5-way MCQ** — barely above the 20% chance floor. A near-chance model's
correct answers aren't confident, they're *lucky*. A selective gate (the
TARG margin) works by withholding retrieval from *confident* answers — but
here the correct answers aren't confident, so the gate can't shield them
from that 37% damage. **Same wall — no exploitable confidence signal — that
killed the [June-1 router](day-02.md) and this morning's reasoning axis.**

Two confounds named rather than buried:

1. **The 3B is floored.** A model at near-chance can't show whether *any*
   help helps — the instrument may be too weak to detect either axis (which
   arguably weakens the visual gate's reading too). The 7B flagship is the
   model we'd build on anyway, so testing it isn't a detour.
2. **Retrieved on question text only**, but ~half of MedXpertQA-MM is
   image-dependent — for those, a text snippet is noise by construction.
   Image-aware retrieval is the heavier fix.

---

## Phase 8 — The fork, and the pre-registered 7B confound-check

The strategic read mattered more than either confound: this was the
**second flat axis today.** Reasoning dead, retrieval flat, and the one
live axis (visual) is the pruning dead-end where random wins. The joint
perception+knowledge controller needs **two** live axes and right now has
**zero clean ones.** The direction is mostly underwater.

The fork, taken deliberately:

- **One bounded 7B check** — rerun reasoning *and* retrieval on the 7B at
  the same +0.03 bar, pre-committed; or
- **Stop here** and reset next session.

Chosen: the **7B check, strictly as the last probe** — kill this on the
real model rather than on an instrument that may be too weak to show
signal. The named risk in that choice: *"the model was too weak, try the
bigger one"* is exactly the one-more-probe reflex that can run forever — so
the rule is pre-registered hard, and there is no third probe.

**Pre-registered rule for the 7B (fixed before any 7B number exists):**

- **Both flat (`< +0.03`) → direction dead, full stop.** No "try the next
  bigger model." End of the line for the joint idea.
- **Reasoning clears** → it was instrument-masked on the 3B; joint
  reasoning + visual revives.
- **Retrieval clears** (Δ ≥ +0.03 **and** damage-rate drops below
  rescue-rate in the flip analysis) → perception + knowledge revives, and
  selective retrieval becomes buildable because the 7B's correct answers
  are finally confident enough to gate on.

**One footgun killed first.** Both gate scripts key their checkpoints on
axis/subset/mode, *not* on model — point them at the 7B without changing
the checkpoint dir and they'd silently replay the 3B's cached
`{idx,gold,pred,ok}` and report 3B numbers as 7B. So the dir changes too:

```bash
# download the 7B (explicit path, load-by-path)
huggingface-cli download UCSC-VLAA/MedVLThinker-7B-RL_m23k \
    --local-dir /data/dan/weights/MedVLThinker-7B-RL_m23k

# two one-line edits in BOTH gate_probe.py and gate_rag.py:
#   MODEL    = "/data/dan/weights/MedVLThinker-7B-RL_m23k"   # was 3B
#   CKPT_DIR = "gate_ckpts_7b"                                # fresh — don't collide

# VM-A — reasoning             |  # VM-B — retrieval (reuses retrieved_*.jsonl as-is)
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
python -u gate_probe.py --axis reasoning --n 100 2>&1 | tee gate_reasoning_7b.log
python -u gate_rag.py            --n 100 2>&1 | tee gate_rag_7b.log
```

The retrieval gate reuses `retrieved_medxpert_n100.jsonl` untouched —
MedCPT was keyed on question text, independent of the generator, so no
re-retrieval. Both launched and **left running across the two VMs** (~2 hr;
the 7B is roughly twice the per-token cost). The calibration tell to watch
next session: the no-RAG / think arms should rise well off 0.27 — if the
7B is still stuck near chance, that itself says the benchmark is too hard
to read either axis, and that's part of the verdict.

**Verdict pending** those two runs.

---

## Phase 9 — Side-decision: the June-8 presentation paper → MedVLThinker

A literature-presentation assignment is due **June 8** (pick a paper,
present with slides). The choice landed on the natural one given the
project:

> **MedVLThinker** — the paper behind the project's own base models
> (MedVLThinker-7B / 32B-RL).

Presenting the paper of the model the entire project is built on doubles
as the written motivation for the work itself — the architecture, the RL
training that elicits the `<think>` traces, and the six-benchmark
evaluation suite are all the substrate today's experiments run on. (The
m1 test-time-scaling findings still get their due in the research write-up
above, as the *literature* that predicted the reasoning-axis result — but
the paper being *presented* on June 8 is MedVLThinker, not m1.)

Locked: **MedVLThinker**, deck already prepared. (The black/gold
lab-report PPTX format with per-slide speaker scripts was offered but
isn't needed — the presentation is already built.)

---

## Honest ledger of the day

1. **Image-difficulty wedge: dead.** Lesion-aware refinement returned a
   pre-registered **NO-GO** (lesion_area ρ=+0.043, lesion_contrast ρ=+0.012
   p=0.56, both wrong-signed, below the 0.1 floor across all 15 strata).
   The June-2 REFINE ran to its honest end.
2. **The failure pattern named** — every dead method bet on a natural
   correlation existing in the data. New rule: pick methods whose value is
   *constructive/learned*, not contingent.
3. **New direction: joint perception + knowledge allocation** — per-question
   allocation of a visual budget and a retrieval budget. Robust by
   construction (always-on settings are net-positive), which is exactly
   what the dead directions lacked.
4. **Reasoning axis (3B): NO-GO** — think − nothink flat-to-negative across
   MedXpert-ALL / Understanding / PMC-VQA, with a single noise-level +0.030
   on the Reasoning slice (1 of 4, on the line, multiple-comparisons trap).
   Corroborates m1's saturation / knowledge-bound finding.
5. **Visual axis (3B): live** — vis_full − vis_low = **+0.080** on PMC-VQA
   (+0.020 on MedXpert-MM), clears the bar.
6. **Retrieval axis (3B): flat** — always-on text RAG net **+0.010**; flip
   analysis **15% rescue vs 37% damage**; a near-chance (27%) base masks any
   selective-gate signal. Same no-confidence wall as the June-1 router.
7. **The joint direction is underwater** — needs two live axes, has zero
   clean ones on the 3B.
8. **7B confound-check launched, pre-registered as the final probe** —
   reasoning + retrieval at the +0.03 bar; **both flat → direction dead,
   full stop.** Verdict pending the running 7B jobs.
9. **June-8 presentation settled on MedVLThinker** — the paper behind the
   project's own base models.

Plus the infra trail: trace-fix (system-prompt gating for the no-think
arm), weights consolidated to `/data/dan/weights`, OOM /
checkpoint-resume hardening, the retrieval env conflict diagnosed and
*avoided* (no new image/venv — `faiss` + `sentence-transformers` added,
`numpy` held `<2`), and the retrieval KB built at `/data/dan/retrieval_kb`.

!!! note "On the project's direction"
    The site name still says *question-aware visual token pruning*. As of
    today the working direction is **joint perception + knowledge
    allocation** on MedVLThinker — but it has *not* cleared its feasibility
    gate (two flat axes on the 3B), so nothing is committed and the rebrand
    stays deferred, on the same discipline that's governed every pivot
    here. The 7B check decides whether this direction lives or joins the
    others.

---

### Plan for tomorrow (next session)

- [ ] **Read the 7B verdict.** Paste the `###` lines from both
      `gate_reasoning_7b.log` and `gate_rag_7b.log`, plus the flip-analysis
      on the new `gate_ckpts_7b` retrieval checkpoints. Check first that the
      no-RAG / think arms lift well off 0.27 (the calibration tell).
- [ ] **Apply the pre-registered rule, no relitigating:** both flat →
      joint perception+knowledge direction dead, full reset; reasoning
      clears → revive joint reasoning+visual; retrieval clears (Δ ≥ +0.03
      **and** damage < rescue) → revive perception+knowledge and design the
      joint controller.
- [ ] If **dead**: a clean-slate direction hunt (Direction A / conformal
      selective-prediction is the standing fallback — value-by-construction,
      lowest re-NO-GO risk).
- [ ] If **alive**: spec the joint perception–knowledge controller; confirm
      the retrieval axis on the heavier image-aware retrieval fix.
- [ ] **June 8:** present **MedVLThinker** (deck ready).
- [ ] Commit the `medvlthinker-imgdiff-compute` gate scripts
      (`gate_probe.py`, `gate_rag.py`, `retrieve.py`) once the verdict is in.

---

## Pushed today

**No code push.** The gate scripts (`gate_probe.py`, `gate_rag.py`,
`retrieve.py`) live in the `medvlthinker-imgdiff-compute` repo, and the
**7B confound-check is still running across both VMs**
(`gate_reasoning_7b.log` / `gate_rag_7b.log`, fresh `gate_ckpts_7b`). The
commit and push come once the 7B verdict lands and the direction is either
confirmed or reset — the push held until then, on the week's standing rule.
