import { Document, Schema, Types, model } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export interface IMarketingBlog extends Document {
  title: string;
  description: string;
  thumbnail: string;
  details: string;
  authorId: Types.ObjectId;
  published: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const marketingBlogSchema = new Schema<IMarketingBlog>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    thumbnail: { type: String, required: true, trim: true, maxlength: 2048 },
    details: { type: String, trim: true, default: "", maxlength: 10000 },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

marketingBlogSchema.plugin(companyScoped);
marketingBlogSchema.index({ published: 1, publishedAt: -1 });
export const MarketingBlog = model<IMarketingBlog>(
  "MarketingBlog",
  marketingBlogSchema,
);
