import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const router = express.Router(); // Create a router for authentication-related routes

// Register a new user
router.post("/register", async (req, res) => {
  try {
    // Extract username, email, and password from the request body
    const { username, email, password } = req.body;
    //Check if the user already exists in the database
    let user = await User.findOne({ email });
    if (user) {
      // If the user already exists, return a 400 Bad Request response with an error message
      return res.status(400).json({ msg: "This email is already registered." });
    }
    // Hash the password using bcrypt with a salt round of 10
    const salt = await bcrypt.genSalt(10); // add 10 rounds of salt
    const hashedPassword = await bcrypt.hash(password, salt); //request password, response hashed
    // Once done, create a new user
    user = new User({
      username,
      email,
      password: hashedPassword,
      rank: "Fledgling", // Default rank for new users
    });
    // push to mongoose atlas
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });
    res.status(201).json({ token });
  } catch (err) {
    console.error("FULL ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});
// session key credentials for login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body; // Extract email and password from the request body
    // check if the user exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials." }); // If the user does not exist, return a 400 Bad Request response with an error message
    }
    // compare password w/ the hashed password stored in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials." }); // If the password does not match, return a 400 Bad Request response with an error message
    }
    // create web token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }, // Token expires in 24 hours
    );
    // send data to client
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        rank: user.rank,
        points: user.points,
        badges: user.badges,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error"); // Return a 500 Internal Server Error response if login fails
  }
});

export default router; // Export the router to be used in the main server file
