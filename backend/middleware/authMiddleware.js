import { getAuth } from "firebase-admin/auth";
import firebaseApp from "../server/config/firebaseAdmin.js";
import User from "../models/user.js";

const protect = async (req, res, next) => {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ msg: "No token, authorization denied." });
    }

    const idToken = authHeader.split(" ")[1];

    try {
        const decoded = await getAuth(firebaseApp).verifyIdToken(idToken);

        // always available =  raw Firebase identity
        req.firebaseUid = decoded.uid;
        req.firebaseEmail = decoded.email;

        // try to resolve the Mongo user (won't exist yet on first /register call)
        const user = await User.findOne({ firebaseUid: decoded.uid });
        if (user) {
            req.user = user._id;
        }

        next();
    } catch (err) {
        console.error("Firebase token verification failed:", err.message);
        res.status(401).json({ msg: "Token is not valid." });
    }
};

export default protect;