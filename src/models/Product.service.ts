import fs from "fs";
import path from "path";
import { ObjectId } from "mongoose";
import ProductModel from "../schema/Product.model";
import ViewService from "./View.service";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { ProductStatus } from "../libs/enums/product.enum";
import { ViewGroup } from "../libs/enums/view.enum";
import { ViewInput } from "../libs/types/view";
import { Paginated, T } from "../libs/types/common";
import {
    Product,
    ProductInput,
    ProductInquiry,
    ProductUpdateInput,
} from "../libs/types/product";

const UPLOAD_ROOT = "uploads/products/";

/**
 * MongoDB reports a unique-index violation as E11000. Products are only
 * soft-deleted, so a removed product keeps holding its name in the index.
 */
const isDuplicateName = (err: unknown): boolean =>
    typeof err === "object" && err !== null && (err as T).code === 11000;

class ProductService {
    private readonly productModel;
    private readonly viewService;

    constructor() {
        this.productModel = ProductModel;
        this.viewService = new ViewService();
    }

    /** SPA */

    public async getProducts(inquiry: ProductInquiry): Promise<Product[]> {
        const match: T = { productStatus: ProductStatus.PROCESS };
        if (inquiry.search)
            match.productName = { $regex: new RegExp(inquiry.search, "i") };

        const sort: T =
            inquiry.order === "productPrice"
                ? { [inquiry.order]: 1 }
                : { [inquiry.order]: -1 };

        const result = await this.productModel
            .aggregate([
                { $match: match },
                { $sort: sort },
                { $skip: (inquiry.page - 1) * inquiry.limit },
                { $limit: inquiry.limit },
            ])
            .exec();

        return result as Product[];
    }

    /**
     * `memberId` is whatever `retrieveAuth` left on the request, so it is null
     * for a guest. The counter is per member rather than per request: a guest
     * browsing, a refresh and a second tab all leave it alone.
     */
    public async getProduct(
        id: string,
        memberId?: ObjectId | null
    ): Promise<Product> {
        const productId = shapeIntoMongooseObjectId(id);
        let result = await this.productModel
            .findOne({ _id: productId, productStatus: ProductStatus.PROCESS })
            .exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        if (memberId) {
            const input: ViewInput = {
                memberId: shapeIntoMongooseObjectId(memberId),
                viewRefId: productId,
                viewGroup: ViewGroup.PRODUCT,
            };

            const existView = await this.viewService.checkViewExistence(input);
            if (!existView) {
                const inserted = await this.viewService.insertMemberView(input);
                /* null means another request won the race and already counted */
                if (inserted) {
                    /* `new: true` so the reply carries the count it just set,
                       rather than the one from before the visit */
                    const updated = await this.productModel
                        .findByIdAndUpdate(
                            productId,
                            { $inc: { productViews: 1 } },
                            { new: true }
                        )
                        .exec();
                    if (updated) result = updated;
                }
            }
        }

        return result.toJSON() as unknown as Product;
    }

    /** SSR */

    public async getAllProducts(
        inquiry: ProductInquiry
    ): Promise<Paginated<Product>> {
        /* removed products stay listable so the admin can restore them */
        const match: T = inquiry.productStatus
            ? { productStatus: inquiry.productStatus }
            : { productStatus: { $ne: ProductStatus.DELETE } };
        if (inquiry.search)
            match.productName = { $regex: new RegExp(inquiry.search, "i") };

        const [result] = await this.productModel
            .aggregate([
                { $match: match },
                {
                    $facet: {
                        list: [
                            { $sort: { createdAt: -1 } },
                            { $skip: (inquiry.page - 1) * inquiry.limit },
                            { $limit: inquiry.limit },
                        ],
                        total: [{ $count: "count" }],
                    },
                },
            ])
            .exec();

        return {
            list: result.list as Product[],
            total: result.total[0]?.count ?? 0,
            page: inquiry.page,
            limit: inquiry.limit,
        };
    }

    public async countProducts(): Promise<number> {
        return await this.productModel
            .countDocuments({ productStatus: { $ne: ProductStatus.DELETE } })
            .exec();
    }

    public async createNewProduct(input: ProductInput): Promise<Product> {
        try {
            const result = await this.productModel.create(input);
            return result.toJSON() as unknown as Product;
        } catch (err) {
            console.log("Error, model:createNewProduct:", err);
            if (isDuplicateName(err))
                throw new Errors(HttpCode.CONFLICT, Message.USED_PRODUCT_NAME);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
    }

    public async updateChosenProduct(
        id: string,
        input: ProductUpdateInput
    ): Promise<Product> {
        const productId = shapeIntoMongooseObjectId(id);
        try {
            const result = await this.productModel
                .findOneAndUpdate({ _id: productId }, input, { new: true })
                .exec();
            if (!result)
                throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);

            return result.toJSON() as unknown as Product;
        } catch (err) {
            if (err instanceof Errors) throw err;
            console.log("Error, model:updateChosenProduct:", err);
            if (isDuplicateName(err))
                throw new Errors(HttpCode.CONFLICT, Message.USED_PRODUCT_NAME);
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
        }
    }

    /** images are appended, so an edit never wipes the existing gallery */
    public async addProductImages(
        id: string,
        images: string[]
    ): Promise<Product> {
        const productId = shapeIntoMongooseObjectId(id);
        const result = await this.productModel
            .findOneAndUpdate(
                { _id: productId },
                { $push: { productImages: { $each: images } } },
                { new: true }
            )
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);

        return result.toJSON() as unknown as Product;
    }

    public async removeProductImage(
        id: string,
        image: string
    ): Promise<Product> {
        const productId = shapeIntoMongooseObjectId(id);
        /* only ever unlink inside the product upload folder */
        const normalized = path.posix.normalize(image);
        if (!normalized.startsWith(UPLOAD_ROOT) || normalized.includes(".."))
            throw new Errors(HttpCode.BAD_REQUEST, Message.NO_SUCH_IMAGE);

        const result = await this.productModel
            .findOneAndUpdate(
                { _id: productId, productImages: normalized },
                { $pull: { productImages: normalized } },
                { new: true }
            )
            .exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_SUCH_IMAGE);

        try {
            await fs.promises.unlink(path.join(process.cwd(), normalized));
        } catch (err) {
            /* the row is what matters; a missing file is not a failure */
            console.log("Error, model:removeProductImage: unlink skipped");
        }

        return result.toJSON() as unknown as Product;
    }

    public async removeChosenProduct(id: string): Promise<void> {
        const productId = shapeIntoMongooseObjectId(id);
        const result = await this.productModel
            .findOneAndUpdate(
                { _id: productId },
                { productStatus: ProductStatus.DELETE },
                { new: true }
            )
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.DELETE_FAILED);
    }
}

export default ProductService;
