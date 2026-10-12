"use client";

import { useEffect, useState } from "react";
import { DashboardCard, DashboardEmptyState } from "./DashboardPrimitives";
import { ServicesService, type CustomerProject, type ServiceRequest } from "@/services/services.service";

type ServiceView = "REQUESTS" | "ACCEPTED" | "DONE";

export function CustomerServicesView({ projectsOnly = false }: { projectsOnly?: boolean }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [projects, setProjects] = useState<CustomerProject[]>([]);
  const [view, setView] = useState<ServiceView>(projectsOnly ? "ACCEPTED" : "REQUESTS");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([ServicesService.myRequests(), ServicesService.myProjects()])
      .then(([nextRequests, nextProjects]) => { setRequests(nextRequests); setProjects(nextProjects); })
      .finally(() => setLoading(false));
  }, []);

  const acceptedProjects = projects.filter((project) => project.status !== "COMPLETED" && project.status !== "CANCELLED");
  const doneProjects = projects.filter((project) => project.status === "COMPLETED");
  const records = view === "REQUESTS" ? requests.filter((request) => request.status !== "ACCEPTED") : view === "ACCEPTED" ? acceptedProjects : doneProjects;
  const title = view === "REQUESTS" ? "Service requests" : view === "ACCEPTED" ? "Accepted services" : "Done services";

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">Customer workspace</p><h1 className="mt-2 text-3xl font-bold text-(--brand-navy)">{projectsOnly ? "My projects" : "My services"}</h1><p className="mt-2 text-sm text-(--brand-text-secondary)">Track your service requests from submission through completion.</p></div>
      {!projectsOnly ? <div className="flex w-fit flex-wrap gap-1 rounded-full bg-(--brand-surface) p-1" role="tablist" aria-label="Service lifecycle"><button type="button" role="tab" aria-selected={view === "REQUESTS"} onClick={() => setView("REQUESTS")} className={`rounded-full px-4 py-2 text-xs font-bold ${view === "REQUESTS" ? "bg-(--brand-navy) text-white" : "text-(--brand-text-secondary)"}`}>Requests ({requests.filter((request) => request.status !== "ACCEPTED").length})</button><button type="button" role="tab" aria-selected={view === "ACCEPTED"} onClick={() => setView("ACCEPTED")} className={`rounded-full px-4 py-2 text-xs font-bold ${view === "ACCEPTED" ? "bg-(--brand-navy) text-white" : "text-(--brand-text-secondary)"}`}>Accepted ({acceptedProjects.length})</button><button type="button" role="tab" aria-selected={view === "DONE"} onClick={() => setView("DONE")} className={`rounded-full px-4 py-2 text-xs font-bold ${view === "DONE" ? "bg-(--brand-navy) text-white" : "text-(--brand-text-secondary)"}`}>Done ({doneProjects.length})</button></div> : null}
      <DashboardCard>
        {loading ? <p className="text-sm text-(--brand-text-secondary)">Loading...</p> : records.length ? <div className="divide-y divide-(--brand-border)">{records.map((record) => { const isProject = view !== "REQUESTS" || projectsOnly; const project = record as CustomerProject; const request = record as ServiceRequest; return <div key={record._id} className="flex flex-col gap-3 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-(--brand-red)">{record.serviceId?.title ?? "Service"}</p><p className="mt-1 font-bold text-(--brand-navy)">{isProject ? project.title : request.projectTitle}</p><p className="mt-1 text-xs text-(--brand-text-muted)">{new Date(record.createdAt).toLocaleDateString()}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${view === "DONE" ? "bg-(--status-success-bg) text-(--status-success)" : "bg-(--brand-surface) text-(--brand-text-secondary)"}`}>{isProject && view === "DONE" ? "DONE" : isProject ? "ACCEPTED" : request.status.replace("_", " ")}</span></div>; })}</div> : <DashboardEmptyState title={`No ${title.toLowerCase()} yet`} description={view === "REQUESTS" ? "Browse the services catalog to start a request." : view === "ACCEPTED" ? "Accepted service requests will appear here." : "Completed services will appear here."} />}
      </DashboardCard>
    </div>
  );
}
