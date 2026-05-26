# Day 5 — Thursday, May 14, 2026

[← Back to Week 1 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 1, Day 5 · **Day 5 of the project**

---

The plan for today was "implement the 7 harness stubs, then run E00."
The harness got finished — but most of the day went to a long
debugging saga about *why the baseline number looked wrong*, and the
honest summary is that today produced fewer visible artifacts than it
eliminated invisible uncertainty. Both halves are written up below.

## Harness implementation — strategy

Decided to fill in the stub files in **3 batches**, ordered by
dependency direction rather than all-at-once:

- **Batch 1** — `metrics.py` + `model_loader.py`. Leaf modules with no
  internal dependencies; fully writable without inspecting any data.
- **Batch 2** — the VQA-RAD dataset loader + `runner.py` +
  `run_eval.py`. Written after inspecting the actual VQA-RAD files.
- **Batch 3** — the SLAKE and PathVQA loaders. _Not done today_ —
  still stubs.

The rationale for batching: each batch is verified in isolation before
the next is built, so when something breaks the bug is localised to a
small surface instead of being somewhere across ~500 lines of
all-at-once code.

## Batch 1 — `metrics.py` + `model_loader.py` (complete, verified)

**`metrics.py`** implements four things:

- `closed_ended_accuracy` — normalised whole-word match, lenient toward
  verbose answers. _(Note: this leniency later became a known open
  issue — see the end-of-day open items.)_
- `open_ended_recall` — set-based token recall, averaged over questions.
- `LatencyTracker` — CUDA-synchronised timing with a configurable
  warmup-discard, returns mean ± std in milliseconds.
- `peak_gpu_memory_gb` / `reset_peak_memory` — thin wrappers over
  `torch.cuda` peak-memory stats.

Added length-mismatch guards (fail loudly if predictions and
references differ in count) and factored shared text cleaning into
`_normalize` / `_tokenize` helpers. Smoke-tested with hand-checked
inputs: closed-ended accuracy 0.667, open-ended recall 0.5 — both
matched the by-hand expected values.

**`model_loader.py`** implements `load_llava_med`, a wrapper over
LLaVA-Med's `load_pretrained_model`. Added `_infer_conv_mode` (selects
the conversation template from the model name — `mistral` →
`mistral_instruct`) and a `FileNotFoundError` guard on the model path.
Verified the wrapped function's signature against the local LLaVA-Med
copy with `inspect.signature` before trusting it.

**Why `model_loader.py` is a separate wrapper** rather than calling
LLaVA internals straight from the runner: (1) the runner never has to
import LLaVA internals directly; (2) if another base model is added
later (e.g. MedGemma), only this one file changes; (3) the auxiliary
objects — tokenizer, image processor, context length, conv mode — get
bundled into a single `LoadedModel` dataclass, so one object travels
downstream instead of four loose values.

??? note "Interface contracts — `eval/datasets/base.py` (the `VQASample` + `MedVQADataset` contract)"

    Every benchmark loader implements this so the runner can iterate
    over any dataset uniformly without knowing benchmark-specific
    details.

    ```python
    """Common interface for medical VQA datasets.

    Every benchmark (VQA-RAD, SLAKE, PathVQA) implements this interface so
    the runner can iterate over them uniformly without knowing
    benchmark-specific details.
    """

    from abc import ABC, abstractmethod
    from dataclasses import dataclass
    from pathlib import Path
    from typing import Iterator, Optional


    @dataclass
    class VQASample:
        """One question-answer pair tied to one image.

        Attributes:
            question_id: Unique identifier within the dataset. Used to key
                per-question predictions in the output JSONL.
            image_path: Absolute path to the image file on disk.
            question: The natural language question.
            answer: The ground-truth answer (a string; for closed-ended
                yes/no questions this is "yes" or "no").
            answer_type: One of "closed" (yes/no, multiple choice) or
                "open" (free-form). Drives which accuracy metric applies.
            dataset: Name of the source dataset ("vqa_rad", "slake",
                "path_vqa"). Useful when merging predictions across sets.
            metadata: Any extra fields (modality, organ, difficulty, etc.)
                that a specific dataset wants to expose for analysis.
        """
        question_id: str
        image_path: str
        question: str
        answer: str
        answer_type: str  # "closed" or "open"
        dataset: str
        metadata: Optional[dict] = None


    class MedVQADataset(ABC):
        """Abstract base class for medical VQA benchmarks.

        Subclasses load their specific format and expose a uniform
        iterator of VQASample objects. The runner doesn't care which
        benchmark it's iterating over.
        """

        def __init__(self, root: str, split: str = "test",
                     max_samples: Optional[int] = None):
            self.root = Path(root)
            self.split = split
            self.max_samples = max_samples
    ```

## Batch 2 — VQA-RAD loader + `runner.py` + `run_eval.py` (complete)

**`runner.py`** is the evaluation orchestrator: it attaches the pruning
method, runs the dataset through single-turn greedy decoding, collects
predictions, and aggregates metrics split by `answer_type`. The
`method.detach()` call is in a `finally` block so the model is always
restored even if generation throws partway through. Added a one-line
`\r`-style progress counter so a 451-sample run shows an advancing
`[run_eval] N/451` line instead of going silent for half an hour.

??? note "The progress-counter change in `eval/runner.py` (minimal, one line added)"

    The change is deliberately minimal — one line added inside the main
    loop, nothing else touched, because this edits verified-working code
    right before the run that counts.

    ```python
    # --- Main evaluation loop ---------------------------------------
    total = len(dataset)
    try:
        for i, sample in enumerate(dataset, start=1):
            tracker.start()
            pred_text = _generate_one(
                loaded_model,
                sample.question,
                sample.image_path,
                max_new_tokens,
                temperature,
            )
            tracker.stop()

            predictions.append({
                "question_id": sample.question_id,
                "question": sample.question,
                "ground_truth": sample.answer,
                "prediction": pred_text,
                "answer_type": sample.answer_type,
                "dataset": sample.dataset,
            })

            # Progress line. \r returns the cursor to the line start so
            # each update overwrites the previous one instead of
            # scrolling -- the terminal shows a single advancing counter,
            # not 451 lines. flush=True forces it to display immediately
            # (print normally buffers, which would make the counter lag).
            print(f"\r[run_eval] {i}/{total} samples done",
                  end="", flush=True)
    finally:
        print()  # newline to close off the \r progress line cleanly
    ```

**`run_eval.py`** is the argparse CLI entry point. Design points:

- **Registry pattern** — `_DATASET_REGISTRY` and `_METHOD_REGISTRY`
  are dicts mapping CLI choice strings to classes, so adding a
  benchmark or pruning method later is a one-line change.
- **Deliberate step ordering** — the dataset is built (fast, fails
  immediately on a bad path) *before* the model is loaded (slow,
  minutes). A mistyped path errors in the first second.
- **Outputs** — `{run_id}_metrics.json` (aggregate metrics + resolved
  config + full `vars(args)` for reproducibility) and
  `{run_id}_predictions.jsonl` (one JSON object per question).
  `run_id` = `{method}_{dataset}_kr{keep_ratio}_{timestamp}` — keep
  ratio is in the name even for the baseline so future pruning runs
  sort and diff cleanly, and the timestamp prevents silent overwrites.

After Batch 2, the VQA-RAD path is complete end-to-end. A 3-sample
smoke test produced coherent medical answers, so the full pipeline
was confirmed wired correctly.

!!! tip "Full harness source"
    The complete, authoritative source for every harness file lives in
    the repository — see [Pushed today](#pushed-today) at the bottom of
    this page for the commit-pinned link. A few files changed several
    times during today's debugging; the pinned commit is the source of
    truth for their final state.

## The baseline underperformance investigation

Running E00 produced a closed-ended accuracy around **0.55**, against
a literature figure of roughly **0.84** for LLaVA-Med on VQA-RAD — a
~29-point gap that needed explaining before the baseline could be
trusted. This investigation ate most of the day. The approach was to
eliminate suspects one at a time:

1. **Dataset** — verified sample counts and the data loader against
   the original VQA-RAD distribution.
2. **Prompt construction** — read the official `model_vqa.py` and
   confirmed it uses the bare question with no "answer in one word"
   instruction baked in; our harness's prompt matches that convention.
3. **Decode path** — `model_vqa.py` decodes the *entire* `output_ids`
   with `skip_special_tokens=True` and no input-length slice. This
   independently confirms the decode fix applied to `runner.py` is
   correct and matches the reference.
4. **The whole harness** — the decisive test: ran the reference
   `model_vqa.py` on the first 20 VQA-RAD test questions and compared
   to the harness's predictions. They were **word-for-word
   identical**. This conclusively exonerates the harness — prompt,
   image handling, generate call, decode — as the source of the gap.

**Conclusion: the gap is methodology, not a code bug.** The official
LLaVA-Med v1.5 evaluation scores via GPT-4-as-judge on a 50-question
chat benchmark — it does *not* produce closed/open exact-match
accuracy on the full VQA-RAD test set. So the literature's ~84% cannot
be reproduced by simply running the current repo's scripts; honest
closed/open accuracy is genuinely something this project has to
compute itself. The ~84% figure is a target to be "in the
neighbourhood of," not a number to hit exactly — and the gap is now
*understood*, which is what matters for trusting the baseline.

## The `answer_type` labeling bug — found and fixed

During the investigation, found a genuine bug: the HuggingFace VQA-RAD
mirror **dropped the `answer_type` field**, and the harness's loader
was falling back to a yes/no heuristic that mislabels genuinely-closed
non-yes/no questions (e.g. "which side?", "what modality?") as open.
This is now written up in full as
[Bugs & Issues #3](../../bugs.md#3-vqa-rad-huggingface-mirror-dropped-the-answer_type-field-loader-heuristic-mislabels-closed-questions).

Short version of the fix: built a `(question, answer)` → `answer_type`
lookup from the original VQA-RAD distribution JSON, and rewrote the
loader to assign real labels by joining on that key, keeping the old
heuristic only as a loudly-reported fallback. The join matched
**450 of 451** test samples; the closed/open split corrected from the
heuristic's 251/200 to the real **272/179** — a 21-question shift that
independently matches a discrepancy spotted earlier against the
original paper, which is a strong consistency check that the fix is
right.

??? note "The `answer_type` fix in `eval/datasets/vqa_rad.py` (applied & verified)"

    `_infer_answer_type` is demoted to a fallback; `_make_lookup_key`
    and `_load_answer_type_lookup` are new; `_load_samples` assigns real
    labels by joining on a normalised `(question, answer)` key and
    loudly reports any fallback usage.

    ```python
    def _infer_answer_type(answer: str) -> str:
        """FALLBACK ONLY: infer 'closed' vs 'open' from the answer string.

        The yes/no heuristic is NOT accurate for VQA-RAD -- the dataset's
        real answer_type depends on the actual answer given. The loader
        uses real labels from the original VQA-RAD distribution via a
        (question, answer) lookup; this function is only invoked if a
        (question, answer) pair is somehow not found, so the loader
        degrades gracefully instead of crashing.
        """
        if str(answer).strip().lower() in ("yes", "no"):
            return "closed"
        return "open"


    def _make_lookup_key(question: str, answer) -> str:
        """Build the normalized (question, answer) lookup key.

        Both fields are str()-coerced (some VQA-RAD answers are numbers),
        stripped, and lowercased so the key matches regardless of casing
        or type differences between the original JSON and the HF parquet
        mirror. The ' ||| ' separator is an arbitrary unlikely delimiter.
        """
        q = str(question).strip().lower()
        a = str(answer).strip().lower()
        return q + " ||| " + a


    def _load_answer_type_lookup(root: Path) -> dict:
        """Load the (question, answer) -> answer_type lookup built from
        the original VQA-RAD distribution.

        The HuggingFace Parquet mirror dropped the answer_type field;
        this lookup (produced by a one-time script from
        'VQA_RAD Dataset Public.json', keyed on normalized
        question+answer) restores the real labels. Returns an empty dict
        if the lookup file is absent, in which case the loader falls back
        to the heuristic for every sample (and warns loudly).
        """
        lookup_path = root / "original" / "answer_type_lookup.json"
        if not lookup_path.exists():
            return {}
        with open(lookup_path) as f:
            return json.load(f)
    ```

    The loader-side of `_load_samples` then consults this lookup per
    sample, counts every `(question, answer)` pair that misses it, and
    prints a loud `NOTE`/`WARNING` if the fallback count is non-zero —
    the same fail-loud principle as the length-mismatch guards in
    `metrics.py`. It also coerces `VQASample.answer` to `str` at
    construction, so the metrics never receive a non-string answer.

## E00 baseline — banked

With corrected labels, ran the full E00 baseline. **These are the
reference numbers every pruning experiment for the next 11 weeks gets
compared against:**

| Metric | Value |
|---|---|
| Dataset | VQA-RAD test (451 samples — 272 closed, 179 open) |
| Closed-ended accuracy | 0.537 |
| Open-ended recall | 0.340 |
| Overall accuracy | 0.459 |
| Mean latency | 842.5 ms / sample |
| Peak GPU memory | 14.86 GiB |

A note on the closed-ended number: it moved from a pre-fix 0.546 to
0.537, but these are **not comparable** — 0.546 was computed over a
heuristically-mislabeled set, 0.537 over the correct 272 closed
questions. The baseline didn't get worse; it became *honest*. A
correct 0.537 is a valid reference; a wrong 0.546 was not. Full E00
writeup is on the
[Experiments](../../experiments.md#e00-baseline-no-pruning-v15) page.

## Git initialised for the harness repo

Put `~/llava-med-pruning/` under version control: `git init`, identity
configured, `.gitignore` created (excludes `results/`, `__pycache__/`,
editor and OS noise — derived artifacts stay out of the code repo, and
the datasets live outside the folder entirely). The first commit
captures the full harness state and the E00 numbers in its message, so
`git log` will always show "this is where the harness stood end of
May 14" at a glance.

The repository is now also pushed to GitHub:
[github.com/Leokuan0208/llava-med-pruning](https://github.com/Leokuan0208/llava-med-pruning).

## Honest note on the day

Today *felt* unproductive — debugging doesn't leave the visible trail
that new code does. But the ledger is real: a verified-correct decode
path, a verified-correct model load, independent confirmation that the
harness matches the reference implementation, real `answer_type`
labels replacing a heuristic, and a trustworthy E00 baseline. This
morning all of those were open questions. A baseline you can't trust
is worthless to build on; a trustworthy 0.537 is a foundation.

---

## Pushed today

**Repository:** [`llava-med-pruning`](https://github.com/Leokuan0208/llava-med-pruning)
&nbsp;·&nbsp; **Commit:**
[`d7e310a`](https://github.com/Leokuan0208/llava-med-pruning/tree/d7e310a)
— "Update README to reflect functional harness state"

The linked commit shows the entire repository as it stood at the end
of today: the full evaluation harness (all 11 files, VQA-RAD path
complete; SLAKE and PathVQA loaders still stubs), with the README
updated to reflect that the harness is functional rather than
scaffold-only.
