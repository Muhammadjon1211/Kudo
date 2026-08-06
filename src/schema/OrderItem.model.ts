import mongoose, { Schema } from "mongoose";
import { ProductSize } from "../libs/enums/product.enum";

const orderItemSchema = new Schema(
    {
        itemQuantity: {
            type: Number,
            required: true,
        },

        itemPrice: {
            type: Number,
            required: true,
        },

        itemSize: {
            type: String,
            enum: ProductSize,
            required: true,
        },

        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },

        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
    },
    { timestamps: true, collection: "orderItems" }
);

export default mongoose.model("OrderItem", orderItemSchema);
