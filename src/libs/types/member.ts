import { ObjectId } from "mongoose";
import { Request } from "express";
import { Session, SessionData } from "express-session";
import "./session";
import { MemberStatus, MemberType } from "../enums/member.enum";

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
    memberPoints: number;
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
    memberPoints?: number;
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
