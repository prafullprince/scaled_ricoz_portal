"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Check,
  Pencil,
  ChevronDown,
  Trash2,
  ArrowRight,
  ChevronRight,
  Code2,
  Columns3,
  ImagePlus,
  List,
  LoaderCircle,
  PackagePlus,
  Rocket,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ProductService,
  type Product,
  type ProductStatus,
} from "@/services/product.service";
import Image from "next/image";
import Link from "next/link";
import { DashboardEmptyState } from "../dashboard/DashboardPrimitives";
import { useAppSelector } from "@/redux/hooks";

const tabs: { id: "all" | ProductStatus; label: string }[] = [
  { id: "all", label: "All Products" },
  { id: "unassigned", label: "Unassigned" },
  { id: "development", label: "Development" },
  { id: "production", label: "Production" },
];

function statusLabel(status: ProductStatus) {
  return status === "production" ? "Production" : status === "development" ? "Development" : "Unassigned";
}

function statusClasses(status: ProductStatus) {
  return status === "production"
    ? "border-(--status-success-border) bg-(--status-success-bg) text-(--status-success)"
    : status === "development"
      ? "border-(--status-info-border) bg-(--status-info-bg) text-(--status-info)"
      : "border-(--status-warning-border) bg-(--status-warning-bg) text-(--status-warning)";
}

export function ProductsAdminView() {
  const user = useAppSelector((state) => state.auth.user);
  const canManage = Boolean(user?.roles.some((role) => role === "CEO" || role === "ADMIN"));
  const leader = canManage || Boolean(user?.roles.some((role) => role === "HEAD" || role === "MANAGER" || role.endsWith("_HEAD") || role.endsWith("_MANAGER")));
  const taskPath = leader ? "/dashboard/admin/tasks" : user?.roles.includes("INTERN") ? "/dashboard/intern/tasks" : "/dashboard/employee/tasks";
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]["id"]>("all");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (canManage ? ProductService.listAdmin() : ProductService.list())
      .then((items) => {
        if (!cancelled) setProducts(items);
      })
      .catch(() => {
        if (!cancelled) toast.error("Unable to load products.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const counts = useMemo(
    () => ({
      all: products.length,
      unassigned: products.filter((product) => product.status === "unassigned").length,
      development: products.filter(
        (product) => product.status === "development",
      ).length,
      production: products.filter((product) => product.status === "production")
        .length,
    }),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesTab = activeTab === "all" || product.status === activeTab;
      if (!matchesTab) return false;
      if (!query) return true;
      return [
        product.title,
        product.description,
        product.developer ?? "",
        ...product.techStack,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeTab, products, search]);

  const boardProducts = useMemo(() => ({
    unassigned: visibleProducts.filter((product) => product.status === "unassigned"),
    development: visibleProducts.filter((product) => product.status === "development"),
    production: visibleProducts.filter((product) => product.status === "production"),
  }), [visibleProducts]);

  function handleCreated(product: Product) {
    setProducts((current) => editing ? current.map((item) => item._id === product._id ? product : item) : [product, ...current]);
    setShowCreate(false);
    setEditing(null);
    setActiveTab("all");
    toast.success(`${product.title} saved.`);
  }

  async function removeProduct() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await ProductService.remove(deleting._id);
      setProducts((current) => current.filter((product) => product._id !== deleting._id));
      setDeleting(null);
      toast.success("Product deleted. Delivery history retained.");
    } catch { toast.error("Unable to delete product."); }
    finally { setRemoving(false); }
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-(--brand-text-muted)">
            <span>Workspaces</span><ChevronRight size={13}/><span className="font-semibold text-(--brand-text-secondary)">Product management</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-(--brand-red-pale) text-(--brand-red)"><PackagePlus size={21}/></span>
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-(--brand-navy) sm:text-3xl">Product management</h1>
              <p className="mt-1 text-sm text-(--brand-text-secondary)">Plan product delivery from intake through development to production.</p>
            </div>
          </div>
        </div>
        {canManage && <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-(--radius-md) bg-(--brand-red) px-4 py-2 text-sm font-bold text-white shadow-(--shadow-brand) transition hover:bg-(--brand-red-hover)"
        >
          <PackagePlus size={17} />
          Create product
        </button>}
      </header>

      <section aria-label="Product delivery overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "All products", value: counts.all, icon: PackagePlus, tone: "text-(--brand-red) bg-(--brand-red-pale)" },
          { label: "Unassigned", value: counts.unassigned, icon: Code2, tone: "text-(--status-warning) bg-(--status-warning-bg)" },
          { label: "In development", value: counts.development, icon: Columns3, tone: "text-(--status-info) bg-(--status-info-bg)" },
          { label: "In production", value: counts.production, icon: Rocket, tone: "text-(--status-success) bg-(--status-success-bg)" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="flex items-center justify-between rounded-xl border border-(--brand-border) bg-white px-4 py-3.5 shadow-(--shadow-sm)">
            <div><p className="text-xs font-semibold text-(--brand-text-secondary)">{label}</p><p className="mt-1 text-2xl font-bold text-(--brand-navy)">{value}</p></div>
            <span className={`flex size-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17}/></span>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-(--brand-border) bg-white shadow-(--shadow-sm)">
        <div className="flex flex-col gap-4 border-b border-(--brand-border) p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Product view" className="flex rounded-lg border border-(--brand-border) bg-(--brand-surface) p-1">
              <button type="button" aria-pressed={viewMode === "board"} onClick={() => setViewMode("board")} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${viewMode === "board" ? "bg-white text-(--brand-navy) shadow-(--shadow-sm)" : "text-(--brand-text-secondary) hover:text-(--brand-text)"}`}><Columns3 size={14}/>Board</button>
              <button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${viewMode === "list" ? "bg-white text-(--brand-navy) shadow-(--shadow-sm)" : "text-(--brand-text-secondary) hover:text-(--brand-text)"}`}><List size={14}/>List</button>
            </div>
            <div role="group" aria-label="Filter products by status" className="flex flex-wrap items-center gap-1">
              {tabs.map((tab) => (
                <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-md px-2.5 py-2 text-xs font-semibold transition ${activeTab === tab.id ? "bg-(--brand-red-pale) text-(--brand-red)" : "text-(--brand-text-secondary) hover:bg-(--brand-surface-hover) hover:text-(--brand-text)"}`}>
                  {tab.label}<span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? "bg-white/70" : "bg-(--brand-surface)"}`}>{counts[tab.id]}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="relative block w-full xl:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-(--brand-text-muted)"/>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, owners, or technology" className="h-10 w-full rounded-(--radius-md) border border-(--brand-border) bg-(--brand-surface) pl-9 pr-9 text-sm text-(--brand-text) outline-none transition focus:border-(--brand-red) focus:bg-white"/>
            {search ? <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-2 flex size-6 items-center justify-center rounded text-(--brand-text-muted) hover:bg-white"><X size={14}/></button> : null}
          </label>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-(--brand-text-secondary)"><LoaderCircle size={17} className="animate-spin"/>Loading products...</div>
          ) : !visibleProducts.length ? (
            <DashboardEmptyState
              icon={PackagePlus}
              title={search ? "No matching products" : activeTab === "all" ? "No products yet" : `No ${statusLabel(activeTab).toLowerCase()} products`}
              description={search ? "Try another product name, owner, or technology." : "Create a product to start planning its delivery."}
            />
          ) : viewMode === "board" ? (
            <div className="overflow-x-auto">
              <div className="grid min-w-[900px] grid-cols-3 items-start gap-4">
                {(["unassigned", "development", "production"] as const).map((status) => {
                  const columnProducts = boardProducts[status];
                  const dotColor = status === "production" ? "bg-(--status-success)" : status === "development" ? "bg-(--status-info)" : "bg-(--status-warning)";
                  return (
                    <section key={status} aria-label={`${statusLabel(status)} products`} className="overflow-hidden rounded-xl border border-(--brand-border) bg-(--brand-surface)">
                      <header className="flex items-center justify-between border-b border-(--brand-border) px-3.5 py-3">
                        <div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${dotColor}`}/><h2 className="text-sm font-semibold text-(--brand-navy)">{statusLabel(status)}</h2><span className="rounded-full bg-(--brand-surface-hover) px-2 py-0.5 text-[10px] font-semibold text-(--brand-text-secondary)">{columnProducts.length}</span></div>
                        {status === "unassigned" && canManage ? <button type="button" onClick={() => setShowCreate(true)} aria-label="Create product" className="flex size-7 items-center justify-center rounded-md text-(--brand-text-muted) transition hover:bg-(--brand-surface-hover) hover:text-(--brand-text)"><PackagePlus size={15}/></button> : null}
                      </header>
                      <div className="min-h-40 space-y-3 p-3">
                        {columnProducts.length ? columnProducts.map((product) => (
                          <ProductCard key={product._id} product={product} canManage={canManage} taskPath={taskPath} onEdit={() => setEditing(product)} onDelete={() => setDeleting(product)}/>
                        )) : <p className="rounded-lg border border-dashed border-(--brand-border-strong) px-3 py-8 text-center text-xs text-(--brand-text-muted)">No products in this stage</p>}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-collapse text-left">
                <thead><tr className="border-b border-(--brand-border) text-[10px] font-bold uppercase tracking-wide text-(--brand-text-muted)">
                  <th className="px-3 py-3">Product</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Owner</th><th className="px-3 py-3">Progress</th><th className="px-3 py-3">Technology</th><th className="px-3 py-3 text-right">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-(--brand-border)">
                  {visibleProducts.map((product) => (
                    <ProductListRow key={product._id} product={product} canManage={canManage} taskPath={taskPath} onEdit={() => setEditing(product)} onDelete={() => setDeleting(product)}/>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showCreate || editing ? (
        <CreateProductDialog
          product={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onCreated={handleCreated}
        />
      ) : null}
      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={(event) => { if (event.key === "Escape" && !removing) setDeleting(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-product-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 id="delete-product-title" className="break-words text-xl font-bold">Delete {deleting.title}?</h2>
            <p className="mt-3 text-sm text-(--brand-text-secondary)">The product will leave the catalog. Assigned work and reports will remain in Tasks.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button autoFocus disabled={removing} onClick={() => setDeleting(null)} className="rounded-md border px-4 py-2">Cancel</button>
              <button disabled={removing} onClick={() => void removeProduct()} className="flex items-center gap-2 rounded-md bg-(--brand-red) px-4 py-2 text-white disabled:opacity-50"><Trash2 size={16} />{removing ? "Deleting..." : "Delete"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ProductCard({ product, canManage, taskPath, onEdit, onDelete }: { product: Product; canManage: boolean; taskPath: string; onEdit: () => void; onDelete: () => void }) {
  const owner = product.workflow?.currentOwner && typeof product.workflow.currentOwner !== "string"
    ? product.workflow.currentOwner.name
    : "Unassigned";

  return (
    <article className="group min-w-0 rounded-lg border border-(--brand-border) bg-white p-3.5 shadow-(--shadow-sm) transition hover:border-(--brand-border-strong) hover:shadow-(--shadow-md)">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--brand-surface) text-(--brand-red)">
          {product.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.thumbnail} alt="" className="size-full object-cover"/>
          ) : <Code2 size={18}/>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-(--brand-navy)" title={product.title}>{product.title}</h3>
            {canManage ? <div className="flex shrink-0 -mr-1 -mt-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <button type="button" onClick={onEdit} title="Edit product" aria-label={`Edit ${product.title}`} className="flex size-7 items-center justify-center rounded text-(--brand-text-muted) hover:bg-(--brand-surface-hover) hover:text-(--brand-text)"><Pencil size={13}/></button>
              <button type="button" onClick={onDelete} title="Delete product" aria-label={`Delete ${product.title}`} className="flex size-7 items-center justify-center rounded text-(--brand-red) hover:bg-(--brand-red-pale)"><Trash2 size={13}/></button>
            </div> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--brand-text-secondary)">{product.summary || product.description}</p>
        </div>
      </div>
      <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
        {product.category ? <span className="rounded border border-(--brand-border) bg-(--brand-surface) px-2 py-0.5 text-[10px] font-medium text-(--brand-text-secondary)">{product.category}</span> : null}
        {product.techStack.slice(0, 3).map((tech) => <span key={tech} className="rounded border border-(--brand-border) bg-(--brand-surface) px-2 py-0.5 text-[10px] font-medium text-(--brand-text-secondary)">{tech}</span>)}
        {product.techStack.length > 3 ? <span className="px-1 py-0.5 text-[10px] text-(--brand-text-muted)">+{product.techStack.length - 3}</span> : null}
      </div>
      <div className="mt-3 rounded-md bg-(--brand-surface) p-2.5">
        <div className="flex items-center justify-between gap-2 text-[10px] text-(--brand-text-secondary)">
          <span>{product.workflow?.department ?? "No delivery team"}</span>
          <span className="font-semibold text-(--brand-navy)">{product.progress}%</span>
        </div>
        <progress aria-label={`${product.title} progress`} value={product.progress} max={100} className="mt-1.5 h-1.5 w-full accent-emerald-600"/>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--brand-red-pale) text-[9px] font-bold text-(--brand-red)">{owner.slice(0, 1).toUpperCase()}</span>
          <span className="truncate text-[11px] font-medium text-(--brand-text-secondary)" title={owner}>{owner}</span>
        </div>
        <Link href={`${taskPath}?department=${product.workflow?.department ?? "PRODUCT"}&product=${product._id}`} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-(--brand-red) hover:underline">
          {product.workflow ? "Delivery" : product.status === "production" ? "Tasks" : "Assign"}<ArrowRight size={13}/>
        </Link>
      </div>
      <p className="mt-2 text-[10px] text-(--brand-text-muted)">{product.completedTaskCount}/{product.taskCount} work items complete</p>
    </article>
  );
}

function ProductListRow({ product, canManage, taskPath, onEdit, onDelete }: { product: Product; canManage: boolean; taskPath: string; onEdit: () => void; onDelete: () => void }) {
  const owner = product.workflow?.currentOwner && typeof product.workflow.currentOwner !== "string"
    ? product.workflow.currentOwner.name
    : "Unassigned";

  return (
    <tr className="group transition-colors hover:bg-(--brand-surface-hover)">
      <td className="max-w-[380px] px-3 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--brand-surface) text-(--brand-red)">
            {product.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.thumbnail} alt="" className="size-full object-cover"/>
            ) : <Code2 size={16}/>}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-(--brand-navy)">{product.title}</span>
            <span className="mt-0.5 block truncate text-xs text-(--brand-text-secondary)">{product.summary || product.description}</span>
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClasses(product.status)}`}>{statusLabel(product.status)}</span></td>
      <td className="max-w-36 truncate px-3 py-3 text-xs text-(--brand-text-secondary)" title={owner}>{owner}</td>
      <td className="min-w-36 px-3 py-3">
        <div className="flex items-center gap-2"><progress aria-label={`${product.title} progress`} value={product.progress} max={100} className="h-1.5 w-20 accent-emerald-600"/><span className="text-xs font-semibold text-(--brand-navy)">{product.progress}%</span></div>
        <span className="mt-1 block text-[10px] text-(--brand-text-muted)">{product.completedTaskCount}/{product.taskCount} work items</span>
      </td>
      <td className="max-w-48 px-3 py-3 text-xs text-(--brand-text-secondary)">{product.techStack.slice(0, 2).join(", ") || "—"}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link href={`${taskPath}?department=${product.workflow?.department ?? "PRODUCT"}&product=${product._id}`} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-(--brand-red) hover:bg-(--brand-red-pale)">{product.workflow ? "Delivery" : "Tasks"}<ArrowRight size={13}/></Link>
          {canManage ? <>
            <button type="button" onClick={onEdit} aria-label={`Edit ${product.title}`} className="flex size-8 items-center justify-center rounded-md text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"><Pencil size={14}/></button>
            <button type="button" onClick={onDelete} aria-label={`Delete ${product.title}`} className="flex size-8 items-center justify-center rounded-md text-(--brand-red) hover:bg-(--brand-red-pale)"><Trash2 size={14}/></button>
          </> : null}
        </div>
      </td>
    </tr>
  );
}

function CreateProductDialog({
  product,
  onClose,
  onCreated,
}: {
  product: Product | null;
  onClose: () => void;
  onCreated: (product: Product) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [summary, setSummary] = useState(product?.summary ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [website, setWebsite] = useState(product?.website ?? "");
  const [techStack, setTechStack] = useState(product?.techStack.join(", ") ?? "");
  const [developer, setDeveloper] = useState(product?.developer ?? "");
  const statusLocked = Boolean(product?.workflow);
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "unassigned");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const preview = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : null),
    [thumbnail],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        description: description.trim(),
        summary: summary.trim(),
        category: category.trim(),
        website: website.trim(),
        techStack: techStack
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        developer: developer.trim(),
        ...(statusLocked ? {} : { status }),
        thumbnail,
      };
      const saved = product ? await ProductService.update(product._id, input) : await ProductService.create(input);
      onCreated(saved);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Unable to save product. Please check the details and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--brand-navy)/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-product-title"
        className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-(--radius-xl) bg-white shadow-(--shadow-xl) sm:rounded-(--radius-xl)"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-(--brand-border) bg-white px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
              Product management
            </p>
            <h2
              id="create-product-title"
              className="mt-1 text-2xl font-bold tracking-[-0.03em] text-(--brand-navy)"
            >
              {product ? "Edit product" : "Add product"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-md text-(--brand-text-secondary) hover:bg-(--brand-surface) disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 px-5 py-6 sm:px-7">
          <div className="rounded-(--radius-lg) border border-(--brand-border) bg-(--brand-surface) p-4">
            <p className="text-sm font-semibold text-(--brand-navy)">Products from every lifecycle stage are displayed publicly</p>
            <p className="mt-2 text-xs leading-5 text-(--brand-text-secondary)">
              Unassigned, Development, and Production products make their title, description, summary, category, image, website, technology tags, lifecycle status, and catalogue dates public. Developer details, tasks, reports, and assignments are never displayed publicly.
            </p>
            {product ? <Link href={`/products/${product._id}`} className="mt-2 inline-block text-xs font-semibold text-(--brand-red)">View public product profile</Link> : null}
          </div>
          <label className="block text-sm font-semibold text-(--brand-navy)">
            Short summary
            <input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={240} placeholder="One sentence describing what the product does" className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border-strong) px-3 text-sm outline-none focus:border-(--brand-red)" />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Category
              <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} placeholder="Product category" className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border-strong) px-3 text-sm outline-none focus:border-(--brand-red)" />
            </label>
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Product website
              <input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border-strong) px-3 text-sm outline-none focus:border-(--brand-red)" />
            </label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Product title <span className="text-(--brand-red)">*</span>
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                minLength={2}
                placeholder="e.g. Ricoz Invoice"
                className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border-strong) px-3 text-sm outline-none focus:border-(--brand-red)"
                required
              />
            </label>
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Status <span className="text-(--brand-red)">*</span>
              <span className="relative mt-2 block">
                <select
                  value={status}
                  disabled={statusLocked}
                  onChange={(event) => setStatus(event.target.value as ProductStatus)}
                  aria-describedby="product-status-hint"
                  className="h-11 w-full appearance-none rounded-md border border-(--brand-border-strong) bg-white px-3 pr-9 text-sm font-normal outline-none transition focus:border-(--brand-red) disabled:cursor-not-allowed disabled:bg-(--brand-surface) disabled:text-(--brand-text-secondary)"
                >
                  <option value="unassigned">Unassigned</option>
                  <option value="development">Development</option>
                  <option value="production">Production</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-(--brand-text-muted)" />
              </span>
              <span id="product-status-hint" className="mt-1.5 block text-xs font-normal text-(--brand-text-muted)">
                {statusLocked
                  ? "Set by its delivery workflow in Tasks."
                  : status === "production"
                    ? "Already live. It won't be sent to a department for delivery."
                    : status === "development"
                      ? "In progress. You can still send it to a department Head."
                      : "Waiting to be sent to a department Head in Tasks."}
              </span>
            </label>
          </div>

          <label className="block text-sm font-semibold text-(--brand-navy)">
            Description <span className="text-(--brand-red)">*</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              minLength={10}
              rows={5}
              placeholder="What does this product do and what business problem does it solve?"
              className="mt-2 w-full resize-y rounded-md border border-(--brand-border-strong) p-3 text-sm leading-6 outline-none focus:border-(--brand-red)"
              required
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Tech stack
              <input
                value={techStack}
                onChange={(event) => setTechStack(event.target.value)}
                placeholder="React, Node.js, MongoDB"
                className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border-strong) px-3 text-sm outline-none focus:border-(--brand-red)"
              />
              <span className="mt-1.5 block text-xs font-normal text-(--brand-text-muted)">
                Separate technologies with commas.
              </span>
            </label>
            <label className="block text-sm font-semibold text-(--brand-navy)">
              Developer{" "}
              <span className="font-normal text-(--brand-text-muted)">
                (optional)
              </span>
              <input
                value={developer}
                onChange={(event) => setDeveloper(event.target.value)}
                maxLength={120}
                placeholder="e.g. Prafull Prince"
                className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border-strong) px-3 text-sm outline-none focus:border-(--brand-red)"
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold text-(--brand-navy)">
              Thumbnail{" "}
              <span className="font-normal text-(--brand-text-muted)">
                (optional)
              </span>
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) =>
                setThumbnail(event.target.files?.[0] ?? null)
              }
            />
            {preview ? (
              <div className="relative mt-2 overflow-hidden rounded-(--radius-lg) border border-(--brand-border)">
                <Image
                  src={preview}
                  alt="Product thumbnail preview"
                  width={500}
                  height={300}
                  className="max-h-56 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setThumbnail(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/95 text-(--brand-navy) shadow-(--shadow-md)"
                  aria-label="Remove thumbnail"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-(--brand-border-strong) bg-(--brand-surface) px-4 text-center transition hover:border-(--brand-red) hover:bg-(--brand-red-subtle)"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-white text-(--brand-red) shadow-(--shadow-xs)">
                  <ImagePlus size={18} />
                </span>
                <span className="mt-2 text-sm font-semibold text-(--brand-navy)">
                  Choose thumbnail
                </span>
                <span className="mt-0.5 text-xs text-(--brand-text-muted)">
                  PNG, JPG, WEBP or GIF · max 5 MB
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-(--brand-border) pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-10 rounded-md border border-(--brand-border) px-4 text-sm font-semibold text-(--brand-navy) hover:bg-(--brand-surface) disabled:opacity-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center gap-3 rounded-md bg-(--brand-red) px-5 text-sm font-bold text-white hover:bg-(--brand-red-hover) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {saving ? "Saving..." : product ? "Save changes" : "Add product"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
