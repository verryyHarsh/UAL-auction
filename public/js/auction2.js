let currentBgIndex = 0;
const backgroundUrls = [
  "/images/playercard bg blue.png",
  "/images/playercard bg yellow.png",
  "/images/playercard bg orange.png",
  "/images/playercard bg purple.png",
];

document.addEventListener("DOMContentLoaded", async () => {
  const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get("room");
  const username = urlParams.get("user");
  const isAdmin = urlParams.get("admin") === "true";
  const roomBudget = parseFloat(urlParams.get("budget")) || 100;

  // ========== AUCTION CONSTANTS ==========
  const CATEGORY_SETS = {
    BAT: ["L1S1", "L1S2", "L1S3", "L1S4", "L1S5", "L1S6"],
    FBOWL: ["L2S1", "L2S2", "L2S3", "L2S4"],
    SPIN: ["L3S1", "L3S2"],
    ALL: ["L4S1", "L4S2", "L4S3"],
    "BAT WK": ["L5S1", "L5S2"],
    "UC-BAT": ["L6S1"],
    "UC-ALL": ["L7S1"],
    "UC-BOWL": ["L8S1"],
    "UC-SPIN": ["L9S1"],
  };

  const MANDATORY_ROLES = {
    BAT: 3,
    "BAT WK": 1,
    ALL: 1,
    FBOWL: 2,
    SPIN: 2,
  };

  // ========== AUCTION STATE VARIABLES ==========
  let players = [];
  let selectedPlayersForAuction = [];
  let currentPlayer = null;
  let auctionTimer = null;
  let timeLeft = 10;
  let currentBid = 0;
  let highestBidder = null;
  let auctionStarted = false;
  let playerTeams = {};
  let currentCategoryIndex = 0;
  let currentPlayerIndex = 0;
  let budget = roomBudget;
  let activeTeams = {};
  let userTeamAssignments = {};
  let teamCount = 2;

  // Selected Players Display State
  let currentRole = "BAT";
  let currentSet = "";

  // ========== DOM ELEMENTS ==========
  const startAuctionBtn = document.getElementById("startAuctionBtn");
  const pauseAuctionBtn = document.getElementById("pauseAuctionBtn");
  const endAuctionBtn = document.getElementById("endAuctionBtn");
  const bidButton = document.getElementById("bidButton");
  const bidButtonText = document.getElementById("bidButtonText");
  const currentPlayerImage = document.getElementById("currentPlayerImage");
  const currentPlayerName = document.getElementById("currentPlayerName");
  const currentBidDisplay = document.getElementById("currentBid");
  const highestBidderDisplay = document.getElementById("highestBidder");
  const teamBoxesContainer = document.getElementById("teamBoxes");
  const adminControls = document.getElementById("adminControls");
  const currentPlayerRating = document.getElementById("currentPlayerRating");
  const currentPlayerBasePrice = document.getElementById(
    "currentPlayerBasePrice"
  );
  const currentPlayerRoleCount = document.getElementById(
    "currentPlayerRoleCount"
  );

  // ========== GLOBAL FUNCTION FOR HTML ONCLICK ==========
  window.showSelectedPlayersByRole = function (role) {
    if (auctionStarted) {
      if (selectedPlayersForAuction.length > 0) {
        currentRole = role;
        currentSet = "";
        const selectedPlayers = getSelectedPlayersByRole(role);
        showSetButtons(role, selectedPlayers);
        console.log(`🎯 Showing ${role} players in table`);
      } else {
        showWaitingForAuctionMessage();
        console.log("⏳ No players selected yet, showing waiting message");
      }
    } else {
      showModal("Auction has not started yet!", "warning");
    }
  };

  // ========== INITIALIZATION ==========
  if (!roomCode || !username) {
    showModal("INVALID ROOM OR USERNAME!", "warning");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("roomCodeDisplay").textContent = roomCode;

  if (isAdmin) {
    adminControls.style.display = "block";
    startAuctionBtn.style.display = "inline-block";
  } else {
    adminControls.style.display = "none";
  }

  updateBudgetDisplay(budget);
  preloadBackgroundImages();

  // Load players and filter based on team count
  try {
    console.log("🔄 Loading players from server...");
    const response = await fetch("/players");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    players = data.players || data;
    console.log(`✅ Loaded ${players.length} players from server`);

    // Process player data
    players = players.map((player, index) => ({
      ...player,
      id: `player-${index}`,
      sequence: extractSequenceNumber(player.category),
    }));

    if (players.length === 0) {
      console.error("❌ No players loaded");
      showModal("No players available for auction!", "error");
      return;
    }

    // DON'T select players here - wait for team count from server
    console.log(
      "⏳ Waiting for team count from server before selecting players..."
    );

    players = sortPlayersByCategoryAndSequence(players);
    console.log("🎯 Players sorted by category and sequence");
  } catch (err) {
    console.error("❌ Error loading players:", err);
    showModal("Failed to load players data!", "error");
  }

  showWaitingForAuctionMessage();
  socket.emit("joinAuctionRoom", { room: roomCode, username, isAdmin });

  // ========== SOCKET EVENT HANDLERS ==========
  socket.on("userListUpdated", (data) => {
    if (data.users && data.teamAssignments) {
      teamCount = Object.keys(data.teamAssignments).length;
      console.log(`🏏 Team count updated to: ${teamCount} teams`);

      // Re-select players based on new team count
      selectedPlayersForAuction = selectPlayersForAuction(players, teamCount);
      console.log(
        `🎯 Selected ${selectedPlayersForAuction.length} players for ${teamCount} teams`
      );

      debugPlayerCounts();
      const roleCounts = calculateRoleCounts(selectedPlayersForAuction);
      console.log("🎭 Final Role Distribution:", roleCounts);

      updateTeamAssignments(data.users, data.teamAssignments);
      updateTeamBoxesFromActiveTeams();

      if (auctionStarted && selectedPlayersForAuction.length > 0) {
        showSelectedPlayersByRole(currentRole);
        console.log("🔄 Updated player table with new selection");
      }
    }
  });

  socket.on("auctionStarted", () => {
    auctionStarted = true;
    startAuctionBtn.style.display = "none";
    pauseAuctionBtn.style.display = "inline-block";
    endAuctionBtn.style.display = "inline-block";
    bidButton.disabled = false;

    currentCategoryIndex = 0;
    currentPlayerIndex = 0;

    if (selectedPlayersForAuction.length > 0) {
      showSelectedPlayersByRole("BAT");
      console.log("📊 Showing selected players in table");
    } else {
      console.log("⏳ Waiting for player selection before showing table...");
      showWaitingForAuctionMessage();
    }

    if (isAdmin && !currentPlayer && selectedPlayersForAuction.length > 0) {
      selectFirstPlayer();
    }
  });

  socket.on("auctionPaused", () => {
    clearInterval(auctionTimer);
    stopTimerAnimation();
    pauseAuctionBtn.textContent = "Resume Auction";
  });

  socket.on("auctionResumed", () => {
    pauseAuctionBtn.textContent = "Pause Auction";
    startTimerAnimation();
    startTimer();
  });

  socket.on("auctionEnded", () => {
    auctionStarted = false;
    clearInterval(auctionTimer);
    stopTimerAnimation();
    startAuctionBtn.style.display = "inline-block";
    pauseAuctionBtn.style.display = "none";
    endAuctionBtn.style.display = "none";
    bidButton.disabled = true;
    resetBiddingBox();

    // Show results after a short delay
    setTimeout(() => {
      showAuctionResults();
    }, 2000);
  });

  socket.on("playerSelected", (playerData) => {
    console.log("🎯 Player selected for bidding:", playerData.name);
    setCurrentPlayer(playerData);
  });

  socket.on("bidUpdate", (bidData) => {
    if (bidData.amount > currentBid && bidData.bidder !== username) {
      clickSound.play();
    }
    updateBid(bidData);
  });

  socket.on("bidError", (errorMessage) => {
    showModal(`❌ ${errorMessage}`, "error");
  });

  socket.on("playerSold", handlePlayerSold);
  socket.on("roomState", handleRoomState);
  socket.on("teamDataUpdated", handleTeamDataUpdated);
  socket.on("roomError", (errorMessage) => {
    showModal(`❌ ${errorMessage}`, "error");
    window.location.href = "index.html";
  });

  // ========== EVENT LISTENERS ==========
  startAuctionBtn.addEventListener("click", () => {
    socket.emit("startAuction", roomCode);
  });

  pauseAuctionBtn.addEventListener("click", () => {
    if (pauseAuctionBtn.textContent === "Pause Auction") {
      socket.emit("pauseAuction", roomCode);
    } else {
      socket.emit("resumeAuction", roomCode);
    }
  });

  endAuctionBtn.addEventListener("click", () => {
    socket.emit("endAuction", roomCode);
  });

  const clickSound = new Audio("/music/button-press.wav"); // ✅ remove '/public'
  clickSound.volume = 0.6;

  bidButton.addEventListener("click", handleBidButtonClick);

  bidButton.addEventListener("click", () => {
    clickSound.currentTime = 0;
    clickSound.play();
  });

  // ========== PLAYER SELECTION LOGIC ==========
  function calculateRequiredPlayers(teamCount) {
    console.log(`🏏 Calculating player requirements for ${teamCount} teams`);
    const mandatoryPerTeam = { BAT: 3, "BAT WK": 1, ALL: 1, FBOWL: 2, SPIN: 2 };
    const required = {};

    Object.keys(mandatoryPerTeam).forEach((role) => {
      const mandatoryCount = mandatoryPerTeam[role] * teamCount;
      const bufferMultiplier = role === "BAT WK" || role === "ALL" ? 2.0 : 1.5;
      required[role] = Math.ceil(mandatoryCount * bufferMultiplier);
    });

    const totalPlayers = Object.values(required).reduce(
      (sum, count) => sum + count,
      0
    );
    return { required, totalPlayers };
  }

  function selectPlayersForAuction(allPlayers, teamCount) {
    const { required } = calculateRequiredPlayers(teamCount);
    const selectedPlayers = [];
    const selectedPlayerIds = new Set();

    Object.keys(required).forEach((role) => {
      const countNeeded = required[role];
      const sets = CATEGORY_SETS[role];

      if (sets && countNeeded > 0) {
        const availableForRole = allPlayers.filter(
          (player) => player.role === role && !selectedPlayerIds.has(player.id)
        );

        const rolePlayers = selectPlayersForRole(
          availableForRole,
          role,
          sets,
          countNeeded
        );
        rolePlayers.forEach((player) => {
          selectedPlayers.push(player);
          selectedPlayerIds.add(player.id);
        });
      }
    });

    return selectedPlayers;
  }

  function selectPlayersForRole(allPlayers, role, sets, countNeeded) {
    const availablePlayers = getAvailablePlayersByRoleAndSet(
      allPlayers,
      role,
      sets
    );
    const sortedPlayers = [...availablePlayers].sort(
      (a, b) => (a.sequence || 999) - (b.sequence || 999)
    );
    return sortedPlayers.slice(0, Math.min(countNeeded, sortedPlayers.length));
  }

  function getAvailablePlayersByRoleAndSet(allPlayers, role, sets) {
    const availablePlayers = [];
    for (const set of sets) {
      const setPlayers = allPlayers.filter(
        (player) => player.role === role && player.category === set
      );
      availablePlayers.push(...setPlayers);
    }
    return availablePlayers;
  }

  // ========== PLAYER SELECTION FOR BIDDING ==========
  function getCurrentCategoryPlayers() {
    if (currentCategoryIndex >= CATEGORY_ORDER.length) return [];
    const currentCategory = CATEGORY_ORDER[currentCategoryIndex];
    return selectedPlayersForAuction
      .filter((player) => player.role === currentCategory)
      .sort((a, b) => (a.sequence || 999) - (b.sequence || 999));
  }

  function selectFirstPlayer() {
    const categoryPlayers = getCurrentCategoryPlayers();
    if (categoryPlayers.length > 0) {
      const firstPlayer = categoryPlayers[0];
      socket.emit("selectPlayer", { room: roomCode, player: firstPlayer });
      currentPlayerIndex = 1;
    } else {
      moveToNextCategory();
    }
  }

  function selectNextPlayer() {
    const categoryPlayers = getCurrentCategoryPlayers();
    if (currentPlayerIndex >= categoryPlayers.length) {
      moveToNextCategory();
      return;
    }

    const nextPlayer = categoryPlayers[currentPlayerIndex];
    if (playerTeams[nextPlayer.id]) {
      currentPlayerIndex++;
      selectNextPlayer();
      return;
    }

    socket.emit("selectPlayer", { room: roomCode, player: nextPlayer });
    currentPlayerIndex++;
  }

  function moveToNextCategory() {
    currentCategoryIndex++;
    currentPlayerIndex = 0;

    if (currentCategoryIndex < CATEGORY_ORDER.length) {
      const nextCategoryPlayers = getCurrentCategoryPlayers();
      if (nextCategoryPlayers.length > 0) {
        const firstPlayer = nextCategoryPlayers[0];
        socket.emit("selectPlayer", { room: roomCode, player: firstPlayer });
        currentPlayerIndex = 1;
      } else {
        moveToNextCategory();
      }
    } else {
      console.log("🎉 All categories completed! Auction finished.");
      socket.emit("endAuction", roomCode);
    }
  }

  // ========== BIDDING HANDLING ==========
  function handleBidButtonClick() {
    if (!currentPlayer || !auctionStarted || highestBidder === username) {
      if (highestBidder === username) {
        showModal(
          "You are already the highest bidder. No need to bid again!",
          "info"
        );
      }
      return;
    }

    const teamName = getUserTeam(username);
    const myTeam = activeTeams[teamName];
    if (!myTeam) return;

    const role = currentPlayer.role;
    const totalPlayers = myTeam.players.length;
    const roleCounts = calculateRoleCounts(myTeam.players);

    if (totalPlayers >= 11) {
      showModal(
        "You already have 11 players. You cannot bid further!",
        "error"
      );
      return;
    }

    const roleLimits = {
      BAT: MANDATORY_ROLES.BAT + 2,
      "BAT WK": MANDATORY_ROLES["BAT WK"] + 2,
      ALL: MANDATORY_ROLES.ALL + 2,
      FBOWL: MANDATORY_ROLES.FBOWL + 2,
      SPIN: MANDATORY_ROLES.SPIN + 2,
    };

    if ((roleCounts[role] || 0) >= (roleLimits[role] || 0)) {
      showModal(
        `You've already filled your ${role} quota. Cannot bid more in this category!`,
        "warning"
      );
      return;
    }

    const buttonText = bidButtonText.textContent;
    const bidAmountMatch = buttonText.match(/₹(\d+\.?\d*) Cr/);
    if (bidAmountMatch) {
      const bidAmount = parseFloat(bidAmountMatch[1]);
      timeLeft = 10;
      resetTimerAnimation();
      startTimerAnimation();
      startTimer();

      socket.emit("placeBid", {
        room: roomCode,
        username: username,
        bidAmount: bidAmount,
      });
    }
  }

  // ========== UTILITY FUNCTIONS ==========
  function preloadBackgroundImages() {
    backgroundUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }

  function updateTeamAssignments(users, serverTeamAssignments = null) {
    if (serverTeamAssignments) {
      userTeamAssignments = { ...serverTeamAssignments };
    } else {
      userTeamAssignments = {};
      users.forEach((user, index) => {
        userTeamAssignments[user.name] = ALL_TEAMS[index % ALL_TEAMS.length];
      });
    }

    activeTeams = {};
    Object.entries(userTeamAssignments).forEach(([userName, teamName]) => {
      activeTeams[teamName] = {
        teamName: teamName,
        fullName: getTeamFullName(teamName),
        players: [],
        owner: userName,
        totalSpent: 0,
        totalRating: 0,
      };
    });
  }

  function updateTeamBudget(teamName) {
    const team = activeTeams[teamName];
    if (team && team.players) {
      team.totalSpent = team.players.reduce(
        (sum, player) => sum + (parseFloat(player.price) || 0),
        0
      );
      team.totalRating = team.players.reduce(
        (sum, player) => sum + (parseFloat(player.rating) || 0),
        0
      );
    }
  }

  function setCurrentPlayer(player) {
    if (!player) return;
    currentPlayer = player;

    currentPlayerImage.src =
      player.image || "https://via.placeholder.com/150?text=PLAYER";
    currentPlayerImage.style.display = "block";
    currentPlayerName.textContent = player.name || "Unknown Player";
    currentPlayerRating.textContent = `RATING - ${player.rating || "N/A"}`;
    currentPlayerBasePrice.textContent = `BASE PRICE - ₹${(
      player.basePrice || 0
    ).toFixed(2)} Cr`;
    currentPlayerRoleCount.textContent = `${player.role || "Unknown"} | ${
      player.country || "Unknown"
    }`;

    updatePlayerCardBackground();
    currentBid = 0;
    highestBidder = null;
    currentBidDisplay.textContent = `₹${currentBid.toFixed(2)} Cr`;
    highestBidderDisplay.textContent = "-";

    const nextBidAmount = calculateNextBid(currentBid, player.basePrice || 0);
    bidButtonText.textContent = `Bid for ₹${nextBidAmount.toFixed(2)} Cr`;

    resetTimerAnimation();
    timeLeft = 10;
    startTimerAnimation();
    startTimer();
  }

  function updateBid(bidData) {
    currentBid = bidData.amount;
    highestBidder = bidData.bidder;
    currentBidDisplay.textContent = `₹${currentBid.toFixed(2)} Cr`;

    if (bidData.bidder) {
      const bidderTeam = getUserTeam(bidData.bidder);
      highestBidderDisplay.textContent = `${bidData.bidder} (${bidderTeam})`;
    } else {
      highestBidderDisplay.textContent = "-";
    }

    const nextBidAmount = calculateNextBid(currentBid, currentPlayer.basePrice);
    bidButtonText.textContent = `Bid for ₹${nextBidAmount.toFixed(2)} Cr`;

    timeLeft = 10;
    resetTimerAnimation();
    startTimerAnimation();
    startTimer();
  }

  function resetBiddingBox() {
    currentPlayerImage.style.display = "none";
    currentPlayerName.textContent = "";
    currentPlayerRating.textContent = "";
    currentPlayerBasePrice.textContent = "";
    currentPlayerRoleCount.textContent = "";
    currentBid = 0;
    highestBidder = null;
    currentBidDisplay.textContent = "₹0 Cr";
    highestBidderDisplay.textContent = "-";
    bidButtonText.textContent = "Bid for ₹0 Cr";
    stopTimerAnimation();
    clearInterval(auctionTimer);
    timeLeft = 10;
  }

  function getUserTeam(username) {
    return userTeamAssignments[username] || "TBD";
  }

  function handlePlayerSold(soldData) {
    const validatedData = {
      playerId: soldData.playerId || "unknown",
      team: soldData.team || "TBD",
      price: parseFloat(soldData.price) || 0,
      playerName: soldData.playerName || "Unknown Player",
      role: soldData.role || "Unknown",
      rating: parseFloat(soldData.rating) || 0,
      basePrice: parseFloat(soldData.basePrice) || 0,
    };

    playerTeams[validatedData.playerId] = validatedData;

    if (activeTeams[validatedData.team]) {
      if (!activeTeams[validatedData.team].players) {
        activeTeams[validatedData.team].players = [];
      }

      const existingPlayerIndex = activeTeams[
        validatedData.team
      ].players.findIndex((p) => p.playerId === validatedData.playerId);

      if (existingPlayerIndex === -1) {
        activeTeams[validatedData.team].players.push({
          playerId: validatedData.playerId,
          playerName: validatedData.playerName,
          price: validatedData.price,
          role: validatedData.role,
          rating: validatedData.rating,
          basePrice: validatedData.basePrice,
        });
      }

      updateTeamBudget(validatedData.team);
    }

    updateTeamBoxesFromActiveTeams();
    updateAuctionSummary(activeTeams, budget); // Update summary when player is sold
    resetBiddingBox();

    // Check if auction should end after player is sold
    if (checkAuctionCompletion()) {
      return; // Don't select next player if auction is ending
    }

    if (isAdmin && auctionStarted) {
      setTimeout(() => {
        selectNextPlayer();
      }, 2000);
    }
  }

  // ========== ADD CSS FOR COMPLETION STYLING ==========
  const completionStyles = `
    <style>
        .team-complete {
            border: 2px solid #28a745 !important;
            background: rgba(40, 167, 69, 0.1) !important;
        }
        
        .completion-badge {
            background: #28a745;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: bold;
            margin-top: 4px;
            display: inline-block;
        }
        
        .text-success {
            color: #28a745 !important;
            font-weight: bold;
        }
        
        .bg-success {
            background: #28a745 !important;
            color: white;
            font-weight: bold;
        }
    </style>
`;

  // Add the styles to the document head
  document.head.insertAdjacentHTML("beforeend", completionStyles);

  // ========== SOCKET EVENT FOR REQUESTING AUCTION END ==========
  socket.on("auctionCompletionRequested", (data) => {
    if (isAdmin) {
      showModal(
        `All teams have completed 11 players! ${data.username} requested to end the auction.`,
        "info"
      );
      // Admin can choose to end auction manually or automatically
      if (confirm("All teams have completed 11 players. End auction now?")) {
        socket.emit("endAuction", roomCode);
      }
    }
  });

  // ========== UPDATE TEAM BOXES WITH COMPLETION CHECK ==========

  // ========== HANDLE PLAYER SOLD WITH COMPLETION CHECK ==========

  // ========== UPDATE THE ROOM STATE HANDLER ==========
  function handleRoomState(roomState) {
    if (roomState.teamAssignments) {
      teamCount = Object.keys(roomState.teamAssignments).length;
    }

    userTeamAssignments = roomState.teamAssignments || {};
    activeTeams = {};

    Object.keys(roomState.teamData || {}).forEach((teamName) => {
      const teamData = roomState.teamData[teamName];
      const owner = Object.keys(userTeamAssignments).find(
        (user) => userTeamAssignments[user] === teamName
      );

      const validatedPlayers = (teamData.players || []).map((player) => ({
        playerId: player.playerId || "unknown",
        playerName: player.playerName || "Unknown Player",
        price: parseFloat(player.price) || 0,
        role: player.role || "Unknown",
        rating: parseFloat(player.rating) || 0,
        basePrice: parseFloat(player.basePrice) || 0,
      }));

      activeTeams[teamName] = {
        teamName: teamName,
        fullName: getTeamFullName(teamName),
        players: validatedPlayers,
        owner: owner || "Unknown",
        totalSpent: parseFloat(teamData.totalSpent) || 0,
        totalRating: parseFloat(teamData.totalRating) || 0,
      };
    });

    // Initialize missing teams
    Object.values(userTeamAssignments).forEach((teamName) => {
      if (!activeTeams[teamName]) {
        const owner = Object.keys(userTeamAssignments).find(
          (user) => userTeamAssignments[user] === teamName
        );
        activeTeams[teamName] = {
          teamName: teamName,
          fullName: getTeamFullName(teamName),
          players: [],
          owner: owner || "Unknown",
          totalSpent: 0,
          totalRating: 0,
        };
      }
    });

    if (roomState.auctionState) {
      currentCategoryIndex = roomState.auctionState.currentCategoryIndex || 0;
      currentPlayerIndex = roomState.auctionState.currentPlayerIndex || 0;
      auctionStarted = roomState.auctionState.started || false;

      if (auctionStarted) {
        startAuctionBtn.style.display = "none";
        pauseAuctionBtn.style.display = "inline-block";
        endAuctionBtn.style.display = "inline-block";
        bidButton.disabled = false;
      }
    }

    playerTeams = {};
    Object.keys(roomState.playerTeams || {}).forEach((playerId) => {
      const player = roomState.playerTeams[playerId];
      playerTeams[playerId] = {
        team: player.team || "TBD",
        price: parseFloat(player.price) || 0,
      };
    });

    updateTeamBoxesFromActiveTeams();
    updateAuctionSummary(activeTeams, budget); // Update summary when room state loads

    // Check if auction should end when room state is loaded
    if (auctionStarted) {
      setTimeout(() => {
        checkAuctionCompletion();
      }, 500);
    }
  }

  // ========== RESULTS SUMMARY FUNCTIONS ==========
  function showAuctionResults() {
    try {
      calculateAndDisplayResults();
      const resultsModal = new bootstrap.Modal(
        document.getElementById("resultsModal")
      );
      resultsModal.show();
    } catch (error) {
      console.error("Error showing auction results:", error);
      showModal("Error displaying results. Please check the console.", "error");
    }
  }

  function calculateAndDisplayResults() {
    // Calculate team rankings based on total rating
    const rankedTeams = Object.values(activeTeams).sort((a, b) => {
      const ratingA = a.totalRating || 0;
      const ratingB = b.totalRating || 0;
      return ratingB - ratingA;
    });

    // Find the most expensive player in the entire auction
    const mostExpensivePlayer = findMostExpensivePlayer();

    // Update highest bid information in results modal
    updateResultsHighestBidInfo(mostExpensivePlayer);

    // Update MVP (highest rated team)
    if (rankedTeams.length > 0) {
      updateResultsMVPInfo(rankedTeams[0]);
    }

    // Update team rankings in results modal
    updateResultsTeamRankings(rankedTeams);
  }

  function findMostExpensivePlayer() {
    let mostExpensive = null;
    let highestPrice = 0;

    Object.values(activeTeams).forEach((team) => {
      (team.players || []).forEach((player) => {
        const playerPrice = parseFloat(player.price) || 0;
        if (playerPrice > highestPrice) {
          highestPrice = playerPrice;
          mostExpensive = {
            ...player,
            team: team.teamName,
          };
        }
      });
    });

    return mostExpensive;
  }

  function updateResultsHighestBidInfo(mostExpensivePlayer) {
    const highestBidPlayerImg = document.getElementById(
      "resultsHighestBidPlayerImg"
    );
    const highestBidPrice = document.getElementById("resultsHighestBidPrice");
    const highestBidTeam = document.getElementById("resultsHighestBidTeam");

    if (highestBidPlayerImg && mostExpensivePlayer) {
      // Use the player image from your players data
      const playerImage =
        mostExpensivePlayer.image ||
        `/images/PLAYERS/${mostExpensivePlayer.playerName
          ?.toLowerCase()
          .replace(/\s+/g, " ")}.png` ||
        "https://via.placeholder.com/120?text=PLAYER";

      highestBidPlayerImg.src = playerImage;
      highestBidPlayerImg.alt =
        mostExpensivePlayer.playerName || "Most Expensive Player";
      highestBidPlayerImg.style.display = "block";

      // Add error handling for broken images
      highestBidPlayerImg.onerror = function () {
        this.src = "https://via.placeholder.com/120?text=PLAYER";
        this.alt = "Player Image Not Available";
      };
    } else if (highestBidPlayerImg) {
      highestBidPlayerImg.src =
        "https://via.placeholder.com/120?text=NO+PLAYER";
      highestBidPlayerImg.alt = "No player sold";
    }

    if (highestBidPrice) {
      highestBidPrice.textContent = mostExpensivePlayer
        ? `₹${(parseFloat(mostExpensivePlayer.price) || 0).toFixed(2)}CR`
        : "₹0.00CR";
    }

    if (highestBidTeam) {
      highestBidTeam.textContent = mostExpensivePlayer
        ? `sold to ${mostExpensivePlayer.team}`
        : "No players sold";
    }
  }

  function updateResultsMVPInfo(team) {
    const mvpTeamLogo = document.getElementById("resultsMvpTeamLogo");
    if (mvpTeamLogo && team) {
      mvpTeamLogo.src = `images/${team.teamName}.png`;
      mvpTeamLogo.alt = team.fullName;
    }
  }

  function updateResultsTeamRankings(rankedTeams) {
    // Update first place team
    if (rankedTeams.length > 0) {
      updateResultsTeamCard("First", rankedTeams[0]);
    }

    // Update second place team
    if (rankedTeams.length > 1) {
      updateResultsTeamCard("Second", rankedTeams[1]);
    }

    // Update third place team
    if (rankedTeams.length > 2) {
      updateResultsTeamCard("Third", rankedTeams[2]);
    }
  }

  function updateResultsTeamCard(position, team) {
    const teamLogo = document.getElementById(`results${position}TeamLogo`);
    const teamRating = document.getElementById(`results${position}TeamRating`);
    const teamPlayer = document.getElementById(`results${position}TeamPlayer`);
    const teamPlayerPrice = document.getElementById(
      `results${position}TeamPlayerPrice`
    );

    if (teamLogo) {
      teamLogo.src = `images/${team.teamName}.png`;
      teamLogo.alt = team.fullName;
    }

    if (teamRating) {
      teamRating.textContent = `RATING: ${(team.totalRating || 0).toFixed(0)}`;
    }

    // Find highest priced player for this team
    const highestPricedPlayer = findHighestPricedPlayer(team.players || []);

    if (teamPlayer) {
      teamPlayer.textContent = highestPricedPlayer?.playerName || "No player";
    }

    if (teamPlayerPrice) {
      teamPlayerPrice.textContent = highestPricedPlayer
        ? `₹${(parseFloat(highestPricedPlayer.price) || 0).toFixed(2)}CR`
        : "0.00CR";
    }
  }

  function shareResults() {
    const resultsText = `🏆 UAL Auction Results! ${getUserTeam(
      username
    )} finished the auction!`;
    if (navigator.share) {
      navigator.share({
        title: "UAL Auction Results",
        text: resultsText,
        url: window.location.href,
      });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(resultsText + " " + window.location.href);
      showModal("Results link copied to clipboard!", "success");
    } else {
      showModal("Share this results page with others!", "info");
    }
  }

  // Make share function globally available
  window.shareResults = shareResults;

  // ========== TIMER FUNCTIONS ==========
  function resetTimerAnimation() {
    bidButton.classList.remove("timer-active");
    void bidButton.offsetWidth;
  }

  function startTimerAnimation() {
    bidButton.classList.add("timer-active");
  }

  function stopTimerAnimation() {
    bidButton.classList.remove("timer-active");
  }

  function startTimer() {
    clearInterval(auctionTimer);
    resetTimerAnimation();
    startTimerAnimation();

    auctionTimer = setInterval(() => {
      timeLeft--;

      if (timeLeft <= 0) {
        clearInterval(auctionTimer);
        stopTimerAnimation();

        if (currentPlayer && highestBidder) {
          const team = getUserTeam(highestBidder);
          socket.emit("playerSold", {
            room: roomCode,
            playerId: currentPlayer.id,
            team: team,
            price: currentBid,
            playerName: currentPlayer.name,
            role: currentPlayer.role,
            rating: currentPlayer.rating,
            basePrice: currentPlayer.basePrice,
          });
        } else {
          if (isAdmin && auctionStarted) {
            setTimeout(() => {
              selectNextPlayer();
            }, 1000);
          }
        }
      }
    }, 1000);
  }

  // ========== SELECTED PLAYERS DISPLAY FUNCTIONS ==========
  function showWaitingForAuctionMessage() {
    const tableBody = document.querySelector("#selected-player-table tbody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: orange;">
            ⏳ Waiting for auction to start...
            <br><small>Players will appear here once the auction begins</small>
          </td>
        </tr>
      `;
    }
  }

  function getSelectedPlayersByRole(role) {
    const emptyData = { names: [], prices: [], ratings: [], categories: [] };

    try {
      if (
        !selectedPlayersForAuction ||
        selectedPlayersForAuction.length === 0
      ) {
        console.log("❌ No selected players available for display");
        return emptyData;
      }

      const roleMappings = {
        BAT: ["BAT"],
        BOW: ["FBOWL", "SPIN"],
        WKB: ["BAT WK"],
        ALL: ["ALL"],
      };

      const targetRoles = roleMappings[role] || [role];
      const filteredPlayers = selectedPlayersForAuction.filter((player) =>
        targetRoles.includes(player.role)
      );

      console.log(
        `🔍 Found ${filteredPlayers.length} ${role} players in selected auction pool`
      );

      return {
        names: filteredPlayers.map((p) => p.name || "Unknown"),
        prices: filteredPlayers.map((p) => (p.basePrice || 0).toFixed(2)),
        ratings: filteredPlayers.map((p) => p.rating || "0"),
        categories: filteredPlayers.map((p) => p.category || ""),
      };
    } catch (error) {
      console.error("Error in getSelectedPlayersByRole:", error);
      return emptyData;
    }
  }

  function removeDuplicatePlayers(data) {
    const seen = new Set();
    const uniqueData = { names: [], prices: [], ratings: [] };

    for (let i = 0; i < data.names.length; i++) {
      const playerKey =
        data.names[i] + "|" + data.prices[i] + "|" + data.ratings[i];
      if (!seen.has(playerKey)) {
        seen.add(playerKey);
        uniqueData.names.push(data.names[i]);
        uniqueData.prices.push(data.prices[i]);
        uniqueData.ratings.push(data.ratings[i]);
      }
    }

    return uniqueData;
  }

  function showSetButtons(role, playersData) {
    const setList = document.getElementById("set-list");
    if (!setList) return;

    setList.innerHTML = "";
    const uniqueSets = [...new Set(playersData.categories)].sort();

    uniqueSets.forEach((set) => {
      const button = document.createElement("button");
      button.textContent = set;
      button.onclick = () => showPlayersBySet(role, set, playersData);
      button.className = currentSet === set ? "active" : "";
      setList.appendChild(button);
    });

    if (uniqueSets.length > 0) {
      currentSet = uniqueSets[0];
      showPlayersBySet(role, uniqueSets[0], playersData);
    } else {
      showPlayersBySet(role, "", playersData);
    }
  }

  function showPlayersBySet(role, set, playersData) {
    currentSet = set;
    updateButtonStates();

    let filteredData = { names: [], prices: [], ratings: [] };

    for (let i = 0; i < playersData.names.length; i++) {
      if (playersData.categories[i] === set) {
        filteredData.names.push(playersData.names[i]);
        filteredData.prices.push(playersData.prices[i]);
        filteredData.ratings.push(playersData.ratings[i]);
      }
    }

    filteredData = removeDuplicatePlayers(filteredData);
    loadSelectedPlayersToTable(filteredData, role, set);
  }

  function updateButtonStates() {
    const categoryButtons = document.querySelectorAll(
      ".selected-players-section .rolebutton button"
    );
    categoryButtons.forEach((button) => {
      const span = button.querySelector("span");
      if (span && span.textContent === currentRole) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    const setButtons = document.querySelectorAll(
      ".selected-players-section .list button"
    );
    setButtons.forEach((button) => {
      if (button.textContent === currentSet) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  }

  function loadSelectedPlayersToTable(data, role, set) {
    const tableBody = document.querySelector("#selected-player-table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    const sectionTitle = document.querySelector(".selected-players-section h2");
    if (sectionTitle) {
      sectionTitle.textContent = `Selected ${role} Players ( Set ${set} )`;
    }

    for (let i = 0; i < data.names.length; i++) {
      let row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.names[i]}</td>
        <td>${data.prices[i]}</td>
        <td>${data.ratings[i]}</td>
      `;
      tableBody.appendChild(row);
    }

    if (data.names.length === 0) {
      let row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="3" style="text-align: center; color: #fff;">
          No ${role} players in set ${set} selected for auction
        </td>
      `;
      tableBody.appendChild(row);
    }
  }

  function updatePlayerCardBackground() {
    const playerCard = document.querySelector(".player-card");
    if (!playerCard) return;

    playerCard.style.transition = "background 0.5s ease";
    playerCard.style.background = `url("${backgroundUrls[currentBgIndex]}") center/cover no-repeat`;
    currentBgIndex = (currentBgIndex + 1) % backgroundUrls.length;
  }
  // ========== AUCTION COMPLETION CHECK ==========
  function checkAuctionCompletion() {
    if (!activeTeams || Object.keys(activeTeams).length === 0) {
      return false;
    }

    const allTeamsComplete = Object.values(activeTeams).every((team) => {
      const playerCount = team.players ? team.players.length : 0;
      return playerCount >= 11;
    });

    if (allTeamsComplete) {
      console.log(
        `🎉 All ${
          Object.keys(activeTeams).length
        } teams have completed 11 players! Ending auction...`
      );

      // End the auction
      if (isAdmin) {
        socket.emit("endAuction", roomCode);
      } else {
        // Notify admin to end auction
        socket.emit("requestAuctionEnd", roomCode);
      }

      return true;
    }

    return false;
  }
  // ========== TEAM BOXES DISPLAY ==========
  function updateTeamBoxesFromActiveTeams() {
    if (!teamBoxesContainer) return;

    teamBoxesContainer.innerHTML = "";
    const teamRankings = calculateTeamRankings(activeTeams, budget);

    let teamsToShow = Object.values(activeTeams);

    const myTeamIndex = teamsToShow.findIndex(
      (team) => team.owner === username
    );
    if (myTeamIndex > 0) {
      const myTeam = teamsToShow.splice(myTeamIndex, 1)[0];
      teamsToShow.unshift(myTeam);
    }

    for (let i = 0; i < teamsToShow.length; i += 3) {
      const rowTeams = teamsToShow.slice(i, i + 3);
      const rowDiv = document.createElement("div");
      rowDiv.className = "row team-row mb-4";

      for (let j = 0; j < 3; j++) {
        const colDiv = document.createElement("div");
        colDiv.className = "col-md-4 team-col";

        if (j < rowTeams.length) {
          const team = rowTeams[j];
          const players = team.players || [];
          const totalSpent = team.totalSpent || 0;
          const totalRating = team.totalRating || 0;
          const playerCount = players.length;
          const remainingBudget = budget - totalSpent;
          const isTeamComplete = playerCount >= 11;

          const roleCounts = calculateRoleCounts(players);
          const ranking = teamRankings.find((r) => r.team === team.teamName);
          const ratingRank = ranking ? ranking.ratingRank : "-";
          const purseRank = ranking ? ranking.purseRank : "-";

          const isMyTeam = team.owner === username;
          const teamBoxClass = isMyTeam
            ? `team-box team-${team.teamName} my-team h-100 ${
                isTeamComplete ? "team-complete" : ""
              }`
            : `team-box team-${team.teamName} h-100 ${
                isTeamComplete ? "team-complete" : ""
              }`;

          colDiv.innerHTML = `
                    <div class="${teamBoxClass}">
                        <div class="teamone mb-3">
                            <div class="teamlogo">
                                <img src="images/${team.teamName}.png" alt="${
            team.fullName
          }" style="width: 50px; height: 50px; object-fit: contain;">
                                ${
                                  isMyTeam
                                    ? '<div class="my-team-badge">MY TEAM</div>'
                                    : ""
                                }
                                ${
                                  isTeamComplete
                                    ? '<div class="completion-badge">COMPLETE ✓</div>'
                                    : ""
                                }
                            </div>
                            <div class="teamdetail">
                                <div class="teamname">
                                    <span class="team-fullname">${
                                      team.fullName
                                    }</span>
                                    <small class="team-owner">Owner: ${
                                      team.owner
                                    }</small>
                                </div>
                                <div class="playnum ${
                                  isTeamComplete ? "text-success" : ""
                                }">
                                    Player - ${playerCount} / 11 ${
            isTeamComplete ? "✓" : ""
          }
                                </div>
                                <div class="role-summary-line">
                                    BAT ${roleCounts.BAT || 0}/3 | 
                                    WK ${roleCounts["BAT WK"] || 0}/1 | 
                                    BOWL ${
                                      (roleCounts.FBOWL || 0) +
                                      (roleCounts.SPIN || 0)
                                    }/4 | 
                                    ALL  ${roleCounts.ALL || 0}/1
                                </div>
                                <div class="ranking">Rating #${ratingRank} | Purse #${purseRank}</div>
                            </div>
                        </div>
                        <div class="teamtwo">
                            <div class="summary ${
                              isTeamComplete ? "bg-success" : ""
                            }">
                                Purse: ₹${remainingBudget.toFixed(
                                  2
                                )} cr | Total Rating: ${totalRating.toFixed(2)}
                                ${isTeamComplete ? " | TEAM COMPLETE" : ""}
                            </div>
                        </div>
                        <div class="teamthree">
                            <table class="table table-dark table-sm">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Base</th>
                                        <th>Price</th>
                                        <th>Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${players
                                      .map(
                                        (player) => `
                                        <tr>
                                            <td>${
                                              player.playerName ||
                                              "Unknown Player"
                                            }</td>
                                            <td>₹${(
                                              parseFloat(player.basePrice) || 0
                                            ).toFixed(2)}</td>
                                            <td>₹${(
                                              parseFloat(player.price) || 0
                                            ).toFixed(2)}</td>
                                            <td>${(
                                              parseFloat(player.rating) || 0
                                            ).toFixed(1)}</td>
                                        </tr>
                                    `
                                      )
                                      .join("")}
                                    ${
                                      players.length === 0
                                        ? `
                                        <tr>
                                            <td colspan="4" class="text-center text-muted">No players bought yet</td>
                                        </tr>
                                    `
                                        : ""
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
        } else {
          colDiv.innerHTML = `<div class="team-box empty-box h-100" style="visibility: hidden;"></div>`;
        }
        rowDiv.appendChild(colDiv);
      }
      teamBoxesContainer.appendChild(rowDiv);
    }

    // Update auction summary when team boxes are updated
    updateAuctionSummary(activeTeams, budget);

    // Check if auction should end after updating team boxes
    setTimeout(() => {
      checkAuctionCompletion();
    }, 100);
  }

  function handleTeamDataUpdated(teamData) {
    Object.keys(teamData).forEach((teamName) => {
      if (activeTeams[teamName]) {
        activeTeams[teamName].players = teamData[teamName].players || [];
        activeTeams[teamName].totalSpent =
          parseFloat(teamData[teamName].totalSpent) || 0;
        activeTeams[teamName].totalRating =
          parseFloat(teamData[teamName].totalRating) || 0;
      }
    });
    updateTeamBoxesFromActiveTeams();
    updateAuctionSummary(activeTeams, budget); // Update summary when team data updates
  }

  // ========== DEBUG AND UTILITY FUNCTIONS ==========
  function debugPlayerCounts() {
    console.log("=== 🎯 PLAYER COUNT DEBUG ===");
    console.log(`Total players loaded: ${players.length}`);
    console.log(`Selected for auction: ${selectedPlayersForAuction.length}`);
    console.log(`Current team count: ${teamCount}`);

    const allRoleCounts = calculateRoleCounts(players);
    const selectedRoleCounts = calculateRoleCounts(selectedPlayersForAuction);

    console.log("Available players by role:", allRoleCounts);
    console.log("Selected players by role:", selectedRoleCounts);

    const { required } = calculateRequiredPlayers(teamCount);
    console.log("Expected by role:", required);

    console.log("=== BUFFER CALCULATIONS ===");
    Object.keys(required).forEach((role) => {
      const mandatoryPerTeam = MANDATORY_ROLES[role];
      const mandatoryTotal = mandatoryPerTeam * teamCount;
      const bufferMultiplier = role === "BAT WK" || role === "ALL" ? 2.0 : 1.5;
      const expected = Math.ceil(mandatoryTotal * bufferMultiplier);
      const actual = selectedRoleCounts[role] || 0;

      console.log(
        `${role}: ${mandatoryTotal} mandatory × ${bufferMultiplier} = ${expected} expected, ${actual} actual`
      );
    });
  }

  // Handle room state updates
  socket.on("roomState", (roomState) => {
    handleRoomState(roomState);

    if (players.length > 0) {
      selectedPlayersForAuction = selectPlayersForAuction(players, teamCount);
      console.log(
        `🎯 Room state: Selected ${selectedPlayersForAuction.length} players for ${teamCount} teams`
      );

      if (auctionStarted && selectedPlayersForAuction.length > 0) {
        showSelectedPlayersByRole(currentRole);
        console.log("🔄 Updated player table from room state");
      } else if (auctionStarted) {
        showWaitingForAuctionMessage();
      }
    }
  });
});
