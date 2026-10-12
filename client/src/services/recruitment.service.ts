import api from "./axios";
import axios from "axios";
import type {
  SalesClientCampaign,
  SalesClientCampaignRecipient,
  SalesClientCampaignTemplate,
  SalesClientWhatsAppAccount,
} from "./sales.service";

function recruitmentError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as {
      message?: string;
      errors?: Array<{ field?: string; message?: string }>;
    } | undefined;
    const details = data?.errors
      ?.map((item) => item.message ? `${item.field ? `${item.field}: ` : ""}${item.message}` : "")
      .filter(Boolean)
      .join(" ");
    const message = [data?.message, details].filter(Boolean).join(" ");
    if (error.response?.status === 409 && /already applied|duplicate|already exists/i.test(message)) {
      return "You have already applied to this opportunity.";
    }
    if (error.response?.status === 409 && /closed|deadline|not available/i.test(message)) {
      return message;
    }
    if (error.response?.status === 409 && (!message || /conflict/i.test(message))) {
      return "You have already applied to this opportunity, or applications are closed.";
    }
    if (message) return message;
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return "The application request timed out. Please try again.";
    if (!error.response) return `Unable to reach the application server: ${error.message}`;
    return `${fallback} (HTTP ${error.response.status})`;
  }
  return error instanceof Error ? error.message : String(error) || fallback;
}

const pendingOfferDeliveryKeys = new Map<string, string>();

export type OpportunityType = "JOB" | "INTERNSHIP";
export type OpportunityStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type WorkMode = "REMOTE" | "ONSITE" | "HYBRID";

export interface OfferLetterProfile {
  legalName: string;
  displayName: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  logoDataUrl: string;
  hrContactName: string;
  hrContactEmail: string;
  signatoryName: string;
  signatoryDesignation: string;
  signatureDataUrl: string;
}

export interface Opportunity {
  _id: string;
  companyId?: string | { name: string; slug?: string; description?: string; industry?: string; category?: string } | null;
  type: OpportunityType;
  title: string;
  description: string;
  role: string;
  category: string;
  workMode: WorkMode;
  employmentType?: "PART_TIME" | "FULL_TIME";
  openings?: number;
  minExperienceYears?: number;
  fixedPayMin?: number | null;
  fixedPayMax?: number | null;
  variablePayMin?: number | null;
  variablePayMax?: number | null;
  screeningQuestions?: string[];
  alternatePhone?: string;
  location?: string;
  experience?: string;
  salary?: string;
  techStack: string[];
  requirements: string[];
  responsibilities: string[];
  qualifications: string[];
  benefits: string[];
  applicationDeadline?: string | null;
  status: OpportunityStatus;
  publishedAt?: string | null;
  createdAt: string;
}

export interface OpportunityPage {
  opportunities: Opportunity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Application {
  _id: string;
  status: "APPLIED" | "UNDER_REVIEW" | "ACCEPTED" | "DECLINED";
  source?: "WEBSITE" | "DIRECT" | "EXTERNAL";
  sourceDetail?: string;
  resumeUrl?: string;
  appliedAt: string;
  reviewedAt?: string | null;
  acceptedAt?: string | null;
  declineReason?: string | null;
  coverLetter?: string;
  candidatePhone?: string;
  portfolioUrl?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  currentCompany?: string;
  experienceYears?: number;
  experienceSummary?: string;
  skills?: string[];
  education?: string;
  screeningAnswers?: Array<{ question: string; answer: string }>;
  address?: string;
  resumeFileName?: string;
  resumeFileSize?: number;
  roleGrantedAt?: string | null;
  offerStatus?: "DRAFT" | "GENERATED" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | null;
  offerSentAt?: string | null;
  opportunityId: Opportunity;
}

export interface ApplicationAssessment {
  _id: string;
  applicationId: string;
  opportunityId: Opportunity | string;
  title: string;
  instructions: string;
  deadline: string;
  status: "ASSIGNED" | "SUBMITTED" | "REVIEWED";
  submissionText?: string;
  submissionFileName?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  result?: "PENDING" | "PASS" | "FAIL";
  score?: number | null;
  feedback?: string;
  createdAt: string;
}

export const RECRUITMENT_PIPELINE_STAGES = [
  "NEW_APPLICATION",
  "SCREENING",
  "SHORTLISTED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL_SELECTION",
  "OFFER",
  "PRE_JOINING",
  "ONBOARDING",
  "ACTIVE",
  "REJECTED",
] as const;

export type RecruitmentPipelineStage = typeof RECRUITMENT_PIPELINE_STAGES[number];
export type PipelineCheckStatus = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "WAIVED";
export type PipelineReviewStatus = "PENDING" | "PASS" | "FAIL";
export type PipelineTaskStatus = "OPEN" | "COMPLETED" | "CONFIRMED";
export type PipelineInterviewStatus = "SCHEDULED" | "COMPLETED" | "FEEDBACK_PENDING" | "PASSED" | "FAILED";

export interface PipelinePerson {
  _id: string;
  name: string;
  email: string;
}

export interface RecruitmentPipelineEntry {
  _id: string;
  stage: RecruitmentPipelineStage;
  updatedAt?: string;
  recruiterId: PipelinePerson | string;
  managerId: PipelinePerson | string | null;
  hiringManagerId: PipelinePerson | string | null;
  applicationId: {
    _id: string;
    status: Application["status"];
    source?: Application["source"];
    sourceDetail?: string;
    appliedAt: string;
    candidatePhone?: string;
    address?: string;
    coverLetter?: string;
    resumeFileName?: string;
    resumeUrl?: string;
    portfolioUrl?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    currentCompany?: string;
    experienceYears?: number;
    experienceSummary?: string;
    skills?: string[];
    education?: string;
    screeningAnswers?: Array<{ question: string; answer: string }>;
    userId: { _id: string; name: string; email: string; phoneNumber?: string } | null;
    opportunityId: Opportunity;
  };
  screening: {
    skillsFit: PipelineReviewStatus;
    educationFit: PipelineReviewStatus;
    experienceFit: PipelineReviewStatus;
    locationFit: PipelineReviewStatus;
    eligibility: PipelineReviewStatus;
    expectedCompensation: string;
    noticePeriod: string;
    notes: string;
  };
  tasks: Array<{
    _id: string;
    stage: RecruitmentPipelineStage;
    title: string;
    description: string;
    assignedTo: PipelinePerson | string;
    dueDate: string;
    status: PipelineTaskStatus;
  }>;
  interviewRounds: Array<{
    _id: string;
    type: string;
    scheduledAt: string;
    interviewerIds: Array<PipelinePerson | string>;
    status: PipelineInterviewStatus;
    feedback: string;
    score: number | null;
    result: PipelineReviewStatus;
  }>;
  finalSelection: {
    selectedRole: "INTERN" | "EMPLOYEE" | null;
    department: string | null;
    compensationAmount: string | number | null;
    compensationFrequency: "MONTHLY" | "ANNUAL" | null;
    annualCtc: string | number | null;
    monthlyGrossSalary: string | number | null;
    salaryStructureReference: string;
    benefits: string;
    currency: string;
    joiningDate: string | null;
    employmentEndDate: string | null;
    probationPeriod: string;
    workingHours: string;
    acceptanceDeadline: string | null;
    hiringManagerApproved: boolean;
    approvalNote: string;
  };
  preJoining: Record<string, PipelineCheckStatus | string>;
  onboarding: Record<string, PipelineCheckStatus | string>;
  finalApproval: { status: "PENDING" | "CONFIRMED" | "REJECTED"; note: string };
  assessmentWaiverReason: string;
  interviewWaiverReason: string;
  latestOffer: { _id: string; status: string; sentAt?: string | null; acceptedAt?: string | null } | null;
  assessmentSummary: { total: number; passed: number; pending: number };
}

export interface RecruitmentPipelinePage {
  entries: RecruitmentPipelineEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stageCounts: Partial<Record<RecruitmentPipelineStage, number>>;
}

export interface RecruitmentPipelineStaff {
  hrStaff: Array<PipelinePerson & { level: string; reportsTo: string | null }>;
  hiringManagers: Array<PipelinePerson & { department: string }>;
}

export type TeamMemberOnboardingInput = {
  department?: string;
  reportsTo?: string;
  accountType: "intern" | "employee";
  name: string;
  email: string;
  temporaryPassword: string;
  phoneNumber: string;
  designation: string;
  joiningDate: string;
  endDate?: string | null;
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | null;
  linkedInUrl?: string;
  address: string;
};

export type DirectCandidateInput = {
  opportunityId: string;
  name: string;
  email: string;
  phoneNumber: string;
  sourceDetail?: string;
  address: string;
  coverLetter?: string;
  portfolioUrl?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  currentCompany?: string;
  experienceYears?: string;
  experienceSummary?: string;
  skills?: string;
  education?: string;
  resume?: File | null;
};

export type CandidateImportInput = {
  opportunityId: string;
  name: string;
  email: string;
  phoneNumber: string;
  sourcePlatform: string;
  resume?: File | null;
};

export type CandidateSourceImportRow = {
  sheet: string;
  rowNumber: number;
  values: Record<string, string>;
};

export type CandidateListEntry = {
  _id: string;
  name: string;
  email: string;
  phoneNumber: string;
  sourcePlatform: string;
  sheet: string;
  rowNumber: number;
  archivedAt: string | null;
  createdAt?: string;
};

export const RecruitmentService = {
  async adminOpportunities() {
    const response = await api.get<{ opportunities: Opportunity[] }>("/recruitment/admin/opportunities");
    return response.data.opportunities;
  },
  async pipeline(stage?: RecruitmentPipelineStage, page = 1, limit = 10) {
    const response = await api.get<RecruitmentPipelinePage>("/recruitment/admin/pipeline", {
      params: { stage, page, limit },
    });
    return response.data;
  },
  async pipelineStaff() {
    const response = await api.get<RecruitmentPipelineStaff>("/recruitment/admin/pipeline/staff");
    return response.data;
  },
  async importOfferCandidates(input: { opportunityId: string; csv: string }) {
    try {
      const response = await api.post<{
        success: boolean;
        imported: Array<{ row: number; name: string; email: string; accountCreated: boolean; inviteSent: boolean | null }>;
        errors: Array<{ row: number; email: string; message: string }>;
        message: string;
      }>("/recruitment/admin/pipeline/offer/import", input);
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to import offer-stage candidates."));
    }
  },
  async requestCandidateDeletionOtp(target: { pipelineIds?: string[]; deleteAll?: boolean }) {
    try {
      const response = await api.post<{ email: string; message: string; candidateCount: number }>(
        "/recruitment/admin/pipeline/candidates/deletion-otp",
        target,
      );
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to send the deletion verification code."));
    }
  },
  async deleteRecruitmentCandidates(target: { pipelineIds?: string[]; deleteAll?: boolean }, otp?: string) {
    try {
      const response = await api.delete<{ deletedCount: number; message: string }>(
        "/recruitment/admin/pipeline/candidates",
        { data: { ...target, ...(otp ? { otp } : {}) } },
      );
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to delete the selected recruitment candidates."));
    }
  },
  async pipelineAction<T = unknown>(pipelineId: string, endpoint: string, input: unknown, method: "patch" | "post" = "patch") {
    try {
      const response = await api.request<T>({
        method,
        url: `/recruitment/admin/pipeline/${pipelineId}${endpoint}`,
        data: input,
      });
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to update the recruitment candidate."));
    }
  },
  async applicationAssessments(applicationId: string) {
    const response = await api.get<{ assignments: ApplicationAssessment[] }>(
      `/recruitment/admin/applications/${applicationId}/assignments`,
    );
    return response.data.assignments;
  },
  async pipelineAssessments(pipelineId: string) {
    const response = await api.get<{ assignments: ApplicationAssessment[] }>(
      `/recruitment/admin/pipeline/${pipelineId}/assessments`,
    );
    return response.data.assignments;
  },
  async createPipelineAssessment(pipelineId: string, input: { title: string; instructions: string; deadline: string }) {
    const response = await api.post<{ assignment: ApplicationAssessment }>(
      `/recruitment/admin/pipeline/${pipelineId}/assessments`,
      input,
    );
    return response.data.assignment;
  },
  async pipelineAssessmentSubmission(pipelineId: string, assessmentId: string) {
    return api.get(
      `/recruitment/admin/pipeline/${pipelineId}/assessments/${assessmentId}/submission-file`,
      { responseType: "blob" },
    );
  },
  async offerLetterProfile() {
    const response = await api.get<{ profile: OfferLetterProfile }>("/recruitment/admin/offer-letter-profile");
    return response.data.profile;
  },
  async saveOfferLetterProfile(input: OfferLetterProfile) {
    const response = await api.put<{ profile: OfferLetterProfile }>("/recruitment/admin/offer-letter-profile", input);
    return response.data.profile;
  },
  async createPipelineOffer(applicationId: string) {
    try {
      const response = await api.post<{ offer: { _id: string; status: string } }>(
        `/recruitment/admin/applications/${applicationId}/offer`,
        { send: false },
      );
      return response.data.offer;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to generate the approved pipeline offer."));
    }
  },
  async sendPipelineOffer(offerId: string) {
    const idempotencyKey = pendingOfferDeliveryKeys.get(offerId)
      ?? `offer:${offerId}:send:${globalThis.crypto.randomUUID()}`;
    pendingOfferDeliveryKeys.set(offerId, idempotencyKey);
    try {
      const response = await api.post<{ offer: { _id: string; status: string } }>(
        `/recruitment/admin/offers/${offerId}/send`,
        { confirm: true },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      pendingOfferDeliveryKeys.delete(offerId);
      return response.data.offer;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string } | undefined;
        if (
          error.response?.status === 502
          || (error.response?.status === 409 && /previous delivery failed/i.test(data?.message ?? ""))
        ) {
          pendingOfferDeliveryKeys.delete(offerId);
        }
      }
      throw new Error(recruitmentError(error, "Unable to send the pipeline offer."));
    }
  },
  async pipelineResume(applicationId: string) {
    return api.get(`/recruitment/admin/applications/${applicationId}/resume`, { responseType: "blob" });
  },
  async createDirectApplication(input: DirectCandidateInput) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(input)) {
      if (typeof File !== "undefined" && value instanceof File) {
        if (value.size) formData.append(key === "resume" ? "resumePdf" : key, value);
      } else if (typeof value === "string" && value.trim()) {
        formData.append(key, value);
      }
    }
    try {
      const response = await api.post<{
        application: Application;
        accountCreated: boolean;
        activationEmailSent: boolean | null;
      }>("/recruitment/admin/applications/direct", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to add the external candidate."));
    }
  },
  async importCandidate(input: CandidateImportInput) {
    const formData = new FormData();
    formData.append("opportunityId", input.opportunityId);
    formData.append("name", input.name);
    formData.append("email", input.email);
    formData.append("phoneNumber", input.phoneNumber);
    formData.append("sourcePlatform", input.sourcePlatform);
    if (input.resume) formData.append("resumePdf", input.resume);
    try {
      const response = await api.post<{
        application: Application;
        accountCreated: boolean;
        activationEmailSent: boolean | null;
      }>("/recruitment/admin/applications/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to import the candidate."));
    }
  },
  async importCandidateSource(rows: CandidateSourceImportRow[]) {
    try {
      const response = await api.post<{
        success: boolean;
        imported: CandidateListEntry[];
        skipped: number;
        errors: Array<{ sheet: string; row: number; email: string; message: string }>;
      }>("/recruitment/admin/candidate-lists/import", { rows });
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to import candidate list rows."));
    }
  },
  async candidateList() {
    const response = await api.get<{ entries: CandidateListEntry[] }>("/recruitment/admin/candidate-lists");
    return response.data.entries;
  },
  async updateCandidateListEntry(entryId: string, input: Pick<CandidateListEntry, "name" | "email" | "phoneNumber" | "sourcePlatform">) {
    const response = await api.patch<{ entry: CandidateListEntry }>(`/recruitment/admin/candidate-lists/${entryId}`, input);
    return response.data.entry;
  },
  async updateCandidateListEntries(entryIds: string[], field: "name" | "email" | "phoneNumber" | "sourcePlatform", value: string) {
    try {
      const response = await api.patch<{ entries: CandidateListEntry[]; updatedCount: number }>(
        "/recruitment/admin/candidate-lists/bulk-update",
        { entryIds, field, value },
      );
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to update the selected candidates."));
    }
  },
  async archiveCandidateListEntry(entryId: string, archived: boolean) {
    const response = await api.patch<{ entry: CandidateListEntry }>(`/recruitment/admin/candidate-lists/${entryId}/archive`, { archived });
    return response.data.entry;
  },
  async requestCandidateListDeletionOtp(entryIds?: string[]) {
    try {
      const response = await api.post<{ email: string; entryCount: number; deleteAll: boolean; message: string }>(
        "/recruitment/admin/candidate-lists/deletion-otp",
        entryIds ? { entryIds } : { deleteAll: true },
      );
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to send the Candidates Lists deletion code."));
    }
  },
  async deleteCandidateListEntries(otp: string, entryIds?: string[]) {
    try {
      const response = await api.delete<{ deletedCount: number; message: string }>(
        "/recruitment/admin/candidate-lists",
        { data: { ...(entryIds ? { entryIds } : { deleteAll: true }), otp } },
      );
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to delete all saved Candidates Lists entries."));
    }
  },
  async deleteAllCandidateListEntries(otp: string) {
    return this.deleteCandidateListEntries(otp);
  },
  async candidateWhatsAppCampaignAccounts() {
    try {
      const response = await api.get<{ success: true; accounts: SalesClientWhatsAppAccount[] }>(
        "/recruitment/admin/candidate-lists/whatsapp-accounts",
      );
      return response.data.accounts;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to load connected WhatsApp Business accounts."));
    }
  },
  async candidateWhatsAppCampaignTemplates(accountId: string) {
    try {
      const response = await api.get<{ success: true; templates: SalesClientCampaignTemplate[] }>(
        "/recruitment/admin/candidate-lists/whatsapp-templates",
        { params: { accountId } },
      );
      return response.data.templates;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to load approved WhatsApp templates."));
    }
  },
  async createCandidateCampaign(input: {
    leadIds: string[];
    channel: "EMAIL" | "WHATSAPP";
    subject?: string;
    body?: string;
    cc?: string[];
    bcc?: string[];
    scheduledAt?: string | null;
    attachments?: Array<{ filename: string; contentType: string; contentBase64: string }>;
    accountId?: string;
    templateName?: string;
    templateLanguage?: string;
    templateVariables?: string[];
    confirmWhatsAppOptIn?: boolean;
    confirmContactPermission: boolean;
  }) {
    try {
      const response = await api.post<{
        success: true;
        campaign: {
          _id: string;
          name: string;
          channel: "EMAIL" | "WHATSAPP";
          status: SalesClientCampaign["status"];
          scheduledAt: string | null;
          total: number;
          queued: number;
          skipped: number;
        };
      }>("/recruitment/admin/candidate-lists/campaigns", input);
      return response.data.campaign;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to start the candidate communication campaign."));
    }
  },
  async candidateCampaigns() {
    try {
      const response = await api.get<{ success: true; campaigns: SalesClientCampaign[] }>(
        "/recruitment/admin/candidate-lists/campaigns",
      );
      return response.data.campaigns;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to load Candidates Lists campaign history."));
    }
  },
  async candidateCampaignRecipients(campaignId: string, page = 1) {
    try {
      const response = await api.get<{
        success: true;
        recipients: SalesClientCampaignRecipient[];
        page: number;
        totalPages: number;
        total: number;
      }>(`/recruitment/admin/candidate-lists/campaigns/${campaignId}/recipients`, { params: { page } });
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to load campaign recipients."));
    }
  },
  async retryCandidateCampaign(campaignId: string) {
    try {
      const response = await api.post<{ success: true; retryCount: number }>(
        `/recruitment/admin/candidate-lists/campaigns/${campaignId}/retry`,
      );
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to retry failed candidate campaign messages."));
    }
  },
  async onboardTeamMember(input: TeamMemberOnboardingInput) {
    try {
      const response = await api.post<{
        accountCreated: boolean;
        user: { _id: string; name: string; email: string; roles: string[] };
      }>("/recruitment/manager/team-members", input);
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to add the team member."));
    }
  },
  async list(params?: Record<string, string>) {
    const response = await api.get<{ opportunities: Opportunity[] }>("/recruitment/opportunities", { params });
    return response.data.opportunities;
  },
  async browse(params: Record<string, string>) {
    const response = await api.get<OpportunityPage>("/recruitment/opportunities", { params });
    return response.data;
  },
  async get(id: string) {
    const response = await api.get<{ opportunity: Opportunity }>(`/recruitment/opportunities/${id}`);
    return response.data.opportunity;
  },
  async apply(id: string, input: { coverLetter?: string; portfolioUrl?: string; linkedInUrl?: string; githubUrl?: string; address: string; screeningAnswers?: Array<{ question: string; answer: string }>; resume?: File | null }) {
    try {
      for (const [field, value] of [["portfolioUrl", input.portfolioUrl], ["linkedInUrl", input.linkedInUrl], ["githubUrl", input.githubUrl]] as const) {
        if (!value?.trim()) continue;
        if (!/^https:\/\//i.test(value.trim())) {
          throw new Error(`${field}: URL must start with https://`);
        }
        try {
          new URL(value.trim());
        } catch {
          throw new Error(`${field}: Enter a valid HTTPS URL`);
        }
      }
      const formData = new FormData();
      Object.entries(input).forEach(([key, value]) => {
        if (typeof File !== "undefined" && value instanceof File) formData.append(key === "resume" ? "resumePdf" : key, value);
        else if (Array.isArray(value)) formData.append(key, JSON.stringify(value));
        else if (typeof value === "string" && value) formData.append(key, value);
      });
      const response = await api.post(`/recruitment/opportunities/${id}/apply`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      return response.data;
    } catch (error) {
      throw new Error(recruitmentError(error, "Unable to submit application."));
    }
  },
  async mine() {
    const response = await api.get<{ applications: Application[] }>("/recruitment/me/applications");
    return response.data.applications;
  },
  async myAssessments() {
    const response = await api.get<{ assignments: ApplicationAssessment[] }>("/recruitment/me/assignments");
    return response.data.assignments;
  },
  async submitAssessment(id: string, submissionText: string, file: File | null) {
    const formData = new FormData();
    if (submissionText.trim()) formData.append("submissionText", submissionText.trim());
    if (file) formData.append("file", file);
    const response = await api.patch<{ assignment: ApplicationAssessment }>(
      `/recruitment/me/assignments/${id}/submission`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data.assignment;
  },
};