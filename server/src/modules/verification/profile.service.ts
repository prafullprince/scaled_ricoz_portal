import mongoose from "mongoose";
import { CustomerProfile, EmployeeProfile, InternProfile, InvestorProfile } from "../../models/index.js";

/** Lazily creates the role-specific profile the first time it's needed. */
export async function getOrCreateCustomerProfile(userId: mongoose.Types.ObjectId) {
  return CustomerProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function getOrCreateInternProfile(userId: mongoose.Types.ObjectId) {
  return InternProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function getOrCreateEmployeeProfile(userId: mongoose.Types.ObjectId) {
  return EmployeeProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function getOrCreateInvestorProfile(userId: mongoose.Types.ObjectId) {
  return InvestorProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}
