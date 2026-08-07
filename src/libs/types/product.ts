import { ObjectId } from "mongoose";
import { ProductSize, ProductStatus } from "../enums/product.enum";

/**
 * Stock is tracked per size: one kimono model can be in stock in M, L and XL
 * with a different count for each. Gear without sizing carries a single
 * ONE_SIZE entry.
 */
export interface ProductSizeStock {
    sizeName: ProductSize;
    sizeLeftCount: number;
}

export interface Product {
    _id: ObjectId;
    productStatus: ProductStatus;
    productName: string;
    productPrice: number;
    productSizes: ProductSizeStock[];
    productDesc?: string;
    productImages: string[];
    productViews: number;
    /** units paid for, summed across orders that reached PROCESS */
    productSoldCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProductInput {
    productStatus?: ProductStatus;
    productName: string;
    productPrice: number;
    productSizes: ProductSizeStock[];
    productDesc?: string;
    productImages?: string[];
    productViews?: number;
}

export interface ProductUpdateInput {
    _id: ObjectId;
    productStatus?: ProductStatus;
    productName?: string;
    productPrice?: number;
    productSizes?: ProductSizeStock[];
    productDesc?: string;
    productImages?: string[];
}

export interface ProductInquiry {
    page: number;
    limit: number;
    order: string;
    productStatus?: ProductStatus;
    search?: string;
}
