/**
 * FR-PATH-005 (task 21): a native `<video controls preload="metadata">`
 * with a `<track kind="captions" default>`, an optional poster, an
 * accessible label, and a text fallback for browsers that can't play it.
 * Renders nothing when the item has no video — which is every seeded item
 * in the R1 pack (decision #4's seed-pack consequence): the designated
 * video lesson ships with its `video` frontmatter block commented out, so
 * this component's "nothing at all" path is what actually renders on the
 * live site today. The rendering path itself is proven by this component's
 * unit test rather than by e2e against seeded data.
 */
export interface LessonVideoData {
  title: string;
  videoUrl: string | null;
  videoCaptionsUrl: string | null;
  videoPosterUrl: string | null;
}

export function LessonVideo({ item }: { item: LessonVideoData }) {
  if (!item.videoUrl || !item.videoCaptionsUrl) {
    return null;
  }

  return (
    <video
      controls
      preload="metadata"
      src={item.videoUrl}
      poster={item.videoPosterUrl ?? undefined}
      aria-label={`Video: ${item.title}`}
      className="mb-6 w-full rounded-md border border-[var(--color-border)]"
    >
      <track kind="captions" default src={item.videoCaptionsUrl} srcLang="en" label="English" />
      <p>
        Your browser does not support embedded video.{" "}
        <a href={item.videoUrl} className="text-[var(--color-primary)] underline">
          Download the video
        </a>{" "}
        instead.
      </p>
    </video>
  );
}
