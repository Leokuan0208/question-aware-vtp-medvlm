# Day 2 — Tuesday, June 9, 2026

[← Back to Week 5 overview](index.md)

**Accuracy direction falsified → efficiency cascade locked in** ·
Week 5, Day 2 · **Day 31 of the project**

---

A clean, disciplined day that closed a question rather than opening one. It
took the fork [Day 1](day-01.md) left — *Path A,* reach the +12.5pp oracle
headroom with a stronger cheap signal, vs *Path B,* commit to the efficiency
framing — and resolved it the honest way: run the one decisive,
pre-registered experiment for Path A first, then commit based on the result.
The experiment added the **full predictive distribution** (entropy, the whole
A–J log-prob vector) as escalation signals — the obvious thing Day 1's probe
never tested, since the margin throws away all but two numbers of a vector
already logged. An apparent accuracy win showed up at a hand-picked
threshold; a Pareto sweep made it look like it might survive; and then a
**pre-registered paired bootstrap killed it** — every significant gain sat on
a budget chosen *on the data*, and at the honest a-priori operating point the
gains vanished (and on SLAKE one signal was significantly *worse* than the
32B). So **Path A is closed cleanly**: the accuracy headroom is not reachable
from any cheap 7B signal tested. The same numbers, read the other way, leave
the day's real contribution standing and now statistically backed — a
**working efficiency cascade**: match the 32B at no significant accuracy cost
while keeping roughly half to three-quarters of questions on the cheap 7B.

No code was pushed today — every script
(`router_escalate.py` extended, `router_pareto.py`, `router_bootstrap.py`)
lives in the `medvlthinker-imgdiff-compute` repo, and the push waits until the
generalization test (leave-one-dataset-out) is in and the framing is written
up, on the week's standing rule.

!!! note "Day count, and June 8"
    June 8 (Day 30) was the **MedVLThinker literature presentation** — the
    paper behind the project's own base models — with the deck prepared over
    the prior sessions, so it isn't a research working-session page. June 9 is
    the next research session: **Day 31** of the project (calendar count from
    May 10), **Day 2 of Week 5**.

---

## Phase 1 — The fork, and the one decisive experiment for Path A

Day 1 ended with a real prize and a wall: the 7B→32B oracle beats always-32B
by **+12.5pp**, but the cheap confidence *margin* couldn't reach it (escalated
96% on the hard sets), and the overnight layer-14 hidden-state probe was even
worse (AUROC ~0.62). The fork that left for today:

- **Path A — reach the headroom.** Is there a stronger-but-still-cheap 7B
  signal that escalates only the truly-hard questions, turning the oracle gap
  into a real accuracy gain?
- **Path B — commit to efficiency.** Accept the headroom isn't cheaply
  reachable, and build the rigorous "match 32B at a fraction of the cost"
  result across the competent benchmarks.

The gap that made Path A worth one clean shot: Day 1's probe compared three
signals — the bare **margin** (top1−top2 logprob), the **layer-14 hidden
state**, and the two concatenated — but never the **full predictive
distribution** over the answer options. The margin is two numbers out of the
whole A–J `opt_logprobs` vector already logged; entropy, the shape of the
tail, how many options are competitive are standard selective-prediction
signals and were untested. And testing them costs nothing — pure CPU analysis
on existing label files.

The rule was **pre-registered before running**, so a marginal result couldn't
become motivated reasoning: a signal *wins* if the gated cascade **beats
always-32B by >0.01, or matches it while escalating clearly less**, on a
competent benchmark (one where 7B-correctness is actually predictable, AUROC
well above 0.5). **If nothing clears that bar, Path A is closed** — and that's
a real finding ("the headroom isn't reachable from any cheap 7B signal we
tested"), not a failure. Branch: a signal lifts a competent benchmark above
32B-alone → candidate method, dig in; nothing does → the rest of the day goes
to Path B (Pareto cost-vs-accuracy curves).

---

## Phase 2 — Two new signals, and an apparent accuracy win

Rather than write a new script, the day **extended the working
`router_escalate.py`** — it already loads the 7B/32B per-sample labels, the
`opt_logprobs` vector, and the layer-14 features, and computes the margin, so
adding signals keeps the comparison on the *identical* CV folds the overnight
run used (and the four original signals still reproduce the overnight numbers
exactly). Two new escalation signals, both built from the already-logged
`opt_logprobs`:

- **`entropy`** — Shannon entropy of the A–J option distribution (one cheap
  output-side number).
- **`dist_full`** — the full per-option log-distribution, sorted and padded
  (the maximal output-side signal).

Head-to-head against `margin`, `hidden`, and `hidden+margin` on the same
folds with a shuffle control. The first read was encouraging: at the single
accuracy-maximizing threshold per signal, **`dist_full` / `entropy` showed a
modest accuracy win over always-32B on the closed-form sets.** Exactly the
kind of result Path A was hoping for — but a win at one hand-tuned `tau` is
fragile, so it had to be stress-tested before being believed.

---

## Phase 3 — The Pareto operating curve: does the edge survive every budget?

A win at one threshold could be a single lucky `tau`. `router_pareto.py`
sweeps the **entire** escalation budget and reads accuracy at every cost — two
jobs at once: it tests whether the `dist_full` edge survives across operating
points, and it produces the rigorous "match 32B at X% cost" efficiency story
with verbatim numbers for the site's SVG.

??? note "`router_pareto.py` — the cost-vs-accuracy operating curve (CPU-only)"

    For each dataset × signal: an **out-of-fold** P(7B correct) from a
    cross-validated logistic probe (5-fold × 5-repeat — honest, no leakage),
    escalate the lowest-P(7B-correct) fraction first for budgets 0%,10%,…,100%,
    and record routed accuracy at each. The x-axis is **% escalated to 32B**,
    an assumption-free compute proxy (0% = all cheap-7B, 100% = always-32B).
    A `random` line (escalate a random fraction → linear interpolation) is the
    no-information baseline; a per-signal **shuffle** row is the control.

    ```python
    BUDGETS = np.linspace(0, 1, 11)            # 0%,10%,...,100% escalated to 32B
    def curve(P, a7, a32):                     # P = OOF P(7B correct)
        order = np.argsort(P, kind="stable")   # ascending: least-confident escalated first
        accs = []
        for b in BUDGETS:
            k = int(round(b * len(P)))
            esc = np.zeros(len(P), bool); esc[order[:k]] = True
            accs.append(float(np.where(esc, a32, a7).mean()))
        return np.array(accs)
    # report break-even% (least escalation to match always-32B), peak & its budget,
    # and the shuffle-control curve. dist_full/entropy/margin only — hidden lost on Day 1.
    ```

Across the full sweep the `dist_full` curve looked like it held an edge over
several operating points — enough that, mid-session, it was (over-)called
"robust across operating points." That call was premature, and the next phase
walks it back. The right test for "is this gain real" isn't *more curve* — it's
a significance test at a budget chosen *before* seeing the data.

---

## Phase 4 — The pre-registered bootstrap: the falsification gate

`router_bootstrap.py` puts a confidence interval on the gain via a **paired
bootstrap** (B=2000) over the evaluation sample, with the gate's out-of-fold
scores held fixed (so the CI reflects test-sample uncertainty, the dominant
source given fixed labels). The crucial design choice is **two operating
points per signal**:

- **`err-rate`** — escalate the bottom *(1 − always-7B-accuracy)* fraction. A
  perfect router escalates exactly the 7B's error rate, so this budget is set
  **a priori / pre-registerable** — the honest headline.
- **`peak`** — the budget that maximized full-data routed accuracy. Chosen
  *on the data* → **optimistic upper estimate.**

Per-sample gain = `routed − always-32B` ∈ {−1, 0, +1}; report observed gain,
95% percentile CI, one-sided bootstrap p, and **SIG** only if the 95% CI
excludes 0. (Validated first with a unit test: it correctly flags a strong
positive as significant and a zero-centred one as not. The toy small-n case
came back significant only because of unrealistically low variance — real
routing gains spread over −1/0/+1, so the real CIs, especially VQA-RAD's at
n=272, would be *wider*. Whether VQA-RAD clears was left for the run to
decide.)

```text
PAIRED BOOTSTRAP: is routed-acc − always-32B > 0?   (B=2000; err-rate point + peak)
### PMC-VQA  (n=2000)   always-7B=0.539   always-32B=0.556   err-rate budget=46%
    margin     err-rate esc=46%  routed=0.555  gain=-0.002  CI[-0.015,+0.011]  p=0.622  -> ns
    margin     peak     esc=40%  routed=0.559  gain=+0.003  CI[-0.011,+0.017]  p=0.349  -> ns
    entropy    err-rate esc=46%  routed=0.545  gain=-0.011  CI[-0.025,+0.002]  p=0.946  -> ns
    entropy    peak     esc=80%  routed=0.560  gain=+0.004  CI[+0.000,+0.007]  p=0.030  -> ns
    dist_full  err-rate esc=46%  routed=0.549  gain=-0.007  CI[-0.020,+0.006]  p=0.864  -> ns
    dist_full  peak     esc=80%  routed=0.560  gain=+0.004  CI[+0.001,+0.007]  p=0.024  -> SIG +
### SLAKE  (n=416)   always-7B=0.733   always-32B=0.764   err-rate budget=27%
    margin     err-rate esc=27%  routed=0.731  gain=-0.034  CI[-0.067,+0.000]  p=0.979  -> ns
    margin     peak     esc=60%  routed=0.769  gain=+0.005  CI[-0.007,+0.017]  p=0.258  -> ns
    entropy    err-rate esc=27%  routed=0.733  gain=-0.031  CI[-0.065,+0.002]  p=0.969  -> ns
    entropy    peak     esc=60%  routed=0.767  gain=+0.002  CI[-0.010,+0.014]  p=0.426  -> ns
    dist_full  err-rate esc=27%  routed=0.719  gain=-0.046  CI[-0.079,-0.012]  p=0.995  -> SIG -
    dist_full  peak     esc=60%  routed=0.767  gain=+0.002  CI[-0.010,+0.014]  p=0.432  -> ns
### VQA-RAD  (n=272)   always-7B=0.761   always-32B=0.776   err-rate budget=24%
    margin     err-rate esc=24%  routed=0.798  gain=+0.022  CI[-0.022,+0.066]  p=0.190  -> ns
    margin     peak     esc=30%  routed=0.801  gain=+0.026  CI[-0.015,+0.066]  p=0.124  -> ns
    entropy    err-rate esc=24%  routed=0.801  gain=+0.026  CI[-0.018,+0.066]  p=0.140  -> ns
    entropy    peak     esc=25%  routed=0.801  gain=+0.026  CI[-0.015,+0.066]  p=0.141  -> ns
    dist_full  err-rate esc=24%  routed=0.805  gain=+0.029  CI[-0.015,+0.074]  p=0.117  -> ns
    dist_full  peak     esc=20%  routed=0.812  gain=+0.037  CI[-0.007,+0.081]  p=0.069  -> ns
### PathVQA  (n=3362)   always-7B=0.644   always-32B=0.673   err-rate budget=36%
    margin     err-rate esc=36%  routed=0.670  gain=-0.002  CI[-0.016,+0.011]  p=0.617  -> ns
    margin     peak     esc=60%  routed=0.685  gain=+0.012  CI[+0.004,+0.022]  p=0.004  -> SIG +
    entropy    err-rate esc=36%  routed=0.670  gain=-0.003  CI[-0.016,+0.010]  p=0.681  -> ns
    entropy    peak     esc=60%  routed=0.686  gain=+0.013  CI[+0.004,+0.022]  p=0.003  -> SIG +
    dist_full  err-rate esc=36%  routed=0.677  gain=+0.004  CI[-0.009,+0.017]  p=0.273  -> ns
    dist_full  peak     esc=55%  routed=0.689  gain=+0.017  CI[+0.007,+0.026]  p=0.001  -> SIG +
```

---

## Phase 5 — The verdict: the accuracy gain does not survive

Read the **`err-rate` rows** — the ones whose budget wasn't tuned. That's the
honest test, and it's decisive:

| Gain vs always-32B @ **err-rate** (a-priori budget) | `margin` | `entropy` | `dist_full` |
| --------------------------------------------------- | :---: | :---: | :---: |
| PathVQA (n=3362) | −0.002 ns | −0.003 ns | +0.004 ns |
| VQA-RAD (n=272) | +0.022 ns | +0.026 ns | +0.029 ns |
| PMC-VQA (n=2000) | −0.002 ns | −0.011 ns | −0.007 ns |
| SLAKE (n=416) | −0.034 ns | −0.031 ns | <span class="cell-bad">−0.046 SIG−</span> |

**Every single `err-rate` result is non-significant — except SLAKE
`dist_full`, which is significantly *worse* than the 32B.** Every `SIG +` in
the whole table sits on a **`peak`** row, whose budget was chosen on the same
data, and even those are small and at high escalation (the strongest, PathVQA
`dist_full` +0.017, escalates 55% — a marginal bump while already sending most
questions to the 32B). VQA-RAD's point estimates are positive (+0.022 to
+0.037) but every CI straddles zero (p=0.117–0.190) — exactly the n=272
small-sample fragility flagged in advance.

So the honest verdict: **there is no robust, deployable accuracy
improvement.** The apparent wins were budget-selection artifacts. This is the
falsification gate doing its job, and it required walking back the mid-session
"robust across operating points" read — corrected by a pre-registered test
rather than a hopeful read of one curve. **Path A is closed cleanly**, and the
project lands back on its long-standing conclusion — *efficiency, not
accuracy* — now backed by a significance test instead of a single tuned
threshold.

---

## Phase 6 — The efficiency cascade, intact and now statistically backed

The same numbers, read the other way, are good news. **`ns at err-rate` means
parity** — routed accuracy statistically indistinguishable from the 32B —
*while escalating only the err-rate fraction* and keeping the rest on the cheap
7B. That's the efficiency cascade, and it's clean:

| Dataset | matches 32B at… | escalated to 32B | kept on cheap 7B |
| ------- | :---: | :---: | :---: |
| VQA-RAD | ~0.776 (edge, +0.022 ns) | **~24%** | ~76% |
| PathVQA | ~0.673 | ~36% | ~64% |
| PMC-VQA | ~0.556 | ~46% | ~54% |
| SLAKE | ~0.764 (parity only at peak) | ~60% | ~40% |

**Match the 32B at no significant accuracy cost while keeping roughly half to
three-quarters of questions on the cheap 7B** — a genuine, defensible result.
Two refinements the bootstrap hands the write-up:

- **The simplest signal is the safest gate.** `margin` and `entropy` are
  *never* significantly negative anywhere; `dist_full` — the one with the
  flashiest peaks — is the one that significantly *hurts* on SLAKE. For a
  robust efficiency gate you reach for **`margin`, not `dist_full`.** That
  flips Day 1's "richer signal is better" — the rich signal was best only at
  the accuracy peaks that don't survive.
- **SLAKE is the weak case.** It needs ~60% escalation to reach parity, so the
  cost saving there is smaller — worth stating plainly rather than averaging
  away.

??? note "Infrastructure aside — Claude Code headless login (optional), and the logfile discipline"
    The terminal Claude Code agent got stuck on login: the OAuth redirect
    points at `localhost`, but the callback server is on the **remote VM**
    while the browser is on the laptop, so `localhost` resolves to the laptop
    where nothing's listening. Fix (per Anthropic's docs): over SSH it shows a
    **login code** instead of redirecting — `Ctrl+C`, re-run `claude`,
    authorize, then paste the whole code (the `code=…#…` from the failed page's
    URL bar, including the `#` part) at the prompt in the *same* session; or
    `export ANTHROPIC_API_KEY=…` to skip OAuth entirely. It's a convenience,
    not a dependency — the experiments run as plain Python. Reaffirmed the
    standing rule it underscores: never let a job depend on the terminal
    staying open — long jobs go `nohup python3 … > run.log 2>&1 &`, reconnect
    from any device with `tail -f run.log`. The terminal UI is disposable; the
    logfile is the source of truth.

---

## Honest ledger of the day

1. **Path A given one clean, pre-registered shot** — added the full
   predictive distribution (`entropy`, `dist_full`) as escalation signals,
   the obvious thing Day 1's probe never tested, by extending
   `router_escalate.py` on the identical CV folds.
2. **An apparent accuracy win** at the hand-picked threshold (`dist_full` /
   `entropy` beat always-32B on the closed-form sets) — then stress-tested
   rather than believed.
3. **Pareto operating curve** (`router_pareto.py`) — OOF CV probe, escalate
   least-confident first across 0–100% budgets, shuffle control; produced the
   verbatim cost-vs-accuracy numbers for the site SVG.
4. **Pre-registered paired bootstrap** (`router_bootstrap.py`, B=2000) at an
   a-priori `err-rate` budget and a data-chosen `peak` — **falsified the
   accuracy gain**: every `err-rate` gain is ns except SLAKE `dist_full`
   (**SIG −0.046, worse than 32B**); every `SIG +` is a `peak`-row,
   budget-selection artifact. VQA-RAD positive but ns at n=272.
5. **Path A closed cleanly** — the +12.5pp headroom is not reachable from any
   cheap 7B signal tested (margin, entropy, full distribution, or layer-14
   hidden state). Efficiency, not accuracy — now significance-backed.
6. **Efficiency cascade intact and clean** — parity with the 32B while keeping
   ~54–76% of questions on the 7B (VQA-RAD ~24% esc, PathVQA ~36%, PMC-VQA
   ~46%; SLAKE the weak case at ~60%).
7. **Signal-choice flipped** — use the simple **`margin`** (never significantly
   negative), not `dist_full` (significantly hurts SLAKE).

---

!!! note "On the project's direction"
    The site name still says *question-aware visual token pruning*. The
    committed result is now a **7B→32B confidence-margin efficiency cascade**
    for medical VQA — match a 32B medical VLM at a fraction of the inference
    cost on the competent benchmarks, with the accuracy direction honestly
    closed by a pre-registered test. The rebrand is the closest it's been, but
    stays deferred one more step — until the **leave-one-dataset-out**
    generalization test confirms the efficiency claim holds on an unseen
    dataset, which is what turns "a real result on this data" into "a
    deployable method."

---

### Plan for next session

- [ ] **Leave-one-dataset-out generalization test** — fit the gate on some
      competent datasets, route a held-out one; the test of whether a gate
      tuned elsewhere still matches 32B at reduced cost on an unseen dataset
      (what "deployable method" requires, and the final word on accuracy).
- [ ] **Build the accuracy-vs-cost Pareto SVG** for the site from the verbatim
      `router_pareto.py` numbers, using **`margin`** as the headline gate.
- [ ] Decide the cost axis for the write-up (escalation % → FLOPs or
      wall-clock latency) so "match 32B at X% cost" has real units.
- [ ] **Commit the day's scripts** to `medvlthinker-imgdiff-compute`
      (`router_escalate.py` extended, `router_pareto.py`, `router_bootstrap.py`)
      once the LODO result is in.

---

## Pushed today

**No code push.** The day's analysis — the extended `router_escalate.py`,
`router_pareto.py`, and `router_bootstrap.py` — lives in the
`medvlthinker-imgdiff-compute` repo, all CPU-only on the existing paired
labels (`ckpts/gate_7b_vllm`, `ckpts/gate_32b`). The commit and push come once
the leave-one-dataset-out generalization test confirms the efficiency claim
and the framing is written up — the push held until then, on the week's
standing rule.
