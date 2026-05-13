# Bugs & Issues

A running log of bugs encountered during the project. Each entry uses
the same template so they're easy to scan, and — importantly —
documents the **full troubleshooting trail**, not just the final fix.
Bug-hunts are part of the research record; later-me will want to know
what hypotheses were eliminated, not just the answer.

---

## #1 — `llava.serve.cli` stops generation immediately for the Mistral variant

<span class="pill pill--done">Patched locally</span>

**Found** May 11, 2026 &nbsp; · &nbsp; **Severity** Moderate (works only
with a one-line patch) &nbsp; · &nbsp; **Upstream status** _not yet
filed — patch ready, planning a PR to `microsoft/LLaVA-Med`_

### What I observed

When running `llava.serve.cli` against `llava-med-v1.5-mistral-7b`, the
model emitted effectively one token per turn — a single word or
fragment, then immediately stopped. The CLI looped and accepted the
next user input, but every response was truncated to a single token.

Direct inference outside the CLI returned coherent paragraphs, so the
model and weights were fine; the bug was in the CLI's generation
path.

### How to reproduce it (pre-fix)

```bash
cd ~/LLaVA-Med

python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png \
    --conv-mode mistral_instruct
```

**Expected** — a coherent paragraph describing the image.

**Actual** — a single word (or one short token), then the CLI re-prompts
for the next user input.

### Root cause (summary)

In `llava/serve/cli.py`, inside the main `while True:` loop, the
stopping criterion is built with:

```python
stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
keywords = [stop_str]
stopping_criteria = KeywordsStoppingCriteria(keywords, tokenizer, input_ids)
```

For the `mistral_instruct` template, the conversation object has
`sep_style = SeparatorStyle.LLAMA_2`, `sep = ''`, and `sep2 = '</s>'`.
Because `LLAMA_2 != TWO`, the conditional picks `conv.sep` — the
empty string. So `stop_str = ''` and `keywords = ['']`.

`KeywordsStoppingCriteria` then halts generation after the very first
token, because the empty string is trivially contained in any decoded
prefix. The "single-token output" symptom is really the model being
interrupted at step 1.

### Fix (applied locally, May 11 2026)

One-line change in `llava/serve/cli.py`:

```diff
- stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
+ stop_str = conv.sep2 if conv.sep_style in (SeparatorStyle.TWO, SeparatorStyle.LLAMA_2) else conv.sep
```

The new conditional picks `sep2` for both LLAMA-2-family separator
styles (which keep the real terminator in `sep2` and leave `sep`
empty), and falls back to `sep` for everything else. After applying,
the CLI returns full multi-token responses for
`llava-med-v1.5-mistral-7b`, and multi-turn conversation works as
expected.

### Troubleshooting trail

Documenting every hypothesis that was tried and eliminated, in order.
This is what makes the bug-hunt re-runnable and what makes the eventual
root cause believable — a one-line fix that comes after eight failed
hypotheses is much more credible than a one-line fix that comes out of
nowhere.

#### Step 1 — Symptom triage

The first observation was simply that `llava.serve.cli` produced
single-word answers. The two highest-prior hypotheses for "VLM emits
EOS immediately" are: (a) the chat template is wrong for this base
model, or (b) the model weights are partially loaded / corrupted.

Decided to eliminate (a) first because it's cheaper to test.

#### Step 2 — Force the conv-mode flag

Re-ran the CLI with the conv-mode override matching the model's base
LM:

```bash
python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png \
    --conv-mode mistral_instruct
```

**Result:** still single-word output. Hypothesis (a) not yet
eliminated — the CLI sometimes prints a warning when it overrides a
user-supplied `--conv-mode` flag, so the flag may have been silently
ignored.

#### Step 3 — Verify the flag actually took effect

Captured the first 30 lines of CLI output to look for any "auto
inferred conversation mode" warnings:

```bash
python -m llava.serve.cli \
    --model-path /data/dan/weights/llava-med-v1.5-mistral-7b \
    --image-file ./llava/serve/examples/bio_patch.png \
    --conv-mode mistral_instruct 2>&1 | head -30
```

**Result:** no override warnings in the output — but the CLI doesn't
necessarily print one. Inconclusive.

#### Step 4 — Enumerate available conv templates

```python
python -c "
from llava.conversation import conv_templates
for name, conv in conv_templates.items():
    print(f'{name}: sep_style={conv.sep_style}, roles={conv.roles}')
"
```

Confirmed `mistral_instruct` exists with
`sep_style=SeparatorStyle.LLAMA_2, roles=('USER', 'ASSISTANT')`, which
matches the Mistral chat format. Right template, right name — so the
flag *should* have been correct. Hypothesis (a) still unresolved.

#### Step 5 — Bypass the chat template entirely

Wrote a small pure-text generation script that loads the model with
`load_pretrained_model` and asks the LM to continue the sentence
`"The chest X-ray shows"`. No conversation template, no image, no
stopping criteria — just raw `model.generate(...)`.

This isolates "is the model healthy?" from "is the prompt construction
broken?"

**First attempt** crashed because `model.generate(**inputs,
max_new_tokens=80, do_sample=False)` was called with keyword args, but
LLaVA-Med's custom `generate()` expects `input_ids` as a positional
argument named `inputs`. The keyword passing put `None` into that
slot.

This was an instructive miss — it shows LLaVA-Med has a heavily
customized `generate()` method, exactly the kind of code that can cause
the single-word issue.

**Fixed script:**

```python
import torch
from llava.model.builder import load_pretrained_model
from llava.mm_utils import get_model_name_from_path

model_path = "/data/dan/weights/llava-med-v1.5-mistral-7b"
model_name = get_model_name_from_path(model_path)
print(f"Detected model name: {model_name}")

tokenizer, model, image_processor, context_len = load_pretrained_model(
    model_path=model_path, model_base=None, model_name=model_name,
)

prompt = "The chest X-ray shows"
input_ids = tokenizer(prompt, return_tensors="pt").input_ids.to("cuda")

with torch.inference_mode():
    output = model.generate(
        input_ids,
        max_new_tokens=80,
        do_sample=False,
        images=None,
    )

print(tokenizer.decode(output[0], skip_special_tokens=False))
```

**Result:** detected model name was `llava-med-v1.5-mistral-7b`
(correct), and the output was a coherent multi-sentence continuation.
**Model and weights are healthy.** Hypothesis (b) eliminated.

Combined conclusion: the bug is **in the CLI's prompt-construction or
stopping-criterion path**, not in the model.

#### Step 6 — Read the CLI source

Opened `~/LLaVA-Med/llava/serve/cli.py`. The first interesting block
was the conv-mode selection at the top of `main()`:

```python
if 'llama-2' in model_name.lower():
    conv_mode = "llava_llama_2"
elif "v1" in model_name.lower():
    conv_mode = "llava_v1"
elif "mpt" in model_name.lower():
    conv_mode = "mpt"
else:
    conv_mode = "llava_v0"
conv_mode = "mistral_instruct"   # ← unconditional override
```

The unconditional reassignment at the bottom looks suspicious — but on
closer reading, it actually *helps* us: regardless of what the if/elif
chain picks, `conv_mode` ends up as `"mistral_instruct"`. So the
conv-mode is definitely right.

#### Step 7 — Render the prompt explicitly

Wrote a small script using the same `conv_templates["mistral_instruct"]`
to construct the prompt the CLI would build:

```python
from llava.conversation import conv_templates
from llava.constants import DEFAULT_IMAGE_TOKEN

conv = conv_templates["mistral_instruct"].copy()
conv.append_message(conv.roles[0], DEFAULT_IMAGE_TOKEN + "\nDescribe this medical image.")
conv.append_message(conv.roles[1], None)
print(repr(conv.get_prompt()))
print(f"sep_style: {conv.sep_style}")
print(f"sep: '{conv.sep}'")
print(f"sep2: '{conv.sep2}'")
```

**Result:**

```
'[INST] <image>\nDescribe this medical image. [/INST]'
sep_style: SeparatorStyle.LLAMA_2
sep: ''
sep2: '</s>'
```

The prompt format is exactly what Mistral expects. Empty system
message is fine for Mistral. **Prompt construction is correct.**

But this is the moment the offending values become visible: `sep` is
the empty string. That's not yet known to be a problem — it just stands
out as unusual.

#### Step 8 — Hypothesis: missing BOS token

Mistral expects `<s>` (BOS, id=1) at the start of every conversation.
The rendered prompt starts with `[INST]`, not `<s>[INST]`. LLaVA's
`tokenizer_image_token` (which the CLI uses to handle the `<image>`
placeholder) sometimes doesn't add BOS.

If BOS is missing, Mistral often produces immediate EOS, which would
match the symptom.

Wrote a tokenization test:

```python
from llava.mm_utils import tokenizer_image_token
from llava.constants import IMAGE_TOKEN_INDEX
ids = tokenizer_image_token(prompt, tokenizer, IMAGE_TOKEN_INDEX, return_tensors="pt")
print("First token:", ids[0].item(), "(BOS would be 1)")
```

**Did not get to fully test this** because Step 9 revealed the real
issue, and the BOS hypothesis became moot. (Still worth verifying
later out of curiosity, but not necessary to fix the bug.)

#### Step 9 — Re-read the CLI's generation loop

Asked for the full body of the `while True:` loop in `cli.py`. The
relevant fragment:

```python
prompt = conv.get_prompt()
input_ids = tokenizer_image_token(prompt, tokenizer, IMAGE_TOKEN_INDEX,
                                  return_tensors='pt').unsqueeze(0).to(model.device)
stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
keywords = [stop_str]
stopping_criteria = KeywordsStoppingCriteria(keywords, tokenizer, input_ids)
streamer = TextStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
with torch.inference_mode():
    output_ids = model.generate(
        input_ids,
        images=image_tensor,
        do_sample=True if args.temperature > 0 else False,
        temperature=args.temperature,
        max_new_tokens=args.max_new_tokens,
        streamer=streamer,
        use_cache=True,
        stopping_criteria=[stopping_criteria])
```

The line

```python
stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
```

combined with the template diagnostics from Step 7

```
sep_style: SeparatorStyle.LLAMA_2   (≠ TWO)
sep: ''
sep2: '</s>'
```

gives `stop_str = ''`, and `keywords = ['']`. The `KeywordsStoppingCriteria`
fires when any keyword is contained in the decoded prefix — and the
empty string is contained in any string. So the criterion triggers at
step 1, and the model halts after generating its first token.

**Root cause confirmed.** Everything before this point — the bypass
test, the prompt rendering, the BOS check — was consistent with this
explanation in retrospect.

#### Step 10 — Apply the fix

Replaced the offending line:

```diff
- stop_str = conv.sep if conv.sep_style != SeparatorStyle.TWO else conv.sep2
+ stop_str = conv.sep2 if conv.sep_style in (SeparatorStyle.TWO, SeparatorStyle.LLAMA_2) else conv.sep
```

The new logic is: for separator styles in the LLAMA-2 family (TWO and
LLAMA_2), the real terminator lives in `sep2`; for everything else,
use `sep`. This restores correct stopping for `mistral_instruct`
without breaking the older Vicuna-based templates whose `sep` is
non-empty.

Re-ran the CLI: full multi-paragraph responses, correct turn
termination, multi-turn conversation works. ✓

### Notes

- The bug only manifests for templates where `sep == ''`. Older
  LLaVA-Med v1.0 (Vicuna-based) used templates where `sep` was the
  real terminator and `SeparatorStyle.TWO` was the right special case
  — which is presumably why the original conditional was written that
  way and never caught. The Mistral migration in v1.5 introduced the
  empty-`sep` case without updating the CLI.
- Worth checking whether downstream LLaVA-derived forks inherited the
  same logic.
- Lessons for next time:
    - **Bypass the suspect path early.** Step 5 (the pure-text bypass)
      eliminated half the hypothesis space in one experiment. The
      earlier you isolate "is the *core thing* healthy", the faster
      you can localise the bug.
    - **Read the source, don't guess.** Steps 6–9 were where the bug
      actually got found. The first five steps were necessary to know
      *where* to read, but the fix only materialised once the full
      `while True:` loop was on screen.
    - **Diagnostic prints are cheap; add them.** A single
      `print(repr(prompt), stop_str, keywords)` in the CLI would have
      surfaced the empty-string stop_str instantly. Worth adding to a
      standard debug-instrumentation playbook.

### Upstream

- [ ] Filed as a GitHub issue on `microsoft/LLaVA-Med` → _link_
- [ ] Pull request opened → _link_
- [ ] PR merged → _date_

---

## Template for new bug entries

Copy the block below, paste it above the previous bug, and renumber.

```markdown
## #N — Short title

<span class="pill pill--wip">In progress</span>

**Found** _date_ · **Severity** _x_ · **Upstream status** _x_

### What I observed
### How to reproduce it
### Root cause (summary)
### Fix
### Troubleshooting trail
   #### Step 1 — ...
   #### Step 2 — ...
### Notes
### Upstream
- [ ] Issue filed
- [ ] PR opened
- [ ] Merged
```
