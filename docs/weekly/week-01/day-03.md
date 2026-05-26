# Day 3 — Tuesday, May 12, 2026

[← Back to Week 1 overview](index.md)

**Phase 1 of 7** (Baseline & Literature) · Week 1, Day 3 · **Day 3 of the project**

---

A tooling day — set up this documentation site and started the
literature reading list.

## Documentation site setup

Set up this site locally with MkDocs + Material:

- Picked the colour palette and the page structure (home, project
  overview, baseline, experiments, weekly log, bugs, resources).
- Got `mkdocs serve` running on `http://127.0.0.1:8000` for live local
  preview.
- Started a reading list for the visual-token-pruning literature
  (ToMe, FastV, PruMerge, SparseVLM, GAP) and dropped them into
  [Resources](../../resources.md).

## The PowerShell execution-policy gotcha

`.venv\Scripts\Activate.ps1` silently failed at first, and
`pip install -r requirements.txt` went to the system Python instead of
the virtual environment. Fixed by running:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

in PowerShell and then re-activating the venv. Worth remembering: on
Windows, a venv that won't activate is almost always the execution
policy, not the venv itself.
