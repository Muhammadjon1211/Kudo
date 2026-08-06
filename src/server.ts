import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import app from "./app";

mongoose
    .connect(process.env.MONGO_URL as string, {})
    .then(() => {
        console.log("MongoDB connection SUCCEED");
        const PORT = process.env.PORT ?? 3007;
        app.listen(PORT, function () {
            console.info(`Our server successfully running on PORT ${PORT}`);
            console.info(`Admin project on http://localhost:${PORT}/admin \n`);
        });
    })
    .catch((err) => console.log("ERROR on connection MongoDB", err));
