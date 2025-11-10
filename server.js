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
      console.log(`✅ Loaded ${players.length} players`);
      res.json(players);
    } catch (parseError) {
      console.error("❌ Error parsing players JSON:", parseError);
      res.status(500).json({ error: "Invalid players data format" });
    }
  });
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
  const teamAssignments = {};

  const shuffledTeams = [...ALL_TEAMS];
  for (let i = shuffledTeams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledTeams[i], shuffledTeams[j]] = [shuffledTeams[j], shuffledTeams[i]];
  }

  const shuffledUsers = [...users];
  for (let i = shuffledUsers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledUsers[i], shuffledUsers[j]] = [shuffledUsers[j], shuffledUsers[i]];
  }

  shuffledUsers.forEach((user, index) => {
    if (index < shuffledTeams.length) {
      teamAssignments[user.name] = shuffledTeams[index];
    } else {
      const randomTeam =
        shuffledTeams[Math.floor(Math.random() * shuffledTeams.length)];
      teamAssignments[user.name] = randomTeam;
    }
  });

  console.log(`Random team assignments for room ${roomCode}:`, teamAssignments);
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

async function processEnhancedAIFirstBids(roomObj, player) {
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

async function processEnhancedAIBids(roomObj, currentBid, currentBidder) {
  if (!roomObj.auctionState.currentPlayer) {
    roomObj.auctionState.isAIBidding = false;
    return;
  }

  const soldPlayers = Object.values(roomObj.playerTeams).map((pt) => ({
    price: pt.price,
    basePrice: pt.basePrice || 0.2,
    role: pt.role || "Unknown",
  }));

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
        highestBid.username
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
    const { name, budget } = data;
    const aiPlayers = data.aiPlayers || 0;

    if (!name) {
      socket.emit("roomError", "Name is required");
      return;
    }

    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (rooms[roomCode]);

    const roomBudget = parseFloat(budget) || 100;

    rooms[roomCode] = {
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
    };

    if (aiPlayers > 0) {
      const totalHumanPlayers = rooms[roomCode].users.filter(
        (u) => !u.isAI
      ).length;
      const totalPlayers = totalHumanPlayers + aiPlayers;

      console.log(
        `Initializing ${aiPlayers} AI players with ${totalHumanPlayers} human players (total: ${totalPlayers})`
      );

      const aiPlayersList = enhancedAIManager.initializeAIPlayers(
        aiPlayers,
        roomBudget,
        rooms[roomCode].teamAssignments,
        roomBudget,
        totalPlayers
      );

      aiPlayersList.forEach((aiPlayer) => {
        rooms[roomCode].users.push({
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
        `Initialized ${aiPlayers} enhanced AI players for room ${roomCode}`
      );
    }

    rooms[roomCode].teamAssignments = assignTeamsToUsers(
      rooms[roomCode].users,
      roomCode
    );

    Object.values(rooms[roomCode].teamAssignments).forEach((team) => {
      rooms[roomCode].teamData[team] = {
        players: [],
        totalSpent: 0,
        totalRating: 0,
      };
    });

    socket.join(roomCode);
    socket.emit("roomCreated", { roomCode, isAdmin: true });
    console.log(
      `🎯 Room ${roomCode} created by ${name} with budget ${roomBudget} and ${aiPlayers} AI players`
    );
  });

  socket.on("joinRoom", (data) => {
    const { name, roomCode } = data;
    const code = roomCode.toUpperCase().trim(); // Ensure uppercase and trim

    console.log(`🚪 Join attempt: ${name} to room ${code}`);
    console.log(`Available rooms: ${Object.keys(rooms).join(", ")}`);

    if (!rooms[code]) {
      console.log(
        `❌ Room ${code} not found. Available: ${Object.keys(rooms).join(", ")}`
      );
      socket.emit("roomError", "Room not found!");
      return;
    }

    const room = rooms[code];
    const roomBudget = room.budget || 100;

    const totalUsers = room.users.length;
    if (totalUsers >= 10) {
      socket.emit("roomError", "Room is full! Maximum 10 players allowed.");
      return;
    }

    if (room.auctionState && room.auctionState.started) {
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

    const existingUser = room.users.find(
      (u) => u.name.toLowerCase() === name.toLowerCase() && !u.isAI
    );

    if (existingUser) {
      const existingSocket = io.sockets.sockets.get(existingUser.id);
      if (existingSocket?.connected) {
        socket.emit("roomError", "Username already taken in this room!");
        return;
      } else {
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

      room.teamAssignments = assignTeamsToUsers(room.users, code);

      const assignedTeams = new Set(Object.values(room.teamAssignments));

      Object.keys(room.teamData).forEach((teamName) => {
        if (!assignedTeams.has(teamName)) {
          delete room.teamData[teamName];
        }
      });

      assignedTeams.forEach((teamName) => {
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
      budget: roomBudget,
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
      console.log(`🎯 Admin selected player: ${player.name}`);

      roomObj.auctionState.currentPlayer = player;
      roomObj.auctionState.currentBid = 0;
      roomObj.auctionState.highestBidder = null;

      io.to(room).emit("playerSelected", player);
      io.to(room).emit("bidUpdate", { amount: 0, bidder: null });

      console.log(`📢 Player ${player.name} broadcast to room ${room}`);

      if (roomObj.aiPlayersCount > 0) {
        setTimeout(async () => {
          await processEnhancedAIFirstBids(roomObj, player);
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
        await processEnhancedAIBids(roomObj, bidAmount, username);
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
