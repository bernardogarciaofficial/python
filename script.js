const video = document.getElementById('video');
const recordBtn = document.getElementById('recordBtn');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const recIndicator = document.getElementById('recIndicator');
const songInput = document.getElementById('songInput');
const waveform = document.getElementById('waveform');
const barChunks = document.getElementById('barChunks');

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedVideoBlob = null;
let isRecording = false;

let audioContext = null;
let audioBuffer = null;
let songSource = null;
let audio = null;
let songUrl = null;
let bars = [];
let barDurations = [];
let currentBar = 0;
let barCount = 8;
let songDuration = 0;
let isSongLoaded = false;
let isSongPlaying = false;
let rafId = null;

// ---- Song Upload and Waveform ---- //
songInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  songUrl = URL.createObjectURL(file);

  // Load and decode audio
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  songDuration = audioBuffer.duration;

  // Build waveform
  drawWaveform(audioBuffer);

  // Divide into 8 bars (chunks)
  divideIntoBars(audioBuffer, barCount);

  // Setup audio element for playback
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
  }
  audio = new Audio(songUrl);

  // Enable controls
  recordBtn.disabled = false;
  playBtn.disabled = false;
  stopBtn.disabled = false;
  isSongLoaded = true;
});

// Draw waveform on canvas
function drawWaveform(buffer) {
  const canvas = waveform;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = waveform.parentElement.offsetWidth;
  const height = canvas.height = 80;
  ctx.clearRect(0, 0, width, height);

  const data = buffer.getChannelData(0);
  const step = Math.floor(data.length / width);
  ctx.beginPath();
  ctx.moveTo(0, height / 2);

  for (let i = 0; i < width; i++) {
    let min = 1.0, max = -1.0;
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    ctx.lineTo(i, (1 + min) * 0.5 * height);
    ctx.lineTo(i, (1 + max) * 0.5 * height);
  }
  ctx.strokeStyle = "#36e";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Divide song into bars
function divideIntoBars(buffer, barCount) {
  bars = [];
  barDurations = [];
  const duration = buffer.duration;
  const barLen = duration / barCount;
  barChunks.innerHTML = '';
  for (let i = 0; i < barCount; i++) {
    bars.push({
      start: i * barLen,
      end: (i + 1) * barLen
    });
    barDurations.push(barLen);
    // Visual chunk division
    const barDiv = document.createElement('div');
    barDiv.className = 'bar-chunk';
    barChunks.appendChild(barDiv);
  }
}

// ---- Controls: Record, Play, Stop ---- //
recordBtn.addEventListener('click', async () => {
  if (!isSongLoaded || isRecording) return;

  try {
    if (!window.MediaRecorder) {
      alert("MediaRecorder API not supported in this browser.");
      return;
    }
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = mediaStream;
    video.muted = true;
    await video.play();
    recIndicator.classList.remove('hidden');
    startRecording();

    // Start song audio in sync
    if (audio) {
      audio.currentTime = 0;
      audio.play();
      isSongPlaying = true;
      syncVideoToAudio();
    }
  } catch (err) {
    alert("Could not access camera. Make sure you use HTTPS and allow camera access.");
  }
});

function startRecording() {
  isRecording = true;
  recordedChunks = [];
  recordedVideoBlob = null;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  recordBtn.disabled = true;

  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };
  mediaRecorder.onstop = () => {
    recIndicator.classList.add('hidden');
    recordedVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
    video.srcObject = null;
    video.src = URL.createObjectURL(recordedVideoBlob);
    video.controls = true;
    video.muted = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    recordBtn.disabled = false;
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    // Stop audio as well
    if (audio) {
      audio.pause();
      isSongPlaying = false;
    }
    cancelAnimationFrame(rafId);
  };
  mediaRecorder.start();
}

// Stop both audio and video (slave logic)
stopBtn.addEventListener('click', () => {
  if (isRecording && mediaRecorder) {
    mediaRecorder.stop();
    isRecording = false;
  }
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    isSongPlaying = false;
  }
  if (!isRecording && video && !video.paused) {
    video.pause();
    video.currentTime = 0;
  }
  cancelAnimationFrame(rafId);
});

// Play both audio and recorded video in sync
playBtn.addEventListener('click', () => {
  if (recordedVideoBlob && audio) {
    video.srcObject = null;
    video.src = URL.createObjectURL(recordedVideoBlob);
    video.controls = true;
    video.muted = false;
    audio.currentTime = 0;
    video.currentTime = 0;

    // Play in sync
    audio.play();
    video.play();
    isSongPlaying = true;
    syncVideoToAudio();

    // If either ends, stop both
    audio.onended = () => {
      video.pause();
      isSongPlaying = false;
      cancelAnimationFrame(rafId);
    };
    video.onended = () => {
      audio.pause();
      isSongPlaying = false;
      cancelAnimationFrame(rafId);
    };
  }
});

// Sync video currentTime to audio currentTime (audio is master)
function syncVideoToAudio() {
  if (!isSongPlaying) return;
  video.currentTime = audio.currentTime;
  rafId = requestAnimationFrame(syncVideoToAudio);

  // Highlight current bar
  highlightCurrentBar();
}

// Visual highlight for current bar (8-bar division)
function highlightCurrentBar() {
  if (!audioBuffer) return;
  const t = audio.currentTime;
  for (let i = 0; i < bars.length; i++) {
    if (t >= bars[i].start && t < bars[i].end) {
      barChunks.childNodes.forEach((node, idx) => {
        node.style.background = idx === i ? 'rgba(54,110,255,0.2)' : '';
      });
      break;
    }
  }
}
