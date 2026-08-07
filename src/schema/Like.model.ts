import mongoose, { Schema } from "mongoose";
import { LikeGroup } from "../libs/enums/like.enum";

/** one row per member per liked document; removing the row is the unlike */
const likeSchema = new Schema(
    {
        likeGroup: {
            type: String,
            enum: LikeGroup,
            required: true,
        },

        memberId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Member",
        },

        likeRefId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
    },
    { timestamps: true, collection: "likes" }
);

/* the index is what keeps a double-click from counting twice */
likeSchema.index(
    { memberId: 1, likeRefId: 1, likeGroup: 1 },
    { unique: true }
);

export default mongoose.model("Like", likeSchema);
