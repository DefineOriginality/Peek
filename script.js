const ver = "v1.1.0";

// too lazy to edit formulas from copy-paste so that's what this thing does
const pow = Math.pow;

// thanks to dan63 for providing formulas
function calcPlaystyle(apm, pps, vs) {
    // base calcs
    const vsapm = vs / apm;
    const app = apm / (pps * 60);
    const dss = (vs / 100) - (apm / 60); // ds per second
    const dsp = dss / pps; // ds per piece
    const gbe = ((app * dss) / pps) * 2; // garbage eff
    // stat rank calcs
    const srarea = (pps * 135) + (app * 290) + (dsp * 700);
    const statrank = 11.2 * Math.atan((srarea - 93) / 130) + 1;
    // normalized stats
    const nmapm = ((apm / srarea) / ((0.069 * pow(1.0017, (pow(statrank, 5) / 4700))) + statrank / 360)) - 1;
    const nmpps = ((pps / srarea) / (0.0084264 * pow(2.14, (-2 * (statrank / 2.7 + 1.03))) - statrank / 5750 + 0.0067)) - 1;
    const nmapp = (app / (0.1368803292 * pow(1.0024, (pow(statrank, 5) / 2800)) + statrank / 54)) - 1;
    const nmdsp = (dsp / (0.02136327583 * pow(14, ((statrank - 14.75) / 3.9)) + statrank / 152 + 0.022)) - 1;
    const nmgbe = (gbe / (statrank / 350 + 0.005948424455 * pow(3.8, ((statrank - 6.1) / 4)) + 0.006)) - 1;
    const nmvsapm = (vsapm / (-pow(((statrank - 16) / 36), 2) + 2.133)) - 1;
    // playstyle formulas
    const opener = ((nmapm + nmpps * 0.75 + nmvsapm * -10 + nmapp * 0.75 + nmdsp * -0.25) / 3.5) + 0.5;
    const plonk = ((nmgbe + nmapp + nmdsp * 0.75 + nmpps * -1) / 2.73) + 0.5;
    const stride = ((nmapm * -0.25 + nmpps + nmapp * -2 + nmdsp * -0.5) * 0.79) + 0.5;
    const infds = ((nmdsp + nmapp * -0.75 + nmapm * 0.5 + nmvsapm * 1.5 + nmpps * 0.5) * 0.9) + 0.5;

    const playstyle = (opener >= plonk && opener >= stride && opener >= infds) ?
            "Opener Main" :
            (plonk >= opener && plonk >= stride && plonk >= infds) ?
            "Plonker" :
            (stride >= opener && stride >= plonk && stride >= infds) ?
            "Strider" :
            (infds >= opener && infds >= plonk && infds >= stride) ?
            "Inf DSer" : "No Idea";

    return {playstyle, opener, plonk, stride, infds};
}

let latestPlaystyleStats;

function displayAdvancedStats() {
    const advanced = document.getElementById("advanced-stats");
    const shouldShow = document.getElementById("show-advanced").checked && latestPlaystyleStats;

    advanced.hidden = !shouldShow;
    advanced.textContent = shouldShow
        ? `Opener: ${latestPlaystyleStats.opener} | Plonk: ${latestPlaystyleStats.plonk} | Stride: ${latestPlaystyleStats.stride} | Inf DS: ${latestPlaystyleStats.infds}`
        : "";
}

async function getPlaystyle(user) {
    const out = document.getElementById("playstyle");
    latestPlaystyleStats = undefined;
    displayAdvancedStats();

    if (user.length < 3) {
        return;
    }

    out.textContent = "Loading opponent playstyle...";

    try {
        const result = await chrome.runtime.sendMessage(
            {
                type: "get-league-summary",
                user: user
            }
        );

        if (!result?.ok) {
            throw new Error(result?.error || "Could not load the player summary.");
        }
        const apm = result.summary?.data?.apm;
        if (apm == null) {
            out.textContent = `Cannot find ${user}'s stats. Are you sure they are ranked?`;
        } else {
            // built-in stats
            const pps = result.summary?.data?.pps;
            const vs = result.summary?.data?.vs;
            const playstyleStats = calcPlaystyle(apm, pps, vs);
            latestPlaystyleStats = playstyleStats;
            displayAdvancedStats();
            out.textContent = `Playstyle: ${playstyleStats.playstyle}`;
            return playstyleStats.playstyle;
        }
    } catch (error) {
        out.textContent = `Error: ${error.message}`;
        return;
    }
}

async function oppPlaystyles(user, oppStyle) {
    //result["data"]["entries"][index]["results"]["leaderboard"][0]["stats"]
    const out = document.getElementById("opponent");
    out.textContent = "Loading their recent game information...";
    var wins = {"Opener Main": 0, "Plonker": 0, "Strider": 0, "Inf DSer": 0, "No Idea": 0};
    var losses = {"Opener Main": 0, "Plonker": 0, "Strider": 0, "Inf DSer": 0, "No Idea": 0};

    const suggestions = {
        "Opener Main": "Utilize the Opener Phase to cancel 2x garbage with your first 14 pieces.",
        "Plonker": "Don't try to counterspike them; you may not be able to keep up.",
        "Strider": "Take their attacks as they come and try to send it all back.",
        "Inf DSer": "Build up surge or upstack a large spike so they can't downstack."
    };
    const win_suggestions = {
        "Opener Main": "Build surge or otherwise avoid using clean openers in case of a counterspike.",
        "Plonker": "Don't try to catch them off guard; you may not be able to keep up.",
        "Strider": "Slow down, don't send too much clean garbage.",
        "Inf DSer": "Don't play cheese race with them, they are likely good at surge or sudden spiking."
    };
    const lose_suggestions = {
        "Opener Main": "Use high-damage kill openers like SDPC to overwhelm them quickly.",
        "Plonker": "Time your attacks and try to counterspike them after they exhaust their stack.",
        "Strider": "Speed up! They may not be good at countering lots of clean garbage.",
        "Inf DSer": "Stamina is likely not their strength, try to drag the game out into midgame."
    };
    
    try {
        const result = await chrome.runtime.sendMessage(
            {
                type: "get-tl-opps",
                user: user
            }
        );

        if (!result?.ok) {
            throw new Error(result?.error || "Could not load the player summary.");
        }
        //const games = result.data?.entries;
        const games = result.summary?.data?.entries;
        if (!games || games.length === 0 || games == null) {
            out.textContent = `No recent games found for ${user}.`;
            return;
        } else {
            out.textContent = "Calculating playstyle based on recent games...";
            for (const game of games) {
                const winner = game?.results?.leaderboard?.[0]?.username;
                const won = (winner?.toLowerCase() === user.toLowerCase()) ? 1 : 0;
                const oppStats = game?.results?.leaderboard?.[won]?.stats;
                if (!oppStats) {
                    continue;
                }
                const playstyle = calcPlaystyle(oppStats.apm, oppStats.pps, oppStats.vsscore).playstyle;
                if (won === 1) {
                    wins[playstyle]++;
                } else {
                    losses[playstyle]++;
                }
            }
            var names = {"Opener Main": "opener mains", "Plonker": "plonkers", "Strider": "striders", "Inf DSer": "inf DSers"};
            var winStyles = [];
            var lossStyles = [];
            var tips = [];
            if (suggestions[oppStyle]) {
                tips.push(suggestions[oppStyle]);
            }
            for (const style in names) {
                if (wins[style] > losses[style]) {
                    winStyles.push(names[style]);
                    tips.push(win_suggestions[style]);
                }
                if (losses[style] > wins[style]) {
                    lossStyles.push(names[style]);
                    tips.push(lose_suggestions[style]);
                }
            }
            var text = [];
            if (winStyles.length > 0) text.push(`Wins against ${winStyles.join(", ")}`);
            if (lossStyles.length > 0) text.push(`Loses against ${lossStyles.join(", ")}`);
            out.textContent = text.length > 0 ? text.join(", ") : "No clear matchup trends found.";
            document.getElementById("suggestion").textContent = `Suggestions (beta): ${tips.length > 0 ? tips.join(" ") : "No suggestions for now."}`;
        }
    } catch (error) {
        out.textContent = `Error: ${error.message}`;
    }
}

async function showVersionStatus() {
    const versioning = document.getElementById("versioning");
    versioning.textContent = "";

    try {
        const response = await fetch("https://defineoriginality.github.io/peek_ver.json");
        if (!response.ok) {
            throw new Error(`Version check failed: ${response.status}`);
        }

        const verInfo = await response.json();
        const latestVersion = verInfo?.latest?.version;
        const latestLink = verInfo?.latest?.link;

        if (!verInfo?.accepted?.includes(ver) && typeof latestVersion === "string" && latestVersion && typeof latestLink === "string" && latestLink) {
            outdated = true;
            versioning.append("Your version is outdated! Download ", latestVersion, " ");
            const link = document.createElement("a");
            link.href = latestLink;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "here.";
            versioning.append(link);
            return verInfo?.latest?.important;
        }
    } catch (error) { return false; }
}

document.getElementById("footer").insertAdjacentHTML("afterbegin", ver+".");

document.getElementById("fetch").onclick = async function() {
    if (await showVersionStatus()) { alert("A new critical patch is available. You'll still be able to use Peek, but you'll see this message every time. Please update at your earliest convenience."); }
    const username = document.getElementById("user").value.trim().toLowerCase();
    const playstyle = await getPlaystyle(username);
    await oppPlaystyles(username, playstyle);
};

const input = document.getElementById("user");
document.getElementById("show-advanced").addEventListener("change", displayAdvancedStats);
input.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("fetch").click();
    }
});
