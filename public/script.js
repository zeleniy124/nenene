let score = 0;
const initialHP = 1000000000;
let sessionId = localStorage.getItem('sessionId');
let canClick = true; // Variable to control click timing

if (!sessionId) {
    sessionId = Math.random().toString(36).substring(7);
    localStorage.setItem('sessionId', sessionId);
}

const SERVER_URL = 'https://live-roughy-hugely.ngrok-free.app';

const ws = new WebSocket(SERVER_URL);

ws.onopen = () => {
    console.log('Connected to server');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.hpUpdate !== undefined) {
        updateHP(data.hpUpdate);
    }
    if (data.scoresUpdate !== undefined) {
        updateScoreboard(data.scoresUpdate);
    }
};

ws.onclose = () => {
    console.log('Disconnected from server');
};

// Function to fetch the initial score and top scores from the server
function fetchInitialScore() {
    fetch(`${SERVER_URL.replace('wss', 'https')}/api/scores`)
        .then(response => response.json())
        .then(scores => {
            updateScoreboard(scores);
            scores.forEach(score => {
                if (score.sessionId === sessionId) {
                    updateDisplayedScore(score.score);
                }
            });
        })
        .catch(error => console.error('Error:', error));
}

// Update the displayed score
function updateDisplayedScore(newScore) {
    score = newScore;
    const scoreDisplay = document.getElementById('score');
    scoreDisplay.textContent = score;
}

// Update the HP display and progress bar
function updateHP(currentHP) {
    const hpDisplay = document.getElementById('hp');
    const progress = document.getElementById('progress');
    hpDisplay.textContent = currentHP;
    const hpPercentage = (currentHP / initialHP) * 100;
    progress.style.width = hpPercentage + '%';
}

// Call fetchInitialScore when the DOMContentLoaded event occurs
document.addEventListener('DOMContentLoaded', fetchInitialScore);

function bonkDog() {
    if (!canClick) return; // Prevent clicking if not allowed
    canClick = false; // Disable further clicks

    const dog = document.getElementById('dog');

    // Change the dog's image to the kicked version
    dog.src = 'powell_2.png';

    // Increase the score and update the display
    score += 1;
    updateDisplayedScore(score);

    // Send updated score to the server
    updateScore(score);

    // Revert the dog's image after a short delay
    setTimeout(() => {
        dog.src = 'powell_1.png';
    }, 200);

    // Re-enable clicking after 1 second
    setTimeout(() => {
        canClick = true;
    }, 1000);
}

function updateScore(score) {
    fetch(`${SERVER_URL.replace('wss', 'https')}/api/score`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, score }),
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message); // Access the message property
        console.log("Current Score:", data.score); // Access the score property
    })
    .catch(error => console.error('Error:', error));
}

// Function to update the scoreboard
function updateScoreboard(scores) {
    let scoreboard = document.getElementById('scoreboard');
    scoreboard.innerHTML = '<div class="title">Top Scores</div>';
    scores.forEach((score, index) => {
        let scoreItem = document.createElement('div');
        scoreItem.classList.add('score-item');
        if (score.sessionId === sessionId) {
            scoreItem.innerText = `${index + 1}. ${score.sessionId} (you): ${score.score}`;
            scoreItem.classList.add('you'); // Highlight the player's score
        } else {
            scoreItem.innerText = `${index + 1}. ${score.sessionId}: ${score.score}`;
        }
        scoreboard.appendChild(scoreItem);
    });
}