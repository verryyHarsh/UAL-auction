// Background Music Controller
class BackgroundMusic {
  constructor() {
    this.audio = document.getElementById("backgroundMusic");
    this.musicButton = document.getElementById("musicButton");
    this.isPlaying = false;
    this.volume = 0.3; // 30% volume for background music

    this.init();
  }

  init() {
    // Set initial volume
    this.audio.volume = this.volume;

    // Load music state from localStorage
    this.loadMusicState();

    // Add event listener to music button
    this.musicButton.addEventListener("click", () => this.toggleMusic());

    // Handle audio events
    this.audio.addEventListener("ended", () => {
      this.audio.currentTime = 0;
      this.audio.play();
    });

    this.audio.addEventListener("error", (e) => {
      console.error("Audio error:", e);
      this.updateButtonState(false);
    });
  }

  toggleMusic() {
    if (this.isPlaying) {
      this.stopMusic();
    } else {
      this.playMusic();
    }
  }

  async playMusic() {
    try {
      await this.audio.play();
      this.isPlaying = true;
      this.updateButtonState(true);
      this.saveMusicState();
    } catch (error) {
      console.error("Failed to play music:", error);
      this.updateButtonState(false);
    }
  }

  stopMusic() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.updateButtonState(false);
    this.saveMusicState();
  }

  updateButtonState(playing) {
    const icon = this.musicButton.querySelector("i");
    const status = this.musicButton.querySelector(".btn-status");

    if (playing) {
      icon.className = "fas fa-music";
      status.textContent = "ON";
      this.musicButton.classList.add("active");
    } else {
      icon.className = "fas fa-music";
      status.textContent = "OFF";
      this.musicButton.classList.remove("active");
    }
  }

  saveMusicState() {
    localStorage.setItem("backgroundMusicEnabled", this.isPlaying);
  }

  loadMusicState() {
    const musicEnabled = localStorage.getItem("backgroundMusicEnabled");
    if (musicEnabled === "true") {
      // Auto-play music if it was enabled previously
      setTimeout(() => this.playMusic(), 1000);
    } else {
      this.updateButtonState(false);
    }
  }

  // Method to change volume if needed
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audio.volume = this.volume;
  }
}

// Initialize music when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.backgroundMusic = new BackgroundMusic();
});
