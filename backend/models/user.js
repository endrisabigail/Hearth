import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({ // Define the schema for the User model
    username: { // Define the username field
        type: String,
        required: true,
        unique: true,
    },
    password: { // Define the password field
        type: String,
        required: true,
    },
    email: { // Define the email field
        type: String,
        required: true,
        unique: true,
    },
    
    rank: { // Define the "rank" title card field
        type: String,
        default:"New Member"
    },
    points: { // Define the points field for gamification
       type: Map,
       of: Number,
       default: {}

    },
    totalPoints:{
        type: 
        Number, default: 0 
    },

    badges: [{
        badgeName: String,
        badgeDescription: String,
        badgeImage: String,
        earnedAt: { type: Date, default: Date.now }
    }]
    
}, { timestamps: true }); // Track automatically when a user has joined
export default mongoose.model('User', UserSchema); // Export the User model based on the defined schema