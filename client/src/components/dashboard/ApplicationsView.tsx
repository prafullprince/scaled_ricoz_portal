"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, Download, Upload } from "lucide-react";
import api from "@/services/axios";
import {
  RecruitmentService,
  type Application,
  type ApplicationAssessment,
} from "@/services/recruitment.service";
import { DashboardEmptyState } from "./DashboardPrimitives";

const labels: Record<Application["status"], string> = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under review",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

function errorMessage(error: unknown) {
  const message = (
    error as { response?: { data?: { message?: string } } }
  )?.response?.data?.message;
  return message ?? "We could not complete that action. Please try again.";
}

export function ApplicationsView() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [assessments, setAssessments] = useState<ApplicationAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyAssessmentId, setBusyAssessmentId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      RecruitmentService.mine(),
      RecruitmentService.myAssessments(),
    ])
      .then(([applicationResult, assessmentResult]) => {
        if (!active) return;
        const errors: string[] = [];
        if (applicationResult.status === "fulfilled") {
          setApplications(applicationResult.value);
        } else {
          errors.push(errorMessage(applicationResult.reason));
        }
        if (assessmentResult.status === "fulfilled") {
          setAssessments(assessmentResult.value);
        } else {
          errors.push(errorMessage(assessmentResult.reason));
        }
        setMessage(errors.join(" "));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitAssessment(assessment: ApplicationAssessment) {
    setBusyAssessmentId(assessment._id);
    setMessage("");
    try {
      const updated = await RecruitmentService.submitAssessment(
        assessment._id,
        answers[assessment._id] ?? "",
        files[assessment._id] ?? null,
      );
      setAssessments((current) =>
        current.map((item) => item._id === updated._id ? updated : item),
      );
      setAnswers((current) => ({ ...current, [assessment._id]: "" }));
      setFiles((current) => ({ ...current, [assessment._id]: null }));
      setMessage("Your assignment was submitted.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusyAssessmentId(null);
    }
  }

  async function downloadSubmission(assessment: ApplicationAssessment) {
    setBusyAssessmentId(assessment._id);
    try {
      const response = await api.get(
        `/recruitment/me/assignments/${assessment._id}/submission-file`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = assessment.submissionFileName ?? "assignment-submission";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusyAssessmentId(null);
    }
  }

  const assessmentCards = assessments;

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-8">
      <div className="rounded-3xl border border-[#e4eaf1] bg-[radial-gradient(ellipse_at_top_right,_rgba(7,152,229,0.1),_transparent_45%),linear-gradient(120deg,#ffffff_0%,#f7faff_100%)] px-5 py-7 shadow-sm sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#078bd1]">
          Candidate workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-(--brand-navy)">
          Keep track of your next move.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-(--brand-text-secondary)">
          Application updates and any assignments shared by the hiring team.
        </p>
      </div>

      {message ? (
        <p role="status" className="rounded-(--radius-md) bg-(--status-info-bg) p-3 text-sm text-(--status-info)">
          {message}
        </p>
      ) : null}

      {assessmentCards.length > 0 ? (
        <section aria-labelledby="application-assessments-title" className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={19} className="text-(--brand-red)" />
            <h2 id="application-assessments-title" className="text-xl font-bold text-(--brand-navy)">
              Assignments
            </h2>
          </div>
          {assessmentCards.map((assessment) => {
            const opportunity = typeof assessment.opportunityId === "string"
              ? null
              : assessment.opportunityId;
            const deadlinePassed = new Date(assessment.deadline).getTime() < currentTime;
            const selectedFile = files[assessment._id] ?? null;
            return (
              <article key={assessment._id} className="rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-[0_6px_22px_rgba(24,36,58,0.05)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-(--brand-text-muted)">
                      {opportunity?.companyId && typeof opportunity.companyId !== "string"
                        ? opportunity.companyId.name
                        : "Recruitment assessment"}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-(--brand-navy)">
                      {assessment.title}
                    </h3>
                    {opportunity?.title ? (
                      <p className="mt-1 text-sm text-(--brand-text-secondary)">
                        For {opportunity.title}
                      </p>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    assessment.status === "SUBMITTED" || assessment.status === "REVIEWED"
                      ? "bg-(--status-success-bg) text-(--status-success)"
                      : "bg-(--status-info-bg) text-(--status-info)"
                  }`}>
                    {assessment.status === "REVIEWED"
                      ? "Reviewed"
                      : assessment.status === "SUBMITTED"
                        ? "Submitted"
                        : "Assigned"}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-[#edf0f4] bg-[#f8fafc] p-4">
                  <p className="whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                    {assessment.instructions}
                  </p>
                </div>
                <p className={`mt-3 text-sm font-semibold ${
                  deadlinePassed ? "text-(--status-danger)" : "text-(--brand-text-secondary)"
                }`}>
                  Deadline: {new Date(assessment.deadline).toLocaleString()}
                  {deadlinePassed ? " · Deadline passed" : ""}
                </p>

                {assessment.submissionText ? (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-(--brand-text-muted)">
                      Latest response
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-(--brand-text-secondary)">
                      {assessment.submissionText}
                    </p>
                  </div>
                ) : null}
                {assessment.submissionFileName ? (
                  <button
                    type="button"
                    disabled={busyAssessmentId === assessment._id}
                    onClick={() => void downloadSubmission(assessment)}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#078bd1] hover:underline disabled:opacity-50"
                  >
                    <Download size={15} />
                    {assessment.submissionFileName}
                  </button>
                ) : null}

                {assessment.status !== "REVIEWED" && !deadlinePassed ? (
                  <div className="mt-5 space-y-3 border-t border-(--brand-border) pt-5">
                    <label className="block text-sm font-semibold text-(--brand-navy)">
                      Your response
                      <textarea
                        value={answers[assessment._id] ?? ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [assessment._id]: event.target.value,
                          }))
                        }
                        maxLength={10000}
                        rows={4}
                        placeholder="Write your response or describe your work"
                        className="mt-2 w-full rounded-xl border border-[#dce3eb] bg-[#fcfdff] p-3.5 text-sm font-normal outline-none transition focus:border-[#078bd1] focus:ring-4 focus:ring-[#078bd1]/10"
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#dce3eb] bg-white px-3 py-2.5 text-sm font-semibold text-(--brand-navy) transition hover:border-[#078bd1] hover:bg-[#f5faff]">
                        <Upload size={15} />
                        {selectedFile?.name ?? "Attach a file"}
                        <input
                          key={`${assessment._id}-${selectedFile?.name ?? "empty"}`}
                          type="file"
                          accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.webp"
                          className="sr-only"
                          onChange={(event) =>
                            setFiles((current) => ({
                              ...current,
                              [assessment._id]: event.target.files?.[0] ?? null,
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={
                          busyAssessmentId === assessment._id ||
                          (!(answers[assessment._id] ?? "").trim() && !selectedFile)
                        }
                        onClick={() => void submitAssessment(assessment)}
                        className="rounded-xl bg-[#078bd1] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0679b5] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAssessmentId === assessment._id ? "Submitting..." : "Submit assignment"}
                      </button>
                    </div>
                    <p className="text-xs text-(--brand-text-muted)">
                      Submit a written response, a file up to 15 MB, or both. Accepted formats include PDF, Office documents, ZIP, text, and images.
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#e4eaf1] bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <p className="text-sm text-(--brand-text-secondary)">Loading applications...</p>
        ) : applications.length === 0 ? (
          <DashboardEmptyState
            title="No applications yet"
            description="When you apply to a Ricoz opportunity, it will appear here."
          />
        ) : (
          <div className="divide-y divide-(--brand-border)">
            {applications.map((application) => (
              <div
                key={application._id}
                className="flex flex-col gap-4 rounded-xl px-4 py-4 transition hover:bg-[#f8fafc] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-(--brand-red)">
                    {application.opportunityId?.type === "JOB" ? "Job" : "Internship"}
                  </p>
                  <h2 className="mt-1 font-bold text-(--brand-navy)">
                    {application.opportunityId?.title ?? "Opportunity"}
                  </h2>
                  <p className="mt-1 text-xs text-(--brand-text-muted)">
                    Applied {new Date(application.appliedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
                  application.status === "ACCEPTED"
                    ? "bg-(--status-success-bg) text-(--status-success)"
                    : application.status === "DECLINED"
                      ? "bg-(--status-danger-bg) text-(--status-danger)"
                      : "bg-(--status-info-bg) text-(--status-info)"
                }`}>
                  {labels[application.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <Link href="/careers" className="inline-flex rounded-xl bg-[#18243a] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#24324b]">
        Browse open opportunities →
      </Link>
    </div>
  );
}
