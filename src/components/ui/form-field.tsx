import type { InputHTMLAttributes } from "react";

/**
 * Labeled input primitive (NFR-A11Y-004): every input gets an explicit
 * `<label htmlFor>`, its error is associated via `aria-describedby`, and
 * the error text itself lives in an `aria-live="polite"` region so screen
 * readers announce validation failures as they appear.
 */
interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

export function FormField({ label, name, error, hint, className, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

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
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={
          className ??
          "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
        }
        {...inputProps}
      />
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
