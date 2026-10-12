import { Schema, model, Document, Types } from "mongoose";

export interface IEmployeeProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  endDate: Date | null;
  joiningDate: Date | null;
  department: string | null;
  managerId: Types.ObjectId | null;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | null;
  address: string | null;
  // Snapshot of the role granted at onboarding — set once, never changed afterward.
  initialRole: string | null;
  // The role the employee currently identifies as; self-editable from one of JOB_ROLES.
  currentRole: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const employeeProfileSchema = new Schema<IEmployeeProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    endDate: { type: Date, default: null },
    joiningDate: { type: Date, default: null },
    department: { type: String, default: null },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    employmentType: { type: String, enum: ["FULL_TIME", "PART_TIME", "CONTRACT"], default: null },
    address: { type: String, default: null },
    initialRole: { type: String, default: null },
    currentRole: { type: String, default: null },
  },
  { timestamps: true },
);

export const EmployeeProfile = model<IEmployeeProfile>("EmployeeProfile", employeeProfileSchema);
