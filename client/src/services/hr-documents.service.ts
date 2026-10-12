import api from "./axios";

export type HrDocumentType =
  | "APPOINTMENT_LETTER"
  | "SERVICE_CERTIFICATE"
  | "EXPERIENCE_CERTIFICATE"
  | "RELIEVING_LETTER"
  | "SALARY_REVISION_LETTER"
  | "PROMOTION_LETTER"
  | "TRANSFER_DESIGNATION_LETTER"
  | "PROBATION_CONFIRMATION"
  | "FULL_FINAL_SETTLEMENT"
  | "NO_OBJECTION_CERTIFICATE"
  | "EMPLOYMENT_VERIFICATION"
  | "LEAVE_APPROVAL_RECORD"
  | "STATUTORY_TAX_DOCUMENT"
  | "EXIT_SEPARATION_DOCUMENT"
  | "EMPLOYEE_OF_MONTH"
  | "EMPLOYEE_OF_WEEK"
  | "EMPLOYEE_OF_YEAR";

export interface HrDocumentRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  type: HrDocumentType;
  title: string;
  referenceNumber: string;
  issueDate: string;
  effectiveDate: string | null;
  status: "DRAFT" | "PUBLISHED";
  fileName: string;
  fileSize: number;
  publishedAt: string | null;
  createdAt: string;
}

export const HrDocumentsService = {
  async list() {
    const response = await api.get<{ success: true; documents: HrDocumentRecord[] }>("/hr/documents");
    return response.data.documents;
  },
  async create(input: {
    employeeId: string;
    type: HrDocumentType;
    issueDate: string;
    effectiveDate: string;
    details?: string;
    fields?: Record<string, string>;
  }) {
    const response = await api.post<{ success: true; document: HrDocumentRecord }>("/hr/documents", input);
    return response.data.document;
  },
  async publish(documentId: string) {
    const response = await api.patch<{ success: true; document: HrDocumentRecord }>(`/hr/documents/${documentId}/publish`);
    return response.data.document;
  },
  async discard(documentId: string) {
    await api.delete(`/hr/documents/${documentId}`);
  },
  async file(documentId: string) {
    const response = await api.get<Blob>(`/hr/documents/${documentId}/file`, { responseType: "blob" });
    return response.data;
  },
  async myDocuments() {
    const response = await api.get<{ success: true; documents: HrDocumentRecord[] }>("/hr/documents/me");
    return response.data.documents;
  },
  async myFile(documentId: string) {
    const response = await api.get<Blob>(`/hr/documents/me/${documentId}/file`, { responseType: "blob" });
    return response.data;
  },
};
