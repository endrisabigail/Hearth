import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const { credential, initializeApp } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : JSON.parse(
        readFileSync(path.join(__dirname, "firebaseServiceAccount.json"), "utf8"),
    );
initializeApp({
    credential: credential.cert(serviceAccount),
});

export default pkg;