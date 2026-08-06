import { ObjectId } from "mongoose";
import { BlogStatus } from "../enums/blog.enum";
import { Member } from "./member";

export interface Blog {
    _id: ObjectId;
    blogStatus: BlogStatus;
    blogTitle: string;
    blogContent: string;
    blogImage?: string;
    blogViews: number;
    blogAuthorId: ObjectId;
    createdAt: Date;
    updatedAt: Date;

    /* from aggregations */
    authorData?: Member[];
}

export interface BlogInput {
    blogStatus?: BlogStatus;
    blogTitle: string;
    blogContent: string;
    blogImage?: string;
    blogViews?: number;
    blogAuthorId: ObjectId;
}

export interface BlogUpdateInput {
    _id: ObjectId;
    blogStatus?: BlogStatus;
    blogTitle?: string;
    blogContent?: string;
    blogImage?: string;
}

export interface BlogInquiry {
    page: number;
    limit: number;
    order?: string;
    blogStatus?: BlogStatus;
    search?: string;
}
