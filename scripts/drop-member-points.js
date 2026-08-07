/**
 * One-off migration: memberPoints is gone — students are ranked by the medals
 * they have won instead.
 *
 *   { memberPoints: 2, ... }  ->  { ... }
 *
 * The field was dropped from the schema, but mongoose only stops writing it;
 * documents already holding it keep returning it through aggregations. This
 * removes it for good, and also backfills memberMedals on anyone who predates
 * it so the ranking has something to sort on.
 *
 * Safe to run more than once. Run with:  node scripts/drop-member-points.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

(async function () {
    await mongoose.connect(String(process.env.MONGO_URL), {});
    const members = mongoose.connection.db.collection("members");

    const withPoints = await members.countDocuments({
        memberPoints: { $exists: true },
    });
    console.log(`found ${withPoints} member(s) still carrying memberPoints`);

    const dropped = await members.updateMany(
        { memberPoints: { $exists: true } },
        { $unset: { memberPoints: "" } }
    );
    console.log(`  dropped memberPoints from ${dropped.modifiedCount}`);

    const backfilled = await members.updateMany(
        { memberMedals: { $exists: false } },
        { $set: { memberMedals: { gold: 0, silver: 0, bronze: 0 } } }
    );
    console.log(`  backfilled memberMedals on ${backfilled.modifiedCount}`);

    const noBelt = await members.updateMany(
        { memberBelt: { $exists: false } },
        { $set: { memberBelt: "WHITE" } }
    );
    console.log(`  backfilled memberBelt on ${noBelt.modifiedCount}`);

    await mongoose.disconnect();
    console.log("done");
})().catch((err) => {
    console.log("Error, drop-member-points:", err);
    process.exit(1);
});
