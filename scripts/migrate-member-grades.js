/**
 * One-off migration: members created before belts and medals existed.
 *
 *   {}  ->  { memberBelt: "WHITE", memberMedals: { gold: 0, silver: 0, bronze: 0 } }
 *
 * Only fills in what is missing, so existing grades are never overwritten and
 * the script is safe to run more than once. The admin panel copes with members
 * that have neither field, so this is a tidy-up rather than a requirement.
 *
 * Run with:  node scripts/migrate-member-grades.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

(async function () {
    await mongoose.connect(String(process.env.MONGO_URL), {});
    const members = mongoose.connection.db.collection("members");

    const belted = await members.updateMany(
        { memberBelt: { $exists: false } },
        { $set: { memberBelt: "WHITE" } }
    );
    console.log(`memberBelt set on ${belted.modifiedCount} member(s)`);

    const medalled = await members.updateMany(
        { memberMedals: { $exists: false } },
        { $set: { memberMedals: { gold: 0, silver: 0, bronze: 0 } } }
    );
    console.log(`memberMedals set on ${medalled.modifiedCount} member(s)`);

    await mongoose.disconnect();
    console.log("done");
})().catch((err) => {
    console.log("Error, migrate-member-grades:", err);
    process.exit(1);
});
