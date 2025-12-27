document.addEventListener("DOMContentLoaded", () => {
  fetch("/recent-matches")
    .then(res => res.json())
    .then(matches => {
      const container = document.getElementById("leaderboard");
      if (!container) return;

      if (matches.length === 0) {
        container.innerHTML += "<p>No matches played yet.</p>";
        return;
      }

      matches.forEach((match, index) => {
        const div = document.createElement("div");
        div.style.marginBottom = "1.5rem";
        div.style.padding = "1rem";
        div.style.border = "1px solid #ddd";
        div.style.borderRadius = "10px";

        div.innerHTML = `
          <h4>${index + 1}. Room ${match.roomCode}</h4>
          <small>${new Date(match.date).toLocaleString()}</small>
          <ol>
            ${match.leaderboard.slice(0,3).map(team =>
              `<li>${team.teamName} — Rating: ${team.totalRating}</li>`
            ).join("")}
          </ol>
        `;
        container.appendChild(div);
      });
    })
    .catch(err => {
      console.error("Leaderboard load failed", err);
    });
});
