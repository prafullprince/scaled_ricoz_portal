import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function DashboardCard({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 border-t border-(--brand-border) py-5 sm:py-6">
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-(--brand-navy)">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-(--brand-text-secondary)">{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon ? <Icon size={28} className="mb-4 text-(--brand-text-muted)" /> : null}
      <p className="text-sm font-semibold text-(--brand-text)">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-(--brand-text-secondary)">{description}</p>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="h-24 animate-pulse rounded-(--radius-lg) bg-(--brand-surface-active)" />
      <div className="h-40 animate-pulse rounded-(--radius-lg) bg-(--brand-surface-active)" />
    </div>
  );
}

export function DashboardError({
  message = "Something went wrong. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-(--radius-lg) border border-(--status-danger-border) bg-(--status-danger-bg) px-6 py-14 text-center">
      <p className="text-sm font-semibold text-(--status-danger)">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-(--radius-md) border border-(--status-danger-border) px-4 py-2 text-sm font-semibold text-(--status-danger) hover:bg-white"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
