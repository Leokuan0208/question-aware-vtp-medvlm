# Question-Aware Visual Token Pruning for Medical VLMs — Progress Site

A static documentation site for a 12-week research project on
**question-conditioned visual token pruning** for medical
vision-language models. The baseline is
[LLaVA-Med](https://github.com/microsoft/LLaVA-Med); the project's
contribution is a pruning module on top of it.

Built with [MkDocs](https://www.mkdocs.org/) and the
[Material](https://squidfunk.github.io/mkdocs-material/) theme. You
write progress in Markdown files; MkDocs turns them into a website; and
GitHub Pages hosts it for free.

---

## What's in this folder

```
question-aware-vtp-medvlm/
├── mkdocs.yml                    # site configuration (nav, theme)
├── requirements.txt              # Python packages needed to build
├── README.md                     # this file
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml            # auto-deploys site on every git push
└── docs/                         # ALL YOUR CONTENT LIVES HERE
    ├── index.md                  #   home page
    ├── project.md                #   research question, plan, hypothesis
    ├── setup.md                  #   LLaVA-Med baseline install notes
    ├── experiments.md            #   pruning experiments and results
    ├── bugs.md                   #   bug log
    ├── resources.md              #   papers, code, datasets
    ├── weekly/
    │   ├── index.md              #     12-week timeline overview
    │   └── week-01/              #     everything for week 1
    │       ├── index.md          #       week 1 overview (summary per day)
    │       ├── day-01.md         #       one detail page per working day
    │       ├── day-02.md
    │       └── ...
    ├── stylesheets/extra.css     # custom colours/fonts (rarely touched)
    └── javascripts/mathjax.js    # math rendering (rarely touched)
```

The only files you'll edit day-to-day are the `.md` files inside `docs/`.

---

## One-time setup (Windows PowerShell)

### Prerequisites

- **Python 3.9 or newer** — check with `python --version`
- **Git** — check with `git --version`
- A **GitHub account** — you have one: `Leokuan0208`

### Step 1 — Install MkDocs

Open PowerShell, navigate to this folder, and run:

```powershell
# Create an isolated Python environment.
python -m venv .venv

# Activate it. (Your prompt should show "(.venv)" once this works.)
.venv\Scripts\Activate.ps1

# Install MkDocs and the Material theme.
pip install -r requirements.txt
```

Verify with `mkdocs --version`.

### Step 2 — Preview locally

```powershell
mkdocs serve
```

Open <http://127.0.0.1:8000>. Edit any `.md` file, save, the page
auto-reloads. `Ctrl+C` to stop.

### Step 3 — Push to GitHub

1. Create an empty public repository at
   <https://github.com/new> with name **`question-aware-vtp-medvlm`**.
   Don't tick any of the "initialise with" boxes.

2. In PowerShell, from this folder:

   ```powershell
   git init
   git add .
   git commit -m "Initial commit: documentation site scaffold"
   git branch -M main
   git remote add origin https://github.com/Leokuan0208/question-aware-vtp-medvlm.git
   git push -u origin main
   ```

3. On GitHub: repo → **Actions** tab → wait for "Deploy MkDocs site"
   to finish (~1 minute, green checkmark).

4. Repo → **Settings → Pages** → **Source: Deploy from a branch**,
   branch **`gh-pages`**, folder **`/ (root)`**. Save.

5. Refresh after 30 seconds — your site is live at
   **<https://leokuan0208.github.io/question-aware-vtp-medvlm/>**.

---

## Day-to-day workflow

```powershell
# Optional: live preview while editing.
.venv\Scripts\Activate.ps1
mkdocs serve

# After editing markdown files, publish:
git add docs/
git commit -m "Week 1, Day 4: documented CLI bug reproduction"
git push
```

A minute later the public site updates. You can also edit files
directly on github.com (pencil icon on any file) — useful from a phone.

---

## Adding a new weekly log

Each week is a folder `week-NN/` containing an **overview page**
(`index.md`, a short summary of every day) plus one **detail page per
working day** (`day-01.md`, `day-02.md`, …).

1. Create the folder `docs/weekly/week-02/` with an `index.md` (the
   overview) and a `day-0X.md` page per working day. The quickest path
   is to copy the `week-01/` folder and edit.
2. In `mkdocs.yml`, find the `Weekly Log:` section and add the week as
   a nested block — the `index.md` overview goes **first** so it
   becomes the clickable section index (this is why the week label in
   the sidebar is clickable):

   ```yaml
       - Weekly Log:
           - weekly/index.md
           - Week 1:
               - weekly/week-01/index.md
               - weekly/week-01/day-01.md
               # ...
           - Week 2:                          # <-- new block
               - weekly/week-02/index.md
               - weekly/week-02/day-01.md
   ```

3. Update the row for that week in `docs/weekly/index.md`.

## Adding a new experiment

Open `docs/experiments.md`, copy the template at the bottom, paste it
above the most recent experiment, bump the ID (`E01` → `E02` → ...),
fill it in.

---

## Markdown crash-course

```markdown
# Heading 1
## Heading 2

**bold**, *italic*, `inline code`.

- bulleted item
1. numbered item
- [x] done · [ ] not done

[link text](https://example.com)
![image alt](path/to/img.png)

​```python
def hello():
    print("hi")
​```

!!! note "Title"
    Styled callout. Other types: tip, warning, danger, example, quote.

<span class="pill pill--done">Done</span>
<span class="pill pill--wip">In progress</span>
<span class="pill pill--blocked">Blocked</span>

Math:  $E = mc^2$       or       $$\\mathcal{L} = -\\sum_i y_i \\log \\hat{y}_i$$

​```mermaid
flowchart LR
  A --> B
​```
```

More: <https://squidfunk.github.io/mkdocs-material/reference/>

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `mkdocs: command not found` | venv not active — run `.venv\Scripts\Activate.ps1` |
| `Activate.ps1` blocked by execution policy | Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` once, type Y, retry |
| Site looks unstyled after deploy | `site_url` in `mkdocs.yml` doesn't match your real Pages URL |
| Actions deploy fails | Open the failed run on GitHub, read the log — usually a YAML typo |
| Math / diagrams not rendering in `mkdocs serve` | Push to GitHub and check the live site; external scripts load there |
