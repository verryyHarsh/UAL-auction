class RatingRandomizer {
  constructor() {
    this.baseRatings = {}; // Store original ratings
    this.currentRatings = {}; // Store randomized ratings
    this.sessionId = Date.now(); // Unique ID for this game session
  }

  // Extract base ratings from player data
  extractBaseRatings(players) {
    players.forEach((player) => {
      this.baseRatings[player.name] = player.rating;
    });
    console.log(`📊 Extracted base ratings for ${players.length} players`);
  }

  // Generate random rating for a player (±1 variation, whole numbers only)
  generateRandomRating(player) {
    const baseRating = this.baseRatings[player.name] || player.rating;

    // Generate random variation: -1, 0, or +1
    const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1

    // Calculate new rating
    let newRating = baseRating + variation;

    // Ensure rating stays within 1-10 range
    newRating = Math.max(1, Math.min(10, newRating));

    // Ensure it's a whole number
    newRating = Math.round(newRating);

    // Store for reference
    this.currentRatings[player.name] = {
      base: baseRating,
      new: newRating,
      variation: variation,
    };

    return newRating;
  }

  // Randomize all player ratings
  randomizePlayerRatings(players) {
    console.log(`🎲 Randomizing ratings for ${players.length} players...`);

    const randomizedPlayers = players.map((player) => {
      const newRating = this.generateRandomRating(player);

      return {
        ...player,
        rating: newRating,
        originalRating: this.baseRatings[player.name] || player.rating,
        sessionId: this.sessionId,
      };
    });

    // Log some examples of rating changes
    this.logRatingChanges(randomizedPlayers.slice(0, 10));

    return randomizedPlayers;
  }

  // Log some rating changes for transparency
  logRatingChanges(samplePlayers) {
    console.log("🎯 Sample Rating Changes:");
    samplePlayers.forEach((player) => {
      const original = this.baseRatings[player.name] || player.originalRating;
      const current = player.rating;
      const change = current - original;
      const changeSymbol = change > 0 ? "↑" : change < 0 ? "↓" : "=";

      console.log(
        `${player.name.padEnd(
          25
        )}: ${original} → ${current} ${changeSymbol}${Math.abs(change)}`
      );
    });

    // Calculate statistics
    const allChanges = Object.values(this.currentRatings);
    const increased = allChanges.filter((r) => r.variation > 0).length;
    const decreased = allChanges.filter((r) => r.variation < 0).length;
    const unchanged = allChanges.filter((r) => r.variation === 0).length;

    console.log(
      `📈 Rating Changes: ↑${increased}  ↓${decreased}  =${unchanged}`
    );
  }

  // Get rating statistics for display
  getRatingStats() {
    const allChanges = Object.values(this.currentRatings);
    const increased = allChanges.filter((r) => r.variation > 0).length;
    const decreased = allChanges.filter((r) => r.variation < 0).length;
    const unchanged = allChanges.filter((r) => r.variation === 0).length;

    return {
      total: allChanges.length,
      increased,
      decreased,
      unchanged,
      sessionId: this.sessionId,
    };
  }

  // Reset for new session
  reset() {
    this.baseRatings = {};
    this.currentRatings = {};
    this.sessionId = Date.now();
  }
}

module.exports = RatingRandomizer;
