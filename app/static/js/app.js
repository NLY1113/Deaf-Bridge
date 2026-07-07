const videoElement = document.getElementById('webcam');
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2, 
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

let lastSent = 0;
let currentDisplayedWord = "Waiting for gestures...";
let executionCounter = 0;
let pendingNewWord = "";
const STABILITY_THRESHOLD = 3;

hands.onResults(results => {
    const now = Date.now();
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && (now - lastSent > 200)) {
        lastSent = now;
        
        let allFeatures = new Array(84).fill(0);
        
        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            if (handIndex > 1) return; 
            
            const wrist = landmarks[0];
            const dx = landmarks[5].x - wrist.x;
            const dy = landmarks[5].y - wrist.y;
            const scale = Math.sqrt(dx * dx + dy * dy) || 1;

            let xFeatures = [];
            let yFeatures = [];

            landmarks.forEach(lm => {
                xFeatures.push((lm.x - wrist.x) / scale);
                yFeatures.push((lm.y - wrist.y) / scale);
            });

            const offset = handIndex * 42;
            for (let i = 0; i < 21; i++) {
                allFeatures[offset + i] = xFeatures[i];
                allFeatures[offset + 21 + i] = yFeatures[i];
            }
        });
        
        fetch('/translate-sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ landmarks: allFeatures })
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                const predictedWord = data.translated_text;
                if (predictedWord === currentDisplayedWord) {
                    executionCounter = 0;
                    pendingNewWord = "";
                } else {
                    if (predictedWord === pendingNewWord) {
                        executionCounter++;
                    } else {
                        pendingNewWord = predictedWord;
                        executionCounter = 1;
                    }
                    if (executionCounter >= STABILITY_THRESHOLD) {
                        currentDisplayedWord = pendingNewWord;
                        document.getElementById('sign-output').innerText = currentDisplayedWord;
                        executionCounter = 0;
                    }
                }
            }
        })
        .catch(err => console.error("Fetch error:", err));
    }
});

if (videoElement) {
    const camera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({ image: videoElement }); },
        width: 640, height: 480
    });
    camera.start().catch(err => console.error("Camera failed:", err));
}