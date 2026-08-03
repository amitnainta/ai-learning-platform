---
slug: writing-effective-prompts
title: Writing Effective Prompts
summary: Five concrete techniques for getting more reliable output from an LLM, and why each one works given how these models actually generate text.
sourceType: ORIGINAL
roles: [TECHNICAL_BUILDER]
level: INTERMEDIATE
format: ARTICLE
estimatedMinutes: 9
topics: [prompt-engineering, large-language-models]
lastReviewedAt: 2026-06-05
---

The previous lesson explained that an LLM generates text by predicting the
most plausible next [token](glossary:token), given everything that came
before it — including your [prompt](glossary:prompt). Prompt engineering is
the practice of writing that input deliberately, so "everything that came
before" steers the model toward the output you actually want.

None of the techniques below are tricks or magic words. They all work for
the same underlying reason: they change what "plausible continuation" means
for the model, by changing the context it's continuing from.

## 1. Be specific about the output you want

"Summarize this article" is a valid prompt, but "Summarize this article in
three bullet points, each under 20 words, for someone who hasn't read it"
constrains the space of plausible continuations dramatically. The more
specific your description of the desired output — format, length, audience,
tone — the less room there is for the model to plausibly continue in a
direction you didn't want.

## 2. Show, don't just tell (few-shot examples)

If you want a specific format, showing one or two examples of input and the
exact output format you want, before your actual request, is often more
reliable than describing the format in words. This is called few-shot
prompting, and it works because the model is directly continuing a pattern
you've already established, rather than inferring one from a description.

## 3. Ask for reasoning before the answer

For anything involving multiple steps — math, logic, multi-part questions —
asking the model to work through its reasoning before stating a final answer
measurably improves accuracy on many tasks. This works because each token
the model generates becomes part of the context for the next one: reasoning
text written first gives the final answer a more constrained, more
carefully-built context to be "the plausible next token" from.

## 4. Give it permission to say "I don't know"

Left to its own devices, a model will usually generate _something_ rather
than nothing, even when it doesn't have a good answer — because generating
a plausible-sounding response is what it's optimized to do. Explicitly
including an instruction like "if you're not confident, say so" gives the
model a plausible continuation path that isn't a confident-sounding guess,
which measurably reduces [hallucination](glossary:hallucination) on
questions near the edge of what it actually knows.

## 5. Iterate — the first prompt is a draft

Treat your first attempt as a draft, not a final answer. If the output isn't
right, look at specifically what's wrong and add or adjust one constraint
at a time, rather than rewriting the whole prompt from scratch. This is
faster in practice than trying to write the perfect prompt up front, and it
builds the intuition for what each kind of instruction actually changes.

## A caution about fine-tuning versus prompting

All five techniques above work by changing the prompt — no retraining
involved. [Fine-tuning](glossary:fine-tuning) a model on your own examples
is a different, heavier technique for specialized cases, and it's worth
knowing the two are not interchangeable: prompting changes what you ask for
a given request; fine-tuning changes the model's underlying behavior across
all future requests. Start with prompting — it's nearly free to iterate on,
and it solves the large majority of real-world cases.
