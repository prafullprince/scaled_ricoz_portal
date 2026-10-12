"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Phone, X } from "lucide-react";
import api from "@/services/axios";
import { DashboardCard, DashboardEmptyState } from "./DashboardPrimitives";
import type { Service, ServiceRequest } from "@/services/services.service";

export function ServiceAdminView({ requestsOnly = false }: { requestsOnly?: boolean }) {
  const [services, setServices] = useState<Service[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [serviceResponse, requestResponse] = await Promise.all([
        api.get<{ services: Service[] }>("/services/admin/list"),
        api.get<{ requests: ServiceRequest[] }>("/services/admin/requests"),
      ]);
      setServices(serviceResponse.data.services);
      setRequests(requestResponse.data.requests);
    } finally {
      setLoading(false);
    }
  }

  // Initial admin data is server-owned and must be fetched after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedRequest(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function act(path: string, body?: unknown) {
    try {
      await api.post(path, body);
      setMessage("Updated successfully.");
      await load();
    } catch {
      setMessage("That action could not be completed.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">Services admin</p>
        <h1 className="mt-2 text-3xl font-bold text-(--brand-navy)">{requestsOnly ? "Service requests" : "Service catalog"}</h1>
        <p className="mt-2 text-sm text-(--brand-text-secondary)">Manage the database-backed services catalog and customer requests.</p>
        {!requestsOnly ? <Link href="/dashboard/admin/services/create" className="mt-5 inline-flex rounded-(--radius-md) bg-(--brand-red) px-4 py-2.5 text-sm font-bold text-white">Create service</Link> : null}
      </div>
      {message ? <p className="rounded-(--radius-md) bg-(--status-info-bg) p-3 text-sm text-(--status-info)">{message}</p> : null}
      <DashboardCard>
        {loading ? <p className="text-sm text-(--brand-text-secondary)">Loading...</p> : requestsOnly ? (
          requests.length ? <div className="divide-y divide-(--brand-border)">{requests.map((request) => <div key={request._id} role="button" tabIndex={0} onClick={() => setSelectedRequest(request)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedRequest(request); }} className="group flex cursor-pointer flex-col gap-3 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--brand-red-pale)"><div><p className="font-bold text-(--brand-navy)">{request.projectTitle}</p><p className="mt-1 text-sm text-(--brand-text-secondary)">{request.serviceId?.title} · {request.customerId?.name ?? "Customer"}</p><p className="mt-1 text-xs text-(--brand-text-muted)">{request.status} · {request.budget ?? "Budget not specified"}</p></div><div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>{["PENDING", "UNDER_REVIEW"].includes(request.status) ? <><button type="button" onClick={() => void act(`/services/admin/requests/${request._id}/accept`)} className="rounded-(--radius-md) bg-(--status-success) px-3 py-2 text-xs font-bold text-white">Accept</button><button type="button" onClick={() => void act(`/services/admin/requests/${request._id}/decline`, {})} className="rounded-(--radius-md) bg-(--status-danger) px-3 py-2 text-xs font-bold text-white">Decline</button></> : request.status === "ACCEPTED" ? <button type="button" onClick={() => void act(`/services/admin/requests/${request._id}/done`)} className="rounded-(--radius-md) bg-(--brand-navy) px-3 py-2 text-xs font-bold text-white">Mark done</button> : null}<span className="text-xs font-semibold text-(--brand-text-muted) group-hover:text-(--brand-red)">View details</span></div></div>)}</div> : <DashboardEmptyState title="No service requests" description="Customer requests will appear here." />
        ) : services.length ? <div className="divide-y divide-(--brand-border)">{services.map((service) => <div key={service._id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-(--brand-red)">{service.category} · {service.status}</p><p className="mt-1 font-bold text-(--brand-navy)">{service.title}</p><p className="mt-1 text-sm text-(--brand-text-secondary)">{service.shortDescription}</p></div>{service.status === "DRAFT" || service.status === "UNPUBLISHED" ? <button type="button" onClick={() => void act(`/services/admin/${service._id}/status`, { status: "PUBLISHED" })} className="rounded-(--radius-md) bg-(--brand-red) px-3 py-2 text-xs font-bold text-white">Publish</button> : service.status === "PUBLISHED" ? <button type="button" onClick={() => void act(`/services/admin/${service._id}/status`, { status: "UNPUBLISHED" })} className="rounded-(--radius-md) border border-(--brand-border) px-3 py-2 text-xs font-bold text-(--brand-navy)">Unpublish</button> : null}</div>)}</div> : <DashboardEmptyState title="No services yet" description="Create the first service for the public catalog." />}
      </DashboardCard>
      {selectedRequest ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-(--brand-navy)/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={() => setSelectedRequest(null)}><section role="dialog" aria-modal="true" aria-labelledby="service-request-details-title" onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-(--radius-xl) bg-white shadow-(--shadow-xl) sm:rounded-(--radius-xl)"><div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-(--brand-border) bg-white px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-(--brand-red)">Service request details</p><h2 id="service-request-details-title" className="mt-1 text-xl font-bold text-(--brand-navy)">{selectedRequest.projectTitle}</h2><p className="mt-1 text-sm text-(--brand-text-secondary)">{selectedRequest.serviceId?.title ?? "Service"}</p></div><button type="button" onClick={() => setSelectedRequest(null)} aria-label="Close service request details" className="rounded-(--radius-md) p-2 text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"><X size={19} /></button></div><div className="space-y-7 px-5 py-6 sm:px-7"><div className="grid gap-4 rounded-(--radius-lg) bg-(--brand-surface) p-4 sm:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--brand-text-muted)">Status</p><p className="mt-1 text-sm font-bold text-(--brand-navy)">{selectedRequest.status.replace("_", " ")}</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--brand-text-muted)">Submitted</p><p className="mt-1 text-sm font-bold text-(--brand-navy)">{new Date(selectedRequest.createdAt).toLocaleDateString()}</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-(--brand-text-muted)">Budget</p><p className="mt-1 text-sm font-bold text-(--brand-navy)">{selectedRequest.budget ?? "Not specified"}</p></div></div><div><h3 className="text-sm font-bold uppercase tracking-[0.1em] text-(--brand-text-muted)">Customer</h3><p className="mt-2 font-bold text-(--brand-navy)">{selectedRequest.customerId?.name ?? "Customer"}</p><p className="mt-1 flex items-center gap-2 text-sm text-(--brand-text-secondary)"><Mail size={14} />{selectedRequest.customerId?.email ?? "Email unavailable"}</p>{selectedRequest.customerId?.phoneNumber ? <p className="mt-1 flex items-center gap-2 text-sm text-(--brand-text-secondary)"><Phone size={14} />{selectedRequest.customerId.phoneNumber}</p> : null}</div><div><h3 className="text-sm font-bold uppercase tracking-[0.1em] text-(--brand-text-muted)">Project description</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-(--brand-text-secondary)">{selectedRequest.projectDescription}</p></div>{selectedRequest.requirements.length ? <div><h3 className="text-sm font-bold uppercase tracking-[0.1em] text-(--brand-text-muted)">Requirements</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-(--brand-text-secondary)">{selectedRequest.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}{selectedRequest.expectedTimeline || selectedRequest.additionalRequirements ? <div className="grid gap-5 border-t border-(--brand-border) pt-6 sm:grid-cols-2">{selectedRequest.expectedTimeline ? <div><h3 className="text-xs font-bold uppercase tracking-[0.1em] text-(--brand-text-muted)">Timeline</h3><p className="mt-2 text-sm text-(--brand-text-secondary)">{selectedRequest.expectedTimeline}</p></div> : null}{selectedRequest.additionalRequirements ? <div><h3 className="text-xs font-bold uppercase tracking-[0.1em] text-(--brand-text-muted)">Additional requirements</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">{selectedRequest.additionalRequirements}</p></div> : null}</div> : null}{selectedRequest.declineReason ? <div className="rounded-(--radius-md) bg-(--status-danger-bg) p-3 text-sm text-(--status-danger)"><strong>Decline reason:</strong> {selectedRequest.declineReason}</div> : null}<div className="flex flex-wrap gap-3 border-t border-(--brand-border) pt-6">{["PENDING", "UNDER_REVIEW"].includes(selectedRequest.status) ? <><button type="button" onClick={() => { void act(`/services/admin/requests/${selectedRequest._id}/accept`); setSelectedRequest(null); }} className="rounded-(--radius-md) bg-(--status-success) px-4 py-2.5 text-sm font-bold text-white">Accept request</button><button type="button" onClick={() => { void act(`/services/admin/requests/${selectedRequest._id}/decline`, {}); setSelectedRequest(null); }} className="rounded-(--radius-md) bg-(--status-danger) px-4 py-2.5 text-sm font-bold text-white">Decline request</button></> : null}</div></div></section></div> : null}
    </div>
  );
}
