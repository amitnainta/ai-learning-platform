import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LessonVideo } from "../lesson-video";

/**
 * Covers the whole FR-PATH-005 video rendering path here rather than in
 * e2e, because the R1 seed pack deliberately ships no video asset
 * (Risks/open questions #3, decision #4 in PLAN.md) — see
 * e2e/content-lesson.spec.ts, which asserts the opposite: no <video>
 * element for the seeded lesson. Together with
 * validation/content.test.ts's "video block without captionsUrl is
 * rejected" case, this covers the whole video path without a live asset.
 */
describe("LessonVideo", () => {
  it("renders a native <video> with controls, preload=metadata, and the CDN URL when a video is present", () => {
    const { container } = render(
      <LessonVideo
        item={{
          title: "AI Strategy Fundamentals",
          videoUrl: "https://cdn.example.com/ai-strategy-fundamentals.mp4",
          videoCaptionsUrl: "https://cdn.example.com/ai-strategy-fundamentals.vtt",
          videoPosterUrl: "https://cdn.example.com/ai-strategy-fundamentals-poster.jpg",
        }}
      />,
    );

    const videos = container.querySelectorAll("video");
    expect(videos).toHaveLength(1);

    const video = videos[0] as HTMLVideoElement;
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).toHaveAttribute("src", "https://cdn.example.com/ai-strategy-fundamentals.mp4");
    expect(video).toHaveAttribute(
      "poster",
      "https://cdn.example.com/ai-strategy-fundamentals-poster.jpg",
    );
    expect(video).toHaveAttribute("aria-label", "Video: AI Strategy Fundamentals");
  });

  it("renders exactly one <track kind=captions default> with the captions URL, srclang, and label", () => {
    const { container } = render(
      <LessonVideo
        item={{
          title: "AI Strategy Fundamentals",
          videoUrl: "https://cdn.example.com/video.mp4",
          videoCaptionsUrl: "https://cdn.example.com/video.vtt",
          videoPosterUrl: null,
        }}
      />,
    );

    const tracks = container.querySelectorAll("track");
    expect(tracks).toHaveLength(1);

    const track = tracks[0] as HTMLTrackElement;
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("default");
    expect(track).toHaveAttribute("src", "https://cdn.example.com/video.vtt");
    expect(track).toHaveAttribute("srclang", "en");
    expect(track).toHaveAttribute("label", "English");
  });

  it("renders without a poster attribute when none is supplied", () => {
    const { container } = render(
      <LessonVideo
        item={{
          title: "Lesson",
          videoUrl: "https://cdn.example.com/video.mp4",
          videoCaptionsUrl: "https://cdn.example.com/video.vtt",
          videoPosterUrl: null,
        }}
      />,
    );

    expect(container.querySelector("video")).not.toHaveAttribute("poster");
  });

  it("renders a text fallback inside the <video> element", () => {
    const { container } = render(
      <LessonVideo
        item={{
          title: "Lesson",
          videoUrl: "https://cdn.example.com/video.mp4",
          videoCaptionsUrl: "https://cdn.example.com/video.vtt",
          videoPosterUrl: null,
        }}
      />,
    );

    const video = container.querySelector("video");
    expect(video?.textContent).toMatch(/does not support embedded video/i);
    expect(video?.querySelector("a")).toHaveAttribute("href", "https://cdn.example.com/video.mp4");
  });

  it("renders nothing at all when the item has no video (the R1 seed pack's actual state)", () => {
    const { container } = render(
      <LessonVideo
        item={{ title: "Lesson", videoUrl: null, videoCaptionsUrl: null, videoPosterUrl: null }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a videoUrl is present but captionsUrl is missing (defensive — the import schema should already reject this shape)", () => {
    const { container } = render(
      <LessonVideo
        item={{
          title: "Lesson",
          videoUrl: "https://cdn.example.com/video.mp4",
          videoCaptionsUrl: null,
          videoPosterUrl: null,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
