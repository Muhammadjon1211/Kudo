/**
 * tsc only emits .ts files, so the EJS templates and the public assets have to
 * be copied into dist/ for a built server to render the admin panel.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

["views", "public"].forEach(function (dir) {
    const from = path.join(root, "src", dir),
        to = path.join(root, "dist", dir);

    if (!fs.existsSync(from)) return;
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(from, to, { recursive: true });
    console.log(`copied src/${dir} -> dist/${dir}`);
});
