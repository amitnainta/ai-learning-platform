# AI Learning Platform — MVP Requirements

_Prepared: July 25, 2026. Step 3 of the project process (Brainstorm → Research → **MVP Requirements** → Roadmap → Detailed Requirements → Non-Functional Requirements). Builds directly on `01_market_research_findings.md`._

## 1. Vision

A free website that teaches people artificial intelligence through a learning path personalized to both their current knowledge level and their professional role, drawing on a hybrid of original framing content and curated best-of-web resources, with a built-in rating and feedback loop that keeps the curation honest over time. The primary audience is people already in technology or moving into it; a zero-knowledge on-ramp is supported but not the platform's center of gravity.

## 2. MVP Personas

Personas are organized as a role axis (which flagship archetype someone identifies with) crossed with a level axis (zero-knowledge, intermediate, advanced). Not every cell in the matrix needs equally deep content at launch, but every persona needs at least a usable path at their level.

**Technical Builder** (software engineer, software architect). At zero-knowledge, this is someone moving into a technical AI role from adjacent work and needs foundational concepts plus a runway into hands-on tooling. At intermediate, it's a working engineer adding AI/ML skills to an existing technical base. At advanced, it's an engineer or architect who wants deep technical mastery: model behavior, fine-tuning, retrieval, evaluation, and how to architect AI into production systems.

**Engineering Leader** (IT project manager, senior director of software delivery). At zero-knowledge, this is a leader without a technical background who needs enough literacy to manage AI-adjacent work credibly. At intermediate, it's someone who understands the technical basics and needs practically-oriented material: scoping AI projects, vendor/tool evaluation, timelines, and risk. At advanced, it's a leader driving AI adoption across teams and needing organizational and capability-building frameworks.

**Executive / Non-Technical** (president of a software/hardware organization, CEO). At zero-knowledge, this is plain-language, business-impact-first content with no assumed technical background — research shows this persona benefits most from strategic framing over mechanics. At intermediate, it's decision frameworks: build vs. buy, where AI creates real advantage, how to talk to the board about it. At advanced, it's governance, competitive strategy, and organizational risk.

**Investor**. This persona is distinct enough from generic executives to warrant its own path (confirmed in research — dedicated VC/PE AI-evaluation programs exist and use different content than internal-facing executive training). Content centers on evaluating AI startups and claims, technical and market due diligence, and sizing genuine AI-driven advantage vs. hype, across zero-knowledge through advanced depth.

A general **zero-knowledge / "just curious"** entry point exists as a landing state for anyone who doesn't identify with a role yet or has no IT background at all — it funnels into whichever role path fits once they're oriented, rather than being a fifth permanent persona.

## 3. Core User Journeys

**Discovery and signup.** A visitor lands on the site, understands the value proposition (personalized, free, role-aware AI learning), and creates an account.

**Placement.** The new user selects a role archetype (or "not sure yet") and takes a short, fixed-length diagnostic quiz that estimates their level. The system recommends a starting path; the user can override the suggested role or level manually.

**Learning.** The user progresses through their path's modules and courses, a mix of original short-form lessons and links out to curated external resources, each tagged with estimated time and format. Progress is tracked and resumable.

**Rating and feedback.** At any point after starting a course, and prompted at completion, the user can rate that individual course (stars + optional text) and, on finishing a path, rate the path as a whole (stars + optional text covering sequencing, relevance, and difficulty fit).

**Certification.** On completing a course or full path, the user receives a free certificate reflecting what they completed.

**Free exploration.** Independent of their assigned path, users can search and browse the full content library by topic, level, role tag, and format, and can bookmark items for later.

## 4. MVP Feature Scope

**In scope.** User accounts with profile (selected role, level, progress); the diagnostic placement quiz (fixed-length, not fully adaptive — mapped to level and role); four flagship role-based paths, each spanning the three levels; hybrid content model combining original "spine" lessons with curated, tagged links to external resources; per-course and per-path rating with star score and free-text feedback; a progress dashboard with resume-where-you-left-off; free completion certificates per course and per path; full-library search and filtering by role, level, topic, format, and duration; a plain-language AI glossary linked contextually throughout lessons; a lightweight content tagging and versioning system on the admin side so curated links and original content can be reviewed and refreshed on a defined cadence; and a basic admin/curation workflow for adding, editing, and retiring content. The site is a responsive web app (desktop and mobile browser); no native mobile apps in MVP.

**Explicitly out of scope for MVP, deferred to later phases.** Full adaptive/IRT-style testing (fixed-length diagnostic is sufficient for launch); an AI chat tutor/assistant; discussion forums or peer Q&A; the full long-tail role list beyond the four flagship archetypes; native iOS/Android apps; deeper gamification such as points economies or leaderboards (basic streaks/completion badges are in scope, competitive gamification is not); any paid tier or monetization; employer/team accounts and enterprise reporting; multi-language localization; and live cohort or mentor-led sessions. These are natural candidates for the roadmap phase rather than requirements to drop.

## 5. Success Metrics

Given free MOOCs average only 5-15% completion industry-wide, with irrelevance and difficulty as leading dropout causes, the metrics below should be read against that baseline rather than against paid-course benchmarks. Suggested MVP metrics: percentage of signups that complete the diagnostic placement flow; activation rate (percentage completing at least one course within their first session or first week); course and path completion rates, with a target of meaningfully beating the 5-15% free-MOOC baseline given the role-relevance and short-unit design choices this platform is built around; average course and path star rating; 30-day return rate; certificates issued; and a content-health metric such as percentage of tagged content reviewed within its defined refresh cadence.

## 6. Content Operations Model

The hybrid content model needs a lightweight but real operating process behind it, not just a content list. Every content item (original or curated) should be tagged with role, level, topic, format, estimated duration, and source type. Curated external links, being the faster-decaying half of the hybrid model, should carry a defined review cadence (informed by the research finding that AI curricula risk going stale within roughly 8-12 weeks for fast-moving specifics); original spine content, being conceptual and role-framing rather than tool-specific, can be reviewed on a longer cycle. Ratings and text feedback should feed back into this process directly — a course whose rating drops or whose feedback flags it as outdated should be surfaced for curator review rather than sitting silently in a path.

## 7. Open Items Carried Into the Roadmap Phase

A few decisions are intentionally left for the roadmap step rather than settled here: the exact sequencing of which of the four flagship paths ships first (likely Technical Builder and Executive/Non-Technical first, given they anchor the two ends of the audience spectrum, with Engineering Leader and Investor following), whether the diagnostic quiz ships at MVP launch or immediately after (it's listed in scope, but it's reasonable to sequence it as an early fast-follow if timeline pressure emerges), and how much of the admin/curation tooling is manual-first (e.g., a spreadsheet-backed process) versus a built admin UI at launch.
