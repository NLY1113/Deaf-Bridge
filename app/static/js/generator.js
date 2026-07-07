const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');

const HAND_SECTIONS = [
    { connections: [[0,1], [0,5], [5,9], [9,13], [0,17]], color: '#FF5722', type: 'palm' },
    { connections: [[1,4]], color: '#FFC107', type: 'finger' },
    { connections: [[5,8]], color: '#4CAF50', type: 'finger' },
    { connections: [[9,12]], color: '#00BCD4', type: 'finger' },
    { connections: [[13,16]], color: '#9C27B0', type: 'finger' },
    { connections: [[17,20]], color: '#E91E63', type: 'finger' }
];

let playbackInterval = null;
const AVATAR_OFFSET_Y = 30; 

async function translateTextToSign(text) {
    try {
        const response = await fetch('/get-sign-sequence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        const data = await response.json();
        if (data.status === 'success') {
            document.getElementById('status-text').innerText = "Playing Sign Language: " + text.toUpperCase();
            playAnimationSequence(data.sequence);
        } else {
            document.getElementById('status-text').innerText = data.message || "Sign not found.";
            ctx.clearRect(0, 0, canvas.width, canvas.height); 
            drawStaticAvatar(); 
        }
    } catch (err) {
        console.error("Error fetching animation sequence:", err);
        document.getElementById('status-text').innerText = "Server communication error.";
    }
}

function playAnimationSequence(sequence) {
    if (playbackInterval) clearInterval(playbackInterval);
    if (!sequence || sequence.length === 0) return;

    let frameIndex = 0;
    playbackInterval = setInterval(() => {
        if (frameIndex >= sequence.length) {
            clearInterval(playbackInterval);
            document.getElementById('status-text').innerText = "Translation animation complete.";
            return;
        }
        renderSignSkeleton(sequence[frameIndex]); 
        frameIndex++;
    }, 85); 
}

function renderSignSkeleton(landmarks) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStaticAvatar(); 

    if (!landmarks || landmarks.length === 0) return;

    const centerX = canvas.width / 2;
    const shoulderY = (canvas.height * 0.45) + AVATAR_OFFSET_Y; 
    const SCALE = 125; 
    const HAND_Y_CENTER_ANCHOR = shoulderY + 30; 

    if (landmarks.length >= 84) {
        let leftHandPoints = [];
        let rightHandPoints = [];

        for (let i = 0; i < 21; i++) {
            leftHandPoints.push({ 
                x: (landmarks[i] * SCALE) + (centerX - 75), 
                y: (landmarks[i + 21] * SCALE) + HAND_Y_CENTER_ANCHOR 
            });
        }

        for (let i = 0; i < 21; i++) {
            rightHandPoints.push({ 
                x: (landmarks[i + 42] * SCALE) + (centerX + 75), 
                y: (landmarks[i + 42 + 21] * SCALE) + HAND_Y_CENTER_ANCHOR 
            });
        }

        drawSingleHand(leftHandPoints);
        drawSingleHand(rightHandPoints);
    } 
    else if (landmarks.length >= 42) {
        let singleHandPoints = [];
        for (let i = 0; i < 21; i++) {
            singleHandPoints.push({ 
                x: (landmarks[i] * SCALE) + centerX, 
                y: (landmarks[i + 21] * SCALE) + HAND_Y_CENTER_ANCHOR 
            });
        }
        drawSingleHand(singleHandPoints);
    }
}

function drawStaticAvatar() {
    const centerX = canvas.width / 2;
    const headCenterY = (canvas.height * 0.25) + AVATAR_OFFSET_Y; 
    const shoulderY = (canvas.height * 0.45) + AVATAR_OFFSET_Y; 

    ctx.beginPath();
    ctx.ellipse(centerX, headCenterY, 58, 68, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#E2E6EA';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX - 75, shoulderY + 25);
    ctx.lineTo(centerX - 60, canvas.height); 
    ctx.lineTo(centerX + 60, canvas.height); 
    ctx.lineTo(centerX + 75, shoulderY + 25); 
    ctx.closePath();
    ctx.fillStyle = '#4A90E2';
    ctx.fill();
}

function drawSingleHand(points) {
    HAND_SECTIONS.forEach(section => {
        ctx.strokeStyle = section.color;
        ctx.lineWidth = 6;
        section.connections.forEach(([start, end]) => {
            if (points[start] && points[end]) {
                ctx.beginPath();
                ctx.moveTo(points[start].x, points[start].y);
                ctx.lineTo(points[end].x, points[end].y);
                ctx.stroke();
            }
        });
    });
}

drawStaticAvatar();