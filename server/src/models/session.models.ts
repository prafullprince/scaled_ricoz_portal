import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    name: string,
    email: string;
    tokenHash: string;
    createdAt: Date;
    updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        tokenHash: {
            type: String,
            required: true,
        },
    },
    { timestamps: true },
);

// Sessions auto-expire 7 days after creation, matching the refresh token lifetime.
sessionSchema.index({ "createdAt": 1 }, { expireAfterSeconds: 604800 });
export const Session = mongoose.model<ISession>("Session", sessionSchema);
