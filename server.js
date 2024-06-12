const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const port = 80;
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: 'https://0c14-2001-1c08-385-fa00-ddfb-e900-fa33-41ce.ngrok-free.app', // Allow this origin
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true,
}));

// MongoDB connection
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://admin:admin@cluster0.iw8pgql.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

const ScoreSchema = new mongoose.Schema({
    sessionId: String,
    score: Number,
    timestamp: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', ScoreSchema);

// Routes
app.post('/api/score', async (req, res) => {
    try {
        const { sessionId, score } = req.body;
        const existingScore = await Score.findOne({ sessionId });

        if (existingScore) {
            if (score > existingScore.score) {
                existingScore.score = score;
                await existingScore.save();
                res.status(201).json({ message: 'Score updated', score: existingScore.score });
            } else {
                res.status(200).json({ message: 'Existing score is higher or equal. No update needed.', score: existingScore.score });
            }
        } else {
            const newScore = new Score({ sessionId, score });
            await newScore.save();
            res.status(201).json({ message: 'New score saved', score: newScore.score });
        }

        // Emit the updated HP and scores to all connected clients
        updateHPAndScores();
    } catch (error) {
        res.status(500).json({ message: 'Error saving score' });
    }
});

app.get('/api/scores', async (req, res) => {
    try {
        const scores = await Score.find().sort({ score: -1 }).limit(15);
        res.json(scores);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching scores' });
    }
});

// Clear all scores from the database
app.delete('/api/scores', async (req, res) => {
    try {
        await Score.deleteMany({});
        res.status(200).json({ message: 'All scores cleared' });

        // Emit the updated HP and scores to all connected clients
        updateHPAndScores();
    } catch (error) {
        res.status(500).json({ message: 'Error clearing scores' });
    }
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '.')));

// Fallback to serve 'index.html' for any unknown routes (for SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper function to update HP and scores
async function updateHPAndScores() {
    try {
        const scores = await Score.find().sort({ score: -1 }).limit(15);
        const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
        const currentHP = 1000000000 - (totalScore * 1000);
        io.emit('hpUpdate', currentHP);
        io.emit('scoresUpdate', scores);
    } catch (error) {
        console.log('Error updating HP and scores:', error);
    }
}

// Set up change stream to listen for changes in the Score collection
const changeStream = Score.watch();

changeStream.on('change', (change) => {
    if (change.operationType === 'update' || change.operationType === 'insert') {
        updateHPAndScores();
    }
});

// Start the server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Call updateHPAndScores on server start
    updateHPAndScores();
});
