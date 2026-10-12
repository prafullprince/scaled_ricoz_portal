import { Schema, model } from "mongoose";

export interface HelpLink {
  id: string;
  title: string;
  description: string;
  url: string;
}

export interface IHelpOptions {
  _id: string;
  selfHelp: HelpLink[];
  usefulLinks: HelpLink[];
  updatedBy: Schema.Types.ObjectId | null;
  updatedAt: Date;
}

const helpLinkSchema = new Schema<HelpLink>({
  id: { type: String, required: true, trim: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  url: { type: String, required: true, trim: true, maxlength: 1000 },
}, { _id: false });

const helpOptionsSchema = new Schema<IHelpOptions>({
  _id: { type: String, default: "default" },
  selfHelp: { type: [helpLinkSchema], default: [] },
  usefulLinks: { type: [helpLinkSchema], default: [] },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: { createdAt: false, updatedAt: true } });

export const HelpOptions = model<IHelpOptions>("HelpOptions", helpOptionsSchema);
