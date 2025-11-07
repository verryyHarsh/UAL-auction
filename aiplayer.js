// fixed-aiplayer.js - Smart Aggressive Bidding AI
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

    this.teamComposition = {
      BAT: { required: 3, current: 0, priority: 0.95 },
      "BAT WK": { required: 1, current: 0, priority: 1.0 },
      ALL: { required: 1, current: 0, priority: 1.0 },
      FBOWL: { required: 2, current: 0, priority: 0.9 },
      SPIN: { required: 2, current: 0, priority: 0.9 },
      "UC-BAT": { required: 0, current: 0, priority: 0.4 },
      "UC-ALL": { required: 0, current: 0, priority: 0.5 },
      "UC-BOWL": { required: 0, current: 0, priority: 0.3 },
      "UC-SPIN": { required: 0, current: 0, priority: 0.3 },
    };

    this.remainingSlots = 11;
    this.auctionPhase = "early";
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
    // Maximum % of budget to spend on one player
    const percents = {
      aggressive: 0.25, // 25% max
      strategic: 0.2, // 20% max
      balanced: 0.18, // 18% max
    };
    return percents[this.behavior] || 0.2;
  }

  calculateBidChance() {
    // Chance to bid on a player (0-1)
    const chances = {
      aggressive: 0.8, // 80% chance to bid
      strategic: 0.6, // 60% chance
      balanced: 0.5, // 50% chance
    };
    return chances[this.behavior] || 0.6;
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

  getRemainingRequirements() {
    const requirements = {};
    Object.keys(this.teamComposition).forEach((role) => {
      const remaining =
        this.teamComposition[role].required -
        this.teamComposition[role].current;
      if (remaining > 0) {
        requirements[role] = {
          count: remaining,
          priority: this.teamComposition[role].priority,
        };
      }
    });
    return requirements;
  }

  isCriticalRole(role) {
    const remainingReqs = this.getRemainingRequirements();
    return (
      ["BAT WK", "ALL"].includes(role) ||
      (remainingReqs[role] && remainingReqs[role].count === 1)
    );
  }

  calculatePlayerValue(player, currentBid) {
    const basePrice = parseFloat(player.basePrice) || 0.2;
    const rating = Math.min(10, Math.max(0, parseFloat(player.rating) || 6.0));
    const remainingReqs = this.getRemainingRequirements();
    const isRequired = !!remainingReqs[player.role];
    const isCritical = this.isCriticalRole(player.role);

    // SMART VALUE CALCULATION WITH BUDGET AWARENESS
    let value = Math.max(basePrice * 1.5, 0.3);

    // Rating multiplier
    const ratingMultiplier = 0.9 + (rating / 10) * 1.2;

    // Role multiplier
    let roleMultiplier = 1;
    if (isRequired) {
      const rolePriority = remainingReqs[player.role].priority || 1;
      roleMultiplier = isCritical ? 2.5 * rolePriority : 2.0 * rolePriority;
    }

    // Behavior multiplier
    let behaviorMultiplier = this.aggressionLevel;

    value = value * ratingMultiplier * roleMultiplier * behaviorMultiplier;

    // SMART BUDGET CAP - Never exceed reasonable limits
    const absoluteMaxBid = this.budget * this.maxBidPercent;
    const slotsLeft = Math.max(1, this.remainingSlots);
    const avgPerSlot = this.remainingBudget / slotsLeft;
    const reasonableMax = avgPerSlot * 2.5; // Don't spend more than 2.5x average per slot

    const finalValue = Math.min(
      value,
      absoluteMaxBid,
      reasonableMax,
      this.remainingBudget
    );

    console.log(
      `🎯 ${this.name} values ${player.name} at ₹${finalValue.toFixed(
        2
      )}Cr (Max allowed: ₹${absoluteMaxBid.toFixed(2)}Cr)`
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

    const playerValue = this.calculatePlayerValue(player, currentBid);
    const remainingReqs = this.getRemainingRequirements();
    const isRequired = !!remainingReqs[player.role];

    console.log(
      `🤖 ${this.name} evaluating ${
        player.name
      }: Current ₹${currentBid}Cr, My Value ₹${playerValue.toFixed(
        2
      )}Cr, Required: ${isRequired}`
    );

    // DECISION MAKING - Simple and effective
    const shouldBid = this.makeBidDecision(
      player,
      currentBid,
      playerValue,
      isRequired
    );

    if (shouldBid) {
      const bidAmount = this.calculateNextBid(currentBid, player.basePrice);

      // FINAL SAFETY CHECK - Never bid more than our calculated value
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

  makeBidDecision(player, currentBid, playerValue, isRequired) {
    // ALWAYS BID if we can get a good deal
    if (currentBid < playerValue * 0.7) {
      return true;
    }

    // BID on required players up to 90% of our value
    if (isRequired && currentBid < playerValue * 0.9) {
      return true;
    }

    // RANDOM BID for auction activity (but within limits)
    const randomBid = Math.random() < this.bidChance;
    if (randomBid && currentBid < playerValue * 0.8) {
      return true;
    }

    return false;
  }

  async makeBidDecisionWrapper(player, currentBid, teamAssignments, roomState) {
    try {
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

  getBidReasoning(player, bidAmount) {
    const remainingReqs = this.getRemainingRequirements();
    const isRequired = !!remainingReqs[player.role];
    const rating = parseFloat(player.rating) || 6.0;

    if (rating >= 8.5) return "STAR PLAYER";
    if (isRequired) return "TEAM NEED";
    return "GOOD VALUE";
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
      )}Cr | Slots: ${this.remainingSlots}`
    );
  }

  isTeamComplete() {
    this.updateTeamComposition();
    return this.players.length >= 11;
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
    };
  }
}

class SmartAIManager {
  constructor() {
    this.aiPlayers = [];
    // More aggressive distribution
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
