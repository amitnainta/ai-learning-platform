import type { ContentFormat, ProficiencyLevel, RoleArchetype, SourceType } from "@prisma/client";
import {
  CONTENT_FORMAT_LABELS,
  PROFICIENCY_LEVEL_LABELS,
  ROLE_ARCHETYPE_LABELS,
  SOURCE_TYPE_LABELS,
} from "@/lib/content/taxonomy";

/**
 * FR-PATH-004: renders an item's role(s), level, topic(s), format,
 * estimated duration, and source type as a definition list — machine
 * readable and sensible to a screen reader (task 18).
 */

export interface TaggedContentItem {
  roles: RoleArchetype[];
  level: ProficiencyLevel;
  format: ContentFormat;
  sourceType: SourceType;
  estimatedMinutes: number;
  topics: { slug: string; label: string }[];
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wide text-[var(--color-text-muted)] uppercase">
        {label}
      </dt>
      <dd className="text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

export function TagList({ item }: { item: TaggedContentItem }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
      <Tag label="Role" value={item.roles.map((role) => ROLE_ARCHETYPE_LABELS[role]).join(", ")} />
      <Tag label="Level" value={PROFICIENCY_LEVEL_LABELS[item.level]} />
      <Tag label="Format" value={CONTENT_FORMAT_LABELS[item.format]} />
      <Tag label="Duration" value={`${item.estimatedMinutes} min`} />
      <Tag label="Source" value={SOURCE_TYPE_LABELS[item.sourceType]} />
      <Tag label="Topics" value={item.topics.map((topic) => topic.label).join(", ") || "—"} />
    </dl>
  );
}
