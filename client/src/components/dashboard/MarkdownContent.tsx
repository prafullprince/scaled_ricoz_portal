"use client";

import { isValidElement, useState, type ComponentProps, type ReactNode } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children);
  return "";
}

function CodeBlock({ children }: ComponentProps<"pre">) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(textContent(children));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return <div className="my-4 overflow-hidden rounded-md border border-(--brand-border-strong) bg-[#142238] text-white">
    <div className="flex h-9 items-center justify-between border-b border-white/15 bg-white/5 px-3">
      <span className="text-[11px] font-semibold text-white/70">Code</span>
      <button type="button" onClick={() => void copyCode()} aria-label={copied ? "Code copied" : "Copy code"} title={copied ? "Copied" : "Copy code"} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white/75 hover:bg-white/10 hover:text-white">
        {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}{copied ? "Copied" : "Copy"}
      </button>
    </div>
    <pre className="overflow-x-auto p-4 text-xs leading-6"><code className="!rounded-none !bg-transparent !p-0 !text-inherit">{textContent(children)}</code></pre>
  </div>;
}

const markdownComponents: Components = {
  pre: CodeBlock,
  table: ({ children }) => (
    <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-left text-[13px] leading-6">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">{children}</th>,
  td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-600 last:border-0">{children}</td>,
};

export function MarkdownContent({ children, className = "" }: { children: string; className?: string }) {
  return <div className={className}><ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{children}</ReactMarkdown></div>;
}