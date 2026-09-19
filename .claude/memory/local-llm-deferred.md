---
name: local-llm-deferred
description: LM Studio analysis and reporting is planned for Better Tracker but deliberately not scaffolded yet
metadata:
  type: project
---

Local-LLM analysis and reporting via LM Studio is an intended future feature. On
2026-09-09 the decision was to build **nothing** for it yet — no client module, no
settings key, no health check.

**Why:** the reporting requirements are not specified, and a stub written now would be
guessing at the shape of them.

**How to apply:** don't add an LM Studio client speculatively. When the first analysis
feature is actually specified, the seam is the API: add a route in `apps/api/src/routes/`
that reads through the repo layer and calls LM Studio's OpenAI-compatible endpoint at
`http://localhost:1234/v1`. The log data it would summarise is already stored and served.

Related: [[stack-decisions]]
