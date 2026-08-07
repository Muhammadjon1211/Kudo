import { ObjectId } from "mongoose";
import { LikeGroup } from "../enums/like.enum";

export interface Like {
    _id: ObjectId;
    likeGroup: LikeGroup;
    memberId: ObjectId;
    likeRefId: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface LikeInput {
    memberId: ObjectId;
    likeRefId: ObjectId;
    likeGroup: LikeGroup;
}

/**
 * What a toggle did. `modifier` is what the target's counter should move by —
 * zero when a racing request already applied the change.
 */
export interface LikeToggle {
    liked: boolean;
    modifier: number;
}
