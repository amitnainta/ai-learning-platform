"use client";

/**
 * FR-RATE-001/003's star control (task 14), accessible by construction
 * (NFR-A11Y-002/-004): a native `<fieldset>`/`<legend>` radio group, not a
 * custom div-based star widget. Five `<input type="radio">`s with
 * visually-hidden labels ("1 star" .. "5 stars") give arrow-key navigation,
 * roving focus, and screen-reader group semantics for free — nothing here
 * is reimplemented. The selected value is also rendered as visible text
 * ("4 out of 5") so nothing depends on glyph shape or colour alone.
 *
 * Each `<input>` is nested **inside** its `<label>` (implicit labelling)
 * rather than a sibling addressed by `htmlFor` alone — deliberate, not
 * cosmetic. The input is visually hidden via `sr-only`
 * (`position: absolute`, collapsed to ~1px), which needs a positioned
 * ancestor to be contained within; nested inside a `relative` label, the
 * hidden input's hit-target stays inside that label's own box instead of
 * escaping to a shared ancestor and colliding with a sibling star's box —
 * which otherwise makes the wrong star respond to a real click (caught by
 * `e2e/rating-course.spec.ts` in a real browser; `jsdom`-based component
 * tests can't catch this class of bug, since `jsdom` doesn't compute real
 * layout). Checked/focus styling accordingly uses Tailwind's `has-*`
 * variant (`:has()`) on the label instead of `peer-*`, since the input is
 * now a descendant, not a preceding sibling.
 */

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function StarRatingInput({
  name,
  value,
  onChange,
  disabled,
  legend = "Your rating",
}: {
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  legend?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-[var(--color-text)]">{legend}</legend>
      <div className="flex items-center gap-2">
        {STAR_VALUES.map((star) => {
          const inputId = `${name}-star-${star}`;
          const isChecked = value === star;
          return (
            <label
              key={star}
              htmlFor={inputId}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--color-border)] text-lg text-[var(--color-text-muted)] has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent)] has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]"
            >
              <input
                type="radio"
                id={inputId}
                name={name}
                value={star}
                checked={isChecked}
                onChange={() => onChange(star)}
                className="sr-only"
              />
              <span aria-hidden="true">★</span>
              <span className="sr-only">
                {star} star{star === 1 ? "" : "s"}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-sm text-[var(--color-text)]">
        {value === null ? "No rating selected" : `${value} out of 5`}
      </p>
    </fieldset>
  );
}
