const video = document.getElementById('video');
const recordBtn = document.getElementById('recordBtn');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const recIndicator = document.getElementById('recIndicator');

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedVideoBlob = null;
let isRecording = false;

recordBtn.addEventListener('click', async () => {
  if (isRecording) return;

  try {
    if (!window.MediaRecorder) {
      alert("MediaRecorder API not supported in this browser.");
      return;
    }
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    video.srcObject = mediaStream;
    video.muted = true;
    await video.play();
    recIndicator.classList.remove('hidden');
    startRecording();
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
  };
  mediaRecorder.start();
}

stopBtn.addEventListener('click', () => {
  if (isRecording && mediaRecorder) {
    mediaRecorder.stop();
    isRecording = false;
  }
});

playBtn.addEventListener('click', () => {
  if (recordedVideoBlob) {
    video.srcObject = null;
    video.src = URL.createObjectURL(recordedVideoBlob);
    video.play();
  }
});
