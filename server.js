const express = require("express");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"],
  },
});

app.use(express.static(path.join(__dirname, "public")));

const { SmartAIManager } = require("./aiplayer.js");
const enhancedAIManager = new SmartAIManager();

// Add Rating Randomizer
const RatingRandomizer = require("./randomrating.js");
const ratingRandomizer = new RatingRandomizer();

app.get("/players", (req, res) => {
  const filePath = path.join(__dirname, "data", "players.json");

  // Check if file exists first
  if (!fs.existsSync(filePath)) {
    console.error("❌ Players file not found:", filePath);
    return res.status(500).json({ error: "Players data file not found" });
  }

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("❌ Error reading players file:", err);
      return res.status(500).json({ error: "Failed to load players" });
    }

    try {
      const playersData = JSON.parse(data);
      const players = playersData.players || playersData;
      console.log(`✅ Loaded ${players.length} players from file`);

      // Extract base ratings first
      ratingRandomizer.extractBaseRatings(players);

      // Randomize ratings for this session
      const randomizedPlayers =
        ratingRandomizer.randomizePlayerRatings(players);

      console.log(
        `🎲 Randomized ratings for ${randomizedPlayers.length} players`
      );

      res.json(randomizedPlayers);
    } catch (parseError) {
      console.error("❌ Error parsing players JSON:", parseError);
      res.status(500).json({ error: "Invalid players data format" });
    }
  });
});

// Optional: Add endpoint to get rating stats
app.get("/rating-stats", (req, res) => {
  const stats = ratingRandomizer.getRatingStats();
  res.json(stats);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "lobby.html"));
});

app.get("/auction", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auction.html"));
});

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

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

// NEW: Function to get all teams data for AI strategy
function getAllTeamsData(roomObj) {
  const allTeamsData = {};
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

// NEW: Function to update AI players with current auction data
function updateAIPlayersWithAuctionData(roomObj, selectedPlayersForAuction) {
  if (roomObj.aiPlayersCount > 0) {
    const allTeamsData = getAllTeamsData(roomObj);
    enhancedAIManager.updateAIPlayersWithAuctionData(
      selectedPlayersForAuction || [],
      allTeamsData
    );
    console.log(
      `🤖 Updated AI players with auction data for room ${roomObj.code}`
    );
  }
}

async function processEnhancedAIFirstBids(
  roomObj,
  player,
  selectedPlayersForAuction
) {
  if (
    !roomObj.auctionState.currentPlayer ||
    roomObj.auctionState.currentBid > 0
  ) {
    return;
  }

  console.log(`🤖 Processing AI first bids for ${player.name}`);

  const soldPlayers = Object.values(roomObj.playerTeams).map((pt) => ({
    price: pt.price,
    basePrice: pt.basePrice || 0.2,
    role: pt.role || "Unknown",
  }));

  // Update AI players with current data before processing bids
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

  if (aiBids.length > 0) {
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
  } else {
    console.log(`🤖 No AI first bids for ${player.name}`);
  }
}

async function processEnhancedAIBids(
  roomObj,
  currentBid,
  currentBidder,
  selectedPlayersForAuction
) {
  if (!roomObj.auctionState.currentPlayer) {
    roomObj.auctionState.isAIBidding = false;
    return;
  }

  const soldPlayers = Object.values(roomObj.playerTeams).map((pt) => ({
    price: pt.price,
    basePrice: pt.basePrice || 0.2,
    role: pt.role || "Unknown",
  }));

  // Update AI players with current data before processing bids
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

  if (aiBids.length > 0) {
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

    setTimeout(async () => {
      await processEnhancedAIBids(
        roomObj,
        highestBid.bidAmount,
        highestBid.username,
        selectedPlayersForAuction
      );
    }, 1000);
  } else {
    roomObj.auctionState.isAIBidding = false;
    console.log(
      `🤖 No more AI bids for ${roomObj.auctionState.currentPlayer.name}`
    );
  }
}

io.on("connection", (socket) => {
  console.log("✅ New connection:", socket.id);

  socket.on("createRoom", (data) => {
    try {
      const { name, budget } = data;
      const aiPlayers = data.aiPlayers || 0;

      console.log(
        `🚀 CREATE_ROOM attempt: ${name}, budget: ${budget}, AI: ${aiPlayers}`
      );

      if (!name) {
        console.log("❌ CREATE_ROOM failed: Name required");
        socket.emit("roomError", "Name is required");
        return;
      }

      // Clean up old rooms first (30-minute expiry)
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      let cleanedCount = 0;

      for (const [code, room] of Object.entries(rooms)) {
        if (now - room.createdAt > thirtyMinutes) {
          console.log(`🧹 Cleaning old room: ${code}`);
          delete rooms[code];
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} old rooms`);
      }

      // Generate unique room code
      let roomCode;
      let attempts = 0;
      do {
        roomCode = generateRoomCode();
        attempts++;
        if (attempts > 10) {
          throw new Error(
            "Failed to generate unique room code after 10 attempts"
          );
        }
      } while (rooms[roomCode]);

      const roomBudget = parseFloat(budget) || 100;

      // Create room object
      const roomData = {
        code: roomCode,
        admin: name,
        budget: roomBudget,
        users: [
          {
            id: socket.id,
            name,
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
        selectedPlayersForAuction: [], // NEW: Store selected players for AI
      };

      rooms[roomCode] = roomData;

      console.log(
        `✅ Room ${roomCode} created. Total rooms: ${Object.keys(rooms).length}`
      );

      // Handle AI players
      if (aiPlayers > 0) {
        try {
          const totalHumanPlayers = roomData.users.filter(
            (u) => !u.isAI
          ).length;
          const totalPlayers = totalHumanPlayers + aiPlayers;

          console.log(
            `🤖 Initializing ${aiPlayers} AI players (human: ${totalHumanPlayers}, total: ${totalPlayers})`
          );

          const aiPlayersList = enhancedAIManager.initializeAIPlayers(
            aiPlayers,
            roomBudget,
            roomData.teamAssignments,
            roomBudget,
            totalPlayers
          );

          aiPlayersList.forEach((aiPlayer) => {
            roomData.users.push({
              id: `ai-${aiPlayer.name}`,
              name: aiPlayer.name,
              budget: roomBudget,
              isAdmin: false,
              connected: true,
              lastSeen: Date.now(),
              isAI: true,
            });
          });

          console.log(
            `✅ Initialized ${aiPlayers} AI players for room ${roomCode}`
          );
        } catch (aiError) {
          console.error("❌ AI initialization failed:", aiError);
          // Continue without AI players
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

        console.log(
          `🏏 Teams assigned for room ${roomCode}:`,
          Object.keys(roomData.teamAssignments)
        );
      } catch (teamError) {
        console.error("❌ Team assignment failed:", teamError);
        // Set default team assignments
        roomData.teamAssignments = { [name]: "CSK" };
        roomData.teamData = {
          CSK: { players: [], totalSpent: 0, totalRating: 0 },
        };
      }

      // Join room and confirm
      socket.join(roomCode);
      socket.emit("roomCreated", { roomCode, isAdmin: true });

      console.log(
        `🎉 Room ${roomCode} fully created by ${name}. Budget: ₹${roomBudget}Cr, AI: ${aiPlayers}, Users: ${roomData.users.length}`
      );

      // Log all current rooms for debugging
      console.log(
        `📊 All active rooms: ${Object.keys(rooms).join(", ") || "None"}`
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

      console.log(`🚪 JOIN_ROOM attempt: "${name}" to room "${code}"`);
      console.log(
        `📋 Available rooms: ${Object.keys(rooms).join(", ") || "None"}`
      );

      if (!rooms[code]) {
        console.log(`❌ JOIN_ROOM failed: Room "${code}" not found`);
        socket.emit("roomError", "Room not found!");
        return;
      }

      const room = rooms[code];
      const roomBudget = room.budget || 100;
      const totalUsers = room.users.length;

      console.log(
        `✅ Room "${code}" found. Current users: ${totalUsers}, Budget: ${roomBudget}`
      );

      // Check if room is full
      if (totalUsers >= 10) {
        console.log(
          `❌ JOIN_ROOM failed: Room "${code}" is full (${totalUsers}/10)`
        );
        socket.emit("roomError", "Room is full! Maximum 10 players allowed.");
        return;
      }

      // Check if auction has already started
      if (room.auctionState && room.auctionState.started) {
        const wasPreviousUser = room.users.some(
          (u) => u.name.toLowerCase() === name.toLowerCase() && !u.isAI
        );
        if (!wasPreviousUser) {
          console.log(
            `❌ JOIN_ROOM failed: Auction started, new user "${name}" cannot join`
          );
          socket.emit(
            "roomError",
            "Auction has already started! New users cannot join."
          );
          return;
        }
      }

      // Check for existing user (reconnection case)
      const existingUser = room.users.find(
        (u) => u.name.toLowerCase() === name.toLowerCase() && !u.isAI
      );

      if (existingUser) {
        const existingSocket = io.sockets.sockets.get(existingUser.id);
        if (existingSocket?.connected) {
          console.log(
            `❌ JOIN_ROOM failed: Username "${name}" already taken in room "${code}"`
          );
          socket.emit("roomError", "Username already taken in this room!");
          return;
        } else {
          // Reconnect existing user
          console.log(`🔁 Reconnecting user "${name}" in room "${code}"`);
          existingUser.id = socket.id;
          existingUser.connected = true;
          existingUser.lastSeen = Date.now();

          const userTeam = room.teamAssignments[existingUser.name];
          if (userTeam && !room.teamData[userTeam]) {
            room.teamData[userTeam] = {
              players: [],
              totalSpent: 0,
              totalRating: 0,
            };
          }
        }
      } else {
        // Add new user
        console.log(`👤 Adding new user "${name}" to room "${code}"`);
        const newUser = {
          id: socket.id,
          name: name,
          budget: roomBudget,
          isAdmin: false,
          connected: true,
          lastSeen: Date.now(),
          joinTime: Date.now(),
          isAI: false,
        };
        room.users.push(newUser);

        // Reassign teams for all users
        console.log(`🔄 Reassigning teams for room "${code}"`);
        room.teamAssignments = assignTeamsToUsers(room.users, code);

        const assignedTeams = new Set(Object.values(room.teamAssignments));

        // Clean up unused teams
        Object.keys(room.teamData).forEach((teamName) => {
          if (!assignedTeams.has(teamName)) {
            console.log(`🗑️ Removing unused team data: ${teamName}`);
            delete room.teamData[teamName];
          }
        });

        // Ensure all assigned teams have data
        assignedTeams.forEach((teamName) => {
          if (!room.teamData[teamName]) {
            console.log(`➕ Creating team data for: ${teamName}`);
            room.teamData[teamName] = {
              players: [],
              totalSpent: 0,
              totalRating: 0,
            };
          }
        });

        console.log(
          `🏏 Teams after reassignment: ${Array.from(assignedTeams).join(", ")}`
        );
      }

      // Set admin status
      const isAdmin = room.admin === name;
      if (isAdmin) {
        const adminUser = room.users.find((u) => u.name === name);
        if (adminUser) {
          adminUser.isAdmin = true;
          console.log(`⭐ User "${name}" is admin of room "${code}"`);
        }
      }

      // Join socket room
      socket.join(code);
      console.log(`✅ Socket joined room "${code}"`);

      // Send room joined confirmation
      socket.emit("roomJoined", {
        roomCode: code,
        isAdmin: isAdmin,
        budget: roomBudget,
        teamAssignments: room.teamAssignments,
        teamData: room.teamData,
        auctionState: room.auctionState,
        playerTeams: room.playerTeams,
        users: room.users,
      });

      console.log(`📤 Sent roomJoined event to "${name}" in room "${code}"`);

      // Notify all users in room
      io.to(code).emit("userListUpdated", {
        users: room.users,
        teamAssignments: room.teamAssignments,
        teamData: room.teamData,
      });

      console.log(
        `📢 Notified all users in room "${code}" about user list update`
      );

      // Final success log
      console.log(`🎉 JOIN_ROOM successful: "${name}" joined room "${code}"`);
      console.log(
        `📊 Room "${code}" now has ${room.users.length} users: ${room.users
          .map((u) => u.name)
          .join(", ")}`
      );
    } catch (error) {
      console.error("❌ JOIN_ROOM critical error:", error);
      console.error("Error details:", {
        name: data?.name,
        roomCode: data?.roomCode,
        errorMessage: error.message,
        stack: error.stack,
      });

      socket.emit("roomError", "Failed to join room. Please try again.");
    }
  });

  socket.on("joinAuctionRoom", (data) => {
    const { room, username, isAdmin } = data;
    socket.join(room);

    const roomObj = rooms[room];
    if (roomObj) {
      const user = roomObj.users.find((u) => u.name === username && !u.isAI);
      if (user) {
        user.id = socket.id;
        user.connected = true;
        user.lastSeen = Date.now();
        user.isAdmin = roomObj.admin === username;
      }

      const teamCount = roomObj.users.filter((user) => user.connected).length;

      socket.emit("roomState", {
        users: roomObj.users,
        teamAssignments: roomObj.teamAssignments,
        teamData: roomObj.teamData,
        auctionState: roomObj.auctionState,
        playerTeams: roomObj.playerTeams,
        teamCount: teamCount,
      });

      if (roomObj.auctionState && roomObj.auctionState.started) {
        socket.emit("auctionStarted");
        if (roomObj.auctionState.currentPlayer) {
          socket.emit("playerSelected", roomObj.auctionState.currentPlayer);
          socket.emit("bidUpdate", {
            amount: roomObj.auctionState.currentBid,
            bidder: roomObj.auctionState.highestBidder,
          });
        }
      }
    }
  });

  // NEW: Socket event to update selected players for auction
  socket.on("updateSelectedPlayers", (data) => {
    const { room, selectedPlayers } = data;
    const roomObj = rooms[room];
    if (!roomObj) return;

    const user = roomObj.users.find((u) => u.id === socket.id);
    if (user && user.name === roomObj.admin) {
      roomObj.selectedPlayersForAuction = selectedPlayers;
      console.log(
        `🎯 Updated selected players for room ${room}: ${selectedPlayers.length} players`
      );

      // Update AI players with the new player list
      updateAIPlayersWithAuctionData(roomObj, selectedPlayers);
    }
  });

  socket.on("startAuction", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    const user = room.users.find((u) => u.id === socket.id);
    if (user && user.name === room.admin) {
      room.auctionState.started = true;
      if (!room.auctionState.currentPlayer) {
        room.auctionState.currentCategoryIndex = 0;
        room.auctionState.currentPlayerIndex = 0;
      }

      // Update AI players when auction starts
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

      // Reset the rating randomizer for next game
      ratingRandomizer.reset();
      console.log(`🔄 Rating randomizer reset for room ${roomCode}`);

      io.to(roomCode).emit("auctionEnded");
    }
  });

  socket.on("selectPlayer", (data) => {
    const { room, player } = data;
    const roomObj = rooms[room];
    if (!roomObj) return;

    const user = roomObj.users.find((u) => u.id === socket.id);
    if (user && user.name === roomObj.admin) {
      console.log(`🎯 Admin selected player: ${player.name}`);

      roomObj.auctionState.currentPlayer = player;
      roomObj.auctionState.currentBid = 0;
      roomObj.auctionState.highestBidder = null;

      io.to(room).emit("playerSelected", player);
      io.to(room).emit("bidUpdate", { amount: 0, bidder: null });

      console.log(`📢 Player ${player.name} broadcast to room ${room}`);

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

      if (roomObj.aiPlayersCount > 0 && roomObj.auctionState.highestBidder) {
        const winningAIName = roomObj.auctionState.highestBidder;
        const aiPlayer = enhancedAIManager.getAIPlayerByName(winningAIName);
        if (aiPlayer) {
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
          console.log(
            `🤖 ${winningAIName} team status:`,
            aiPlayer.getTeamStatus()
          );
        }
      }

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

      // Update AI players with latest team data after player is sold
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

  // NEW: Socket event to get AI status for debugging
  socket.on("getAIStatus", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.aiPlayersCount === 0) return;

    const aiStatus = enhancedAIManager.getAIStatus();
    socket.emit("aiStatusUpdate", aiStatus);
    console.log("🤖 AI Status:", aiStatus);
  });

  // NEW: Socket event to get rating stats
  socket.on("getRatingStats", (roomCode) => {
    const stats = ratingRandomizer.getRatingStats();
    socket.emit("ratingStatsUpdate", stats);
    console.log("📊 Rating Stats:", stats);
  });
});

setInterval(() => {
  const now = Date.now();
  const sixtyMinutes = 60 * 60 * 1000;

  for (const [roomCode, room] of Object.entries(rooms)) {
    let needsUpdate = false;
    let activeUsers = [];

    room.users.forEach((user) => {
      const socketExists = io.sockets.sockets.get(user.id);
      if (socketExists?.connected || user.isAI) {
        user.connected = true;
        user.lastSeen = now;
        activeUsers.push(user);
      } else if (now - user.lastSeen < sixtyMinutes) {
        user.connected = false;
        activeUsers.push(user);
      } else {
        if (room.admin === user.name && activeUsers.length > 0 && !user.isAI) {
          room.admin = activeUsers[0].name;
          activeUsers[0].isAdmin = true;
        }
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      room.users = activeUsers;
      if (activeUsers.length > 0) {
        room.teamAssignments = assignTeamsToUsers(activeUsers, roomCode);
      }
      if (room.users.length === 0) {
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit("userListUpdated", {
          users: room.users,
          teamAssignments: room.teamAssignments,
          teamData: room.teamData,
        });
      }
    }
  }
}, 60000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
