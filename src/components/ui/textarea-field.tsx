import type { TextareaHTMLAttributes } from "react";

/**
 * A `<textarea>` sibling of `<FormField>` (task 13, NFR-A11Y-004): an
 * explicit `<label htmlFor>`, `aria-describedby` wiring for hint + error +
 * character counter, error text in an `aria-live="polite"` region, and an
 * optional `maxLength`/`value`-driven counter ("123 / 2000 characters")
 * also announced via `aria-live="polite"` + `aria-atomic`. Same styling
 * tokens as `FormField`.
 */
interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  /** Renders a live "N / max characters" counter when set. */
  maxLength?: number;
}

export function TextAreaField({
  label,
  name,
  error,
  hint,
  maxLength,
  className,
  value,
  ...textareaProps
}: TextAreaFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const counterId = `${name}-counter`;
  const describedBy = [error ? errorId : null, hint ? hintId : null, maxLength ? counterId : null]
    .filter(Boolean)
    .join(" ");

  const currentLength = typeof value === "string" ? value.length : 0;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-[var(--color-text)]">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--color-text-muted)]">
          {hint}
        </p>
      ) : null}
      <textarea
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        maxLength={maxLength}
        value={value}
        className={
          className ??
          "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
        }
        {...textareaProps}
      />
      {maxLength !== undefined ? (
        <p
          id={counterId}
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-[var(--color-text-muted)]"
        >
          {currentLength} / {maxLength} characters
        </p>
      ) : null}
      <p
        id={errorId}
        aria-live="polite"
        className="min-h-[1rem] text-xs text-[var(--color-danger)]"
      >
        {error ?? ""}
      </p>
    </div>
  );
}
