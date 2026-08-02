---
slug: understanding-large-language-models
title: Understanding Large Language Models
summary: What an LLM actually is, how it generates text one piece at a time, and why that explains both its strengths and its most common failures.
sourceType: ORIGINAL
roles: [TECHNICAL_BUILDER, EXECUTIVE_NON_TECHNICAL]
level: INTERMEDIATE
format: ARTICLE
estimatedMinutes: 10
topics: [large-language-models, generative-ai]
lastReviewedAt: 2026-06-05
---

A [large language model](glossary:large-language-model) (LLM) — the
technology behind tools like ChatGPT, Claude, and Gemini — is, at its core,
doing something much narrower than it feels like from the outside: it's
predicting the next [token](glossary:token) in a sequence of text, over and
over, one piece at a time.

## "Predicting the next token" — what that means in practice

A token is a chunk of text, often a word or part of a word. Give an LLM the
text "The capital of France is," and it calculates, across its entire
vocabulary of possible tokens, which one is most likely to come next —
"Paris," almost certainly. It appends that token, then repeats the whole
calculation again for the next one, and the next, building a response one
piece at a time.

This sounds too simple to explain what these systems can do — write working
code, summarize a document, hold a coherent conversation across many turns.
The gap is bridged by scale: an LLM's "next token" predictions are shaped by
[parameters](glossary:parameter) — internal values, often numbering in the
hundreds of billions — tuned during training on enormous amounts of text. At
that scale, "predict the next word well" turns out to require capturing an
enormous amount about grammar, facts, reasoning patterns, and style.

## Why this explains LLM strengths

- **Fluency.** Because the model is directly optimized to produce
  plausible-sounding text, its output reads naturally almost by
  construction.
- **Breadth.** Trained on a huge and varied slice of written text, an LLM
  can plausibly continue text about nearly any topic that's well
  represented in that training data.
- **Few-shot adaptability.** Show an LLM a couple of examples of a pattern
  in your prompt, and it's often good at continuing that pattern — this is
  most of what makes prompt engineering (the next lesson in this course)
  work at all.

## Why this also explains LLM failures

- **[Hallucination](glossary:hallucination).** An LLM has no built-in mechanism
  for "I don't actually know this." If a plausible-sounding continuation is
  available, it will generate one — confidently — whether or not it's
  factually true. This is the single most important limitation to
  internalize: fluency is not the same thing as accuracy, and an LLM's
  confidence level in its own phrasing tells you nothing about whether it's
  correct.
- **No real "reasoning" in the human sense.** What looks like step-by-step
  reasoning is the model generating plausible reasoning-shaped text, which
  often lands on a correct answer but isn't guaranteed to, especially for
  problems that require exact calculation or genuinely novel logic.
- **Sensitivity to how a question is asked.** Because output is generated
  token by token based on everything that came before, the exact wording of
  a prompt can meaningfully change the result — which is why prompt
  engineering is a real, learnable skill rather than an afterthought.

## The practical takeaway

Treat an LLM as an extremely capable, extremely well-read collaborator who
will never say "I don't know" unless specifically prompted to consider that
possibility — and who should always be fact-checked on anything that
matters. Once you're used to that mental model, LLMs go from feeling like
magic (or feeling untrustworthy) to feeling like a specific, understandable
tool with specific, understandable failure modes.
