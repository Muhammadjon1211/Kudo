import mongoose, { Schema } from "mongoose";
import { ViewGroup } from "../libs/enums/view.enum";

/**
 * Dedupe table: one row per member per viewed document, so a view count rises
 * once per member however often they come back.
 */
const viewSchema = new Schema(
    {
        viewGroup: {
            type: String,
            enum: ViewGroup,
            required: true,
        },

        memberId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "Member",
        },

        viewRefId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
    },
    { timestamps: true, collection: "views" }
);

/* the index is what actually enforces the dedupe; the lookup in the service is
   only there to avoid throwing on the common path */
viewSchema.index(
    { memberId: 1, viewRefId: 1, viewGroup: 1 },
    { unique: true }
);

export default mongoose.model("View", viewSchema);
