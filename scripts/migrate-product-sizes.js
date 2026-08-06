/**
 * One-off migration: products created before per-size stock.
 *
 *   { productCollection, productSize: "XXL", productLeftCount: 50 }
 *      ->  { productSizes: [{ sizeName: "XXL", sizeLeftCount: 50 }] }
 *
 * Products that already carry productSizes are left alone, so it is safe to
 * run more than once. Run with:  node scripts/migrate-product-sizes.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

(async function () {
    await mongoose.connect(String(process.env.MONGO_URL), {});
    const products = mongoose.connection.db.collection("products");

    const legacy = await products
        .find({ productSizes: { $exists: false } })
        .toArray();
    console.log(`found ${legacy.length} product(s) to migrate`);

    for (const product of legacy) {
        const sizeName = product.productSize || "ONE_SIZE",
            sizeLeftCount = product.productLeftCount ?? 0;

        await products.updateOne(
            { _id: product._id },
            {
                $set: { productSizes: [{ sizeName, sizeLeftCount }] },
                $unset: {
                    productCollection: "",
                    productSize: "",
                    productLeftCount: "",
                },
            }
        );
        console.log(
            `  ${product.productName}: ${sizeName} x ${sizeLeftCount}` +
                (product.productCollection
                    ? ` (dropped category ${product.productCollection})`
                    : "")
        );
    }

    await mongoose.disconnect();
    console.log("done");
})().catch((err) => {
    console.log("Error, migrate-product-sizes:", err);
    process.exit(1);
});
