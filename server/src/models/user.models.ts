import { Schema, model, Document, Types } from "mongoose";
import { companyHomeStamp } from "../modules/company/company.plugin.js";
import { UserRole, UserStatus } from "../modules/auth/authorization.js";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phoneNumber?: string;
  email: string;
  password: string;
  roles: UserRole[];
  status: UserStatus;
  emailVerifiedAt: Date | null;
  emailVerified?: boolean;
  profile_pic?: string;
  about: string;
  lastSeen: Date;
  companyId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true
    },
    password: { type: String, required: true, select: false },
    roles: {
      type: [String],
      enum: Object.values(UserRole),
      default: [UserRole.USER],
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING,
      index: true,
    },
    emailVerifiedAt: { type: Date, default: null },
    emailVerified: { type: Boolean, default: undefined },
    profile_pic: { type: String, default: "" },
    about: { type: String, default: "Hey there! I am using First Chat." },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

UserSchema.plugin(companyHomeStamp);
export const User = model<IUser>("User", UserSchema);
