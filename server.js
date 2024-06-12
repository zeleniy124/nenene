const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: 'https://cosmic-shortbread-544cb2.netlify.app', // Allow this origin
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true,
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

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

// WebSocket connection
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('message', (message) => {
        console.log(`Received message: ${message}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
    
    // Send initial HP and scores when a client connects
    updateHPAndScores(ws);
});

// Broadcast function to send messages to all connected clients
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

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

// Helper function to update HP and scores
async function updateHPAndScores(ws = null) {
    try {
        const scores = await Score.find().sort({ score: -1 }).limit(15);
        const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
        const currentHP = 1000000000 - (totalScore * 1000);
        const data = {
            hpUpdate: currentHP,
            scoresUpdate: scores
        };
        
        if (ws) {
            ws.send(JSON.stringify(data));
        } else {
            broadcast(data);
        }
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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Call updateHPAndScores on server start
    updateHPAndScores();
});
