import mongoose, { Schema } from "mongoose";

const contactSchema = new Schema(
    {
        contactPhone: {
            type: String,
            default: "",
        },

        contactEmail: {
            type: String,
            default: "",
        },

        contactAddress: {
            type: String,
            default: "",
        },

        contactMapUrl: {
            type: String,
            default: "",
        },

        contactWorkHours: {
            type: String,
            default: "",
        },

        contactSocials: {
            instagram: { type: String, default: "" },
            telegram: { type: String, default: "" },
            facebook: { type: String, default: "" },
            youtube: { type: String, default: "" },
        },
    },
    { timestamps: true, collection: "contacts" }
);

export default mongoose.model("Contact", contactSchema);
