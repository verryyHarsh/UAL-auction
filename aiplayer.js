// enhanced-aiplayer.js - Smart AI with Team Composition Rules
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

class SmartAIPlayer {
  constructor(name, behavior, budget, roomBudget, totalPlayers) {
    this.name = name;
    this.behavior = behavior;
    this.budget = budget;
    this.roomBudget = roomBudget;
    this.totalPlayers = totalPlayers;
    this.team = null;
    this.players = [];
    this.remainingBudget = budget;
    this.biddingHistory = [];

    // Smart aggressive settings
    this.aggressionLevel = this.calculateAggressionLevel();
    this.maxBidPercent = this.calculateMaxBidPercent();
    this.bidChance = this.calculateBidChance();

    console.log(
      `🔥 ${this.name} (${behavior}) - Budget: ₹${budget}Cr, Aggression: ${this.aggressionLevel}`
    );

    // Enhanced team composition with EXACT SAME RULES as human players
    this.teamComposition = {
      BAT: { required: 3, max: 5, current: 0, priority: 0.95 }, // 3 mandatory + 2 extra
      "BAT WK": { required: 1, max: 3, current: 0, priority: 1.0 }, // 1 mandatory + 2 extra
      ALL: { required: 1, max: 3, current: 0, priority: 1.0 }, // 1 mandatory + 2 extra
      FBOWL: { required: 2, max: 4, current: 0, priority: 0.9 }, // 2 mandatory + 2 extra
      SPIN: { required: 2, max: 4, current: 0, priority: 0.9 }, // 2 mandatory + 2 extra
      "UC-BAT": { required: 0, max: 2, current: 0, priority: 0.4 },
      "UC-ALL": { required: 0, max: 2, current: 0, priority: 0.5 },
      "UC-BOWL": { required: 0, max: 2, current: 0, priority: 0.3 },
      "UC-SPIN": { required: 0, max: 2, current: 0, priority: 0.3 },
    };

    this.remainingSlots = 11;
    this.auctionPhase = "early";
    this.availablePlayers = [];
    this.allTeamsData = {}; // Store all teams' data for strategy
    this.roleUrgency = {};
  }

  calculateAggressionLevel() {
    const levels = {
      aggressive: 2.2,
      strategic: 1.7,
      balanced: 1.4,
    };
    return levels[this.behavior] || 1.7;
  }

  calculateMaxBidPercent() {
    const percents = {
      aggressive: 0.25,
      strategic: 0.2,
      balanced: 0.18,
    };
    return percents[this.behavior] || 0.2;
  }

  calculateBidChance() {
    const chances = {
      aggressive: 0.8,
      strategic: 0.6,
      balanced: 0.5,
    };
    return chances[this.behavior] || 0.6;
  }

  // NEW: Update with all teams data for strategy
  updateAllTeamsData(allTeamsData) {
    this.allTeamsData = allTeamsData || {};
    console.log(
      `🎯 ${this.name} updated with ${
        Object.keys(allTeamsData).length
      } teams data`
    );
  }

  // NEW: Update available players for the auction session
  updateAvailablePlayers(availablePlayers) {
    this.availablePlayers = availablePlayers || [];
    this.calculateRoleUrgency();
  }

  // ENHANCED: Calculate role urgency with team competition awareness
  calculateRoleUrgency() {
    const remainingReqs = this.getRemainingRequirements();
    const roleCounts = {};

    // Count available players for each role
    this.availablePlayers.forEach((player) => {
      if (player.role) {
        roleCounts[player.role] = (roleCounts[player.role] || 0) + 1;
      }
    });

    // Calculate competition for each role
    const roleCompetition = this.calculateRoleCompetition();

    this.roleUrgency = {};
    Object.keys(remainingReqs).forEach((role) => {
      const remaining = remainingReqs[role].count;
      const available = roleCounts[role] || 0;
      const competition = roleCompetition[role] || 1;

      if (available === 0 && remaining > 0) {
        this.roleUrgency[role] = 1.0; // Critical - no players left
      } else if (available > 0) {
        // Higher urgency when fewer players available and high competition
        const scarcityFactor = Math.min(1.0, remaining / available);
        const competitionFactor = Math.min(1.5, 1 + competition * 0.5);
        this.roleUrgency[role] = Math.min(
          1.0,
          scarcityFactor * competitionFactor
        );
      } else {
        this.roleUrgency[role] = 0;
      }
    });

    console.log(`🎯 ${this.name} Role Urgency:`, this.roleUrgency);
  }

  // NEW: Calculate competition for each role from other teams
  calculateRoleCompetition() {
    const competition = {};
    const myTeamNeeds = this.getRemainingRequirements();

    Object.keys(this.allTeamsData).forEach((teamName) => {
      if (teamName !== this.team) {
        const team = this.allTeamsData[teamName];
        if (team && team.players) {
          const teamRoleCounts = this.calculateRoleCounts(team.players);

          Object.keys(myTeamNeeds).forEach((role) => {
            const teamHasRole = teamRoleCounts[role] || 0;
            const roleConfig = this.teamComposition[role];
            if (roleConfig && teamHasRole < roleConfig.max) {
              competition[role] = (competition[role] || 0) + 1;
            }
          });
        }
      }
    });

    return competition;
  }

  updateTeamComposition() {
    Object.keys(this.teamComposition).forEach((role) => {
      this.teamComposition[role].current = 0;
    });

    this.players.forEach((player) => {
      if (this.teamComposition[player.role]) {
        this.teamComposition[player.role].current++;
      } else {
        if (player.role && player.role.includes("BAT"))
          this.teamComposition["UC-BAT"].current++;
        else if (player.role && player.role.includes("ALL"))
          this.teamComposition["UC-ALL"].current++;
        else this.teamComposition["UC-BOWL"].current++;
      }
    });

    this.remainingSlots = 11 - this.players.length;
  }

  // ENHANCED: Get remaining requirements following EXACT SAME RULES as human players
  getRemainingRequirements() {
    const requirements = {};

    // First, calculate mandatory requirements
    Object.keys(this.teamComposition).forEach((role) => {
      const config = this.teamComposition[role];

      // Check if we still need mandatory players
      if (config.current < config.required) {
        requirements[role] = {
          count: config.required - config.current,
          priority: config.priority,
          type: "mandatory",
        };
      }
    });

    // Then calculate available extra slots
    const totalMandatoryNeeded = Object.values(requirements).reduce(
      (sum, req) => sum + req.count,
      0
    );
    const availableExtraSlots = Math.max(
      0,
      this.remainingSlots - totalMandatoryNeeded
    );

    // Add extra slots for roles that haven't reached max limit
    if (availableExtraSlots > 0) {
      Object.keys(this.teamComposition).forEach((role) => {
        const config = this.teamComposition[role];
        const currentExtra = Math.max(0, config.current - config.required);
        const maxExtra = config.max - config.required;
        const remainingExtra = Math.max(0, maxExtra - currentExtra);

        if (remainingExtra > 0 && config.current >= config.required) {
          const extraAllocation = Math.min(remainingExtra, availableExtraSlots);
          if (extraAllocation > 0) {
            requirements[role] = {
              count: extraAllocation,
              priority: config.priority * 0.7, // Lower priority for extras
              type: "extra",
            };
          }
        }
      });
    }

    return requirements;
  }

  // NEW: Check if we can bid for a player (same validation as human players)
  canBidForPlayer(playerRole) {
    const config = this.teamComposition[playerRole];
    if (!config) {
      // Handle UC roles
      if (playerRole.includes("BAT"))
        return (
          this.teamComposition["UC-BAT"].current <
          this.teamComposition["UC-BAT"].max
        );
      if (playerRole.includes("ALL"))
        return (
          this.teamComposition["UC-ALL"].current <
          this.teamComposition["UC-ALL"].max
        );
      return (
        this.teamComposition["UC-BOWL"].current <
        this.teamComposition["UC-BOWL"].max
      );
    }

    // Check if we've reached the maximum limit for this role
    if (config.current >= config.max) {
      return false; // Already at maximum limit
    }

    // Check if we have slots available
    if (this.remainingSlots <= 0) {
      return false; // Team is full
    }

    const remainingReqs = this.getRemainingRequirements();

    // If it's a mandatory requirement, always allow bidding
    if (
      remainingReqs[playerRole] &&
      remainingReqs[playerRole].type === "mandatory"
    ) {
      return true;
    }

    // For extra slots, check if we have available extra slots
    if (
      remainingReqs[playerRole] &&
      remainingReqs[playerRole].type === "extra"
    ) {
      return true;
    }

    return false;
  }

  isCriticalRole(role) {
    const mandatoryReqs = this.getRemainingRequirements();
    const isMandatory =
      mandatoryReqs[role] && mandatoryReqs[role].type === "mandatory";
    const urgency = this.roleUrgency[role] || 0;

    return isMandatory && urgency > 0.7;
  }

  // ENHANCED: Calculate player value with team competition awareness
  calculatePlayerValue(player, currentBid) {
    if (!this.canBidForPlayer(player.role)) {
      console.log(
        `❌ ${this.name} cannot bid for ${player.role} - limit reached`
      );
      return 0;
    }

    const basePrice = parseFloat(player.basePrice) || 0.2;
    const rating = Math.min(10, Math.max(0, parseFloat(player.rating) || 6.0));
    const remainingReqs = this.getRemainingRequirements();
    const isRequired = !!remainingReqs[player.role];
    const isCritical = this.isCriticalRole(player.role);
    const roleUrgency = this.roleUrgency[player.role] || 0;

    // Base value calculation
    let value = Math.max(basePrice * 1.5, 0.3);

    // Rating multiplier (more aggressive for high-rated players)
    const ratingMultiplier = 0.9 + (rating / 10) * 1.5;

    // Role multiplier with urgency and competition
    let roleMultiplier = 1;
    if (isRequired) {
      const rolePriority = remainingReqs[player.role].priority || 1;
      const urgencyBonus = 0.5 + roleUrgency * 0.8;

      if (isCritical) {
        roleMultiplier = 3.0 * rolePriority * urgencyBonus;
      } else {
        roleMultiplier = 2.2 * rolePriority * urgencyBonus;
      }
    }

    // Behavior multiplier
    let behaviorMultiplier = this.aggressionLevel;

    // Competition awareness - bid more if other teams need this role
    const competitionMultiplier =
      1 + (this.calculateRoleCompetition()[player.role] || 0) * 0.1;

    value =
      value *
      ratingMultiplier *
      roleMultiplier *
      behaviorMultiplier *
      competitionMultiplier;

    // SMART BUDGET CAP
    const absoluteMaxBid = this.budget * this.maxBidPercent;
    const slotsLeft = Math.max(1, this.remainingSlots);
    const avgPerSlot = this.remainingBudget / slotsLeft;
    const reasonableMax = avgPerSlot * (isCritical ? 3.5 : 2.5);

    const finalValue = Math.min(
      value,
      absoluteMaxBid,
      reasonableMax,
      this.remainingBudget
    );

    console.log(
      `🎯 ${this.name} values ${player.name} at ₹${finalValue.toFixed(
        2
      )}Cr (Role: ${player.role}, CanBid: ${this.canBidForPlayer(
        player.role
      )}, Urgency: ${(roleUrgency * 100).toFixed(0)}%)`
    );

    return finalValue;
  }

  calculateNextBid(currentBid, basePrice) {
    const base = parseFloat(basePrice) || 0.2;

    if (currentBid === 0) return base;

    let increment;

    if (currentBid < 1) {
      increment = 0.05;
    } else if (currentBid < 2) {
      increment = 0.1;
    } else if (currentBid < 5) {
      increment = 0.2;
    } else if (currentBid < 10) {
      increment = 0.5;
    } else {
      increment = 1.0;
    }

    const nextBid = currentBid + increment;
    return parseFloat(nextBid.toFixed(2));
  }

  async shouldBid(player, currentBid, teamAssignments) {
    // QUICK ELIMINATION CHECKS
    if (this.remainingBudget <= currentBid + 0.05) {
      return null;
    }
    if (this.remainingSlots === 0) {
      return null;
    }

    // CRITICAL CHECK: Can we bid for this player role?
    if (!this.canBidForPlayer(player.role)) {
      console.log(
        `❌ ${this.name} cannot bid for ${player.name} - ${player.role} limit reached`
      );
      return null;
    }

    const playerValue = this.calculatePlayerValue(player, currentBid);
    const remainingReqs = this.getRemainingRequirements();
    const isRequired = !!remainingReqs[player.role];
    const roleUrgency = this.roleUrgency[player.role] || 0;

    console.log(
      `🤖 ${this.name} evaluating ${
        player.name
      }: Current ₹${currentBid}Cr, My Value ₹${playerValue.toFixed(
        2
      )}Cr, Required: ${isRequired}, Urgency: ${(roleUrgency * 100).toFixed(
        0
      )}%`
    );

    // ENHANCED DECISION MAKING with strict role limits
    const shouldBid = this.makeBidDecision(
      player,
      currentBid,
      playerValue,
      isRequired,
      roleUrgency
    );

    if (shouldBid) {
      const bidAmount = this.calculateNextBid(currentBid, player.basePrice);

      // FINAL SAFETY CHECK
      if (bidAmount <= playerValue && bidAmount <= this.remainingBudget) {
        console.log(
          `✅ ${this.name} BIDDING ₹${bidAmount.toFixed(2)}Cr for ${
            player.name
          }`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 300 + Math.random() * 400)
        );
        return bidAmount;
      } else {
        console.log(
          `❌ ${
            this.name
          } WONT BID - Bid ${bidAmount} exceeds value ${playerValue.toFixed(2)}`
        );
      }
    }

    return null;
  }

  // ENHANCED: Make bid decision with strict role limits
  makeBidDecision(player, currentBid, playerValue, isRequired, roleUrgency) {
    const isCritical = this.isCriticalRole(player.role);
    const rating = parseFloat(player.rating) || 6.0;

    // Cannot bid if role limit reached (already checked in shouldBid)

    // HIGH PRIORITY: Critical roles with high urgency
    if (isCritical && roleUrgency > 0.8) {
      return currentBid < playerValue * 0.95;
    }

    // HIGH PRIORITY: Star players in required roles
    if (isRequired && rating >= 8.0) {
      return currentBid < playerValue * 0.85;
    }

    // MEDIUM PRIORITY: Required roles with medium urgency
    if (isRequired && roleUrgency > 0.5) {
      return currentBid < playerValue * 0.75;
    }

    // MEDIUM PRIORITY: Good deals on required players
    if (isRequired && currentBid < playerValue * 0.65) {
      return true;
    }

    // LOW PRIORITY: Extra slots for good value
    if (currentBid < playerValue * 0.6) {
      return true;
    }

    // RANDOM BID for auction activity (reduced)
    const randomBid = Math.random() < this.bidChance * 0.3;
    if (randomBid && currentBid < playerValue * 0.5) {
      return true;
    }

    return false;
  }

  async makeBidDecisionWrapper(player, currentBid, teamAssignments, roomState) {
    try {
      // Update auction phase based on progress
      this.updateAuctionPhase(roomState);

      const bidAmount = await this.shouldBid(
        player,
        currentBid,
        teamAssignments
      );

      if (bidAmount) {
        this.biddingHistory.push({
          player: player.name,
          role: player.role,
          bid: bidAmount,
          value: this.calculatePlayerValue(player, currentBid),
          timestamp: Date.now(),
        });

        return {
          username: this.name,
          bidAmount: bidAmount,
          reasoning: this.getBidReasoning(player, bidAmount),
        };
      }
    } catch (error) {
      console.error(`Error in ${this.name} bidding:`, error);
    }

    return null;
  }

  // NEW: Update auction phase based on progress
  updateAuctionPhase(roomState) {
    if (!roomState || !roomState.soldPlayers) return;

    const soldCount = roomState.soldPlayers.length;
    const totalExpected = this.totalPlayers * 11;

    if (soldCount < totalExpected * 0.3) {
      this.auctionPhase = "early";
    } else if (soldCount < totalExpected * 0.7) {
      this.auctionPhase = "mid";
    } else {
      this.auctionPhase = "late";
    }
  }

  // Utility function to calculate role counts (used for competition calculation)
  calculateRoleCounts(players) {
    const counts = {};
    players.forEach((player) => {
      const role = player.role;
      counts[role] = (counts[role] || 0) + 1;
    });
    return counts;
  }

  getBidReasoning(player, bidAmount) {
    const remainingReqs = this.getRemainingRequirements();
    const isRequired = !!remainingReqs[player.role];
    const isCritical = this.isCriticalRole(player.role);
    const rating = parseFloat(player.rating) || 6.0;

    if (isCritical) return "CRITICAL NEED";
    if (rating >= 8.5) return "STAR PLAYER";
    if (isRequired) return "TEAM NEED";
    if (rating >= 7.5) return "HIGH VALUE";
    return "GOOD DEAL";
  }

  addPlayer(player, price) {
    this.players.push({
      ...player,
      price: price,
    });
    this.remainingBudget -= price;
    if (this.remainingBudget < 0) this.remainingBudget = 0;
    this.updateTeamComposition();

    console.log(
      `🏆 ${this.name} bought ${
        player.name
      } for ₹${price}Cr | Remaining: ₹${this.remainingBudget.toFixed(
        2
      )}Cr | Slots: ${this.remainingSlots} | ${player.role}: ${
        this.teamComposition[player.role].current
      }/${this.teamComposition[player.role].max}`
    );
  }

  isTeamComplete() {
    this.updateTeamComposition();

    // Team is complete when we have 11 players AND all mandatory roles filled
    if (this.players.length < 11) return false;

    const mandatoryRoles = ["BAT", "BAT WK", "ALL", "FBOWL", "SPIN"];
    for (const role of mandatoryRoles) {
      if (
        this.teamComposition[role].current < this.teamComposition[role].required
      ) {
        return false;
      }
    }

    return true;
  }

  getTeamStatus() {
    this.updateTeamComposition();
    const remainingReqs = this.getRemainingRequirements();

    return {
      name: this.name,
      behavior: this.behavior,
      totalSpent: (this.budget - this.remainingBudget).toFixed(2),
      remainingBudget: this.remainingBudget.toFixed(2),
      playersBought: this.players.length,
      remainingSlots: this.remainingSlots,
      maxBidPercent: this.maxBidPercent * 100 + "%",
      mandatoryComplete: this.isTeamComplete(),
      composition: Object.keys(this.teamComposition).reduce((acc, role) => {
        acc[
          role
        ] = `${this.teamComposition[role].current}/${this.teamComposition[role].max}`;
        return acc;
      }, {}),
    };
  }
}

class SmartAIManager {
  constructor() {
    this.aiPlayers = [];
    this.behaviors = [
      "aggressive",
      "aggressive",
      "strategic",
      "aggressive",
      "balanced",
      "strategic",
    ];
    this.aiNames = [
      "Jarvis",
      "Tars",
      "G-one",
      "Thala",
      "Ultron",
      "Ghost",
      "Vader",
      "Terminator",
    ];
  }

  initializeAIPlayers(
    count,
    budget,
    teamAssignments,
    roomBudget,
    totalPlayers
  ) {
    this.aiPlayers = [];

    const shuffledNames = [...this.aiNames].sort(() => Math.random() - 0.5);
    const shuffledBehaviors = [...this.behaviors].sort(
      () => Math.random() - 0.5
    );

    for (let i = 0; i < count; i++) {
      const name =
        shuffledNames[i % shuffledNames.length] +
        (i > 4 ? ` ${Math.floor(i / 5) + 1}` : "");
      const behavior = shuffledBehaviors[i % shuffledBehaviors.length];

      const aiPlayer = new SmartAIPlayer(
        name,
        behavior,
        budget,
        roomBudget,
        totalPlayers
      );
      this.aiPlayers.push(aiPlayer);

      const availableTeams = ALL_TEAMS.filter(
        (team) => !Object.values(teamAssignments).includes(team)
      );
      if (availableTeams.length > 0) {
        const assignedTeam = availableTeams[0];
        teamAssignments[aiPlayer.name] = assignedTeam;
        aiPlayer.team = assignedTeam;
      }
    }

    console.log(`🔥 SMART AI INITIALIZED: ${count} players`);
    console.log(
      `🎯 AI Teams:`,
      this.aiPlayers.map((ai) => `${ai.name} (${ai.behavior})`)
    );

    return this.aiPlayers;
  }

  // ENHANCED: Update AI players with all available data
  updateAIPlayersWithAuctionData(availablePlayers, allTeamsData) {
    this.aiPlayers.forEach((aiPlayer) => {
      aiPlayer.updateAvailablePlayers(availablePlayers);
      aiPlayer.updateAllTeamsData(allTeamsData);
    });
    console.log(
      `🎯 Updated ${this.aiPlayers.length} AI players with ${
        availablePlayers.length
      } players and ${Object.keys(allTeamsData).length} teams data`
    );
  }

  getAIPlayers() {
    return this.aiPlayers;
  }

  getAIPlayerByName(name) {
    return this.aiPlayers.find((ai) => ai.name === name);
  }

  async processAIBids(
    player,
    currentBid,
    highestBidder,
    teamAssignments,
    roomState
  ) {
    const bids = [];

    // SIMPLE ELIGIBILITY CHECK
    const eligibleAIPlayers = this.aiPlayers.filter((ai) => {
      return (
        ai.name !== highestBidder &&
        ai.remainingBudget > currentBid + 0.05 &&
        !ai.isTeamComplete()
      );
    });

    console.log(`\n🎯 PROCESSING BIDS for ${player.name} at ₹${currentBid}Cr`);
    console.log(`🤖 ${eligibleAIPlayers.length} eligible AI bidders`);

    // PROCESS ALL ELIGIBLE AIs
    for (const aiPlayer of eligibleAIPlayers) {
      try {
        const bidDecision = await aiPlayer.makeBidDecisionWrapper(
          player,
          currentBid,
          teamAssignments,
          roomState
        );

        if (bidDecision) {
          console.log(`✅ ${aiPlayer.name} BID: ₹${bidDecision.bidAmount}Cr`);
          bids.push(bidDecision);
        }
      } catch (error) {
        console.error(`Bid error for ${aiPlayer.name}:`, error);
      }
    }

    // RETURN HIGHEST BID ONLY
    if (bids.length > 0) {
      bids.sort((a, b) => b.bidAmount - a.bidAmount);
      const highestBid = bids[0];
      console.log(
        `🔥 HIGHEST BID: ${highestBid.username} - ₹${highestBid.bidAmount}Cr`
      );
      return [highestBid];
    }

    console.log(`❌ NO AI BIDS for ${player.name}`);
    return [];
  }

  updateAIOnWin(aiName, player, price) {
    const aiPlayer = this.getAIPlayerByName(aiName);
    if (aiPlayer) {
      aiPlayer.addPlayer(player, price);
    }
  }

  getAIStatus() {
    return this.aiPlayers.map((ai) => ai.getTeamStatus());
  }

  areAllTeamsComplete() {
    return this.aiPlayers.every((ai) => ai.isTeamComplete());
  }
}

module.exports = { SmartAIManager, SmartAIPlayer };
