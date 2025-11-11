let currentBgIndex = 0;
const backgroundUrls = [
  "/images/playercard bg blue.png",
  "/images/playercard bg yellow.png",
  "/images/playercard bg orange.png",
  "/images/playercard bg purple.png",
];

const CATEGORY_ORDER = [
  "BAT",
  "BAT WK",
  "ALL",
  "FBOWL",
  "SPIN",
  "UC-BAT",
  "UC-ALL",
  "UC-BOWL",
  "UC-SPIN",
];

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

// ========== TEAM COMBINATION TRACKING ==========

// Mandatory role requirements
const MANDATORY_REQUIREMENTS = {
  BAT: 3, // 3 batsmen mandatory
  FBOWL: 2, // 2 fast bowlers mandatory
  SPIN: 2, // 2 spinners mandatory
  ALL: 1, // 1 all-rounder mandatory
  "BAT WK": 1, // 1 wicket-keeper mandatory
};

// Role mappings for counting
const ROLE_CATEGORIES = {
  BAT: ["BAT"],
  BOWL: ["FBOWL", "SPIN"], // Both fast and spin count as bowlers
  ALL: ["ALL"],
  WK: ["BAT WK"],
};

function calculateTeamCombination(teamPlayers) {
  const roleCounts = calculateRoleCounts(teamPlayers);

  // Calculate current counts - BOWL is total of FBOWL + SPIN
  const current = {
    BAT: roleCounts.BAT || 0,
    BOWL: (roleCounts.FBOWL || 0) + (roleCounts.SPIN || 0), // Total bowlers
    ALL: roleCounts.ALL || 0,
    WK: roleCounts["BAT WK"] || 0,
    FBOWL: roleCounts.FBOWL || 0,
    SPIN: roleCounts.SPIN || 0,
    TOTAL: teamPlayers.length,
  };

  // Calculate remaining mandatory slots - BOWL has 4 total mandatory (any combination)
  const remainingMandatory = {
    BAT: Math.max(0, MANDATORY_REQUIREMENTS.BAT - current.BAT),
    BOWL: Math.max(0, 4 - current.BOWL), // 4 total bowlers mandatory (FBOWL + SPIN)
    ALL: Math.max(0, MANDATORY_REQUIREMENTS.ALL - current.ALL),
    WK: Math.max(0, MANDATORY_REQUIREMENTS["BAT WK"] - current.WK),
  };

  // Calculate total remaining mandatory slots
  const totalRemainingMandatory = Object.values(remainingMandatory).reduce(
    (sum, count) => sum + count,
    0
  );

  // Calculate available extra slots (11 total - mandatory filled - remaining mandatory)
  const filledMandatory =
    (current.BAT >= 3 ? 3 : current.BAT) +
    (current.BOWL >= 4 ? 4 : current.BOWL) +
    (current.ALL >= 1 ? 1 : current.ALL) +
    (current.WK >= 1 ? 1 : current.WK);

  const availableExtraSlots = 11 - filledMandatory - totalRemainingMandatory;

  return {
    current,
    remainingMandatory,
    totalRemainingMandatory,
    availableExtraSlots,
    isTeamComplete: teamPlayers.length >= 11,
    canBidMore: teamPlayers.length < 11,
  };
}

function canBidForPlayer(
  teamCombination,
  playerRole,
  currentRoleCounts,
  totalPlayers
) {
  const { remainingMandatory, availableExtraSlots, current, isTeamComplete } =
    teamCombination;

  // If team is complete, cannot bid
  if (isTeamComplete) {
    return { canBid: false, reason: "Team already has 11 players!" };
  }

  // Define mandatory requirements
  const MANDATORY_REQS = {
    BAT: 3,
    BOWL: 4, // Total bowlers (FBOWL + SPIN)
    ALL: 1,
    "BAT WK": 1,
  };

  const currentCount = currentRoleCounts[playerRole] || 0;
  const mandatoryReq = MANDATORY_REQS[playerRole] || 0;

  // Special handling for bowlers
  if (playerRole === "FBOWL" || playerRole === "SPIN") {
    const totalBowlers = current.BOWL || 0;
    const mandatoryReq = 4; // Total bowlers required

    // Check if bowler limit is reached (4 mandatory + 2 extra = 6 total)
    if (totalBowlers >= 6) {
      return { canBid: false, reason: "Maximum 6 bowlers allowed!" };
    }

    // Check if we need mandatory bowlers
    const needsMandatoryBowlers = totalBowlers < 4;

    if (needsMandatoryBowlers) {
      return { canBid: true, reason: "Mandatory bowler slot available" };
    } else {
      // For extra bowlers, check available extra slots
      const otherMandatoryRoles = ["BAT", "ALL", "BAT WK"].filter(
        (role) => (current[role] || 0) < MANDATORY_REQS[role]
      );

      const slotsNeededForOtherMandatory = otherMandatoryRoles.reduce(
        (sum, role) => sum + (MANDATORY_REQS[role] - (current[role] || 0)),
        0
      );

      const totalAvailableSlots = 11 - totalPlayers;
      const effectiveExtraSlots =
        totalAvailableSlots - slotsNeededForOtherMandatory;

      if (effectiveExtraSlots > 0) {
        return { canBid: true, reason: "Available in extra slots" };
      } else {
        return {
          canBid: false,
          reason:
            "No slots available - need to fill other mandatory roles first",
        };
      }
    }
  }

  // For non-bowler roles, use the original logic
  const needsMandatory = currentCount < mandatoryReq;

  // Calculate remaining mandatory slots across all roles
  const totalRemainingMandatory = Object.values(remainingMandatory).reduce(
    (sum, count) => sum + count,
    0
  );

  // Calculate available slots for this specific role (mandatory + 2 extra)
  let availableForThisRole = mandatoryReq + 2;

  // Check if role limit is reached
  if (currentCount >= availableForThisRole) {
    return {
      canBid: false,
      reason: `Maximum ${availableForThisRole} ${playerRole} players allowed!`,
    };
  }

  // Check if we need to reserve slots for other mandatory roles
  const otherMandatoryRoles = Object.keys(remainingMandatory).filter(
    (role) => role !== playerRole && remainingMandatory[role] > 0
  );

  const slotsNeededForOtherMandatory = otherMandatoryRoles.reduce(
    (sum, role) => sum + remainingMandatory[role],
    0
  );
  const totalAvailableSlots = 11 - totalPlayers;

  if (
    !needsMandatory &&
    slotsNeededForOtherMandatory > 0 &&
    totalAvailableSlots <= slotsNeededForOtherMandatory
  ) {
    return {
      canBid: false,
      reason: `Need to fill mandatory ${otherMandatoryRoles.join(
        ", "
      )} slots first!`,
    };
  }

  if (needsMandatory) {
    return { canBid: true, reason: "Mandatory slot available" };
  } else {
    const effectiveExtraSlots =
      totalAvailableSlots - slotsNeededForOtherMandatory;
    if (effectiveExtraSlots > 0) {
      return { canBid: true, reason: "Available in extra slots" };
    } else {
      return {
        canBid: false,
        reason: "No slots available - need to fill other mandatory roles first",
      };
    }
  }
}

function getTeamCombinationStatus(teamCombination, selectedPlayersForAuction) {
  const { current, remainingMandatory } = teamCombination;

  const roleDisplay = [];

  // Check if team is eliminated (missing mandatory players when category is exhausted)
  // Only check elimination if selectedPlayersForAuction is available
  const isEliminated = selectedPlayersForAuction
    ? checkTeamElimination(teamCombination, selectedPlayersForAuction)
    : false;

  // BAT - show orange if > 3
  const batCount = current.BAT || 0;
  const batStatus =
    batCount >= 3
      ? batCount > 3
        ? "extra"
        : "mandatory-complete"
      : isEliminated && remainingMandatory.BAT > 0
      ? "eliminated"
      : "mandatory-incomplete";
  roleDisplay.push(
    `<span class="role-count ${batStatus}">BAT ${batCount}/3</span>`
  );

  // WK - show orange if > 1
  const wkCount = current.WK || 0;
  const wkStatus =
    wkCount >= 1
      ? wkCount > 1
        ? "extra"
        : "mandatory-complete"
      : isEliminated && remainingMandatory.WK > 0
      ? "eliminated"
      : "mandatory-incomplete";
  roleDisplay.push(
    `<span class="role-count ${wkStatus}">WK ${wkCount}/1</span>`
  );

  // BOWL - show orange if > 4
  const bowlCount = current.BOWL || 0;
  const bowlStatus =
    bowlCount >= 4
      ? bowlCount > 4
        ? "extra"
        : "mandatory-complete"
      : isEliminated &&
        (remainingMandatory.FBOWL > 0 || remainingMandatory.SPIN > 0)
      ? "eliminated"
      : "mandatory-incomplete";
  roleDisplay.push(
    `<span class="role-count ${bowlStatus}">BOWL ${bowlCount}/4</span>`
  );

  // ALL - show orange if > 1
  const allCount = current.ALL || 0;
  const allStatus =
    allCount >= 1
      ? allCount > 1
        ? "extra"
        : "mandatory-complete"
      : isEliminated && remainingMandatory.ALL > 0
      ? "eliminated"
      : "mandatory-incomplete";
  roleDisplay.push(
    `<span class="role-count ${allStatus}">ALL ${allCount}/1</span>`
  );

  return roleDisplay.join(" | ");
}

function checkTeamElimination(teamCombination, allPlayers) {
  const { remainingMandatory } = teamCombination;

  // Safety check - if allPlayers is not an array, return false
  if (!Array.isArray(allPlayers)) {
    return false;
  }

  return Object.keys(remainingMandatory).some((role) => {
    if (remainingMandatory[role] > 0) {
      // Check if players for this role are exhausted in the auction
      let rolePlayersAvailable;

      if (role === "BOWL") {
        // For bowlers, check both FBOWL and SPIN
        rolePlayersAvailable = allPlayers.filter((player) => {
          if (!player || !player.role) return false;
          return player.role === "FBOWL" || player.role === "SPIN";
        }).length;
      } else if (role === "WK") {
        rolePlayersAvailable = allPlayers.filter((player) => {
          if (!player || !player.role) return false;
          return player.role === "BAT WK";
        }).length;
      } else {
        rolePlayersAvailable = allPlayers.filter((player) => {
          if (!player || !player.role) return false;
          return player.role === role;
        }).length;
      }

      return rolePlayersAvailable === 0;
    }
    return false;
  });
}

// New function to check team elimination
function checkTeamElimination(teamCombination, allPlayers) {
  const { remainingMandatory } = teamCombination;

  return Object.keys(remainingMandatory).some((role) => {
    if (remainingMandatory[role] > 0) {
      // Check if players for this role are exhausted in the auction
      const rolePlayersAvailable = allPlayers.filter((player) => {
        if (role === "WK") return player.role === "BAT WK";
        return player.role === role;
      }).length;

      return rolePlayersAvailable === 0;
    }
    return false;
  });
}

// ========== UPDATE BID VALIDATION ==========

function validateBid(
  teamPlayers,
  playerRole,
  username,
  selectedPlayersForAuction
) {
  const teamCombination = calculateTeamCombination(teamPlayers);
  const bidCheck = canBidForPlayer(
    teamCombination,
    playerRole,
    calculateRoleCounts(teamPlayers),
    teamPlayers.length
  );

  console.log(`🔍 Bid validation for ${username}:`, {
    playerRole,
    teamStatus: getTeamCombinationStatus(
      teamCombination,
      selectedPlayersForAuction || []
    ),
    canBid: bidCheck.canBid,
    reason: bidCheck.reason,
  });

  return bidCheck;
}

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
  let userCommentaryEnabled = true;
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

      selectedPlayersForAuction = selectPlayersForAuction(players, teamCount);
      console.log(
        `🎯 Selected ${selectedPlayersForAuction.length} players for ${teamCount} teams`
      );

      updateTeamAssignments(data.users, data.teamAssignments);
      updateTeamBoxesFromActiveTeams();

      if (auctionStarted && selectedPlayersForAuction.length > 0) {
        showSelectedPlayersByRole(currentRole);
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
    } else {
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

    setTimeout(() => {
      showAuctionResults();
    }, 2000);
  });

  socket.on("playerSelected", (playerData) => {
    console.log("🎯 Player selected for bidding:", playerData.name);
    setCurrentPlayer(playerData);
  });

  socket.on("bidUpdate", (bidData) => {
    if (bidData.bidder !== username) {
      playBidSound();
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

  bidButton.addEventListener("click", handleBidButtonClick);

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

    return { required };
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

  function playBidSound() {
    try {
      const bidSound = new Audio("/music/button-press.mp3");
      bidSound.volume = 0.4; // Adjust volume as needed
      bidSound.play().catch((e) => console.log("Audio play failed:", e));
    } catch (error) {
      console.log("Bid sound not available");
    }
  }

  // ========== UPDATED BIDDING HANDLING ==========
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
    playBidSound();

    const teamName = getUserTeam(username);
    const myTeam = activeTeams[teamName];
    if (!myTeam) return;

    const role = currentPlayer.role;

    const totalPlayers = myTeam.players.length;

    const bidValidation = validateBid(
      myTeam.players,
      role,
      username,
      selectedPlayersForAuction
    );

    if (!bidValidation.canBid) {
      showModal(
        `❌ Cannot bid for ${role}: ${bidValidation.reason}`,
        "warning"
      );
      return;
    }

    // Check if team already has 11 players
    if (totalPlayers >= 11) {
      showModal(
        "You already have 11 players. You cannot bid further!",
        "error"
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
    updateAuctionSummary(activeTeams, budget);
    resetBiddingBox();

    if (checkAuctionCompletion()) {
      return;
    }

    if (isAdmin && auctionStarted) {
      setTimeout(() => {
        selectNextPlayer();
      }, 2000);
    }

    if (userCommentaryEnabled) {
      const bidAmount = parseFloat(soldData.price);
      const basePrice = parseFloat(soldData.basePrice);

      let eventType = "player_sold";
      if (bidAmount <= basePrice * 1.1) {
        eventType = "bargain_buy";
      } else if (bidAmount > basePrice * 4) {
        eventType = "expensive_buy";
      } else if (bidAmount > basePrice * 2) {
        eventType = "aggressive_bid";
      }
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

        /* Combination status styles */
        .combination-status {
            font-size: 0.7rem;
            color: #ffcc00;
            margin-bottom: 3px;
            line-height: 1.2;
        }
        
        .team-complete .combination-status {
            color: #28a745;
            font-weight: bold;
        }
    </style>
`;

  document.head.insertAdjacentHTML("beforeend", completionStyles);

  // ========== SOCKET EVENT FOR REQUESTING AUCTION END ==========
  socket.on("auctionCompletionRequested", (data) => {
    if (isAdmin) {
      showModal(
        `All teams have completed 11 players! ${data.username} requested to end the auction.`,
        "info"
      );
      if (confirm("All teams have completed 11 players. End auction now?")) {
        socket.emit("endAuction", roomCode);
      }
    }
  });

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
    updateAuctionSummary(activeTeams, budget);

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
    const rankedTeams = Object.values(activeTeams).sort((a, b) => {
      const ratingA = a.totalRating || 0;
      const ratingB = b.totalRating || 0;
      return ratingB - ratingA;
    });

    const mostExpensivePlayer = findMostExpensivePlayer();
    updateResultsHighestBidInfo(mostExpensivePlayer);

    if (rankedTeams.length > 0) {
      updateResultsMVPInfo(rankedTeams[0]);
    }

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
          // Try to find the original player data for image
          const originalPlayer = players.find(
            (p) => p.name === player.playerName || p.id === player.playerId
          );

          mostExpensive = {
            ...player,
            team: team.teamName,
            image: originalPlayer?.image || player.image,
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
      // Get the actual player object to access the image
      const actualPlayer = players.find(
        (p) =>
          p.name === mostExpensivePlayer.playerName ||
          p.id === mostExpensivePlayer.playerId
      );

      const playerImage =
        actualPlayer?.image ||
        mostExpensivePlayer.image ||
        "https://via.placeholder.com/120?text=PLAYER";

      highestBidPlayerImg.src = playerImage;
      highestBidPlayerImg.alt =
        mostExpensivePlayer.playerName || "Most Expensive Player";
      highestBidPlayerImg.style.display = "block";

      highestBidPlayerImg.onerror = function () {
        this.src = "https://via.placeholder.com/120?text=PLAYER";
        this.alt = "Player Image Not Available";
      };
    } else if (highestBidPlayerImg) {
      highestBidPlayerImg.src =
        "https://via.placeholder.com/120?text=NO+PLAYER";
      highestBidPlayerImg.alt = "No player sold";
      highestBidPlayerImg.style.display = "block";
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
    if (rankedTeams.length > 0) {
      updateResultsTeamCard("First", rankedTeams[0]);
    }
    if (rankedTeams.length > 1) {
      updateResultsTeamCard("Second", rankedTeams[1]);
    }
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

      if (isAdmin) {
        socket.emit("endAuction", roomCode);
      } else {
        socket.emit("requestAuctionEnd", roomCode);
      }

      return true;
    }

    return false;
  }

  // ========== UPDATED TEAM BOXES DISPLAY ==========
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

          // Calculate team combination
          const teamCombination = calculateTeamCombination(players);
          const isTeamComplete = teamCombination.isTeamComplete;

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

          // Get team combination status
          const combinationStatus = getTeamCombinationStatus(
            teamCombination,
            selectedPlayersForAuction
          );

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
                                    Players: ${playerCount}/11 ${
            isTeamComplete ? "✓" : ""
          }
                                </div>
                                <div class="role-summary-line" id="roleSummary-${
                                  team.teamName
                                }">
                                    ${combinationStatus}
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
                                        <th>Role</th>
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
                                            <td>${player.role || "Unknown"}</td>
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

    updateAuctionSummary(activeTeams, budget);

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
    updateAuctionSummary(activeTeams, budget);
  }

  socket.on("roomState", (roomState) => {
    handleRoomState(roomState);

    if (players.length > 0) {
      selectedPlayersForAuction = selectPlayersForAuction(players, teamCount);
      console.log(
        `🎯 Room state: Selected ${selectedPlayersForAuction.length} players for ${teamCount} teams`
      );

      if (auctionStarted && selectedPlayersForAuction.length > 0) {
        showSelectedPlayersByRole(currentRole);
      } else if (auctionStarted) {
        showWaitingForAuctionMessage();
      }
    }
  });
});

// ========== GLOBAL UTILITY FUNCTIONS ==========
function extractSequenceNumber(category) {
  if (!category) return 999;
  const match = category.match(/L\d+S(\d+)/);
  return match ? parseInt(match[1]) : 999;
}

function sortPlayersByCategoryAndSequence(players) {
  return players.sort((a, b) => {
    const categoryA = a.category || "";
    const categoryB = b.category || "";

    if (categoryA < categoryB) return -1;
    if (categoryA > categoryB) return 1;

    const seqA = a.sequence || 999;
    const seqB = b.sequence || 999;
    return seqA - seqB;
  });
}

function calculateRoleCounts(players) {
  const counts = {};
  players.forEach((player) => {
    const role = player.role;
    counts[role] = (counts[role] || 0) + 1;
  });
  return counts;
}

function calculateNextBid(currentBid, basePrice) {
  if (currentBid === 0) return parseFloat(basePrice);
  if (currentBid < 1) return parseFloat((currentBid + 0.05).toFixed(2));
  if (currentBid < 2) return parseFloat((currentBid + 0.1).toFixed(2));
  if (currentBid < 5) return parseFloat((currentBid + 0.2).toFixed(2));
  if (currentBid < 10) return parseFloat((currentBid + 0.5).toFixed(2));
  return currentBid + 1;
}

function getTeamFullName(teamCode) {
  const teamNames = {
    CSK: "Chennai Super Kings",
    MI: "Mumbai Indians",
    RCB: "Royal Challengers Bangalore",
    KKR: "Kolkata Knight Riders",
    DC: "Delhi Capitals",
    SRH: "Sunrisers Hyderabad",
    RR: "Rajasthan Royals",
    PK: "Punjab Kings",
    GT: "Gujarat Titans",
    LSG: "Lucknow Super Giants",
  };
  return teamNames[teamCode] || teamCode;
}

function findHighestPricedPlayer(players) {
  if (!players || players.length === 0) return null;
  return players.reduce((highest, player) => {
    const playerPrice = parseFloat(player.price) || 0;
    const highestPrice = parseFloat(highest.price) || 0;
    return playerPrice > highestPrice ? player : highest;
  });
}

function calculateTeamRankings(activeTeams, budget) {
  const teams = Object.values(activeTeams);

  const ratingRanked = [...teams].sort(
    (a, b) => (b.totalRating || 0) - (a.totalRating || 0)
  );
  const purseRanked = [...teams].sort((a, b) => {
    const aRemaining = budget - (a.totalSpent || 0);
    const bRemaining = budget - (b.totalSpent || 0);
    return bRemaining - aRemaining;
  });

  return teams.map((team) => {
    const ratingRank =
      ratingRanked.findIndex((t) => t.teamName === team.teamName) + 1;
    const purseRank =
      purseRanked.findIndex((t) => t.teamName === team.teamName) + 1;
    return {
      team: team.teamName,
      ratingRank,
      purseRank,
    };
  });
}

function updateAuctionSummary(activeTeams, budget) {
  console.log("🔄 Updating auction summary...");

  if (Object.keys(activeTeams).length === 0) {
    console.log("❌ No active teams for summary");
    return;
  }

  let highestRatingTeam = null,
    highestRating = -1;
  let highestPurseTeam = null,
    highestPurse = -1;

  Object.values(activeTeams).forEach((team) => {
    const teamRating = parseFloat(team.totalRating) || 0;
    const teamSpent = parseFloat(team.totalSpent) || 0;
    const remainingPurse = budget - teamSpent;

    console.log(
      `🏏 ${
        team.teamName
      }: Rating=${teamRating}, Purse=₹${remainingPurse.toFixed(2)}`
    );

    if (teamRating > highestRating) {
      highestRating = teamRating;
      highestRatingTeam = team.teamName;
    }
    if (remainingPurse > highestPurse) {
      highestPurse = remainingPurse;
      highestPurseTeam = team.teamName;
    }
  });

  const highestRatingTeamElement = document.getElementById("highestRatingTeam");
  const highestPurseTeamElement = document.getElementById("highestPurseTeam");

  console.log(`🏆 Highest Rating: ${highestRatingTeam} (${highestRating})`);
  console.log(`💰 Biggest Purse: ${highestPurseTeam} (₹${highestPurse})`);

  if (highestRatingTeamElement) {
    const span = highestRatingTeamElement.querySelector("span");
    if (span) {
      span.textContent = highestRatingTeam
        ? `${highestRatingTeam} ${highestRating.toFixed(1)}`
        : "—";
    }
  }

  if (highestPurseTeamElement) {
    const span = highestPurseTeamElement.querySelector("span");
    if (span) {
      span.textContent = highestPurseTeam
        ? `${highestPurseTeam} ₹${highestPurse.toFixed(1)} Cr`
        : "—";
    }
  }
}

function showModal(message, type = "info") {
  const modalEl = document.getElementById("alertModal");
  if (!modalEl) {
    // Fallback to alert if modal not found
    alert(`${type.toUpperCase()}: ${message}`);
    return;
  }

  const modal = new bootstrap.Modal(modalEl);
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");

  // Set title based on type
  if (type === "success") {
    modalTitle.textContent = "✅ Success";
  } else if (type === "error") {
    modalTitle.textContent = "❌ Error";
  } else if (type === "warning") {
    modalTitle.textContent = "⚠️ Warning";
  } else {
    modalTitle.textContent = "ℹ️ Info";
  }

  modalMessage.textContent = message;
  modal.show();
}

function updateBudgetDisplay(budget) {
  const budgetDisplay = document.getElementById("budgetDisplay");
  if (budgetDisplay) {
    budgetDisplay.textContent = budget.toFixed(0);
  }
}
