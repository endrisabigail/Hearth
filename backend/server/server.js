import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from '../routes/auth.js';
import questRoutes from '../routes/quest.js';

dotenv.config(); // Load environment variables from .env file

const app = express(); // Create an Express application

// Connect to the database
connectDB();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/auth', authRoutes); // Use authentication routes for /api/auth
app.use('/api/quests', questRoutes); // Use quest routes for /api/quests

const PORT = process.env.PORT || 5000; // Define the port to listen on

app.listen(PORT, () => {
    console.log(`Hearth is running on port ${PORT}`); // Log a message when the server starts
});