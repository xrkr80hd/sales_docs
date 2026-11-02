"use client";

import { useState, type InputHTMLAttributes } from "react";

/** Keep an editable string so clearing a numeric field does not reinsert zero. */
export function NumberInput({ value, onChange, onBlur, onFocus, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input
    {...props}
    type="number"
    value={draft ?? value ?? ""}
    onFocus={event => {
      event.currentTarget.select();
      onFocus?.(event);
    }}
    onChange={event => {
      // React preserves numerically equivalent input such as "012" for number
      // values. Writing a canonical string removes it without clamping typing.
      const next = event.currentTarget.value.replace(/^(-?)0+(?=\d)/, "$1");
      event.currentTarget.value = next;
      setDraft(next);
      onChange?.(event);
    }}
    onBlur={event => {
      setDraft(null);
      onBlur?.(event);
    }}
  />;
}
