export type Opportunity = {
  _id: string;
  type: 'JOB' | 'INTERNSHIP';
  title: string;
  description: string;
  role: string;
  category: string;
  workMode: 'REMOTE' | 'ONSITE' | 'HYBRID';
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  location?: string;
  experience?: string;
  salary?: string;
  techStack: string[];
  applicationDeadline?: string | null;
};

export type Application = {
  _id: string;
  status: 'APPLIED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'DECLINED';
  appliedAt: string;
  declineReason?: string | null;
  resumeFileName?: string;
  offerStatus?: 'DRAFT' | 'GENERATED' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | null;
  opportunityId: Opportunity;
  applicantId?: { name?: string; email?: string };
};

export type ResumeAsset = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

export type ApplicationInput = {
  address: string;
  coverLetter?: string;
  portfolioUrl?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  resume?: ResumeAsset | null;
};
