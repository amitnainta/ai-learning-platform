import { describe, expect, it } from "vitest";
import type { ProficiencyLevel, RoleArchetype } from "@prisma/client";
import {
  courseUrl,
  glossaryUrl,
  lessonUrl,
  levelSegment,
  parseLevelSegment,
  parseRoleSegment,
  pathUrl,
  roleSegment,
  roleUrl,
} from "../routes";

const ROLE_ARCHETYPES: RoleArchetype[] = [
  "TECHNICAL_BUILDER",
  "ENGINEERING_LEADER",
  "EXECUTIVE_NON_TECHNICAL",
  "INVESTOR",
  "NOT_SURE_YET",
];

const PROFICIENCY_LEVELS: ProficiencyLevel[] = ["ZERO_KNOWLEDGE", "INTERMEDIATE", "ADVANCED"];

describe("routes — enum <-> URL segment round-trip", () => {
  it("round-trips every RoleArchetype through its URL segment", () => {
    for (const role of ROLE_ARCHETYPES) {
      const segment = roleSegment(role);
      expect(parseRoleSegment(segment)).toBe(role);
    }
  });

  it("round-trips every ProficiencyLevel through its URL segment", () => {
    for (const level of PROFICIENCY_LEVELS) {
      const segment = levelSegment(level);
      expect(parseLevelSegment(segment)).toBe(level);
    }
  });

  it("returns null for an unknown role segment", () => {
    expect(parseRoleSegment("not-a-real-role")).toBeNull();
  });

  it("returns null for an unknown level segment", () => {
    expect(parseLevelSegment("not-a-real-level")).toBeNull();
  });

  it("builds a role URL", () => {
    expect(roleUrl("TECHNICAL_BUILDER")).toBe("/paths/technical-builder");
  });

  it("builds a path URL", () => {
    expect(pathUrl("TECHNICAL_BUILDER", "ZERO_KNOWLEDGE")).toBe(
      "/paths/technical-builder/zero-knowledge",
    );
  });

  it("builds a course URL", () => {
    expect(courseUrl("my-course")).toBe("/courses/my-course");
  });

  it("builds a lesson URL", () => {
    expect(lessonUrl("my-lesson")).toBe("/lessons/my-lesson");
  });

  it("builds a glossary URL", () => {
    expect(glossaryUrl("my-term")).toBe("/glossary/my-term");
  });
});
