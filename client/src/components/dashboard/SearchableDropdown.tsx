"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SearchableDropdownOption = {
  value: string;
  label: string;
};

export function SearchableDropdown({
  name,
  options,
  defaultValue = "",
  placeholder = "Choose an option",
  required = false,
  onValueChange,
  ariaLabel,
}: {
  name: string;
  options: SearchableDropdownOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [open]);

  function choose(option: SearchableDropdownOption) {
    setValue(option.value);
    onValueChange?.(option.value);
    setQuery("");
    setOpen(false);
    inputRef.current?.setCustomValidity("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && filtered[highlightedIndex]) {
      event.preventDefault();
      choose(filtered[highlightedIndex]!);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setQuery("");
      setOpen(false);
      inputRef.current?.setCustomValidity("");
    }
  }

  return <div ref={rootRef} className="relative min-w-0">
    <input type="hidden" name={name} value={value} />
    <div className="relative">
      <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-required={required}
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open && filtered.length ? `${id}-option-${highlightedIndex}` : undefined}
        autoComplete="off"
        required={required && !value}
        value={open ? query : selected?.label ?? ""}
        placeholder={placeholder}
        onFocus={() => {
          setQuery("");
          setHighlightedIndex(Math.max(options.findIndex((option) => option.value === value), 0));
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={(event) => {
          if (event.relatedTarget && rootRef.current?.contains(event.relatedTarget as Node)) return;
          setOpen(false);
          setQuery("");
        }}
        onChange={(event) => {
          setValue("");
          setQuery(event.target.value);
          setHighlightedIndex(0);
          setOpen(true);
          event.currentTarget.setCustomValidity(
            required && event.target.value ? "Choose an option from the list." : "",
          );
        }}
        onKeyDown={handleKeyDown}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />
      {!required && value && <button
        type="button"
        aria-label={`Clear ${name}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setValue("");
          onValueChange?.("");
          setQuery("");
          inputRef.current?.setCustomValidity("");
        }}
        className="absolute right-9 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={14} />
      </button>}
      <ChevronDown size={16} aria-hidden="true" className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </div>
    {open && <ul id={`${id}-listbox`} role="listbox" className="absolute z-40 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5">
      {filtered.length ? filtered.map((option, index) => <li key={option.value} role="presentation">
        <button
          id={`${id}-option-${index}`}
          type="button"
          role="option"
          aria-selected={option.value === value}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setHighlightedIndex(index)}
          onClick={() => choose(option)}
          className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
            index === highlightedIndex ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className="truncate">{option.label}</span>
          {option.value === value && <Check size={15} className="shrink-0 text-blue-700" />}
        </button>
      </li>) : <li className="px-3 py-3 text-sm text-slate-500">No matching options</li>}
    </ul>}
  </div>;
}
