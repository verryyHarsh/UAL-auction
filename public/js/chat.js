// Chat functionality - Add this to auction2.js
function initializeChat() {
  const chatContainer = document.getElementById("chatContainer");
  const chatToggle = document.getElementById("chatToggle");
  const messagesContainer = document.getElementById("messages");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");

  if (!chatContainer || !messagesContainer) {
    console.log("Chat elements not found, retrying...");
    setTimeout(initializeChat, 1000);
    return;
  }

  // Toggle chat visibility
  chatToggle.addEventListener("change", function () {
    if (this.checked) {
      chatContainer.classList.remove("hidden");
    } else {
      chatContainer.classList.add("hidden");
    }
  });

  // Send message function
  function sendMessage() {
    const message = messageInput.value.trim();
    if (message && username) {
      socket.emit("sendChatMessage", {
        room: roomCode,
        message: message,
        username: username,
      });
      messageInput.value = "";
    }
  }

  // Send message on button click
  sendButton.addEventListener("click", sendMessage);

  // Send message on Enter key
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Team color mapping for consistent colors
  const teamColors = {
    CSK: "#fdb913", // Yellow
    MI: "#004ba0", // Blue
    RCB: "#ec1c24", // Red
    KKR: "#3a225d", // Purple
    DC: "#2561ae", // Blue
    SRH: "#fb643e", // Orange
    RR: "#e2396b", // Pink
    PK: "#ed1b24", // Red
    GT: "#1b2133", // Navy
    LSG: "#ff6b00", // Orange
  };

  function getTeamColor(team) {
    return teamColors[team] || "#007bff";
  }

  function getUserInitials(username) {
    return username.charAt(0).toUpperCase();
  }

  // Load chat messages
  socket.on("loadChatMessages", (messages) => {
    messagesContainer.innerHTML = "";
    messages.forEach((message) => {
      addMessageToChat(message);
    });
    scrollToBottom();
  });

  // Receive new chat message
  socket.on("newChatMessage", (message) => {
    addMessageToChat(message);
    scrollToBottom();
  });

  function addMessageToChat(messageData) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message";

    const teamColor = getTeamColor(messageData.team);

    messageDiv.innerHTML = `
            <div class="message-user">
                <div class="username-circle" style="background: ${teamColor};">
                    ${getUserInitials(messageData.username)}
                </div>
            </div>
            <div class="message-content">
                <div class="message-username">${messageData.username}</div>
                <div class="message-text">${messageData.message}</div>
            </div>
        `;

    messagesContainer.appendChild(messageDiv);
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Join chat when page loads
  socket.emit("joinChat", {
    room: roomCode,
    username: username,
  });

  console.log("Chat initialized successfully");
}

// Initialize chat after the page loads and socket is connected
// Add this line at the end of your DOMContentLoaded event in auction2.js
setTimeout(initializeChat, 1500);
