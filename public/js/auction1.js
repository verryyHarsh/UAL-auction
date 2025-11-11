// Remove these duplicate declarations from auction1.js
// const ALL_TEAMS = [
//   "CSK",
//   "MI",
//   "RCB",
//   "KKR",
//   "DC",
//   "SRH",
//   "RR",
//   "PK",
//   "GT",
//   "LSG",
// ];

// const TEAM_FULL_NAMES = {
//   CSK: "Chennai Super Kings",
//   MI: "Mumbai Indians",
//   RCB: "Royal Challengers Bangalore",
//   KKR: "Kolkata Knight Riders",
//   DC: "Delhi Capitals",
//   SRH: "Sunrisers Hyderabad",
//   RR: "Rajasthan Royals",
//   PK: "Punjab Kings",
//   GT: "Gujarat Titans",
//   LSG: "Lucknow Super Giants",
// };

function extractSequenceNumber(category) {
  if (!category) return 999;
  const match = category.match(/S(\d+)/);
  return match ? parseInt(match[1]) : 999;
}

function sortPlayersByCategoryAndSequence(players) {
  const categoryOrder = {
    BAT: 1,
    "BAT WK": 5,
    ALL: 4,
    FBOWL: 2,
    SPIN: 3,
    "UC-BAT": 6,
    "UC-ALL": 7,
    "UC-BOWL": 8,
    "UC-SPIN": 9,
  };

  return players.sort((a, b) => {
    const orderA = categoryOrder[a.role] || 999;
    const orderB = categoryOrder[b.role] || 999;
    if (orderA !== orderB) return orderA - orderB;

    const seqA = a.sequence || 999;
    const seqB = b.sequence || 999;
    return seqA - seqB;
  });
}

function calculateNextBid(currentBidAmount, basePrice) {
  if (currentBidAmount === 0) return basePrice;
  if (currentBidAmount < 1) return currentBidAmount + 0.05;
  if (currentBidAmount < 2) return currentBidAmount + 0.1;
  if (currentBidAmount < 5) return currentBidAmount + 0.2;
  if (currentBidAmount < 10) return currentBidAmount + 0.5;
  return currentBidAmount + 1;
}

function calculateRoleCounts(players) {
  const roleCounts = {};
  players.forEach((player) => {
    roleCounts[player.role] = (roleCounts[player.role] || 0) + 1;
  });
  return roleCounts;
}

function getTeamFullName(shortName) {
  // This function will now use the TEAM_FULL_NAMES from auction2.js
  const TEAM_FULL_NAMES = {
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
  return TEAM_FULL_NAMES[shortName] || shortName;
}

function calculateTeamRankings(activeTeams, budget) {
  const teamsData = Object.values(activeTeams).map((team) => ({
    team: team.teamName,
    totalRating: team.totalRating || 0,
    remainingPurse: budget - (team.totalSpent || 0),
  }));

  const ratingRanking = [...teamsData].sort(
    (a, b) => b.totalRating - a.totalRating
  );
  const purseRanking = [...teamsData].sort(
    (a, b) => b.remainingPurse - a.remainingPurse
  );

  return teamsData.map((team) => ({
    team: team.team,
    ratingRank: ratingRanking.findIndex((t) => t.team === team.team) + 1,
    purseRank: purseRanking.findIndex((t) => t.team === team.team) + 1,
  }));
}

function updateBudgetDisplay(budget) {
  const budgetDisplay = document.getElementById("budgetDisplay");
  if (budgetDisplay) budgetDisplay.textContent = budget.toFixed(0);
}

// ===== UPDATED SUMMARY FUNCTIONS =====
function updateAuctionSummary(activeTeams, budget) {
  if (Object.keys(activeTeams).length === 0) {
    console.log("❌ No active teams for summary");
    return;
  }

  let highestRatingTeam = null,
    highestRating = -1;
  let highestPurseTeam = null,
    highestPurse = -1;

  console.log("🔄 Calculating auction summary:");

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

  if (
    highestRatingTeamElement &&
    highestRatingTeamElement.querySelector("span")
  ) {
    highestRatingTeamElement.querySelector("span").textContent =
      highestRatingTeam
        ? `${highestRatingTeam} ${highestRating.toFixed(1)}`
        : "—";
  } else {
    console.log("❌ highestRatingTeamElement not found");
  }

  if (
    highestPurseTeamElement &&
    highestPurseTeamElement.querySelector("span")
  ) {
    highestPurseTeamElement.querySelector("span").textContent = highestPurseTeam
      ? `${highestPurseTeam} ₹${highestPurse.toFixed(1)} Cr`
      : "—";
  } else {
    console.log("❌ highestPurseTeamElement not found");
  }
}

function updateHighestBidInfo(
  currentPlayer,
  currentBid,
  highestBidder,
  userTeamAssignments
) {
  const highestBidPlayerImg = document.getElementById("highestBidPlayerImg");
  const highestBidPrice = document.getElementById("highestBidPrice");
  const highestBidTeam = document.getElementById("highestBidTeam");

  // Helper function to get user team
  const getUserTeam = (username) => {
    return userTeamAssignments[username] || "TBD";
  };

  if (highestBidPlayerImg) {
    if (currentPlayer?.image) {
      highestBidPlayerImg.src = currentPlayer.image;
      highestBidPlayerImg.alt = currentPlayer.name || "Current Player";
      highestBidPlayerImg.style.display = "block";
    } else {
      highestBidPlayerImg.style.display = "none";
    }
  }

  if (highestBidPrice) {
    highestBidPrice.textContent = `₹${currentBid?.toFixed(2) || "0.00"}CR`;
  }

  if (highestBidTeam) {
    highestBidTeam.textContent = highestBidder
      ? `sold to ${getUserTeam(highestBidder)}`
      : "No bids yet";
  }
}

function updateMVPInfo(team) {
  const mvpTeamLogo = document.getElementById("mvpTeamLogo");
  if (mvpTeamLogo && team) {
    mvpTeamLogo.src = `images/${team.teamName}.png`;
    mvpTeamLogo.alt = team.fullName;
  }
}

function updateTeamRankings(rankedTeams) {
  // Update first place team
  if (rankedTeams.length > 0) {
    updateTeamCard("first", rankedTeams[0]);
  }

  // Update second place team
  if (rankedTeams.length > 1) {
    updateTeamCard("second", rankedTeams[1]);
  }

  // Update third place team
  if (rankedTeams.length > 2) {
    updateTeamCard("third", rankedTeams[2]);
  }
}

function updateTeamCard(position, team) {
  const teamLogo = document.getElementById(`${position}TeamLogo`);
  const teamRating = document.getElementById(`${position}TeamRating`);
  const teamPlayer = document.getElementById(`${position}TeamPlayer`);
  const teamPlayerPrice = document.getElementById(`${position}TeamPlayerPrice`);

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

function findHighestPricedPlayer(players) {
  if (!players || players.length === 0) return null;

  return players.reduce((highest, player) => {
    const currentPrice = parseFloat(player.price) || 0;
    const highestPrice = parseFloat(highest.price) || 0;
    return currentPrice > highestPrice ? player : highest;
  }, players[0]);
}

function updateTimerDisplay(timeLeft) {
  const timerProgress = document.getElementById("timerProgress");
  if (timerProgress) {
    const progressPercent = (timeLeft / 10) * 100;
    timerProgress.style.width = `${progressPercent}%`;
  }
}

// Fullscreen functionality
function initializeFullscreen() {
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  if (!fullscreenBtn) return;

  function updateFullscreenButton() {
    if (isFullscreen()) {
      fullscreenBtn.innerHTML = "EXIT FULL SCREEN";
      fullscreenBtn.title = "Exit Fullscreen";
    } else {
      fullscreenBtn.innerHTML = "FULL SCREEN";
      fullscreenBtn.title = "Enter Fullscreen";
    }
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function enterFullscreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  }

  function exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  function toggleFullscreen() {
    if (isFullscreen()) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }

  fullscreenBtn.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
  document.addEventListener("mozfullscreenchange", updateFullscreenButton);
  document.addEventListener("MSFullscreenChange", updateFullscreenButton);
  updateFullscreenButton();
}

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

  modalTitle.style.color = "#222";
  modalMessage.textContent = message;
  modal.show();
}

// Add close button functionality for summary
function initializeSummaryCloseButton() {
  const closeBtn = document.querySelector(".close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      const container = document.querySelector(".container1");
      if (container) {
        container.style.display = "none";
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initializeFullscreen();
  initializeSummaryCloseButton();
});

// Make functions globally available
if (typeof window !== "undefined") {
  window.sortPlayersByCategoryAndSequence = sortPlayersByCategoryAndSequence;
  window.calculateRoleCounts = calculateRoleCounts;
  window.extractSequenceNumber = extractSequenceNumber;
  window.getTeamFullName = getTeamFullName;
  window.calculateTeamRankings = calculateTeamRankings;
  window.updateBudgetDisplay = updateBudgetDisplay;
  window.updateAuctionSummary = updateAuctionSummary;
  window.showModal = showModal;
  window.initializeSummaryCloseButton = initializeSummaryCloseButton;
}
