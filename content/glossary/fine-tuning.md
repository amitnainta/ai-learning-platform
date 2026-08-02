---
slug: fine-tuning
term: Fine-Tuning
shortDefinition: Further training an existing model on a smaller, specialized dataset to adapt its behavior.
aliases: []
relatedSlugs: [large-language-model, training-data]
lastReviewedAt: 2026-06-05
---

Fine-tuning is the process of taking an already-trained model and training
it further on a smaller, specialized dataset, to adapt its behavior for a
particular use case. It's a heavier, more involved technique than prompt
engineering: prompting changes what you ask of a model for a single
request, while fine-tuning changes the model's underlying behavior across
all future requests. Most real-world needs are met by prompting alone;
fine-tuning is reserved for cases that need consistent, specialized
behavior a prompt can't reliably produce.
