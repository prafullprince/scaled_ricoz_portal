"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Filter,
  Mail,
  MessageSquareText,
  MapPin,
  Search,
  X,
} from "lucide-react";
import api from "@/services/axios";
import { ChatService } from "@/services/chat.service";
import { DashboardCard, DashboardEmptyState } from "./DashboardPrimitives";
import type { Application, Opportunity } from "@/services/recruitment.service";

type RecruitmentAssessment = {
  _id: string;
  applicationId: string;
  title: string;
  instructions: string;
  deadline: string;
  status: "ASSIGNED" | "SUBMITTED" | "REVIEWED";
  submissionText?: string;
  submissionFileName?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

type AdminApplication = Application & {
  userId?: {
    _id?: string;
    name: string;
    email: string;
    roles?: string[];
    profile_pic?: string;
    about?: string;
    phoneNumber?: string;
    status?: string;
    emailVerifiedAt?: string | null;
    createdAt?: string;
  };
};

type ApplicationStage = "RECEIVED" | "SHORTLISTED" | "HIRED" | "NOT_INTERESTED";

const applicationStages: Array<{
  key: ApplicationStage;
  label: string;
  status: Application["status"];
}> = [
  { key: "RECEIVED", label: "Received", status: "APPLIED" },
  { key: "SHORTLISTED", label: "Shortlisted", status: "UNDER_REVIEW" },
  { key: "HIRED", label: "Hired", status: "ACCEPTED" },
  { key: "NOT_INTERESTED", label: "Not interested", status: "DECLINED" },
];

export function AdminRecruitmentView({
  applicationsOnly = false,
  initialOpportunityId,
  initialApplicantSearch,
}: {
  applicationsOnly?: boolean;
  initialOpportunityId?: string;
  initialApplicantSearch?: string;
}) {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [opportunityCounts, setOpportunityCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] =
    useState<AdminApplication | null>(null);
  const [roleGrantApplication, setRoleGrantApplication] =
    useState<AdminApplication | null>(null);
  const [roleEndDate, setRoleEndDate] = useState("");
  const [opportunityType, setOpportunityType] = useState<"INTERNSHIP" | "JOB">("INTERNSHIP");
  const [applicationStage, setApplicationStage] = useState<ApplicationStage>(initialApplicantSearch ? "HIRED" : "RECEIVED");
  const [applicantSearch, setApplicantSearch] = useState(initialApplicantSearch ?? "");
  const [applicantLocation, setApplicantLocation] = useState("");
  const [applicantSkills, setApplicantSkills] = useState("");
  const [applicationPage, setApplicationPage] = useState(1);
  const [applicationTotal, setApplicationTotal] = useState(0);
  const [applicationTotalPages, setApplicationTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const pendingDetailNavigation = useRef<"first" | "last" | null>(null);
  const [assessmentItems, setAssessmentItems] = useState<RecruitmentAssessment[]>([]);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentFormOpen, setAssessmentFormOpen] = useState(false);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentInstructions, setAssessmentInstructions] = useState("");
  const [assessmentDeadline, setAssessmentDeadline] = useState("");
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [assessmentMessage, setAssessmentMessage] = useState("");
  const [minimumAssessmentDeadline] = useState(() =>
    (() => {
      const date = new Date(Date.now() + 60_000);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      return date.toISOString().slice(0, 16);
    })(),
  );
  const [minimumRoleEndDate] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!applicationsOnly) {
        const [opportunityResponse, countResponse] = await Promise.all([
          api.get<{ opportunities: Opportunity[] }>("/recruitment/admin/opportunities"),
          api.get<{ counts: Array<{ _id: string; total: number }> }>("/recruitment/admin/applications/summary"),
        ]);
        setOpportunities(opportunityResponse.data.opportunities);
        setOpportunityCounts(Object.fromEntries(
          countResponse.data.counts.map((item) => [item._id, item.total]),
        ));
        return;
      }

      const stage = applicationStages.find((item) => item.key === applicationStage);
      const params: Record<string, string> = {
        page: String(applicationPage),
        limit: "10",
        status: stage?.status ?? "APPLIED",
      };
      if (initialOpportunityId) params.opportunityId = initialOpportunityId;
      if (applicantSearch.trim()) params.search = applicantSearch.trim();
      if (applicantLocation.trim()) params.location = applicantLocation.trim();
      if (applicantSkills.trim()) params.skills = applicantSkills.trim();

      const [applicationResponse, opportunityResponse] = await Promise.all([
        api.get<{
          applications: AdminApplication[];
          pagination: { page: number; total: number; totalPages: number };
          statusCounts: Record<string, number>;
        }>("/recruitment/admin/applications", { params }),
        initialOpportunityId
          ? api.get<{ opportunities: Opportunity[] }>("/recruitment/admin/opportunities")
          : Promise.resolve(null),
      ]);
      setApplications(applicationResponse.data.applications);
      if (pendingDetailNavigation.current && applicationResponse.data.applications.length) {
        const target = pendingDetailNavigation.current === "first"
          ? applicationResponse.data.applications[0]
          : applicationResponse.data.applications[applicationResponse.data.applications.length - 1];
        setSelectedApplication(target);
        setAssessmentFormOpen(false);
        pendingDetailNavigation.current = null;
      }
      setApplicationTotal(applicationResponse.data.pagination.total);
      setApplicationTotalPages(Math.max(1, applicationResponse.data.pagination.totalPages));
      setStatusCounts(applicationResponse.data.statusCounts);
      if (opportunityResponse) setOpportunities(opportunityResponse.data.opportunities);
      else setOpportunities([]);
    } catch (error) {
      pendingDetailNavigation.current = null;
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      setMessage(responseMessage ?? "Recruitment data could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    applicantLocation,
    applicantSearch,
    applicantSkills,
    applicationPage,
    applicationStage,
    applicationsOnly,
    initialOpportunityId,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedApplicationId = selectedApplication?._id;
  useEffect(() => {
    if (!selectedApplicationId) return;
    let active = true;
    void Promise.resolve()
      .then(async () => {
        if (!active) return;
        setAssessmentLoading(true);
        setAssessmentMessage("");
        const response = await api.get<{ assignments: RecruitmentAssessment[] }>(
          `/recruitment/admin/applications/${selectedApplicationId}/assignments`,
        );
        if (active) setAssessmentItems(response.data.assignments);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const responseMessage = (error as { response?: { data?: { message?: string } } })
          ?.response?.data?.message;
        setAssessmentMessage(responseMessage ?? "Assignments could not be loaded.");
      })
      .finally(() => {
        if (active) setAssessmentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedApplicationId]);

  const filteredOpportunities = useMemo(
    () => opportunities.filter((opportunity) => opportunity.type === opportunityType),
    [opportunities, opportunityType],
  );
  const activeOpportunity = opportunities.find(
    (opportunity) => opportunity._id === initialOpportunityId,
  );
  const selectedApplicationIndex = selectedApplication
    ? applications.findIndex((application) => application._id === selectedApplication._id)
    : -1;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeApplicationDetails();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busyAction]);

  async function action(path: string, body?: unknown) {
    setMessage("");
    setBusyAction(path);
    try {
      await api.post(path, body);
      setMessage("Updated successfully.");
      if (selectedApplication && path.includes(`/applications/${selectedApplication._id}/`)) {
        closeApplicationDetails();
      }
      await load();
    } catch {
      setMessage("That action could not be completed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadResume(application: AdminApplication) {
    setBusyAction(`resume:${application._id}`);
    try {
      const response = await api.get(
        `/recruitment/admin/applications/${application._id}/resume`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = application.resumeFileName ?? "resume.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("We could not download this resume.");
    } finally {
      setBusyAction(null);
    }
  }

  async function startApplicantChat(application: AdminApplication) {
    const applicantId = application.userId?._id;
    if (!applicantId) {
      setMessage("This applicant account is unavailable for chat.");
      return;
    }
    setBusyAction(`chat:${application._id}`);
    try {
      const conversation = await ChatService.direct(applicantId);
      router.push(`/dashboard/messages?conversation=${encodeURIComponent(conversation._id)}`);
    } catch (error) {
      const responseMessage = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setAssessmentMessage(responseMessage ?? "Could not start a chat with this applicant.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createAssessment(application: AdminApplication) {
    setAssessmentBusy(true);
    setAssessmentMessage("");
    try {
      const response = await api.post<{ assignment: RecruitmentAssessment }>(
        `/recruitment/admin/applications/${application._id}/assignments`,
        {
          title: assessmentTitle,
          instructions: assessmentInstructions,
          deadline: new Date(assessmentDeadline).toISOString(),
        },
      );
      setAssessmentItems((current) => [response.data.assignment, ...current]);
      setAssessmentTitle("");
      setAssessmentInstructions("");
      setAssessmentDeadline("");
      setAssessmentFormOpen(false);
      setAssessmentMessage("Assignment sent to the applicant.");
    } catch (error) {
      const responseMessage = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setAssessmentMessage(responseMessage ?? "The assignment could not be sent.");
    } finally {
      setAssessmentBusy(false);
    }
  }

  async function markAssessmentReviewed(application: AdminApplication, assessment: RecruitmentAssessment) {
    setAssessmentBusy(true);
    setAssessmentMessage("");
    try {
      const response = await api.post<{ assignment: RecruitmentAssessment }>(
        `/recruitment/admin/applications/${application._id}/assignments/${assessment._id}/review`,
      );
      setAssessmentItems((current) =>
        current.map((item) => item._id === assessment._id ? response.data.assignment : item),
      );
      setAssessmentMessage("Assignment marked as reviewed.");
    } catch (error) {
      const responseMessage = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setAssessmentMessage(responseMessage ?? "The assignment could not be reviewed.");
    } finally {
      setAssessmentBusy(false);
    }
  }

  async function downloadAssessmentSubmission(application: AdminApplication, assessment: RecruitmentAssessment) {
    setAssessmentBusy(true);
    try {
      const response = await api.get(
        `/recruitment/admin/applications/${application._id}/assignments/${assessment._id}/submission-file`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = assessment.submissionFileName ?? "assignment-submission";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const responseMessage = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setAssessmentMessage(responseMessage ?? "The submitted file could not be downloaded.");
    } finally {
      setAssessmentBusy(false);
    }
  }

  function openRoleGrant(application: AdminApplication) {
    setRoleGrantApplication(application);
    setRoleEndDate("");
  }

  function openApplicationDetails(application: AdminApplication) {
    setAssessmentFormOpen(false);
    setAssessmentTitle("");
    setAssessmentInstructions("");
    setAssessmentDeadline("");
    setAssessmentMessage("");
    setSelectedApplication(application);
  }

  function closeApplicationDetails() {
    setSelectedApplication(null);
    setAssessmentFormOpen(false);
  }

  function applicationActionButtons(application: AdminApplication) {
    const opportunity = application.opportunityId as Opportunity;
    const shortlistPath = `/recruitment/admin/applications/${application._id}/shortlist`;
    const declinePath = `/recruitment/admin/applications/${application._id}/decline`;
    const acceptPath = `/recruitment/admin/applications/${application._id}/accept`;

    if (application.status === "DECLINED") {
      return (
        <span className="rounded-full bg-(--status-danger-bg) px-3 py-2 text-xs font-bold text-(--status-danger)">
          Not interested
        </span>
      );
    }
    if (application.status === "ACCEPTED") {
      if (!application.roleGrantedAt) {
        return (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => openRoleGrant(application)}
            className="rounded-(--radius-md) bg-(--brand-navy) px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Make {opportunity?.type === "JOB" ? "employee" : "intern"}
          </button>
        );
      }
      if (application.offerStatus === "SENT" || application.offerStatus === "VIEWED" || application.offerStatus === "ACCEPTED") {
        return (
          <Link
            href={`/dashboard/admin/recruitment-pipeline?application=${encodeURIComponent(application._id)}`}
            className="rounded-(--radius-md) border border-(--brand-border) px-3 py-2 text-xs font-bold text-(--brand-navy)"
          >
            Manage offer
          </Link>
        );
      }
      if (!application.userId?.emailVerifiedAt) {
        return (
          <span
            title="The candidate must activate and verify their Ricoz account before an offer can be emailed."
            className="rounded-full bg-[#fff4e5] px-3 py-2 text-xs font-bold text-[#9a5700]"
          >
            Awaiting account activation
          </span>
        );
      }
      return (
        <Link
          href={`/dashboard/admin/recruitment-pipeline?application=${encodeURIComponent(application._id)}`}
          className="rounded-(--radius-md) bg-(--brand-red) px-3 py-2 text-xs font-bold text-white"
        >
          Continue offer in pipeline
        </Link>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {application.status === "APPLIED" ? (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void action(shortlistPath)}
            className="rounded-(--radius-md) bg-[#e8fbe4] px-3 py-2 text-xs font-bold text-[#31802a] disabled:opacity-50"
          >
            {busyAction === shortlistPath ? "Shortlisting..." : "Shortlist"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => void action(declinePath, {})}
          className="rounded-(--radius-md) bg-(--status-danger-bg) px-3 py-2 text-xs font-bold text-(--status-danger) disabled:opacity-50"
        >
          {busyAction === declinePath ? "Updating..." : "Not interested"}
        </button>
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => void action(acceptPath)}
          className="rounded-(--radius-md) bg-(--brand-red) px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {busyAction === acceptPath ? "Updating..." : "Hire"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 px-1 pb-8">
      {applicationsOnly ? (
        <div className="flex flex-col gap-5 rounded-3xl border border-[#e4eaf1] bg-[radial-gradient(ellipse_at_top_right,_rgba(7,152,229,0.1),_transparent_45%),linear-gradient(120deg,#ffffff_0%,#f7faff_100%)] px-5 py-6 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#078bd1]">
              Recruitment workspace
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-(--brand-navy) sm:text-3xl">
              {activeOpportunity
                ? `Applications for ${activeOpportunity.title} ${activeOpportunity.type === "INTERNSHIP" ? "internship" : "job"}`
                : "Applications received"}
            </h1>
            <p className="mt-2 text-sm text-(--brand-text-secondary)">
              Keep candidate conversations, screening, and next steps in one place.
            </p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search applicants by name</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--brand-text-muted)" />
            <input
              value={applicantSearch}
              onChange={(event) => {
                setApplicantSearch(event.target.value);
                setApplicationPage(1);
              }}
              placeholder="Search applicants by name"
              className="h-11 w-full rounded-xl border border-[#dce3eb] bg-white pl-10 pr-3 text-sm outline-none shadow-sm transition focus:border-[#078bd1] focus:ring-4 focus:ring-[#078bd1]/10"
            />
          </label>
          <Link
            href="/dashboard/admin/applications/add-candidate"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-(--brand-red) px-4 text-sm font-bold text-white shadow-sm transition hover:bg-(--brand-red-hover)"
          >
            Add external candidate
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-3xl border border-[#e4eaf1] bg-[radial-gradient(ellipse_at_top_right,_rgba(201,29,32,0.08),_transparent_45%),linear-gradient(120deg,#ffffff_0%,#fbfbfc_100%)] px-5 py-6 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--brand-red)">
              Recruitment workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-(--brand-navy)">
              Opportunities
            </h1>
            <p className="mt-2 text-sm text-(--brand-text-secondary)">
              Create roles, keep postings up to date, and manage incoming candidates.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/admin/jobs/create"
              className="inline-flex items-center justify-center rounded-xl bg-(--brand-red) px-4 py-3 text-sm font-bold text-white shadow-[0_5px_14px_rgba(201,29,32,0.18)] transition hover:-translate-y-0.5 hover:bg-(--brand-red-hover)"
            >
              Create job
            </Link>
            <Link
              href="/dashboard/admin/internships/create"
              className="inline-flex items-center justify-center rounded-xl border border-(--brand-border) bg-white px-4 py-3 text-sm font-bold text-(--brand-navy) transition hover:border-(--brand-red) hover:bg-(--brand-red-subtle)"
            >
              Create internship
            </Link>
          </div>
        </div>
      )}
      {message ? (
        <p className="rounded-(--radius-md) bg-(--status-info-bg) p-3 text-sm text-(--status-info)">
          {message}
        </p>
      ) : null}
      {loading ? (
        <DashboardCard>Loading recruitment data...</DashboardCard>
      ) : applicationsOnly ? (
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_270px]">
          <nav aria-label="Application status" className="h-fit rounded-2xl border border-[#e4eaf1] bg-white p-2 shadow-sm xl:sticky xl:top-5">
            {applicationStages.map((stage) => {
              const selected = applicationStage === stage.key;
              const count = statusCounts[stage.status] ?? 0;
              return (
                <button
                  key={stage.key}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => {
                    setApplicationStage(stage.key);
                    setApplicationPage(1);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-(--radius-md) px-3 text-left text-sm font-semibold transition ${
                    selected
                      ? "bg-[#eaf7ff] text-[#078bd1] shadow-sm"
                      : "text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"
                  }`}
                >
                  <span>{stage.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-[#078bd1] text-white" : "bg-(--brand-surface) text-(--brand-text-muted)"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#e4eaf1] bg-white px-4 py-3 text-sm shadow-sm">
              <p aria-live="polite"><span className="font-bold text-(--brand-navy)">{applicationTotal}</span> <span className="text-(--brand-text-secondary)">candidates in this view</span></p>
              {initialOpportunityId ? (
                <Link href="/dashboard/admin/applications" className="font-semibold text-[#078bd1] hover:underline">
                  All applications
                </Link>
              ) : null}
            </div>
            {applications.length ? (
              <div className="space-y-4">
                {applications.map((application) => {
                  const opportunity = application.opportunityId as Opportunity;
                  return (
                    <article key={application._id} className="overflow-hidden rounded-2xl border border-[#e4eaf1] bg-white shadow-[0_4px_16px_rgba(24,36,58,0.045)] transition hover:border-[#cbdbea] hover:shadow-[0_10px_26px_rgba(24,36,58,0.08)]">
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#18243a] to-[#344766] text-sm font-bold text-white ring-2 ring-[#edf2f8]">
                            {application.userId?.profile_pic ? (
                              <img src={application.userId.profile_pic} alt="" className="size-full object-cover" />
                            ) : (
                              application.userId?.name?.slice(0, 1).toUpperCase() || "A"
                            )}
                          </div>
                          <div className="min-w-0">
                            <h2 className="font-bold text-(--brand-navy)">
                              {application.userId?.name ?? "Applicant"}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--brand-text-secondary)">
                              {application.address ? (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={13} />
                                  {application.address}
                                </span>
                              ) : null}
                              {application.userId?.email ? (
                                <span>{application.userId.email}</span>
                              ) : null}
                              {(application.candidatePhone || application.userId?.phoneNumber) ? (
                                <span>{application.candidatePhone || application.userId?.phoneNumber}</span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-(--brand-text-muted)">
                              Applied {new Date(application.appliedAt).toLocaleDateString()}
                              {opportunity?.title ? ` · ${opportunity.title}` : ""}
                              {application.source === "DIRECT" ? " · Added by recruiter" : ""}
                              {application.source === "EXTERNAL" ? ` · ${application.sourceDetail || "External source"}` : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openApplicationDetails(application)}
                          className="min-h-10 shrink-0 rounded-xl border border-[#c7dff3] bg-[#f8fcff] px-4 text-xs font-bold text-[#078bd1] transition hover:border-[#078bd1] hover:bg-[#eff8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078bd1]"
                        >
                          View full application
                        </button>
                      </div>

                      {application.userId?.about ? (
                        <div className="border-y border-[#e5eff9] bg-[#f5faff] px-4 py-3 sm:px-5">
                          <h3 className="text-xs font-bold text-(--brand-navy)">Profile summary</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--brand-text-secondary)">
                            {application.userId.about}
                          </p>
                        </div>
                      ) : null}

                      {application.screeningAnswers?.length ? (
                        <div className="border-b border-[#e5eff9] bg-[#f8fbff] px-4 py-3 sm:px-5">
                          <h3 className="text-xs font-bold text-(--brand-navy)">Assessment and custom questions</h3>
                          <dl className="mt-2 space-y-2">
                            {application.screeningAnswers.slice(0, 2).map((item) => (
                              <div key={item.question} className="grid gap-1 text-xs sm:grid-cols-[130px_minmax(0,1fr)]">
                                <dt className="font-semibold text-(--brand-text-secondary)">{item.question}</dt>
                                <dd className="text-(--brand-text)">{item.answer}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-3 border-t border-(--brand-border) p-4 sm:flex-row sm:items-center sm:justify-between">
                        {application.resumeFileName ? (
                          <button
                            type="button"
                            disabled={busyAction === `resume:${application._id}`}
                            onClick={() => void downloadResume(application)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#078bd1] disabled:opacity-50"
                          >
                            <Download size={14} />
                            {application.resumeFileName}
                          </button>
                        ) : application.resumeUrl ? (
                          <a href={application.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#078bd1]">
                            <Download size={14} />Open source resume
                          </a>
                        ) : (
                          <span className="text-xs text-(--brand-text-muted)">No resume uploaded</span>
                        )}
                        {applicationActionButtons(application)}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <DashboardEmptyState
                title={`No ${applicationStages.find((stage) => stage.key === applicationStage)?.label.toLowerCase() ?? ""} applications`}
                description="Applications matching this status and your filters will appear here."
              />
            )}
            {applicationTotalPages > 1 ? (
              <nav aria-label="Application pages" className="mt-5 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={applicationPage <= 1}
                  onClick={() => setApplicationPage((page) => Math.max(1, page - 1))}
                  className="inline-flex items-center gap-1 rounded-(--radius-md) border border-(--brand-border) bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-(--brand-text-secondary)">
                  Page {applicationPage} of {applicationTotalPages}
                </span>
                <button
                  type="button"
                  disabled={applicationPage >= applicationTotalPages}
                  onClick={() => setApplicationPage((page) => Math.min(applicationTotalPages, page + 1))}
                  className="inline-flex items-center gap-1 rounded-(--radius-md) border border-(--brand-border) bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </nav>
            ) : null}
          </section>

          <aside className="h-fit rounded-2xl border border-[#e4eaf1] bg-white shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-(--brand-border) px-4 py-4 font-bold text-(--brand-navy)">
              <Filter size={17} /> Filters
            </h2>
            <div className="space-y-4 p-4">
              <label className="block text-xs font-semibold text-(--brand-text-secondary)">
                Applicants&apos; locations
                <input
                  value={applicantLocation}
                  onChange={(event) => {
                    setApplicantLocation(event.target.value);
                    setApplicationPage(1);
                  }}
                  placeholder="e.g. Mumbai or Maharashtra"
                  className="mt-2 h-11 w-full rounded-xl border border-[#dce3eb] bg-[#fcfdff] px-3 text-sm font-normal outline-none transition focus:border-[#078bd1] focus:ring-4 focus:ring-[#078bd1]/10"
                />
              </label>
              <label className="block text-xs font-semibold text-(--brand-text-secondary)">
                Skills / profile keywords
                <input
                  value={applicantSkills}
                  onChange={(event) => {
                    setApplicantSkills(event.target.value);
                    setApplicationPage(1);
                  }}
                  placeholder="e.g. Java"
                  className="mt-2 h-11 w-full rounded-xl border border-[#dce3eb] bg-[#fcfdff] px-3 text-sm font-normal outline-none transition focus:border-[#078bd1] focus:ring-4 focus:ring-[#078bd1]/10"
                />
              </label>
              <div className="border-t border-(--brand-border) pt-4">
                <p className="text-xs font-bold text-(--brand-navy)">Application progress</p>
                <p className="mt-1 text-xs leading-5 text-(--brand-text-muted)">
                  Choose Received, Shortlisted, Hired, or Not interested from the left panel.
                </p>
              </div>
              <div className="flex justify-between gap-3 border-t border-(--brand-border) pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setApplicantLocation("");
                    setApplicantSkills("");
                    setApplicantSearch("");
                    setApplicationPage(1);
                  }}
                  className="text-xs font-semibold text-[#078bd1] hover:underline"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-xl bg-[#078bd1] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0676b4]"
                >
                  Show results
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div>
          <div className="mb-4 inline-flex gap-1 rounded-xl border border-[#e4eaf1] bg-white p-1.5 shadow-sm" role="tablist" aria-label="Opportunity type">
            {(["INTERNSHIP", "JOB"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={opportunityType === type}
                onClick={() => setOpportunityType(type)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  opportunityType === type
                    ? "bg-[#18243a] text-white shadow-sm"
                    : "text-(--brand-text-secondary) hover:bg-[#f3f6fa] hover:text-(--brand-navy)"
                }`}
              >
                {type === "INTERNSHIP" ? "Internships" : "Jobs"}
              </button>
            ))}
          </div>
          <DashboardCard>
            {filteredOpportunities.length ? (
              <div className="overflow-x-auto rounded-2xl border border-[#e4eaf1] bg-white shadow-sm">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="bg-[#f4f7fb] text-[11px] font-bold uppercase tracking-[0.08em] text-(--brand-text-muted)">
                    <tr>
                      <th className="px-5 py-4">Profile</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Applications</th>
                      <th className="px-4 py-4">Posted</th>
                      <th className="px-4 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--brand-border)">
                    {filteredOpportunities.map((opportunity) => (
                      <tr key={opportunity._id} className="text-sm transition-colors hover:bg-[#f9fbfe]">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-(--brand-navy)">{opportunity.title}</p>
                          <p className="mt-1 text-xs text-(--brand-text-muted)">
                            {opportunity.workMode === "REMOTE" ? "Work from home" : opportunity.location || opportunity.workMode}
                            {" · "}
                            {opportunity.employmentType === "PART_TIME" ? "Part time" : "Full time"}
                          </p>
                          <p className="mt-1 text-xs text-(--brand-text-muted)">
                            {opportunity.status === "PUBLISHED" ? "Active" : opportunity.status}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex min-w-24 justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                            opportunity.status === "PUBLISHED"
                              ? "bg-[#effbe8] text-[#34842b]"
                              : "bg-(--brand-surface) text-(--brand-text-secondary)"
                          }`}>
                            {opportunity.status === "PUBLISHED" ? "Active" : opportunity.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-(--brand-text-secondary)">
                          {opportunityCounts[opportunity._id] ?? 0}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-(--brand-text-muted)">
                          {new Date(opportunity.publishedAt ?? opportunity.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/dashboard/admin/applications?opportunity=${opportunity._id}`}
                              className="inline-flex min-h-9 items-center justify-center rounded-(--radius-md) bg-[#0798e5] px-3 text-xs font-bold text-white hover:bg-[#087ab6]"
                            >
                              View applications ({opportunityCounts[opportunity._id] ?? 0})
                            </Link>
                            {opportunity.status === "DRAFT" ? (
                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() => void action(`/recruitment/admin/opportunities/${opportunity._id}/status`, { status: "PUBLISHED" })}
                                className="rounded-(--radius-md) border border-(--brand-border) px-3 py-2 text-xs font-semibold text-(--brand-navy) disabled:opacity-50"
                              >
                                Publish
                              </button>
                            ) : opportunity.status === "PUBLISHED" ? (
                              <button
                                type="button"
                                disabled={busyAction !== null}
                                onClick={() => void action(`/recruitment/admin/opportunities/${opportunity._id}/status`, { status: "CLOSED" })}
                                className="rounded-(--radius-md) border border-(--brand-border) px-3 py-2 text-xs font-semibold text-(--brand-navy) disabled:opacity-50"
                              >
                                Close
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <DashboardEmptyState
                title={`No ${opportunityType === "INTERNSHIP" ? "internships" : "jobs"} yet`}
                description="Create an opportunity to start receiving applications."
              />
            )}
          </DashboardCard>
        </div>
      )}
      {roleGrantApplication ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-(--brand-navy)/50 p-5 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setRoleGrantApplication(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-grant-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-(--radius-xl) bg-white p-6 shadow-(--shadow-xl)"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--brand-red)">
                  Role conversion
                </p>
                <h2
                  id="role-grant-title"
                  className="mt-1 text-xl font-bold text-(--brand-navy)"
                >
                  Set role end date
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRoleGrantApplication(null)}
                aria-label="Close role conversion dialog"
                className="rounded-(--radius-md) p-2 text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-(--brand-text-secondary)">
              This applicant will become{" "}
              {(roleGrantApplication.opportunityId as Opportunity)?.type ===
              "JOB"
                ? "an employee"
                : "an intern"}{" "}
              until the selected date. After that, the work role will be removed
              and the account will retain USER.
            </p>
            <label className="mt-5 block text-sm font-semibold text-(--brand-navy)">
              Last date
              <input
                type="date"
                value={roleEndDate}
                min={minimumRoleEndDate}
                onChange={(event) => setRoleEndDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-(--radius-md) border border-(--brand-border) px-3 text-sm font-normal text-(--brand-text) outline-none focus:border-(--brand-red) focus:ring-4 focus:ring-(--brand-red-pale)"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRoleGrantApplication(null)}
                className="rounded-(--radius-md) border border-(--brand-border) px-4 py-2.5 text-sm font-bold text-(--brand-navy)"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!roleEndDate}
                onClick={() => {
                  void action(
                    `/recruitment/admin/applications/${roleGrantApplication._id}/${(roleGrantApplication.opportunityId as Opportunity)?.type === "JOB" ? "make-employee" : "make-intern"}`,
                    { endDate: roleEndDate },
                  );
                  setRoleGrantApplication(null);
                }}
                className="rounded-(--radius-md) bg-(--brand-red) px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Confirm conversion
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {selectedApplication ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#f6f8fb]"
          role="presentation"
          onMouseDown={closeApplicationDetails}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-details-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 z-10 border-b border-[#e4eaf1] bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
                  <p className="min-w-0 truncate text-sm text-(--brand-text-secondary)">
                    <span>Dashboard</span>
                    <span className="px-2">›</span>
                    <button
                      type="button"
                      onClick={closeApplicationDetails}
                      className="hover:text-[#078bd1]"
                    >
                      Applications received
                    </button>
                    <span className="px-2">›</span>
                    <span className="font-medium text-(--brand-text)">
                      {selectedApplication.userId?.name ?? "Applicant"}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={closeApplicationDetails}
                    aria-label="Close application details"
                    className="shrink-0 rounded-(--radius-md) p-2 text-(--brand-text-secondary) hover:bg-(--brand-surface-hover)"
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>
              <main className="mx-auto w-full max-w-5xl space-y-5 px-5 py-6 pb-10 sm:px-8 sm:py-8">
                <h1
                  id="application-details-title"
                  className="text-2xl font-bold tracking-[-0.035em] text-(--brand-navy) sm:text-[30px]"
                >
                  Applications for{" "}
                  {(selectedApplication.opportunityId as Opportunity)?.title ??
                    "opportunity"}
                </h1>

                <section className="overflow-hidden rounded-2xl border border-[#e4eaf1] bg-white shadow-[0_6px_24px_rgba(24,36,58,0.045)]">
                  <div className="flex flex-wrap items-center gap-3 border-b border-(--brand-border) px-5 py-4 sm:px-6">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedApplication.status === "ACCEPTED"
                          ? "bg-(--status-success-bg) text-(--status-success)"
                          : selectedApplication.status === "DECLINED"
                            ? "bg-(--status-danger-bg) text-(--status-danger)"
                            : selectedApplication.status === "UNDER_REVIEW"
                              ? "bg-[#eaf7ff] text-[#078bd1]"
                              : "bg-[#f3f4f6] text-(--brand-text-secondary)"
                      }`}
                    >
                      {applicationStages.find((stage) => stage.status === selectedApplication.status)?.label ?? selectedApplication.status}
                    </span>
                    <span className="text-sm text-(--brand-text-muted)">
                      Applied{" "}
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                      }).format(new Date(selectedApplication.appliedAt))}
                    </span>
                    {selectedApplication.source === "DIRECT" ? (
                      <span className="rounded-full bg-[#fff4e5] px-3 py-1 text-xs font-semibold text-[#9a5700]">
                        Added by recruiter
                      </span>
                    ) : selectedApplication.source === "EXTERNAL" ? (
                      <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#1645a2]">
                        {selectedApplication.sourceDetail || "External source"}
                      </span>
                    ) : null}
                  </div>
                  <div className="px-5 py-6 sm:px-7 sm:py-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-(--brand-navy)">
                          {selectedApplication.userId?.name ?? "Applicant"}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--brand-text-secondary)">
                          {selectedApplication.address ? (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={15} />
                              {selectedApplication.address}
                            </span>
                          ) : null}
                          {selectedApplication.userId?.email ? (
                            <a
                              href={`mailto:${selectedApplication.userId.email}`}
                              className="inline-flex items-center gap-1.5 text-[#078bd1] hover:underline"
                            >
                              <Mail size={15} />
                              {selectedApplication.userId.email}
                            </a>
                          ) : null}
                          {(selectedApplication.candidatePhone || selectedApplication.userId?.phoneNumber) ? (
                            <a
                              href={`tel:${selectedApplication.candidatePhone || selectedApplication.userId?.phoneNumber}`}
                              className="text-[#078bd1] hover:underline"
                            >
                              {selectedApplication.candidatePhone || selectedApplication.userId?.phoneNumber}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    {selectedApplication.userId?.about &&
                    selectedApplication.userId.about !== "Hey there! I am using First Chat." ? (
                      <div className="mt-7 grid gap-3 border-t border-[#edf0f4] pt-5 sm:grid-cols-[160px_minmax(0,1fr)]">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--brand-text-muted)">
                          About
                        </h3>
                        <p className="whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                          {selectedApplication.userId.about}
                        </p>
                      </div>
                    ) : null}
                    {selectedApplication.currentCompany ||
                    selectedApplication.experienceYears !== undefined ||
                    selectedApplication.skills?.length ||
                    selectedApplication.education ||
                    selectedApplication.experienceSummary ? (
                      <div className="mt-6 grid gap-x-3 gap-y-4 border-t border-[#edf0f4] pt-5 sm:grid-cols-[160px_minmax(0,1fr)]">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--brand-text-muted)">
                          Candidate details
                        </h3>
                        <dl className="grid gap-3 sm:grid-cols-2">
                          {selectedApplication.currentCompany ? (
                            <div><dt className="text-xs font-semibold text-(--brand-text-muted)">Current company</dt><dd className="mt-1 text-sm text-(--brand-text-secondary)">{selectedApplication.currentCompany}</dd></div>
                          ) : null}
                          {selectedApplication.experienceYears !== undefined ? (
                            <div><dt className="text-xs font-semibold text-(--brand-text-muted)">Experience</dt><dd className="mt-1 text-sm text-(--brand-text-secondary)">{selectedApplication.experienceYears} years</dd></div>
                          ) : null}
                          {selectedApplication.skills?.length ? (
                            <div className="sm:col-span-2"><dt className="text-xs font-semibold text-(--brand-text-muted)">Skills</dt><dd className="mt-1 text-sm text-(--brand-text-secondary)">{selectedApplication.skills.join(", ")}</dd></div>
                          ) : null}
                          {selectedApplication.education ? (
                            <div className="sm:col-span-2"><dt className="text-xs font-semibold text-(--brand-text-muted)">Education</dt><dd className="mt-1 whitespace-pre-line text-sm text-(--brand-text-secondary)">{selectedApplication.education}</dd></div>
                          ) : null}
                          {selectedApplication.experienceSummary ? (
                            <div className="sm:col-span-2"><dt className="text-xs font-semibold text-(--brand-text-muted)">Experience summary</dt><dd className="mt-1 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">{selectedApplication.experienceSummary}</dd></div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                    {selectedApplication.coverLetter ? (
                      <div className="mt-6 grid gap-3 border-t border-[#edf0f4] pt-5 sm:grid-cols-[160px_minmax(0,1fr)]">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--brand-text-muted)">
                          Cover letter
                        </h3>
                        <p className="whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                          {selectedApplication.coverLetter}
                        </p>
                      </div>
                    ) : null}
                    {selectedApplication.portfolioUrl ||
                    selectedApplication.linkedInUrl ||
                    selectedApplication.githubUrl ? (
                      <div className="mt-6 grid gap-3 border-t border-[#edf0f4] pt-5 sm:grid-cols-[160px_minmax(0,1fr)]">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-(--brand-text-muted)">
                          Portfolio / work samples
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {[
                            ["Portfolio", selectedApplication.portfolioUrl],
                            ["LinkedIn", selectedApplication.linkedInUrl],
                            ["GitHub", selectedApplication.githubUrl],
                          ].map(([label, url]) =>
                            url ? (
                              <a
                                key={label}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#078bd1] hover:underline"
                              >
                                <ExternalLink size={15} />
                                {label}
                              </a>
                            ) : null,
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#e4eaf1] bg-white px-5 py-6 shadow-[0_6px_24px_rgba(24,36,58,0.045)] sm:px-7">
                  <h2 className="text-lg font-bold text-(--brand-navy)">
                    Screening Questions
                  </h2>
                  {selectedApplication.screeningAnswers?.length ? (
                    <dl className="mt-5 space-y-5">
                      {selectedApplication.screeningAnswers.map((item, index) => (
                        <div key={`${item.question}-${index}`}>
                          <dt className="text-sm font-semibold text-(--brand-navy)">
                            {item.question}
                          </dt>
                          <dd className="mt-1.5 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                            {item.answer}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-(--brand-text-muted)">
                      No screening questions were answered for this application.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-[#e4eaf1] bg-white px-5 py-6 shadow-[0_6px_24px_rgba(24,36,58,0.045)] sm:px-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={18} className="text-(--brand-red)" />
                      <h2 className="text-lg font-bold text-(--brand-navy)">
                        Review assignments
                      </h2>
                    </div>
                    {selectedApplication.status !== "DECLINED" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAssessmentMessage("");
                          setAssessmentFormOpen((open) => !open);
                        }}
                        className="rounded-(--radius-md) border border-[#9ec9f4] px-3 py-2 text-sm font-semibold text-[#078bd1] hover:bg-[#f1f9ff]"
                      >
                        {assessmentFormOpen ? "Cancel" : "Send assignment"}
                      </button>
                    ) : null}
                  </div>
                  {assessmentMessage ? (
                    <p role="status" className="mt-4 rounded-(--radius-md) bg-(--status-info-bg) p-3 text-sm text-(--status-info)">
                      {assessmentMessage}
                    </p>
                  ) : null}
                  {assessmentFormOpen ? (
                    <form
                      className="mt-5 space-y-4 rounded-(--radius-md) bg-(--brand-surface) p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void createAssessment(selectedApplication);
                      }}
                    >
                      <label className="block text-sm font-semibold text-(--brand-navy)">
                        Assignment title
                        <input
                          value={assessmentTitle}
                          onChange={(event) => setAssessmentTitle(event.target.value)}
                          required
                          minLength={3}
                          maxLength={120}
                          placeholder="e.g. Product design exercise"
                          className="mt-1.5 h-10 w-full rounded-(--radius-md) border border-(--brand-border) bg-white px-3 text-sm font-normal outline-none focus:border-[#078bd1]"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-(--brand-navy)">
                        Instructions
                        <textarea
                          value={assessmentInstructions}
                          onChange={(event) => setAssessmentInstructions(event.target.value)}
                          required
                          minLength={10}
                          maxLength={10000}
                          rows={5}
                          placeholder="Describe the task, expected deliverables, and how to submit the work."
                          className="mt-1.5 w-full rounded-(--radius-md) border border-(--brand-border) bg-white p-3 text-sm font-normal outline-none focus:border-[#078bd1]"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-(--brand-navy)">
                        Due date and time
                        <input
                          type="datetime-local"
                          value={assessmentDeadline}
                          onChange={(event) => setAssessmentDeadline(event.target.value)}
                          min={minimumAssessmentDeadline}
                          required
                          className="mt-1.5 h-10 w-full rounded-(--radius-md) border border-(--brand-border) bg-white px-3 text-sm font-normal outline-none focus:border-[#078bd1]"
                        />
                      </label>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={
                            assessmentBusy ||
                            assessmentTitle.trim().length < 3 ||
                            assessmentInstructions.trim().length < 10 ||
                            !assessmentDeadline
                          }
                          className="rounded-(--radius-md) bg-[#078bd1] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {assessmentBusy ? "Sending..." : "Send to applicant"}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {assessmentLoading ? (
                    <p className="mt-4 text-sm text-(--brand-text-muted)">Loading assignments...</p>
                  ) : assessmentItems.length ? (
                    <div className="mt-5 space-y-4">
                      {assessmentItems.map((assessment) => (
                        <article key={assessment._id} className="rounded-(--radius-md) border border-(--brand-border) p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-(--brand-navy)">{assessment.title}</h3>
                              <p className="mt-1 text-xs text-(--brand-text-muted)">
                                Due {new Date(assessment.deadline).toLocaleString()}
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              assessment.status === "REVIEWED"
                                ? "bg-(--status-success-bg) text-(--status-success)"
                                : assessment.status === "SUBMITTED"
                                  ? "bg-[#eaf7ff] text-[#078bd1]"
                                  : "bg-(--brand-surface) text-(--brand-text-secondary)"
                            }`}>
                              {assessment.status === "REVIEWED" ? "Reviewed" : assessment.status === "SUBMITTED" ? "Submitted" : "Awaiting submission"}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                            {assessment.instructions}
                          </p>
                          {assessment.submissionText ? (
                            <div className="mt-4 rounded-(--radius-md) bg-(--brand-surface) p-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-(--brand-text-muted)">
                                Applicant response
                              </p>
                              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-(--brand-text)">
                                {assessment.submissionText}
                              </p>
                            </div>
                          ) : null}
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            {assessment.submissionFileName ? (
                              <button
                                type="button"
                                disabled={assessmentBusy}
                                onClick={() => void downloadAssessmentSubmission(selectedApplication, assessment)}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-[#078bd1] hover:underline disabled:opacity-50"
                              >
                                <Download size={15} />
                                {assessment.submissionFileName}
                              </button>
                            ) : <span />}
                            {assessment.status === "SUBMITTED" ? (
                              <button
                                type="button"
                                disabled={assessmentBusy}
                                onClick={() => void markAssessmentReviewed(selectedApplication, assessment)}
                                className="rounded-(--radius-md) bg-[#e8fbe4] px-3 py-2 text-xs font-bold text-[#31802a] disabled:opacity-50"
                              >
                                {assessmentBusy ? "Updating..." : "Mark reviewed"}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : !assessmentLoading ? (
                    <p className="mt-4 text-sm text-(--brand-text-muted)">
                      No assignments have been sent to this applicant.
                    </p>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-[#e4eaf1] bg-white px-5 py-6 shadow-[0_6px_24px_rgba(24,36,58,0.045)] sm:px-7">
                  <h2 className="text-lg font-bold text-(--brand-navy)">Resume</h2>
                  {selectedApplication.resumeFileName ? (
                    <button
                      type="button"
                      disabled={busyAction === `resume:${selectedApplication._id}`}
                      onClick={() => void downloadResume(selectedApplication)}
                      className="mt-4 inline-flex max-w-full items-center gap-2 text-left text-sm font-medium text-[#078bd1] hover:underline disabled:opacity-50"
                    >
                      <Download size={16} className="shrink-0" />
                      <span className="truncate">{selectedApplication.resumeFileName}</span>
                      {busyAction === `resume:${selectedApplication._id}` ? "Downloading..." : ""}
                    </button>
                  ) : selectedApplication.resumeUrl ? (
                    <a href={selectedApplication.resumeUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#078bd1] hover:underline">
                      <Download size={16} />Open source resume
                    </a>
                  ) : (
                    <p className="mt-3 text-sm text-(--brand-text-muted)">
                      No resume was uploaded with this application.
                    </p>
                  )}
                </section>

                {selectedApplication.declineReason ? (
                  <section className="rounded-2xl border border-(--status-danger-border) bg-(--status-danger-bg) px-5 py-6 shadow-sm sm:px-7">
                    <h2 className="text-base font-bold text-(--status-danger)">Not interested</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-(--status-danger)">
                      {selectedApplication.declineReason}
                    </p>
                  </section>
                ) : null}
              </main>
            </div>
            <footer className="shrink-0 border-t border-[#e4eaf1] bg-white px-4 py-3 shadow-[0_-5px_22px_rgba(24,36,58,0.08)] sm:px-8">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedApplication.userId?._id ? (
                    <button
                      type="button"
                      disabled={busyAction === `chat:${selectedApplication._id}`}
                      onClick={() => void startApplicantChat(selectedApplication)}
                      className="inline-flex items-center gap-2 rounded-(--radius-md) px-3 py-2 text-sm font-semibold text-[#078bd1] hover:bg-[#f1f9ff] disabled:opacity-50"
                    >
                      <MessageSquareText size={16} />
                      {busyAction === `chat:${selectedApplication._id}` ? "Opening chat..." : "Start chat"}
                    </button>
                  ) : null}
                  {selectedApplication.status !== "DECLINED" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAssessmentFormOpen(true);
                        setAssessmentMessage("");
                      }}
                      className="inline-flex items-center gap-2 rounded-(--radius-md) px-3 py-2 text-sm font-semibold text-[#078bd1] hover:bg-[#f1f9ff]"
                    >
                      <ClipboardList size={16} />
                      Send assignment
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous application"
                    disabled={
                      loading ||
                      (selectedApplicationIndex <= 0 && applicationPage <= 1)
                    }
                    onClick={() => {
                      if (selectedApplicationIndex > 0) {
                        openApplicationDetails(applications[selectedApplicationIndex - 1]);
                      } else if (applicationPage > 1) {
                        pendingDetailNavigation.current = "last";
                        setApplicationPage((page) => page - 1);
                      }
                    }}
                    className="rounded-(--radius-md) p-2 text-[#078bd1] hover:bg-[#f1f9ff] disabled:text-(--brand-text-muted) disabled:opacity-40"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="whitespace-nowrap text-sm text-(--brand-text-secondary)">
                    {selectedApplicationIndex >= 0
                      ? (applicationPage - 1) * 10 + selectedApplicationIndex + 1
                      : 0}{" "}
                    / {applicationTotal}
                  </span>
                  <button
                    type="button"
                    aria-label="Next application"
                    disabled={
                      loading ||
                      selectedApplicationIndex < 0 ||
                      (selectedApplicationIndex >= applications.length - 1 &&
                        applicationPage >= applicationTotalPages)
                    }
                    onClick={() => {
                      if (selectedApplicationIndex >= 0 && selectedApplicationIndex < applications.length - 1) {
                        openApplicationDetails(applications[selectedApplicationIndex + 1]);
                      } else if (applicationPage < applicationTotalPages) {
                        pendingDetailNavigation.current = "first";
                        setApplicationPage((page) => page + 1);
                      }
                    }}
                    className="rounded-(--radius-md) p-2 text-[#078bd1] hover:bg-[#f1f9ff] disabled:text-(--brand-text-muted) disabled:opacity-40"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {applicationActionButtons(selectedApplication)}
                </div>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
