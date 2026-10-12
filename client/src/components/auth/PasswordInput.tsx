"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { inputClassName } from "./AuthLayout";

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={error || undefined}
        className={`${inputClassName(error)} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-2 text-(--brand-gray) transition-colors hover:text-(--brand-navy) focus:outline-none focus:ring-2 focus:ring-(--brand-red)"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
