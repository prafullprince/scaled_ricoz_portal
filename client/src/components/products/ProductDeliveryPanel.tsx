"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Package,
  RefreshCw,
  Send,
} from "lucide-react";
import { isAxiosError } from "axios";
import {
  ProductService,
  type Product,
  type ProductDetails,
  type ProductHead,
} from "@/services/product.service";

const fieldClass =
  "mt-1 h-11 w-full min-w-0 rounded-md border border-(--brand-border) bg-white px-3 text-sm";
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");

function errorMessage(error: unknown) {
  return isAxiosError(error) &&
    typeof error.response?.data?.message === "string"
    ? error.response.data.message
    : "Unable to load product delivery. Please retry.";
}

export function ProductDeliveryPanel({
  executive = false,
  department,
  revision = 0,
  onDispatched,
}: {
  executive?: boolean;
  department?: string;
  revision?: number;
  onDispatched?: () => Promise<void>;
}) {
  const params = useSearchParams();
  const requestedId = params.get("product") ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState(requestedId);
  const [details, setDetails] = useState<ProductDetails | null>(null);
  const [heads, setHeads] = useState<ProductHead[]>([]);
  const [headId, setHeadId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllReports, setShowAllReports] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const targetDepartment = department ?? "PRODUCT";
  const selected = products.find((product) => product._id === selectedId);

  useEffect(() => {
    let cancelled = false;
    ProductService.list(executive ? undefined : department)
      .then((items) => {
        if (cancelled) return;
        const visible =
          executive && department
            ? items.filter(
                (product) =>
                  !product.workflow ||
                  product.workflow.department === department,
              )
            : items;
        setProducts(visible);
        setSelectedId((current) =>
          visible.some((product) => product._id === current)
            ? current
            : (visible[0]?._id ?? ""),
        );
        setError("");
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [executive, department, refresh, revision]);

  useEffect(() => {
    if (!executive) return;
    let cancelled = false;
    ProductService.heads(targetDepartment)
      .then((items) => {
        if (!cancelled) {
          setHeads(items);
          setHeadId((current) =>
            items.some((head) => head.userId._id === current)
              ? current
              : items.length === 1
                ? items[0].userId._id
                : "",
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [executive, targetDepartment, refresh]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    ProductService.details(selectedId, page)
      .then((result) => {
        if (!cancelled) {
          setDetails(result);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setDetails(null);
          setError(errorMessage(reason));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, page, refresh, revision]);

  useEffect(() => {
    const update = () => setRefresh((value) => value + 1);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 30000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);

  async function dispatch(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await ProductService.dispatch(selected._id, {
        department: targetDepartment,
        ...(headId ? { headId } : { executiveAssignment: true }),
        deadline: new Date(deadline).toISOString(),
      });
      setNotice(
        headId
          ? `${selected.title} sent to the ${label(targetDepartment)} Head.`
          : `${selected.title} is ready for executive assignment.`,
      );
      setRefresh((value) => value + 1);
      await onDispatched?.();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const currentDetails = details?.product._id === selectedId ? details : null;
  const product = currentDetails?.product ?? selected;
  const owner = product?.workflow?.currentOwner;
  const unassignedCount = products.filter(
    (item) => !item.workflow && item.status !== "production",
  ).length;
  const reports = currentDetails?.reports ?? [];
  const visibleReports = showAllReports ? reports : reports.slice(0, 3);

  return (
    <section
      aria-label="Product delivery"
      className="min-w-0 rounded-lg border border-(--brand-border) bg-white p-4 shadow-(--shadow-xs) sm:p-5 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:not(:disabled)]:transition-colors [&_button:disabled]:cursor-not-allowed"
    >
      <div className="flex items-center justify-between gap-3 border-b border-(--brand-border) pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-(--brand-navy)">
            <Package size={19} />
            Product delivery
          </h2>
          <p className="mt-1 text-xs text-(--brand-text-muted)">
            Progress, ownership, and recent contributor updates
          </p>
        </div>
        <button
          type="button"
          title="Refresh product progress"
          aria-label="Refresh product progress"
          onClick={() => {
            setDetailLoading(true);
            setRefresh((value) => value + 1);
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-(--brand-border) hover:bg-(--brand-surface-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-red)"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm">
          <LoaderCircle size={16} className="animate-spin" />
          Loading products...
        </p>
      ) : !products.length ? (
        <p className="mt-4 text-sm text-(--brand-text-muted)">
          No products in your reporting scope.
        </p>
      ) : (
        <>
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="min-w-0 text-xs font-semibold text-(--brand-text-secondary)">
              Product
              <select
                aria-label="Delivery product"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setPage(1);
                  setDetailLoading(true);
                  setNotice("");
                }}
                className={fieldClass}
              >
                {products.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.title} - {label(item.status)}
                  </option>
                ))}
              </select>
            </label>
            {executive ? (
              <p className="pb-3 text-sm text-(--brand-text-muted)">
                {unassignedCount} ready to assign
              </p>
            ) : null}
          </div>
          {product ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="wrap-break-word text-base font-semibold">
                    {product.title}
                  </h3>
                  <p className="mt-1 text-xs capitalize text-(--brand-text-muted)">
                    {product.workflow?.department
                      ? label(product.workflow.department)
                      : "No department"}{" "}
                    /{" "}
                    {owner && typeof owner !== "string"
                      ? owner.name
                      : "No owner"}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${product.status === "production" ? "bg-emerald-50 text-emerald-800" : product.status === "development" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700"}`}
                >
                  {label(product.status)}
                </span>
              </div>
              {executive &&
              !product.workflow &&
              product.status !== "production" ? (
                <form
                  onSubmit={dispatch}
                  className="grid gap-3 border-y border-(--brand-border) py-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end"
                >
                  <label className="min-w-0 text-xs font-semibold">
                    {label(targetDepartment)} routing
                    <select
                      value={headId}
                      onChange={(event) => setHeadId(event.target.value)}
                      className={fieldClass}
                      disabled={saving}
                    >
                      <option value="">Executive assignment</option>
                      {heads.map((head) => (
                        <option key={head._id} value={head.userId._id}>
                          {head.userId.name} (Head)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 text-xs font-semibold">
                    Delivery deadline
                    <input
                      required
                      type="datetime-local"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      className={fieldClass}
                      disabled={saving}
                    />
                  </label>
                  <button
                    disabled={saving}
                    type="submit"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-(--brand-red) px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {saving ? "Assigning..." : "Start Delivery"}
                  </button>
                </form>
              ) : null}
              {product.workflow ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md bg-(--brand-surface) p-3">
                    <p className="text-xs text-(--brand-text-muted)">
                      Reported progress
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {product.progress}%
                    </p>
                    <progress
                      value={product.progress}
                      max={100}
                      aria-label="Product reported progress"
                      className="mt-2 h-2 w-full accent-emerald-600"
                    />
                  </div>
                  <div className="rounded-md bg-(--brand-surface) p-3">
                    <p className="text-xs text-(--brand-text-muted)">
                      Approval stage
                    </p>
                    <p className="mt-2 text-sm font-semibold capitalize">
                      {label(product.workflow.workflowStage ?? "assigned")}
                    </p>
                  </div>
                  <div className="rounded-md bg-(--brand-surface) p-3">
                    <p className="text-xs text-(--brand-text-muted)">
                      Completed work
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {product.completedTaskCount} / {product.taskCount}
                    </p>
                  </div>
                </div>
              ) : null}
              {detailLoading ? (
                <p role="status" className="text-xs text-(--brand-text-muted)">
                  Updating progress...
                </p>
              ) : null}
              {currentDetails?.tasks.length ? (
                <section
                  aria-label="Product work items"
                  className="rounded-md border border-(--brand-border) px-3"
                >
                  <h4 className="py-3 text-xs font-semibold uppercase tracking-wide text-(--brand-text-muted)">
                    Work items
                  </h4>
                  <div className="divide-y divide-(--brand-border)">
                    {currentDetails.tasks.map((task) => (
                      <div
                        key={task._id}
                        className="grid min-w-0 gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <span className="wrap-break-word font-medium">
                          {task.title}
                        </span>
                        <span className="wrap-break-word text-(--brand-text-muted)">
                          {task.assignedTo &&
                          typeof task.assignedTo !== "string"
                            ? task.assignedTo.name
                            : "Unassigned"}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {task.progress}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {product.workflow ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">
                      Progress reports{" "}
                      <span className="ml-1 text-xs font-normal text-(--brand-text-muted)">
                        {reports.length}
                      </span>
                    </h4>
                    {reports.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllReports((current) => !current)}
                        aria-expanded={showAllReports}
                        className="rounded px-2 py-1 text-xs font-semibold text-(--brand-text-secondary) hover:bg-(--brand-surface-hover) hover:text-(--brand-red)"
                      >
                        {showAllReports ? "Show less" : "Show all"}
                      </button>
                    ) : null}
                  </div>
                  {!currentDetails?.reports.length ? (
                    <p className="mt-2 text-sm text-(--brand-text-muted)">
                      No reports yet.
                    </p>
                  ) : (
                    <div className="mt-2 divide-y divide-(--brand-border)">
                      {visibleReports.map((report) => (
                        <article key={report._id} className="min-w-0 py-3">
                          <div className="flex flex-wrap justify-between gap-2 text-xs">
                            <span className="font-semibold">
                              {report.userId?.name ?? "Former member"} /{" "}
                              {
                                currentDetails.tasks.find(
                                  (task) => task._id === report.taskId,
                                )?.title
                              }
                            </span>
                            <span className="text-(--brand-text-muted)">
                              {report.reportDate} / {report.progress}%
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-(--brand-text-secondary)">
                            {report.summary}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                  {currentDetails &&
                  currentDetails.pagination.totalPages > 1 ? (
                    <div className="mt-3 flex items-center justify-end gap-3 text-xs">
                      <button
                        aria-label="Previous report page"
                        title="Previous report page"
                        disabled={page <= 1 || detailLoading}
                        onClick={() => {
                          setPage((value) => value - 1);
                          setDetailLoading(true);
                        }}
                        className="flex size-9 items-center justify-center rounded border disabled:opacity-40"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <span>
                        {page} / {currentDetails.pagination.totalPages}
                      </span>
                      <button
                        aria-label="Next report page"
                        title="Next report page"
                        disabled={
                          page >= currentDetails.pagination.totalPages ||
                          detailLoading
                        }
                        onClick={() => {
                          setPage((value) => value + 1);
                          setDetailLoading(true);
                        }}
                        className="flex size-9 items-center justify-center rounded border disabled:opacity-40"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
