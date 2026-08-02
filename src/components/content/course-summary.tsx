import Link from "next/link";
import { courseUrl } from "@/lib/content/routes";

/**
 * Course title, summary, item count, and summed estimated duration —
 * shared by the path page and the course page so the two can never
 * disagree (task 23). No duration column on `Course` (Prisma schema
 * design): duration is always summed from items at read time.
 */
export interface CourseSummaryData {
  slug: string;
  title: string;
  summary: string;
  items: { estimatedMinutes: number }[];
}

export function CourseSummary({
  course,
  linked = true,
}: {
  course: CourseSummaryData;
  linked?: boolean;
}) {
  const totalMinutes = course.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const itemCount = course.items.length;

  return (
    <div>
      <h2 className="text-lg font-medium text-[var(--color-text)]">
        {linked ? (
          <Link href={courseUrl(course.slug)} className="hover:underline">
            {course.title}
          </Link>
        ) : (
          course.title
        )}
      </h2>
      <p className="text-sm text-[var(--color-text-muted)]">{course.summary}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        {itemCount} item{itemCount === 1 ? "" : "s"} · {totalMinutes} min total
      </p>
    </div>
  );
}
