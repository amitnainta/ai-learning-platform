---
slug: bias
term: Bias (in AI)
shortDefinition: Systematic, unfair skew in a model's predictions, usually inherited from patterns in its training data.
aliases: []
relatedSlugs: [explainability, training-data]
lastReviewedAt: 2026-06-12
---

Bias, in an AI context, is systematic, unfair skew in a model's
predictions — usually because the [training data](glossary:training-data)
itself reflected historical or social patterns the model then learned to
reproduce. Bias isn't reliably fixed by removing an obviously sensitive
field from the input data, because models can reconstruct that information
indirectly from correlated signals. Addressing it requires actively testing
outputs across affected groups, not just trusting the input data was
"clean."
