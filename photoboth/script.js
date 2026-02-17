// State Management
const state = {
    frameColor: '#ffffff',
    framePattern: 'none',
    layout: 'strip',
    photoCount: 3,
    currentFilter: 'bw', // Default
    photos: [] // Will store raw color images
};

// --- Navigation ---

function nextScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'screen-options-2') {
        const countSelect = document.getElementById('photo-count');
        if (state.layout === 'solo') {
            countSelect.value = '1';
            countSelect.disabled = true;
        } else {
            countSelect.disabled = false;
        }
    }
}

function selectColor(color, element) {
    state.frameColor = color;
    document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function selectLayout(layout, element) {
    state.layout = layout;
    document.querySelectorAll('.layout-btn').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

// Visual Preview for UI only
function previewFilter(filterName) {
    state.currentFilter = filterName;
}

// --- Camera Logic ---

let stream;
const video = document.getElementById('video');

async function startCamera() {
    // 1. Save Settings
    state.framePattern = document.getElementById('frame-pattern').value;
    state.photoCount = parseInt(document.getElementById('photo-count').value);
    
    // 2. Get Filter (Double Check)
    const filterEl = document.getElementById('photo-filter');
    if(filterEl) {
        state.currentFilter = filterEl.value;
    }

    // 3. Switch Screen & Apply CSS Preview
    nextScreen('screen-camera');
    const videoEl = document.getElementById('video');
    videoEl.className = ''; 
    videoEl.classList.add(`filter-${state.currentFilter}`);

    // 4. Start Video
    try {
      // facingMode: "user" forces the selfie camera on mobile
stream = await navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: "user" }, 
    audio: false 
});   video.srcObject = stream;
        setTimeout(startPhotoSequence, 1000);
    } catch (err) {
        alert("Camera access denied.");
        console.error(err);
    }
}

function startPhotoSequence() {
    state.photos = [];
    takePhoto(0);
}

function takePhoto(index) {
    if (index >= state.photoCount) {
        finishSession();
        return;
    }

    const countdownEl = document.getElementById('countdown');
    const statusEl = document.getElementById('camera-status');
    let count = 3;

    statusEl.innerText = `Photo ${index + 1} of ${state.photoCount}`;

    const timer = setInterval(() => {
        countdownEl.innerText = count > 0 ? count : '';
        if (count === 0) {
            clearInterval(timer);
            captureFrameRaw(); // New function name: saves raw color
            setTimeout(() => takePhoto(index + 1), 1000);
        }
        count--;
    }, 1000);
}

function captureFrameRaw() {
    // Flash Animation
    const flash = document.getElementById('flash');
    flash.style.animation = 'none';
    flash.offsetHeight; 
    flash.style.animation = 'flashAnim 0.2s';

    // Capture RAW image (Color)
    const canvas = document.getElementById('temp-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // We do NOT filter here anymore. We save the raw high-quality photo.
    ctx.drawImage(video, 0, 0);
    state.photos.push(canvas.toDataURL('image/png'));
}

function finishSession() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    generateFinalImage(); // Filter happens here now
    nextScreen('screen-result');
}

// --- Final Image Generation (Where the Filter is Applied) ---

function generateFinalImage() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const padding = 40;
    const photoWidth = 400;
    const photoHeight = 300; 
    const textSpace = 100;

    // Canvas Size Logic
    if (state.layout === 'strip') {
        canvas.width = photoWidth + (padding * 2);
        canvas.height = (photoHeight * state.photoCount) + (padding * (state.photoCount + 1)) + textSpace;
    } else if (state.layout === 'card') {
        canvas.width = (photoWidth * 2) + (padding * 3);
        canvas.height = (photoHeight * 2) + (padding * 3) + textSpace;
    } else {
        canvas.width = photoWidth + (padding * 2);
        canvas.height = photoHeight + (padding * 2) + textSpace;
    }

    // 1. Draw Background
    ctx.fillStyle = state.frameColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Pattern
    if (state.framePattern === 'dots') {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for (let i = 0; i < canvas.width; i += 20) {
            for (let j = 0; j < canvas.height; j += 20) {
                ctx.beginPath();
                ctx.arc(i, j, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (state.framePattern === 'lines') {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        for (let i = 0; i < canvas.width; i += 10) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
    }

    // 3. Define the Filter String for Canvas
    // This is the crucial step that was missing/failing before
    let filterString = 'none';
    if (state.currentFilter === 'bw') {
        filterString = 'grayscale(100%) contrast(1.2)';
    } else if (state.currentFilter === 'sepia') {
        filterString = 'sepia(100%) contrast(1.1)';
    } else if (state.currentFilter === 'pink') {
        filterString = 'sepia(50%) hue-rotate(315deg) contrast(1.1) brightness(1.1)';
    } else if (state.currentFilter === 'warm') {
        filterString = 'sepia(40%) contrast(1.1) brightness(1.1)';
    }

    // 4. Load Photos & Draw with Filter
    const loadImages = state.photos.map(src => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = src;
        });
    });

    Promise.all(loadImages).then(images => {
        images.forEach((img, i) => {
            let x, y;

            // Coordinate Logic
            if (state.layout === 'strip') {
                x = padding;
                y = padding + (i * (photoHeight + padding));
            } else if (state.layout === 'card') {
                const col = i % 2;
                const row = Math.floor(i / 2);
                x = padding + (col * (photoWidth + padding));
                y = padding + (row * (photoHeight + padding));
            } else {
                x = padding;
                y = padding;
            }

            // Draw Shadow (No Filter)
            ctx.filter = 'none'; 
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(x + 5, y + 5, photoWidth, photoHeight);

            // --- APPLY FILTER HERE ---
            ctx.filter = filterString;
            ctx.drawImage(img, x, y, photoWidth, photoHeight);
            
            // Draw Border (No Filter)
            ctx.filter = 'none';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, photoWidth, photoHeight);
        });

        // 5. Add Text (No Filter)
        ctx.filter = 'none';
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '50px "Great Vibes"';
        ctx.textAlign = 'center';
        ctx.fillText('Vintage Booth', canvas.width / 2, canvas.height - 40);

        ctx.font = '20px "Playfair Display"';
        const date = new Date().toLocaleDateString();
        ctx.fillText(date, canvas.width / 2, canvas.height - 15);

        // 6. Output
        const finalUrl = canvas.toDataURL('image/jpeg', 0.9);
        const resultImg = document.createElement('img');
        resultImg.src = finalUrl;
        
        const resultContainer = document.getElementById('result-container');
        resultContainer.innerHTML = '';
        resultContainer.appendChild(resultImg);

        const dlLink = document.getElementById('download-link');
        dlLink.href = finalUrl;
        dlLink.download = `vintage_photo_${Date.now()}.jpg`;
    });
}