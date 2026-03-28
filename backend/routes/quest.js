import express from 'express';
import User from '../models/user.js';
import Quest from '../models/quest.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router(); // Create a router for quest-related routes

//completing a quest route
router.post('/complete', protect, async (req, res) => {
    try {
        const { questId } = req.body; // Extract the quest ID from the request body
        
        // find the user from jwt token and the quest
        const currentUser = await User.findById(req.user.id || req.user);
        const currentQuest = await Quest.findById(questId);

        if (!currentQuest) return res.status(404).json({ msg: "Quest not found." });

        //add points to categories
        const category = currentQuest.category; // Assuming the quest has a category field
        
        // Initialize points category if it doesn't exist
        if (!currentUser.points[category]) {
            currentUser.points[category] = 0;
        }
        currentUser.points[category] += 5;

        const currentPoints = currentUser.points[category];
        
        // Check if the user has reached the threshold for a new badge
        let newBadge = null;
        
        // badge logic: 5 (first quest completed congrats badge)
        //then 20, then 40, 60... 
        if (currentPoints === 5) {
            newBadge = {
                badgeName: `${category} First Timer`,
                category: category,
                badgeDescription: 'Congratulations on completing your first quest! Keep up the great work!',
                dateEarned: new Date()
            };
        }
        //check if user has reached the next badge threshold
        else if (currentPoints >= 20 && currentPoints % 20 === 0) {
            newBadge = {
                badgeName: `${category} Level ${currentPoints}`,
                category: category,
                badgeDescription: `Amazing! You have completed ${currentPoints} points worth of quests in the ${category} category. Keep it up!`,
                dateEarned: new Date()
            };
        }

        //save the badge
        if (newBadge) {
            // Check for duplicates
            const alreadyHas = currentUser.badges.some(b => b.badgeName === newBadge.badgeName);
            if (!alreadyHas) {
                currentUser.badges.push(newBadge);
            } else {
                newBadge = null; 
            }
        }

        //save the user with the updated points and badges
        await currentUser.save();
        
        res.json({
            msg: "Prgress saved!", // Keeping original spelling
            points: currentUser.points[category],
            newBadge: newBadge ? newBadge.badgeName : null,
            badgeDescription: newBadge ? newBadge.badgeDescription : null,
            allBadges: currentUser.badges
        });
        
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error"); // Return a 500 Internal Server Error response if something goes wrong
    }
});

export default router;