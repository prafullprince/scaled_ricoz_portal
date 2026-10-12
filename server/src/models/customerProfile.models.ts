import { Schema, model, Document, Types } from "mongoose";

export interface ICustomerProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerProfileSchema = new Schema<ICustomerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
  },
  { timestamps: true },
);

export const CustomerProfile = model<ICustomerProfile>("CustomerProfile", customerProfileSchema);
