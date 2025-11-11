const hamburgerMenu = document.getElementById("hamburgerMenu");
const navMenu = document.getElementById("navMenu");

hamburgerMenu.addEventListener("click", () => {
  navMenu.classList.toggle("active");
});

// Close menu when clicking outside
document.addEventListener("click", (event) => {
  if (
    !hamburgerMenu.contains(event.target) &&
    !navMenu.contains(event.target)
  ) {
    navMenu.classList.remove("active");
  }
});
function showModal(message, type = "info", title = "Notice") {
  const modalEl = document.getElementById("alertModal");
  const modal = new bootstrap.Modal(modalEl);
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");

  modalTitle.textContent =
    type === "success"
      ? "✅ Success"
      : type === "error"
      ? "❌ Error"
      : type === "warning"
      ? "⚠️ Warning"
      : title;

  // Neutral color for title
  modalTitle.style.color = "#222";
  modalMessage.textContent = message;
  modal.show();
}

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const createRoomModal = document.getElementById("createRoomModal");
const joinRoomModal = document.getElementById("joinRoomModal");
const cancelCreate = document.getElementById("cancelCreate");
const cancelJoin = document.getElementById("cancelJoin");
const confirmCreate = document.getElementById("confirmCreate");
const confirmJoin = document.getElementById("confirmJoin");

createRoomBtn.addEventListener("click", () => {
  createRoomModal.classList.add("active");
});

joinRoomBtn.addEventListener("click", () => {
  joinRoomModal.classList.add("active");
});

cancelCreate.addEventListener("click", () => {
  createRoomModal.classList.remove("active");
});

cancelJoin.addEventListener("click", () => {
  joinRoomModal.classList.remove("active");
});

// ================= SOCKET SETUP =================
const socket = io({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// ================= CREATE ROOM =================
// Update the createRoom event handler
confirmCreate.addEventListener("click", () => {
  const name = document.getElementById("createName").value.trim();
  const budget = document.getElementById("createBudget").value;
  const aiPlayers = parseInt(document.getElementById("aiPlayers").value) || 0;

  if (!name) {
    showModal("ENTER YOU NAME!", "error");
    return;
  }

  if (!budget) {
    showModal("PLEASE SELECT A BUDGET!", "error");
    return;
  }

  // Show loading state
  confirmCreate.disabled = true;
  confirmCreate.textContent = "Creating...";

  socket.emit("createRoom", {
    name,
    budget: parseFloat(budget),
    aiPlayers: aiPlayers,
  });
});

// ================= JOIN ROOM =================
confirmJoin.addEventListener("click", () => {
  const name = document.getElementById("joinName").value.trim();
  const roomCode = document
    .getElementById("roomCode")
    .value.trim()
    .toUpperCase();

  if (!name || !roomCode) {
    showModal("PLEASE FILL ALL FIELDS!", "error");
    return;
  }

  // Show loading state
  confirmJoin.disabled = true;
  confirmJoin.textContent = "Joining...";

  socket.emit("joinRoom", { name, roomCode });
});

// ================= SOCKET RESPONSES =================
socket.on("roomCreated", (data) => {
  console.log("✅ Room created:", data.roomCode);
  const user = document.getElementById("createName").value;
  const budget = document.getElementById("createBudget").value;

  // Smooth redirect
  setTimeout(() => {
    window.location.href = `/auction?room=${
      data.roomCode
    }&user=${encodeURIComponent(user)}&admin=true&budget=${budget}`;
  }, 500);
});

socket.on("roomJoined", (data) => {
  console.log("✅ Joined room:", data.roomCode);
  const user = document.getElementById("joinName").value;

  // Smooth redirect
  setTimeout(() => {
    window.location.href = `/auction?room=${
      data.roomCode
    }&user=${encodeURIComponent(user)}&admin=false&budget=${
      data.budget || 100
    }`;
  }, 500);
});

socket.on("roomError", (msg) => {
  showModal("⚠️ " + msg, "error");
  // Reset buttons
  confirmCreate.disabled = false;
  confirmCreate.textContent = "Create Room";
  confirmJoin.disabled = false;
  confirmJoin.textContent = "Join Room";
});

// Connection handling
socket.on("connect", () => {
  console.log("🔗 Connected to server");
});

socket.on("disconnect", () => {
  console.log("🔌 Disconnected from server");
});

socket.on("reconnect", (attemptNumber) => {
  console.log("🔄 Reconnected after", attemptNumber, "attempts");
});

// Close modals when clicking outside
window.addEventListener("click", (event) => {
  if (event.target === createRoomModal) {
    createRoomModal.classList.remove("active");
  }
  if (event.target === joinRoomModal) {
    joinRoomModal.classList.remove("active");
  }
});

// Grid functionality
function createGrid() {
  const gridContainer = document.getElementById("gridContainer");
  if (!gridContainer) return;

  const gridSize = 70;
  const container = document.documentElement;
  const width = container.scrollWidth;
  const height = container.scrollHeight;

  const columns = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);

  gridContainer.style.gridTemplateColumns = `repeat(${columns}, ${gridSize}px)`;
  gridContainer.style.gridTemplateRows = `repeat(${rows}, ${gridSize}px)`;
  gridContainer.style.width = `${columns * gridSize}px`;
  gridContainer.style.height = `${rows * gridSize}px`;

  gridContainer.innerHTML = "";
  for (let i = 0; i < rows * columns; i++) {
    const gridLine = document.createElement("div");
    gridLine.classList.add("grid-line");
    gridContainer.appendChild(gridLine);
  }
}

function handleHover(event) {
  const gridContainer = document.getElementById("gridContainer");
  if (!gridContainer) return;

  const gridLines = gridContainer.querySelectorAll(".grid-line");
  const rect = gridContainer.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const computedStyle = window.getComputedStyle(gridContainer);
  const columnSize = parseFloat(
    computedStyle.gridTemplateColumns.split(" ")[0]
  );
  const rowSize = parseFloat(computedStyle.gridTemplateRows.split(" ")[0]);

  const mouseCol = mouseX / columnSize;
  const mouseRow = mouseY / rowSize;
  const totalCols = Math.floor(rect.width / columnSize);

  gridLines.forEach((line, index) => {
    const col = index % totalCols;
    const row = Math.floor(index / totalCols);

    const distance = Math.sqrt(
      Math.pow(col - mouseCol, 2) + Math.pow(row - mouseRow, 2)
    );
    if (distance <= 1.5) {
      const distanceFactor = 1 - distance / 1.5;
      line.style.setProperty("--hover-intensity", distanceFactor);
      line.classList.add("hover-effect");
    } else {
      line.classList.remove("hover-effect");
      line.style.removeProperty("--hover-intensity");
    }
  });
}

// Initialize grid and events
createGrid();
window.addEventListener("resize", createGrid);
document.addEventListener("mousemove", handleHover);
