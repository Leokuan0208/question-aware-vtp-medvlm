# Day 2 — Monday, May 18, 2026

[← Back to Week 2 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 2, Day 2 · **Day 9 of
the project**

---

No research today — used the day as a site cleanup pass. Went through
every page on the documentation site looking for things that bugged
me, and consolidated the fixes into two files. Modest in scope but
worth doing now while the early framing on the Project Overview page
was still loose; the site is the deliverable that gets shared with
the advisor and it needs to read cleanly.

## Site changes

### `docs/project.md` — Project Overview rewrite

The overview page hadn't been touched substantively since the
mid-Week-1 rewrite, and several things had drifted out of date:

- **Title block now uses a custom CSS class.** The page's H2 "Title"
  heading introduces the project name, and the project name itself
  was just bold body text. Switched to a `<p class="project-title">`
  wrapper so the name can be sized between H1 and H2 (1.75rem),
  matching the visual hierarchy of "section header → headline."
- **Related Work table expanded from 3 columns to 5.** The previous
  version was *paper · what it does · why it's relevant.* Replaced
  with *paper (with link) · authors · venue · institution · why it's
  relevant.* Two practical upsides: it's now legible at a glance who
  did each piece and where it was published, and the link goes to the
  official source (NeurIPS proceedings, OpenReview, ECVA, CVF Open
  Access) with arXiv only as a fallback for preprints.
- **Venues corrected.** PruMerge was attributed to "Shang et al.,
  2024" — actually ICCV 2025. SparseVLM was attributed to "2024" —
  actually ICML 2025 poster. Both had been bothering me since I
  noticed during the literature scan on May 17.
- **MedPruner added** (Liu et al., arXiv 2026, CUHK + Westlake) — the
  closest medical-domain prior art. 3D-focused but uses
  attention-based selection in a Medical VLM. The most directly
  comparable published method to ours, so it warrants explicit
  citation up front rather than buried in a later notes page.
- **Approach diagram restructured.** The previous flat Mermaid graph
  had thirteen nodes in a single horizontal flow, which read as a
  wall of boxes at the new wider content width. Reorganised into
  three named subgraphs — "Vision branch," "Text branch," and
  "LLaMA decoder (32 layers)" — with the cross-branch edges drawn
  between them. Conceptually the same diagram, visually much clearer
  about which pieces belong together.

### `docs/stylesheets/extra.css` — two additions

- **Widened the content area** from MkDocs Material's default 61rem
  max-width to 80rem (`.md-grid { max-width: 80rem; }`). The site had
  been feeling cramped — the comparison table on the Experiments
  page was scrolling horizontally even on a 1440p monitor, and the
  Mermaid diagrams were getting clipped. 80rem is enough headroom
  for the wide comparison table without pushing prose to
  uncomfortably-long line lengths.
- **Added `.project-title` class** for the Project Overview title
  block. Sized at 1.75rem with weight 700 (Inter), explicitly between
  the H2 (1.4rem) above it and the page H1 (1.85rem) at the top.

## Other notes from today

While doing the cleanup pass I cloned the repo to my **laptop** at
`D:\Project Website\question-aware-vtp-medvlm` so I can keep editing
the site while travelling for the next two days. Hit the same
PowerShell execution-policy gotcha from Day 3 of Week 1 and resolved
it with the same one-line fix:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Worth re-noting that this is a *per-user* setting on a *per-machine*
basis — `git config --global` syncs across machines via your git
credentials, but PowerShell execution policy is local and has to be
set once on each Windows install you work from.

## Honest ledger of the day

A cleanup day, not a research day. Two files changed, no new
results. The project overview is now in a state I'm not embarrassed
to send to the advisor — that's the value.

May 19 and May 20 are travel days; the plan is to spend them reading
papers on the plane and writing them up in `resources.md` rather
than coding. Pruning ablation results from the kr ∈ {0.50, 0.25,
0.10} sweep that launched at the end of Day 1 are still pending —
the server should be done by the time I'm back at the desk on
May 21, and that's the first thing to look at.

---

### Plan for the next two days (May 19-20, travel)

- [ ] **May 19** — Read FastV end-to-end (Chen et al., ECCV 2024).
      Focus on the `generate()` integration, which solves the
      decode-step mask coordination problem we hit on Day 1.
- [ ] **May 20** — Read MedPruner (Liu et al., 2026) and SwiftVLM
      (Qian et al., 2026). MedPruner is the closest medical-domain
      prior art; SwiftVLM's bypass paradigm is directly relevant to
      our open question of *where* in the LLaMA stack to prune.

---

## Pushed today

_No code push — site-only changes. Site changes deployed via the
documentation repo's normal `git push` workflow (the GitHub Actions
deploy then publishes to gh-pages within ~60 seconds)._
