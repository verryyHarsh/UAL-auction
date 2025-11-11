const micBtn = document.getElementById("micButton");
const speakerBtn = document.getElementById("speakerButton");

let micStream = null;
let audioContext = null;
let micSource = null;
let micGain = null;
let isMicOn = false; // Mic OFF by default
let isSpeakerOn = true; // Speaker ON by default

// ---------- INITIAL UI STATE ----------
micBtn.classList.add("active");
const micIcon = micBtn.querySelector("i");
const micStatus = micBtn.querySelector(".btn-status");
micIcon.classList.replace("fa-microphone", "fa-microphone-slash");
micStatus.textContent = "OFF";

const speakerIcon = speakerBtn.querySelector("i");
const speakerStatus = speakerBtn.querySelector(".btn-status");
speakerIcon.classList.replace("fa-volume-up", "fa-volume-up");
speakerStatus.textContent = "ON";

// ---------- MIC TOGGLE ----------
micBtn.addEventListener("click", async () => {
  const icon = micBtn.querySelector("i");
  const status = micBtn.querySelector(".btn-status");

  if (isMicOn) {
    // Turn OFF mic
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
    }
    if (micSource) micSource.disconnect();
    icon.classList.replace("fa-microphone", "fa-microphone-slash");
    status.textContent = "OFF";
  } else {
    // Turn ON mic
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContext = new AudioContext();
      micSource = audioContext.createMediaStreamSource(micStream);
      micGain = audioContext.createGain();
      micGain.gain.value = 1;
      micSource.connect(micGain).connect(audioContext.destination);

      icon.classList.replace("fa-microphone-slash", "fa-microphone");
      status.textContent = "ON";
    } catch (err) {
      alert("Microphone access denied!");
      console.error(err);
    }
  }
  isMicOn = !isMicOn;
});

// ---------- SPEAKER TOGGLE ----------
speakerBtn.addEventListener("click", () => {
  const icon = speakerBtn.querySelector("i");
  const status = speakerBtn.querySelector(".btn-status");

  if (isSpeakerOn) {
    // Turn speaker OFF
    if (micGain && audioContext) micGain.disconnect(audioContext.destination);
    icon.classList.replace("fa-volume-up", "fa-volume-mute");
    status.textContent = "OFF";
  } else {
    // Turn speaker ON
    if (micGain && audioContext) micGain.connect(audioContext.destination);
    icon.classList.replace("fa-volume-mute", "fa-volume-up");
    status.textContent = "ON";
  }
  isSpeakerOn = !isSpeakerOn;
});
