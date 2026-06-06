// ==========================================================================
// CONFIGURATION (Skopiowane z Twojej głównej bazy)
// ==========================================================================
const DISCORD_CLIENT_ID = "1510567895212494930"; 

const firebaseConfig = {
    databaseURL: "https://atlas-71678-default-rtdb.europe-west1.firebasedatabase.app/"
};

// Bezpieczna inicjalizacja bazy v8
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

/* ==========================================================================
   STAN GRY I ZMIENNE GLOBALNE
   ========================================================================== */
let currentLang = localStorage.getItem("currentLang") || localStorage.getItem("site-lang") || "en";

let playerData = {
    clicks: 0,
    clickPower: 1,
    autoClickers: 0,
    level: 1,
    exp: 0
};

let userRef = null;
let userId = null;

/* ==========================================================================
   JĘZYK (Dostosowany do klas body, które przesłałeś w CSS)
   ========================================================================== */
function updateLanguageUI() {
    if (currentLang === "pl") {
        document.body.classList.add("lang-pl");
        document.body.classList.remove("lang-en");
    } else {
        document.body.classList.remove("lang-pl");
        document.body.classList.add("lang-en");
    }
    localStorage.setItem("currentLang", currentLang);
    localStorage.setItem("site-lang", currentLang);
}
updateLanguageUI();

/* ==========================================================================
   AUTORYZACJA DISCORD (DLA GRACZY VIA OAUTH2)
   ========================================================================== */
function checkDiscordAuth() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    let accessToken = hashParams.get("access_token");

    const queryParams = new URLSearchParams(window.location.search);
    const authCode = queryParams.get("code");

    if (accessToken) {
        localStorage.setItem("discord_clicker_token", accessToken);
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    } else if (authCode) {
        localStorage.removeItem("discord_clicker_token");
        window.location.href = "https://discord.com/oauth2/authorize?client_id=1510567895212494930&response_type=token&scope=identify&redirect_uri=https%3A%2F%2Fklik.info-atlas.pl%2F";
        return;
    } else {
        accessToken = localStorage.getItem("discord_clicker_token");
    }

    if (accessToken) {
        fetchDiscordUserData(accessToken);
    } else {
        showView("login-view");
    }
}

function fetchDiscordUserData(token) {
    fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error("Sesja wygasła");
        return res.json();
    })
    .then(data => {
        userId = data.id;
        userRef = db.ref("clicker_players/" + userId);
        
        userRef.child("profile").set({
            username: data.username,
            avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png"
        });

        setupGameSync();
        showView("game-view");
        updateUserHeader(data);
    })
    .catch(err => {
        console.error("Discord Auth Error:", err);
        localStorage.removeItem("discord_clicker_token");
        showView("login-view");
    });
}

function updateUserHeader(data) {
    const nameEl = document.getElementById("user-name");
    const avatarEl = document.getElementById("user-avatar");
    if (nameEl) nameEl.textContent = data.username;
    if (avatarEl) {
        avatarEl.src = data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : "https://cdn.discordapp.com/embed/avatars/0.png";
    }
}

function showView(viewId) {
    const loginView = document.getElementById("login-view");
    const gameView = document.getElementById("game-view");
    if (loginView && gameView) {
        if (viewId === "game-view") {
            loginView.style.display = "none";
            gameView.style.display = "block";
            
            const clickTarget = document.getElementById("game-click-target");
            if (clickTarget) {
                clickTarget.src = "./lisu1.png";
            }
        } else {
            loginView.style.display = "block";
            gameView.style.display = "none";
        }
    }
}

/* ==========================================================================
   MECHANIKA GRY (ZAPIS I SYNCHRONIZACJA Z BAZĄ)
   ========================================================================== */
function setupGameSync() {
    userRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data) {
            playerData.clicks = data.clicks || 0;
            playerData.clickPower = data.clickPower || 1;
            playerData.autoClickers = data.autoClickers || 0;
            playerData.level = data.level || 1;
            playerData.exp = data.exp || 0;
            renderGameUI();
            updateLevelUI();
        } else {
            userRef.update({
                clicks: 0,
                clickPower: 1,
                autoClickers: 0,
                level: 1,
                exp: 0
            });
        }
    });

    setInterval(() => {
        if (playerData.autoClickers > 0 && userRef) {
            userRef.child("clicks").transaction((currentClicks) => {
                return (currentClicks || 0) + playerData.autoClickers;
            });
        }
    }, 1000);
}

function getUpgradeCost(baseCost, count) {
    return Math.floor(baseCost * Math.pow(1.15, count));
}

function renderGameUI() {
    const scoreDisplay = document.getElementById("score-display");
    const cpsDisplay = document.getElementById("cps-display");
    
    const cost1El = document.getElementById("upgrade-1-cost");
    const count1El = document.getElementById("upgrade-1-count");
    const cost2El = document.getElementById("upgrade-2-cost");
    const count2El = document.getElementById("upgrade-2-count");

    const cost1PlEl = document.getElementById("upgrade-1-cost-pl");
    const count1PlEl = document.getElementById("upgrade-1-count-pl");
    const cost2PlEl = document.getElementById("upgrade-2-cost-pl");
    const count2PlEl = document.getElementById("upgrade-2-count-pl");

    if (scoreDisplay) scoreDisplay.textContent = playerData.clicks;
    if (cpsDisplay) cpsDisplay.textContent = playerData.autoClickers;

    const cost1 = getUpgradeCost(10, playerData.clickPower - 1);
    const cost2 = getUpgradeCost(50, playerData.autoClickers);
    const owned1 = playerData.clickPower - 1;
    const owned2 = playerData.autoClickers;

    if (cost1El) cost1El.textContent = cost1;
    if (count1El) count1El.textContent = owned1;
    if (cost2El) cost2El.textContent = cost2;
    if (count2El) count2El.textContent = owned2;

    if (cost1PlEl) cost1PlEl.textContent = cost1;
    if (count1PlEl) count1PlEl.textContent = owned1;
    if (cost2PlEl) cost2PlEl.textContent = cost2;
    if (count2PlEl) count2PlEl.textContent = owned2;
}

/* ==========================================================================
   EVENT LISTENERS (ZDARZENIA DOM)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    checkDiscordAuth();

    const langBtn = document.getElementById("game-lang-btn");
    if (langBtn) {
        langBtn.addEventListener("click", (e) => {
            e.preventDefault();
            currentLang = (currentLang === "en") ? "pl" : "en";
            updateLanguageUI();
        });
    }

    const loginBtn = document.getElementById("discord-login-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            window.location.href = "https://discord.com/oauth2/authorize?client_id=1510567895212494930&response_type=token&scope=identify&redirect_uri=https%3A%2F%2Fklik.info-atlas.pl%2F";
        });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("discord_clicker_token");
            if (userRef) userRef.off(); 
            window.location.reload();
        });
    }

    // Klikanie w cel (Liska)
    const clickTarget = document.getElementById("game-click-target");
    if (clickTarget) {
        clickTarget.addEventListener("click", () => {
            if (!userRef) return;
            
            // 1. Zapis punktów w Firebase
            userRef.child("clicks").transaction((currentClicks) => {
                return (currentClicks || 0) + playerData.clickPower;
            });

            // 2. Dodawanie doświadczenia (EXP) z synchronizacją z bazą danych
            userRef.transaction((currentData) => {
                if (currentData) {
                    let level = currentData.level || 1;
                    let exp = (currentData.exp || 0) + 1; // 1 klik = 1 EXP
                    let required = Math.floor(100 * Math.pow(1.5, level - 1));

                    if (exp >= required) {
                        exp -= required;
                        level++;
                        
                        // NOWOŚĆ: Eleganckie powiadomienie o awansie zamiast okienka alert()
                        setTimeout(() => {
                            showNotification(
                                currentLang === "pl" ? `AWANS! Osiągnąłeś poziom ${level}! 🎉` : `LEVEL UP! You reached level ${level}! 🎉`, 
                                'success'
                            );
                        }, 50);
                    }
                    currentData.level = level;
                    currentData.exp = exp;
                }
                return currentData;
            });
            
            // Efekty graficzne klinięcia
            clickTarget.src = "./lisu2.png"; 
            clickTarget.classList.add("squish-effect");
            
            setTimeout(() => {
                clickTarget.src = "./lisu1.png"; 
                clickTarget.classList.remove("squish-effect");
            }, 120);
        });
    }

    // SKLEP: Kupowanie siły kliknięcia (Upgrade 1)
    const buyClickPowerBtn = document.getElementById("buy-click-power");
    if (buyClickPowerBtn) {
        buyClickPowerBtn.addEventListener("click", () => {
            if (!userRef) return;
            const cost = getUpgradeCost(10, playerData.clickPower - 1);
            
            if (playerData.clicks >= cost) {
                userRef.transaction((currentData) => {
                    if (currentData) {
                        const actualCost = getUpgradeCost(10, (currentData.clickPower || 1) - 1);
                        if ((currentData.clicks || 0) >= actualCost) {
                            currentData.clicks -= actualCost;
                            currentData.clickPower = (currentData.clickPower || 1) + 1;
                        }
                    }
                    return currentData;
                });
            } else {
                // NOWOŚĆ: Powiadomienie o braku punktów typu 'error'
                showNotification(
                    currentLang === "pl" ? "Masz za mało punktów! ❌" : "Not enough points! ❌", 
                    'error'
                );
            }
        });
    }

    // SKLEP: Kupowanie Auto-Clickera (Upgrade 2)
    const buyAutoClickerBtn = document.getElementById("buy-auto-clicker");
    if (buyAutoClickerBtn) {
        buyAutoClickerBtn.addEventListener("click", () => {
            if (!userRef) return;
            const cost = getUpgradeCost(50, playerData.autoClickers);
            
            if (playerData.clicks >= cost) {
                userRef.transaction((currentData) => {
                    if (currentData) {
                        const actualCost = getUpgradeCost(50, currentData.autoClickers || 0);
                        if ((currentData.clicks || 0) >= actualCost) {
                            currentData.clicks -= actualCost;
                            currentData.autoClickers = (currentData.autoClickers || 0) + 1;
                        }
                    }
                    return currentData;
                });
            } else {
                // NOWOŚĆ: Powiadomienie o braku punktów typu 'error'
                showNotification(
                    currentLang === "pl" ? "Masz za mało punktów! ❌" : "Not enough points! ❌", 
                    'error'
                );
            }
        });
    }
});

/* ==========================================================================
   SYSTEM POZIOMÓW I DOŚWIADCZENIA
   ========================================================================== */
function getRequiredExp(level) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
}

function updateLevelUI() {
    let requiredExp = getRequiredExp(playerData.level);
    let progressPercentage = (playerData.exp / requiredExp) * 100;
    
    const lvlEl = document.getElementById("player-level");
    const curExpEl = document.getElementById("current-exp");
    const reqExpEl = document.getElementById("required-exp");
    const barEl = document.getElementById("progress-bar-fill");

    if (lvlEl) lvlEl.innerText = playerData.level;
    if (curExpEl) curExpEl.innerText = playerData.exp;
    if (reqExpEl) reqExpEl.innerText = requiredExp;
    if (barEl) barEl.style.width = progressPercentage + "%";
}

/* ==========================================================================
   SYSTEM POWIADOMIEŃ 
   ========================================================================== */
function showNotification(message, type = 'success') {
    const container = document.getElementById("notification-container");
    if (!container) return;

    // Tworzymy mały prostokąt
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    // Dodajemy go do kontenera na ekranie
    container.appendChild(toast);

    // Po 3.2 sekundy usuwamy go całkowicie z kodu HTML
    setTimeout(() => {
        toast.remove();
    }, 3200);
}
