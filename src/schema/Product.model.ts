import mongoose, { Schema } from "mongoose";
import { ProductSize, ProductStatus } from "../libs/enums/product.enum";

/** one stock line per size the product is sold in */
const productSizeSchema = new Schema(
    {
        sizeName: {
            type: String,
            enum: ProductSize,
            required: true,
        },

        sizeLeftCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { _id: false }
);

const productSchema = new Schema(
    {
        productStatus: {
            type: String,
            enum: ProductStatus,
            default: ProductStatus.PAUSE,
        },

        productName: {
            type: String,
            index: { unique: true, sparse: true },
            required: true,
        },

        productPrice: {
            type: Number,
            required: true,
        },

        productSizes: {
            type: [productSizeSchema],
            required: true,
        },

        productDesc: {
            type: String,
        },

        productImages: {
            type: [String],
            default: [],
        },

        productViews: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true, collection: "products" }
);

export default mongoose.model("Product", productSchema);
