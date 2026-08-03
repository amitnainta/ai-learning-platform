---
slug: how-machine-learning-works
title: How Machine Learning Actually Works
summary: A step-by-step, jargon-light walkthrough of how a model learns from data — what "training" means and why models get things wrong.
sourceType: ORIGINAL
roles: [TECHNICAL_BUILDER]
level: ZERO_KNOWLEDGE
format: ARTICLE
estimatedMinutes: 9
topics: [machine-learning, ai-fundamentals]
lastReviewedAt: 2026-06-01
---

The previous lesson said machine learning models "learn patterns from
examples" instead of following rules a person wrote. This lesson makes that
concrete: what does "learning" actually mean here, mechanically?

## The three ingredients

Every machine learning system needs three things:

1. **[Training data](glossary:training-data)** — examples of the task,
   usually with the correct answer attached. To teach a model to recognize
   spam email, you need a large pile of emails, each labeled "spam" or
   "not spam."
2. **A model** — a mathematical structure with a large number of adjustable
   internal values (called parameters, or sometimes weights). At the start,
   these values are essentially random, so the model's guesses are useless.
3. **An [algorithm](glossary:algorithm)** — a procedure for adjusting those
   internal values so the model's guesses get closer to correct over time.

## What "training" actually does

Training is a loop, repeated many times:

1. Show the model an example from the training data.
2. Let the model make a guess.
3. Compare the guess to the correct answer, and measure how wrong it was.
4. Nudge the model's internal values slightly in the direction that would
   have made this particular guess less wrong.
5. Repeat, often millions of times, across the whole training dataset,
   often many times over.

Each individual nudge is tiny. What makes this work is scale — enough
examples, and enough repetitions, that the model's internal values settle
into a configuration that produces good guesses across the whole range of
examples it's seen, and (if it worked) on new examples it hasn't seen too.

## This is [supervised learning](glossary:supervised-learning) — worth naming

The spam-detection example above is called supervised learning: every
training example comes with the correct answer attached ("this one is
spam"), and the training loop is explicitly trying to match it. It's the
most common and most intuitive category of machine learning, and it's what
most people picture when they picture "training a model." (Other categories
exist — models that find structure in unlabeled data, or that learn by
trial and error — but supervised learning is the right starting point.)

## Why models get things wrong

Once training is done, the model doesn't "know" the training examples the
way a person memorizes facts. It's captured statistical patterns from them.
That has two important consequences:

- **It generalizes, sometimes badly.** A well-trained model can often handle
  new examples it's never seen — that's the whole point. But it can also
  latch onto a pattern that happened to be true in the training data but
  isn't actually the real signal (a classic example: a model trained to spot
  wolves that actually learned to spot snow, because most of its wolf
  photos happened to have snowy backgrounds).
- **Its mistakes are probabilistic, not logical.** There's no line of code
  to point at and say "that's the bug." A model is wrong in proportion to
  how different a new example is from what it saw during training, which is
  exactly why testing AI systems on realistic, varied examples matters so
  much more than it does for traditional software.

Understanding this loop — data in, adjustable parameters, a training
procedure that nudges them — is the single most useful mental model for
everything that follows in this path, including how large language models
are trained.
