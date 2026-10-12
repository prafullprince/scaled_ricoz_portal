import { Document, model, Schema, Types } from "mongoose";
import { companyScoped } from "../modules/company/company.plugin.js";

export enum PersonalTodoStatus {
  OPEN = "OPEN",
  COMPLETED = "COMPLETED",
  DELETED = "DELETED",
}

export enum PersonalTodoAction {
  CREATED = "CREATED",
  EDITED = "EDITED",
  COMPLETED = "COMPLETED",
  DELETED = "DELETED",
}

export interface IPersonalTodoHistoryEvent {
  action: PersonalTodoAction;
  actorId: Types.ObjectId;
  title: string;
  description: string;
  deadline: Date;
  createdAt: Date;
}

export interface IPersonalTodo extends Document {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description: string;
  deadline: Date;
  status: PersonalTodoStatus;
  completedAt: Date | null;
  deletedAt: Date | null;
  history: Types.DocumentArray<IPersonalTodoHistoryEvent>;
  createdAt: Date;
  updatedAt: Date;
}

const todoHistorySchema = new Schema<IPersonalTodoHistoryEvent>(
  {
    action: { type: String, enum: Object.values(PersonalTodoAction), required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 4_000 },
    deadline: { type: Date, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const personalTodoSchema = new Schema<IPersonalTodo>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 4_000 },
    deadline: { type: Date, required: true, index: true },
    status: { type: String, enum: Object.values(PersonalTodoStatus), required: true, default: PersonalTodoStatus.OPEN, index: true },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    history: { type: [todoHistorySchema], default: [] },
  },
  { timestamps: true },
);

personalTodoSchema.plugin(companyScoped);
personalTodoSchema.index({ companyId: 1, ownerId: 1, status: 1, deadline: 1 });
personalTodoSchema.index({ companyId: 1, ownerId: 1, updatedAt: -1 });

export const PersonalTodo = model<IPersonalTodo>("PersonalTodo", personalTodoSchema);
