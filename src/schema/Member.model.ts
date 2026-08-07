import mongoose, { Schema } from "mongoose";
import { MemberBelt, MemberStatus, MemberType } from "../libs/enums/member.enum";

/** medal tally, one count per placing */
const memberMedalsSchema = new Schema(
    {
        gold: { type: Number, default: 0, min: 0 },
        silver: { type: Number, default: 0, min: 0 },
        bronze: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const memberSchema = new Schema(
    {
        memberType: {
            type: String,
            enum: MemberType,
            default: MemberType.STUDENT,
        },

        memberStatus: {
            type: String,
            enum: MemberStatus,
            default: MemberStatus.ACTIVE,
        },

        memberNick: {
            type: String,
            index: { unique: true, sparse: true },
            required: true,
        },

        memberPhone: {
            type: String,
            index: { unique: true, sparse: true },
            required: true,
        },

        memberPassword: {
            type: String,
            select: false,
            required: true,
        },

        memberFullName: {
            type: String,
        },

        memberAddress: {
            type: String,
        },

        memberDesc: {
            type: String,
        },

        memberImage: {
            type: String,
        },

        memberBelt: {
            type: String,
            enum: MemberBelt,
            default: MemberBelt.WHITE,
        },

        memberMedals: {
            type: memberMedalsSchema,
            default: () => ({}),
        },
    },
    { timestamps: true, collection: "members" }
);

export default mongoose.model("Member", memberSchema);
