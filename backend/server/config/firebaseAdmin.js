import { initializeApp, cert } from "firebase-admin/app";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(
        readFileSync(path.join(__dirname, "firebaseServiceAccount.json"), "utf8"),
    );

const app = initializeApp({
    credential: cert(serviceAccount),
});

export default app;