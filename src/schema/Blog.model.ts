import mongoose, { Schema } from "mongoose";
import { BlogStatus } from "../libs/enums/blog.enum";

const blogSchema = new Schema(
    {
        blogStatus: {
            type: String,
            enum: BlogStatus,
            default: BlogStatus.DRAFT,
        },

        blogTitle: {
            type: String,
            required: true,
        },

        blogContent: {
            type: String,
            required: true,
        },

        blogImage: {
            type: String,
        },

        blogViews: {
            type: Number,
            default: 0,
        },

        blogAuthorId: {
            type: Schema.Types.ObjectId,
            ref: "Member",
            required: true,
        },
    },
    { timestamps: true, collection: "blogs" }
);

export default mongoose.model("Blog", blogSchema);
