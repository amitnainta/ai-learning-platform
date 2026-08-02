---
slug: explainability
term: Explainability
shortDefinition: How well a model's decision can be understood and justified in human-readable terms.
aliases: ["interpretability"]
relatedSlugs: [bias]
lastReviewedAt: 2026-06-12
---

Explainability describes how well a model's decision can be understood and
justified in human-readable terms. Simple models (like a decision tree) are
often naturally explainable; large neural networks generally are not, and
their decisions typically can't be reduced to a short list of readable
rules. Explainability requirements should scale with the stakes of the
decision — low for a low-stakes recommendation, high for anything that
meaningfully affects a person's life.
