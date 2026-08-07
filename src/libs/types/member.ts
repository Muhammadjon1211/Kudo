import { ObjectId } from "mongoose";
import { Request } from "express";
import { Session, SessionData } from "express-session";
import "./session";
import { MemberBelt, MemberStatus, MemberType } from "../enums/member.enum";

/** Competition medals won by a member, counted per placing. */
export interface MemberMedals {
    gold: number;
    silver: number;
    bronze: number;
}

export interface Member {
    _id: ObjectId;
    memberType: MemberType;
    memberStatus: MemberStatus;
    memberNick: string;
    memberPhone: string;
    memberPassword?: string;
    memberFullName?: string;
    memberAddress?: string;
    memberDesc?: string;
    memberImage?: string;
    memberBelt: MemberBelt;
    memberMedals: MemberMedals;
    createdAt: Date;
    updatedAt: Date;
}

export interface MemberInput {
    memberType?: MemberType;
    memberStatus?: MemberStatus;
    memberNick: string;
    memberPhone: string;
    memberPassword: string;
    memberFullName?: string;
    memberAddress?: string;
    memberDesc?: string;
    memberImage?: string;
}

export interface MemberUpdateInput {
    _id: ObjectId;
    memberType?: MemberType;
    memberStatus?: MemberStatus;
    memberNick?: string;
    memberPhone?: string;
    memberPassword?: string;
    memberFullName?: string;
    memberAddress?: string;
    memberDesc?: string;
    memberImage?: string;
    memberBelt?: MemberBelt;
    memberMedals?: MemberMedals;
}

export interface MemberInquiry {
    page: number;
    limit: number;
    memberType?: MemberType;
    memberStatus?: MemberStatus;
    search?: string;
}

export interface LoginInput {
    memberNick: string;
    memberPassword: string;
}

export interface PasswordChangeInput {
    currentPassword: string;
    newPassword: string;
}

export interface ExtendedRequest extends Request {
    member: Member;
    file: Express.Multer.File;
    files: Express.Multer.File[];
}

export interface AdminRequest extends Request {
    member: Member;
    session: Session & Partial<SessionData>;
    file: Express.Multer.File;
    files: Express.Multer.File[];
}
