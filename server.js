const express = require("express");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");

// Environment configuration
require("dotenv").config();
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(express.static(path.join(__dirname, "public")));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // stricter in production
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// CORS configuration for production
const allowedOrigins = isProduction
  ? [
      "https://yourdomain.com",
      "https://www.yourdomain.com",
      "https://yourapp.railway.app",
    ]
  : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"];

const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: false,
  },
});

// Enhanced AI manager with production error handling
let enhancedAIManager;
try {
  const { SmartAIManager } = require("./aiplayer.js");
  enhancedAIManager = new SmartAIManager();
  console.log("✅ AI Manager loaded successfully");
} catch (error) {
  console.error("❌ Failed to load AI manager:", error.message);
  // Create fallback AI manager to prevent crashes
  enhancedAIManager = {
    initializeAIPlayers: (
      count,
      budget,
      assignments,
      roomBudget,
      totalPlayers
    ) => {
      console.log("⚠️ AI Manager not available - running without AI");
      return [];
    },
    processAIBids: async () => {
      console.log("⚠️ AI Manager not available - no AI bids");
      return [];
    },
    updateAIPlayersWithAuctionData: () => {
      // Silent fallback
    },
    updateAIOnWin: () => {
      // Silent fallback
    },
    getAIPlayerByName: () => null,
    getAIStatus: () => ({
      aiPlayers: [],
      message: "AI functionality not available",
      status: "disabled",
    }),
  };
}

// API Routes with enhanced error handling
app.get("/players", async (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "players.json");

    // Check if file exists first
    if (!fs.existsSync(filePath)) {
      console.error("❌ Players file not found:", filePath);
      return res.status(500).json({
        error: "Players data file not found",
        success: false,
      });
    }

    const data = await fs.promises.readFile(filePath, "utf8");
    const playersData = JSON.parse(data);
    const players = playersData.players || playersData;

    console.log(`✅ Loaded ${players.length} players`);
    res.json({
      success: true,
      players: players,
      count: players.length,
    });
  } catch (error) {
    console.error("❌ Error loading players:", error);
    res.status(500).json({
      error: "Failed to load players data",
      success: false,
    });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "lobby.html"));
});

app.get("/auction", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auction.html"));
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    rooms: Object.keys(rooms).length,
  });
});

// Room management
const rooms = {};
const ALL_TEAMS = [
  "CSK",
  "MI",
  "RCB",
  "KKR",
  "DC",
  "SRH",
  "RR",
  "PK",
  "GT",
  "LSG",
];

// Utility functions
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function calculateRoleCounts(players) {
  const counts = {};
  if (!players || !Array.isArray(players)) return counts;

  players.forEach((player) => {
    if (player && player.role) {
      const role = player.role;
      counts[role] = (counts[role] || 0) + 1;
    }
  });
  return counts;
}

function assignTeamsToUsers(users, roomCode) {
  console.log(
    `🔧 Assigning teams for room ${roomCode} with ${users.length} users`
  );

  const teamAssignments = {};
  const shuffledTeams = [...ALL_TEAMS];

  // Shuffle teams
  for (let i = shuffledTeams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
  }

  const shuffledUsers = [...users];
  // Shuffle users
  for (let i = shuffledUsers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledUsers[i], shuffledUsers[j]] = [shuffledUsers[j], shuffledUsers[i]];
  }

  // Assign teams
  shuffledUsers.forEach((user, index) => {
    if (index < shuffledTeams.length) {
      teamAssignments[user.name] = shuffledTeams[index];
    } else {
      const randomTeam =
        shuffledTeams[Math.floor(Math.random() * shuffledTeams.length)];
      teamAssignments[user.name] = randomTeam;
    }
  });

  console.log(`✅ Team assignments for room ${roomCode}:`, teamAssignments);
  return teamAssignments;
}

function calculateNextBidAmount(currentBid, basePrice) {
  if (currentBid === 0) return parseFloat(basePrice);
  if (currentBid < 1) return parseFloat((currentBid + 0.05).toFixed(2));
  if (currentBid < 2) return parseFloat((currentBid + 0.1).toFixed(2));
  if (currentBid < 5) return parseFloat((currentBid + 0.2).toFixed(2));
  if (currentBid < 10) return parseFloat((currentBid + 0.5).toFixed(2));
  return currentBid + 1;
}

function getAllTeamsData(roomObj) {
  const allTeamsData = {};
  if (!roomObj.teamAssignments) return allTeamsData;

  Object.keys(roomObj.teamAssignments).forEach((userName) => {
    const teamName = roomObj.teamAssignments[userName];
    allTeamsData[teamName] = roomObj.teamData[teamName] || {
      players: [],
      totalSpent: 0,
      totalRating: 0,
    };
  });
  return allTeamsData;
}

function updateAIPlayersWithAuctionData(roomObj, selectedPlayersForAuction) {
  if (roomObj.aiPlayersCount > 0) {
    try {
      const allTeamsData = getAllTeamsData(roomObj);
      enhancedAIManager.updateAIPlayersWithAuctionData(
        selectedPlayersForAuction || [],
        allTeamsData
      );
    } catch (error) {
      console.error(
        "❌ Error updating AI players with auction data:",
        error.message
      );
    }
  }
}

async function processEnhancedAIFirstBids(
  roomObj,
  player,
  selectedPlayersForAuction
) {
  if (
    !roomObj.auctionState.currentPlayer ||
    roomObj.auctionState.currentBid > 0 ||
    roomObj.auctionState.isAIBidding
  ) {
    return;
  }

  console.log(`🤖 Processing AI first bids for ${player.name}`);

  try {
    const soldPlayers = Object.values(roomObj.playerTeams || {}).map((pt) => ({
      price: pt.price,
      basePrice: pt.basePrice || 0.2,
      role: pt.role || "Unknown",
    }));

    updateAIPlayersWithAuctionData(roomObj, selectedPlayersForAuction);

    const aiBids = await enhancedAIManager.processAIBids(
      player,
      0,
      null,
      roomObj.teamAssignments,
      {
        soldPlayers: soldPlayers,
        teams: roomObj.teamData || {},
      }
    );

    if (aiBids && aiBids.length > 0) {
      const highestBid = aiBids[0];
      roomObj.auctionState.currentBid = highestBid.bidAmount;
      roomObj.auctionState.highestBidder = highestBid.username;

      io.to(roomObj.code).emit("bidUpdate", {
        amount: highestBid.bidAmount,
        bidder: highestBid.username,
      });

      console.log(
        `🤖 ${highestBid.username} placed first bid: ₹${highestBid.bidAmount}Cr`
      );
    }
  } catch (error) {
    console.error("❌ Error in AI first bids:", error.message);
    roomObj.auctionState.isAIBidding = false;
  }
}

async function processEnhancedAIBids(
  roomObj,
  currentBid,
  currentBidder,
  selectedPlayersForAuction
) {
  if (!roomObj.auctionState.currentPlayer || roomObj.auctionState.isAIBidding) {
    roomObj.auctionState.isAIBidding = false;
    return;
  }

  try {
    const soldPlayers = Object.values(roomObj.playerTeams || {}).map((pt) => ({
      price: pt.price,
      basePrice: pt.basePrice || 0.2,
      role: pt.role || "Unknown",
    }));

    updateAIPlayersWithAuctionData(roomObj, selectedPlayersForAuction);

    const aiBids = await enhancedAIManager.processAIBids(
      roomObj.auctionState.currentPlayer,
      currentBid,
      currentBidder,
      roomObj.teamAssignments,
      {
        soldPlayers: soldPlayers,
        teams: roomObj.teamData || {},
      }
    );

    if (aiBids && aiBids.length > 0) {
      const highestBid = aiBids[0];
      roomObj.auctionState.currentBid = highestBid.bidAmount;
      roomObj.auctionState.highestBidder = highestBid.username;

      io.to(roomObj.code).emit("bidUpdate", {
        amount: highestBid.bidAmount,
        bidder: highestBid.username,
      });

      console.log(
        `🤖 ${highestBid.username} outbid with: ₹${highestBid.bidAmount}Cr`
      );

      roomObj.auctionState.isAIBidding = true;

      setTimeout(async () => {
        await processEnhancedAIBids(
          roomObj,
          highestBid.bidAmount,
          highestBid.username,
          selectedPlayersForAuction
        );
        roomObj.auctionState.isAIBidding = false;
      }, 1000);
    } else {
      roomObj.auctionState.isAIBidding = false;
    }
  } catch (error) {
    console.error("❌ Error in AI bidding:", error.message);
    roomObj.auctionState.isAIBidding = false;
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("✅ New connection:", socket.id);

  // Connection timeout handling
  const connectionTimeout = setTimeout(() => {
    if (socket.connected) {
      console.log(`⏰ Connection ${socket.id} timed out`);
      socket.disconnect(true);
    }
  }, 30000); // 30 seconds

  socket.on("createRoom", (data) => {
    try {
      const { name, budget } = data;
      const aiPlayers = Math.min(data.aiPlayers || 0, 8); // Limit AI players

      console.log(
        `🚀 CREATE_ROOM attempt: ${name}, budget: ${budget}, AI: ${aiPlayers}`
      );

      if (!name || name.trim().length === 0) {
        socket.emit("roomError", "Valid name is required");
        return;
      }

      if (name.length > 20) {
        socket.emit("roomError", "Name must be less than 20 characters");
        return;
      }

      // Clean up old rooms
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      Object.keys(rooms).forEach((code) => {
        if (now - rooms[code].createdAt > ONE_HOUR) {
          console.log(`🧹 Cleaning old room: ${code}`);
          delete rooms[code];
        }
      });

      // Generate unique room code
      let roomCode;
      let attempts = 0;
      do {
        roomCode = generateRoomCode();
        attempts++;
        if (attempts > 20) {
          throw new Error("Failed to generate unique room code");
        }
      } while (rooms[roomCode]);

      const roomBudget = Math.min(Math.max(parseFloat(budget) || 100, 50), 500); // Limit budget

      // Create room object
      const roomData = {
        code: roomCode,
        admin: name,
        budget: roomBudget,
        users: [
          {
            id: socket.id,
            name: name.trim(),
            budget: roomBudget,
            isAdmin: true,
            connected: true,
            lastSeen: Date.now(),
          },
        ],
        createdAt: Date.now(),
        auctionState: {
          started: false,
          currentPlayer: null,
          currentBid: 0,
          highestBidder: null,
          currentCategoryIndex: 0,
          currentPlayerIndex: 0,
          isAIBidding: false,
        },
        playerTeams: {},
        teamAssignments: {},
        teamData: {},
        aiPlayersCount: aiPlayers,
        chatMessages: [],
        selectedPlayersForAuction: [],
      };

      rooms[roomCode] = roomData;

      // Handle AI players
      if (aiPlayers > 0) {
        try {
          const aiPlayersList = enhancedAIManager.initializeAIPlayers(
            aiPlayers,
            roomBudget,
            roomData.teamAssignments,
            roomBudget,
            roomData.users.length + aiPlayers
          );

          aiPlayersList.forEach((aiPlayer) => {
            roomData.users.push({
              id: `ai-${aiPlayer.name}-${Date.now()}`,
              name: aiPlayer.name,
              budget: roomBudget,
              isAdmin: false,
              connected: true,
              lastSeen: Date.now(),
              isAI: true,
            });
          });
        } catch (aiError) {
          console.error("❌ AI initialization failed:", aiError.message);
        }
      }

      // Assign teams
      try {
        roomData.teamAssignments = assignTeamsToUsers(roomData.users, roomCode);
        Object.values(roomData.teamAssignments).forEach((team) => {
          roomData.teamData[team] = {
            players: [],
            totalSpent: 0,
            totalRating: 0,
          };
        });
      } catch (teamError) {
        console.error("❌ Team assignment failed:", teamError.message);
        roomData.teamAssignments = { [name]: "CSK" };
        roomData.teamData = {
          CSK: { players: [], totalSpent: 0, totalRating: 0 },
        };
      }

      socket.join(roomCode);
      socket.emit("roomCreated", { roomCode, isAdmin: true });

      console.log(
        `🎉 Room ${roomCode} created by ${name}. Users: ${roomData.users.length}`
      );
    } catch (error) {
      console.error("❌ CREATE_ROOM error:", error);
      socket.emit("roomError", "Failed to create room. Please try again.");
    }
  });

  socket.on("joinRoom", (data) => {
    try {
      const { name, roomCode } = data;
      const code = roomCode.toUpperCase().trim();

      if (!name || name.trim().length === 0) {
        socket.emit("roomError", "Valid name is required");
        return;
      }

      if (!rooms[code]) {
        socket.emit("roomError", "Room not found!");
        return;
      }

      const room = rooms[code];

      // Check if room is full
      if (room.users.length >= 10) {
        socket.emit("roomError", "Room is full! Maximum 10 players allowed.");
        return;
      }

      // Check if auction has started and user is new
      if (room.auctionState.started) {
        const wasPreviousUser = room.users.some(
          (u) => u.name.toLowerCase() === name.toLowerCase() && !u.isAI
        );
        if (!wasPreviousUser) {
          socket.emit(
            "roomError",
            "Auction has already started! New users cannot join."
          );
          return;
        }
      }

      // Check for existing user (reconnection)
      const existingUser = room.users.find(
        (u) => u.name.toLowerCase() === name.toLowerCase() && !u.isAI
      );

      if (existingUser) {
        const existingSocket = io.sockets.sockets.get(existingUser.id);
        if (existingSocket?.connected) {
          socket.emit("roomError", "Username already taken in this room!");
          return;
        } else {
          // Reconnect
          existingUser.id = socket.id;
          existingUser.connected = true;
          existingUser.lastSeen = Date.now();
        }
      } else {
        // Add new user
        const newUser = {
          id: socket.id,
          name: name.trim(),
          budget: room.budget,
          isAdmin: false,
          connected: true,
          lastSeen: Date.now(),
          joinTime: Date.now(),
          isAI: false,
        };
        room.users.push(newUser);

        // Reassign teams
        room.teamAssignments = assignTeamsToUsers(room.users, code);

        // Ensure team data exists
        Object.values(room.teamAssignments).forEach((teamName) => {
          if (!room.teamData[teamName]) {
            room.teamData[teamName] = {
              players: [],
              totalSpent: 0,
              totalRating: 0,
            };
          }
        });
      }

      const isAdmin = room.admin === name;
      if (isAdmin) {
        const adminUser = room.users.find((u) => u.name === name);
        if (adminUser) adminUser.isAdmin = true;
      }

      socket.join(code);

      socket.emit("roomJoined", {
        roomCode: code,
        isAdmin: isAdmin,
        budget: room.budget,
        teamAssignments: room.teamAssignments,
        teamData: room.teamData,
        auctionState: room.auctionState,
        playerTeams: room.playerTeams,
        users: room.users,
      });

      io.to(code).emit("userListUpdated", {
        users: room.users,
        teamAssignments: room.teamAssignments,
        teamData: room.teamData,
      });
    } catch (error) {
      console.error("❌ JOIN_ROOM error:", error);
      socket.emit("roomError", "Failed to join room. Please try again.");
    }
  });

  socket.on("joinAuctionRoom", (data) => {
    const { room, username, isAdmin } = data;
    const roomObj = rooms[room];

    if (!roomObj) {
      socket.emit("roomError", "Room not found");
      return;
    }

    socket.join(room);

    const user = roomObj.users.find((u) => u.name === username && !u.isAI);
    if (user) {
      user.id = socket.id;
      user.connected = true;
      user.lastSeen = Date.now();
      user.isAdmin = roomObj.admin === username;
    }

    socket.emit("roomState", {
      users: roomObj.users,
      teamAssignments: roomObj.teamAssignments,
      teamData: roomObj.teamData,
      auctionState: roomObj.auctionState,
      playerTeams: roomObj.playerTeams,
      teamCount: roomObj.users.filter((user) => user.connected).length,
    });

    if (roomObj.auctionState.started) {
      socket.emit("auctionStarted");
      if (roomObj.auctionState.currentPlayer) {
        socket.emit("playerSelected", roomObj.auctionState.currentPlayer);
        socket.emit("bidUpdate", {
          amount: roomObj.auctionState.currentBid,
          bidder: roomObj.auctionState.highestBidder,
        });
      }
    }
  });

  socket.on("updateSelectedPlayers", (data) => {
    const { room, selectedPlayers } = data;
    const roomObj = rooms[room];
    if (!roomObj) return;

    const user = roomObj.users.find((u) => u.id === socket.id);
    if (user && user.name === roomObj.admin) {
      roomObj.selectedPlayersForAuction = selectedPlayers;
      updateAIPlayersWithAuctionData(roomObj, selectedPlayers);
    }
  });

  socket.on("startAuction", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("roomError", "Room not found!");
      return;
    }

    const user = room.users.find((u) => u.id === socket.id);
    if (user && user.name === room.admin) {
      room.auctionState.started = true;
      updateAIPlayersWithAuctionData(room, room.selectedPlayersForAuction);
      io.to(roomCode).emit("auctionStarted");
    }
  });

  socket.on("pauseAuction", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    const user = room.users.find((u) => u.id === socket.id);
    if (user && user.name === room.admin) {
      room.auctionState.started = false;
      io.to(roomCode).emit("auctionPaused");
    }
  });

  socket.on("resumeAuction", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    const user = room.users.find((u) => u.id === socket.id);
    if (user && user.name === room.admin) {
      room.auctionState.started = true;
      io.to(roomCode).emit("auctionResumed");
    }
  });

  socket.on("endAuction", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    const user = room.users.find((u) => u.id === socket.id);
    if (user && user.name === room.admin) {
      room.auctionState.started = false;
      room.auctionState.currentPlayer = null;
      room.auctionState.currentBid = 0;
      room.auctionState.highestBidder = null;
      io.to(roomCode).emit("auctionEnded");
    }
  });

  socket.on("selectPlayer", (data) => {
    const { room, player } = data;
    const roomObj = rooms[room];
    if (!roomObj) return;

    const user = roomObj.users.find((u) => u.id === socket.id);
    if (user && user.name === roomObj.admin) {
      roomObj.auctionState.currentPlayer = player;
      roomObj.auctionState.currentBid = 0;
      roomObj.auctionState.highestBidder = null;

      io.to(room).emit("playerSelected", player);
      io.to(room).emit("bidUpdate", { amount: 0, bidder: null });

      if (roomObj.aiPlayersCount > 0) {
        setTimeout(async () => {
          await processEnhancedAIFirstBids(
            roomObj,
            player,
            roomObj.selectedPlayersForAuction
          );
        }, 150);
      }
    }
  });

  socket.on("updateAuctionProgress", (data) => {
    const { room, categoryIndex, playerIndex } = data;
    const roomObj = rooms[room];
    if (!roomObj) return;

    const user = roomObj.users.find((u) => u.id === socket.id);
    if (user && user.name === roomObj.admin) {
      roomObj.auctionState.currentCategoryIndex = categoryIndex;
      roomObj.auctionState.currentPlayerIndex = playerIndex;
    }
  });

  socket.on("placeBid", (data) => {
    const { room, username, bidAmount } = data;
    const roomObj = rooms[room];

    if (
      !roomObj ||
      !roomObj.auctionState.started ||
      !roomObj.auctionState.currentPlayer
    ) {
      socket.emit("bidError", "Auction is not active!");
      return;
    }

    const currentHighestBidder = roomObj.auctionState.highestBidder;
    const currentBidAmount = roomObj.auctionState.currentBid;

    if (currentHighestBidder === username) {
      socket.emit("bidError", "You are already the highest bidder!");
      return;
    }

    if (bidAmount <= currentBidAmount) {
      socket.emit("bidError", "Bid amount must be higher than current bid!");
      return;
    }

    const userTeam = roomObj.teamAssignments[username];
    if (userTeam && roomObj.teamData[userTeam]) {
      const teamSpent = roomObj.teamData[userTeam].totalSpent || 0;
      const remainingBudget = roomObj.budget - teamSpent;

      if (bidAmount > remainingBudget) {
        socket.emit(
          "bidError",
          `Insufficient budget! Remaining: ₹${remainingBudget.toFixed(2)}Cr`
        );
        return;
      }
    }

    roomObj.auctionState.currentBid = bidAmount;
    roomObj.auctionState.highestBidder = username;

    io.to(room).emit("bidUpdate", { amount: bidAmount, bidder: username });

    if (roomObj.aiPlayersCount > 0 && !roomObj.auctionState.isAIBidding) {
      roomObj.auctionState.isAIBidding = true;
      setTimeout(async () => {
        await processEnhancedAIBids(
          roomObj,
          bidAmount,
          username,
          roomObj.selectedPlayersForAuction
        );
      }, 1000);
    }
  });

  socket.on("playerSold", (data) => {
    const { room, playerId, team, price, playerName, role, rating, basePrice } =
      data;
    const roomObj = rooms[room];
    if (!roomObj) return;

    const user = roomObj.users.find((u) => u.id === socket.id);
    if (user && user.name === roomObj.admin) {
      roomObj.playerTeams[playerId] = { team: team, price: price };

      // Update AI if applicable
      if (roomObj.aiPlayersCount > 0 && roomObj.auctionState.highestBidder) {
        const winningAIName = roomObj.auctionState.highestBidder;
        try {
          enhancedAIManager.updateAIOnWin(
            winningAIName,
            {
              playerId: playerId,
              name: playerName,
              role: role,
              rating: parseFloat(rating) || 0,
              basePrice: parseFloat(basePrice) || 0,
            },
            price
          );
        } catch (error) {
          console.error("❌ Error updating AI on win:", error.message);
        }
      }

      // Update team data
      if (roomObj.teamData[team]) {
        roomObj.teamData[team].players.push({
          playerId: playerId,
          playerName: playerName,
          price: price,
          role: role,
          rating: parseFloat(rating) || 0,
          basePrice: parseFloat(basePrice) || 0,
        });

        roomObj.teamData[team].totalSpent = roomObj.teamData[
          team
        ].players.reduce(
          (sum, player) => sum + (parseFloat(player.price) || 0),
          0
        );
        roomObj.teamData[team].totalRating = roomObj.teamData[
          team
        ].players.reduce(
          (sum, player) => sum + (parseFloat(player.rating) || 0),
          0
        );
      }

      io.to(room).emit("playerSold", {
        playerId: playerId,
        team: team,
        price: price,
        playerName: playerName,
        role: role,
        rating: rating,
        basePrice: basePrice,
      });

      io.to(room).emit("teamDataUpdated", roomObj.teamData);
      updateAIPlayersWithAuctionData(
        roomObj,
        roomObj.selectedPlayersForAuction
      );
    }
  });

  socket.on("heartbeat", () => {
    for (const [roomCode, room] of Object.entries(rooms)) {
      const user = room.users.find((u) => u.id === socket.id);
      if (user) {
        user.lastSeen = Date.now();
        user.connected = true;
      }
    }
  });

  socket.on("getAIStatus", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.aiPlayersCount === 0) return;

    const aiStatus = enhancedAIManager.getAIStatus();
    socket.emit("aiStatusUpdate", aiStatus);
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ User disconnected: ${socket.id} - ${reason}`);
    clearTimeout(connectionTimeout);

    // Mark user as disconnected
    for (const [roomCode, room] of Object.entries(rooms)) {
      const user = room.users.find((u) => u.id === socket.id);
      if (user && !user.isAI) {
        user.connected = false;
        user.lastSeen = Date.now();

        io.to(roomCode).emit("userListUpdated", {
          users: room.users,
          teamAssignments: room.teamAssignments,
          teamData: room.teamData,
        });
      }
    }
  });
});

// Enhanced room cleanup
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const THIRTY_MINUTES = 30 * 60 * 1000;

  Object.keys(rooms).forEach((roomCode) => {
    const room = rooms[roomCode];

    // Remove expired rooms (1 hour)
    if (now - room.createdAt > ONE_HOUR) {
      console.log(`🧹 Removing expired room: ${roomCode}`);
      delete rooms[roomCode];
      return;
    }

    // Remove disconnected users (30 minutes)
    const activeUsers = room.users.filter(
      (user) =>
        user.connected || now - user.lastSeen < THIRTY_MINUTES || user.isAI
    );

    if (activeUsers.length !== room.users.length) {
      room.users = activeUsers;
      if (activeUsers.length > 0) {
        room.teamAssignments = assignTeamsToUsers(activeUsers, roomCode);
        io.to(roomCode).emit("userListUpdated", {
          users: room.users,
          teamAssignments: room.teamAssignments,
          teamData: room.teamData,
        });
      } else {
        delete rooms[roomCode];
      }
    }
  });
}, 60000); // Run every minute

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  if (!isProduction) process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${isProduction ? "Production" : "Development"}`);
  console.log(`📊 Current rooms: ${Object.keys(rooms).length}`);
});
