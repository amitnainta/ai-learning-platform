---
slug: ai-strategy-fundamentals
title: AI Strategy Fundamentals
summary: A framework for deciding where AI is actually worth investing in your organization, and where it's a distraction.
sourceType: ORIGINAL
roles: [EXECUTIVE_NON_TECHNICAL]
level: INTERMEDIATE
format: VIDEO
estimatedMinutes: 12
topics: [ai-strategy, ai-business-value]
lastReviewedAt: 2026-06-10
# FR-PATH-005 / decision #4: this is the R1 pack's designated video lesson.
# The block below is intentionally commented out — the pack ships no video
# URL at all, live or placeholder (Risks/open questions #3, PLAN.md), so no
# page renders a broken or empty <video> element. <LessonVideo> renders
# nothing while this stays commented out (see its component test).
#
# TODO(manual-provisioning): record this lesson, generate WebVTT captions,
# upload both to Vercel Blob, then uncomment the block below with the real
# CDN URLs and re-run `npm run content:check` / `npm run content:import`.
# See docs/runbooks/provisioning-checklist.md.
#
# video:
#   url: "https://example-blob.vercel-storage.com/ai-strategy-fundamentals.mp4"
#   captionsUrl: "https://example-blob.vercel-storage.com/ai-strategy-fundamentals.vtt"
#   posterUrl: "https://example-blob.vercel-storage.com/ai-strategy-fundamentals-poster.jpg"
#   durationSeconds: 720
---

Every organization eventually asks some version of "should we be doing more
with AI?" This lesson is a framework for answering that question well,
instead of either chasing every headline or dismissing AI as hype.

## Start with the problem, not the technology

The single most common mistake in AI strategy is starting from "we should
use AI" and searching for a place to apply it. Flip it around: start from
your organization's actual bottlenecks — the slow processes, the expensive
manual work, the decisions currently made on incomplete information — and
ask, for each one, whether AI is plausibly a better tool than the
alternatives (better process design, more staff, simpler automation). Often
it isn't. That's a useful answer, not a failure.

## A simple filter: data, stakes, and tolerance for error

For any candidate AI use case, three questions do most of the work:

1. **Do you actually have the data?** AI systems, especially machine
   learning ones, need relevant data to work from. "We'll figure out the
   data later" is the most common reason AI projects stall.
2. **What are the stakes if it's wrong?** A recommendation engine suggesting
   the wrong product is low-stakes. An AI system influencing a hiring or
   lending decision is extremely high-stakes, and needs a completely
   different level of oversight, testing, and human review before you'd
   trust it. Match your investment in safeguards to the actual stakes.
3. **What's your tolerance for the kind of errors AI makes?** AI systems
   fail probabilistically and unpredictably, not like traditional software
   bugs (see the "How Machine Learning Actually Works" lesson if you want
   the mechanics). A use case that can absorb occasional, hard-to-predict
   mistakes is a good candidate. One that can't, isn't — at least not
   without a human reliably in the loop.

## Measuring [ROI](glossary:roi), honestly

AI initiatives are often justified with projected savings that never quite
materialize, because the calculation leaves out real costs: the cost of
data preparation, of building trust and adoption internally, of the ongoing
work required to keep a model accurate as the world changes around it (this
is why the Advanced level of this path covers MLOps and responsible AI
practices — running an AI system well is not a one-time project). A
credible ROI case accounts for all of it, not just the optimistic upside.

## Choosing your first [use case](glossary:use-case)

If your organization is early in its AI journey, resist the temptation to
start with the most ambitious idea on the list. Choose a use case where:
data is genuinely available, the stakes of an occasional wrong answer are
low, and success is measurable within a few months. A modest early win that
actually ships builds the internal credibility (and the practical lessons)
that make the next, more ambitious use case more likely to succeed.

The next lesson in this course looks at how to communicate AI's business
value in terms that hold up to real scrutiny.
