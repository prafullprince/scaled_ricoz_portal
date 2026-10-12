import { Schema, model, Document, Types } from "mongoose";

export interface IInternProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  endDate: Date | null;
  joiningDate: Date | null;
  department: string | null;
  managerId: Types.ObjectId | null;
  address: string | null;
  // Snapshot of the role granted at onboarding — set once, never changed afterward.
  initialRole: string | null;
  // The role the intern currently identifies as; self-editable from one of JOB_ROLES.
  currentRole: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const internProfileSchema = new Schema<IInternProfile>(
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
    address: { type: String, default: null },
    initialRole: { type: String, default: null },
    currentRole: { type: String, default: null },
  },
  { timestamps: true },
);

export const InternProfile = model<IInternProfile>("InternProfile", internProfileSchema);
