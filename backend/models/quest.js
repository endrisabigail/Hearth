import mongoose from 'mongoose';

const QuestSchema = new mongoose.Schema({ // Define the schema for the Quest model
    title: { // Define the title field
        type: String,
        required: true
    },
    description: { // Define the description field
        type: String,
        required: true
    },
    dueDate: { // Define the due date field
        type: Date,
        required: true
    },
    points: { // Define the points field for gamification
        type: Number,
        default: 0
    },
    status: { // Define the status field to track quest completion
        type: String,
        enum: ['Not Started', 'In Progress', 'Completed'],
        default: 'Not Started'
    }
}, { timestamps: true }); // Track automatically when a quest is created or updated

export default mongoose.model('Quest', QuestSchema); // Export the Quest model based on the defined schema