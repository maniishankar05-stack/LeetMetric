const API_BASE_URL = "https://alfa-leetcode-api.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    const usernameInput = document.getElementById("username");
    const fetchBtn = document.getElementById("fetchBtn");
    const statsDiv = document.getElementById("stats");
    const statsCard = document.querySelector(".statscard");

    const circles = {
        easy: document.querySelector(".easy-progress"),
        medium: document.querySelector(".medium-progress"),
        hard: document.querySelector(".hard-progress")
    };

    const labels = {
        easy: document.getElementById("easy-label"),
        medium: document.getElementById("medium-label"),
        hard: document.getElementById("hard-label")
    };

    resetDashboard();

    fetchBtn.addEventListener("click", fetchLeetCodeStats);
    usernameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            fetchLeetCodeStats();
        }
    });

    async function fetchLeetCodeStats() {
        const username = usernameInput.value.trim();

        if (!username) {
            showMessage("Please enter a valid LeetCode username.", true);
            return;
        }

        setLoading(true);
        showMessage(`Fetching stats for ${escapeHtml(username)}...`);

        try {
            const profile = await getApiData(`/${username}/profile`);
            const data = normalizeLeetCodeData({ username, profile });

            if (!data.username && !data.totalSolved) {
                throw new Error("User not found or API returned no profile data.");
            }

            renderDashboard(data);
        } catch (error) {
            console.error("LeetCode API error:", error);
            resetDashboard();
            showMessage(error.message || "Unable to fetch LeetCode stats. Please try again.", true);
        } finally {
            setLoading(false);
        }
    }

    async function getApiData(endpoint) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            throw new Error(getApiErrorMessage(data) || `API request failed with status ${response.status}.`);
        }

        if (data.errors || data.error) {
            throw new Error(data.message || data.error || "API returned an error.");
        }

        if (typeof data === "string") {
            throw new Error(getApiErrorMessage(data) || data || "API returned an invalid response.");
        }

        return data;
    }

    function normalizeLeetCodeData(raw) {
        const profile = unwrap(raw.profile);

        return {
            username: pick(profile, "username", "matchedUser.username", "user.username") || raw.username,
            realName: pick(profile, "name", "realName", "profile.realName", "matchedUser.profile.realName"),
            avatar: pick(profile, "avatar", "userAvatar", "profile.userAvatar", "matchedUser.profile.userAvatar"),
            ranking: pick(profile, "ranking", "profile.ranking", "matchedUser.profile.ranking"),
            reputation: pick(profile, "reputation", "profile.reputation", "matchedUser.profile.reputation"),
            totalSolved: toNumber(pick(profile, "solvedProblem", "totalSolved", "submitStats.acSubmissionNum.0.count", "matchedUser.submitStats.acSubmissionNum.0.count")),
            totalQuestions: toNumber(pick(profile, "totalQuestions", "allQuestionsCount.0.count")),
            easySolved: toNumber(pick(profile, "easySolved", "easy.solved", "submitStats.acSubmissionNum.1.count", "matchedUser.submitStats.acSubmissionNum.1.count")),
            totalEasy: toNumber(pick(profile, "totalEasy", "easy.total", "allQuestionsCount.1.count")),
            mediumSolved: toNumber(pick(profile, "mediumSolved", "medium.solved", "submitStats.acSubmissionNum.2.count", "matchedUser.submitStats.acSubmissionNum.2.count")),
            totalMedium: toNumber(pick(profile, "totalMedium", "medium.total", "allQuestionsCount.2.count")),
            hardSolved: toNumber(pick(profile, "hardSolved", "hard.solved", "submitStats.acSubmissionNum.3.count", "matchedUser.submitStats.acSubmissionNum.3.count")),
            totalHard: toNumber(pick(profile, "totalHard", "hard.total", "allQuestionsCount.3.count")),
            acceptanceRate: pick(profile, "acceptanceRate", "totalQuestionsAcceptanceRate"),
            contestRating: Math.round(toNumber(pick(profile, "contestRating", "rating", "userContestRanking.rating")) || 0),
            contestRank: pick(profile, "contestGlobalRanking", "globalRanking", "userContestRanking.globalRanking"),
            attendedContests: pick(profile, "contestAttend", "attendedContestsCount", "userContestRanking.attendedContestsCount"),
            badgeCount: pick(profile, "badgesCount", "badgeCount", "totalBadges", "matchedUser.badges.length"),
            recentBadge: pick(profile, "recentBadge.displayName", "recentBadges.0.displayName", "badges.0.displayName", "matchedUser.badges.0.displayName"),
            languages: toList(pick(profile, "matchedUser.languageProblemCount", "languageProblemCount")),
            submissions: toList(pick(profile, "submission", "recentSubmissions", "recentSubmissionList", "submissions"))
        };
    }

    function renderDashboard(data) {
        const totalSolved = formatNumber(data.totalSolved);
        const totalQuestions = data.totalQuestions ? ` / ${formatNumber(data.totalQuestions)}` : "";
        const acceptance = data.acceptanceRate
            ? String(data.acceptanceRate).includes("%") ? data.acceptanceRate : `${data.acceptanceRate}%`
            : null;

        showMessage(`
            <div class="profile-summary">
                ${data.avatar ? `<img class="avatar" src="${escapeHtml(data.avatar)}" alt="${escapeHtml(data.username)} avatar">` : ""}
                <div>
                    <h2>${escapeHtml(data.realName || data.username)}</h2>
                    <p>@${escapeHtml(data.username)}</p>
                    <strong>${totalSolved}${totalQuestions} solved</strong>
                </div>
            </div>
        `);

        updateCircle("easy", data.easySolved, data.totalEasy, "#22c55e");
        updateCircle("medium", data.mediumSolved, data.totalMedium, "#f59e0b");
        updateCircle("hard", data.hardSolved, data.totalHard, "#ef4444");

        statsCard.innerHTML = `
            ${statCard("Ranking", data.ranking)}
            ${statCard("Acceptance", acceptance)}
            ${statCard("Reputation", data.reputation)}
            ${statCard("Contest Rating", data.contestRating || null)}
            ${statCard("Contest Rank", data.contestRank)}
            ${statCard("Contests", data.attendedContests)}
            ${statCard("Badges", data.badgeCount)}
            ${statCard("Recent Badge", data.recentBadge)}
            ${listCard("Languages", data.languages, (language) => {
                const name = language.languageName || language.language || language.name;
                const count = language.problemsSolved || language.count || language.solved;
                return `${escapeHtml(name || "Unknown")} - ${formatNumber(count)}`;
            })}
            ${listCard("Recent Submissions", data.submissions, (submission) => {
                const title = submission.title || submission.titleSlug || submission.questionTitle;
                const status = submission.statusDisplay || submission.status || submission.lang;
                return `${escapeHtml(title || "Submission")} - ${escapeHtml(status || "Viewed")}`;
            })}
        `;
    }

    function updateCircle(type, solved, total, color) {
        const safeSolved = toNumber(solved);
        const safeTotal = toNumber(total);
        const progress = safeTotal ? Math.min((safeSolved / safeTotal) * 100, 100) : 0;

        circles[type].style.setProperty("--progress-degree", `${progress}%`);
        circles[type].style.setProperty("--progress-color", color);
        labels[type].innerHTML = `
            ${capitalize(type)}
            <small>${formatNumber(safeSolved)}${safeTotal ? `/${formatNumber(safeTotal)}` : ""}</small>
        `;
    }

    function statCard(label, value) {
        return `
            <div class="info-card">
                <span>${escapeHtml(label)}</span>
                <strong>${value || value === 0 ? escapeHtml(formatNumber(value)) : "N/A"}</strong>
            </div>
        `;
    }

    function listCard(title, items, formatter) {
        const visibleItems = items.slice(0, 5);

        if (!visibleItems.length) {
            return statCard(title, null);
        }

        return `
            <div class="info-card list-card">
                <span>${escapeHtml(title)}</span>
                <ul>
                    ${visibleItems.map((item) => `<li>${formatter(item)}</li>`).join("")}
                </ul>
            </div>
        `;
    }

    function resetDashboard() {
        updateCircle("easy", 0, 0, "#22c55e");
        updateCircle("medium", 0, 0, "#f59e0b");
        updateCircle("hard", 0, 0, "#ef4444");

        if (statsCard) {
            statsCard.innerHTML = "";
        }
    }

    function showMessage(message, isError = false) {
        statsDiv.className = isError ? "message error" : "message";
        statsDiv.innerHTML = message;
    }

    function setLoading(isLoading) {
        fetchBtn.disabled = isLoading;
        fetchBtn.textContent = isLoading ? "Fetching..." : "Fetch Stats";
    }
});

function unwrap(value) {
    if (!value || typeof value !== "object") {
        return value;
    }

    return value.data && typeof value.data === "object" ? value.data : value;
}

function pick(source, ...paths) {
    for (const path of paths) {
        const value = path.split(".").reduce((current, key) => current?.[key], source);

        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }

    return null;
}

function toList(value) {
    return Array.isArray(value) ? value : [];
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
    if (value === null || value === undefined || value === "") {
        return "N/A";
    }

    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("en-IN") : String(value);
}

function getApiErrorMessage(data) {
    const message = typeof data === "string" ? data : data?.message || data?.error;

    if (!message) {
        return "";
    }

    if (message.toLowerCase().includes("too many request")) {
        return "The API rate limit was reached. Please try again later.";
    }

    return message;
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
