import type { ProficiencyLevel, RoleArchetype } from "@prisma/client";
import { PROFICIENCY_LEVEL_SLUGS, ROLE_ARCHETYPE_SLUGS } from "@/lib/content/taxonomy";

/**
 * Bidirectional mapping between enum values and URL segments (task 5).
 * Every link in the app goes through these helpers rather than
 * hand-building a URL string, so a slug convention only has to change in
 * one place.
 */

const ROLE_SEGMENT_TO_ARCHETYPE: Record<string, RoleArchetype> = Object.fromEntries(
  Object.entries(ROLE_ARCHETYPE_SLUGS).map(([role, segment]) => [segment, role as RoleArchetype]),
);

const LEVEL_SEGMENT_TO_PROFICIENCY: Record<string, ProficiencyLevel> = Object.fromEntries(
  Object.entries(PROFICIENCY_LEVEL_SLUGS).map(([level, segment]) => [
    segment,
    level as ProficiencyLevel,
  ]),
);

/** Returns the matching `RoleArchetype`, or `null` for an unknown segment (route handlers call `notFound()`). */
export function parseRoleSegment(segment: string): RoleArchetype | null {
  return ROLE_SEGMENT_TO_ARCHETYPE[segment] ?? null;
}

/** Returns the matching `ProficiencyLevel`, or `null` for an unknown segment. */
export function parseLevelSegment(segment: string): ProficiencyLevel | null {
  return LEVEL_SEGMENT_TO_PROFICIENCY[segment] ?? null;
}

export function roleSegment(role: RoleArchetype): string {
  return ROLE_ARCHETYPE_SLUGS[role];
}

export function levelSegment(level: ProficiencyLevel): string {
  return PROFICIENCY_LEVEL_SLUGS[level];
}

export function roleUrl(role: RoleArchetype): string {
  return `/paths/${roleSegment(role)}`;
}

export function pathUrl(role: RoleArchetype, level: ProficiencyLevel): string {
  return `/paths/${roleSegment(role)}/${levelSegment(level)}`;
}

export function courseUrl(slug: string): string {
  return `/courses/${slug}`;
}

export function lessonUrl(slug: string): string {
  return `/lessons/${slug}`;
}

export function glossaryUrl(slug: string): string {
  return `/glossary/${slug}`;
}
