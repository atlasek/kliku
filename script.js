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
    autoClickers: 0
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
    // Pobieramy parametry po znaku '#' (Implicit Grant zwraca dane w hash)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    let accessToken = hashParams.get("access_token");

    if (accessToken) {
        // Zapisujemy otrzymany token w przeglądarce gracza
        localStorage.setItem("discord_clicker_token", accessToken);
        // Bezpieczne czyszczenie paska adresu z tokenu bez przeładowania routingu Netlify
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    } else {
        // Jeśli nie ma w URL, sprawdzamy czy gracz był już zalogowany wcześniej
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
        // Zapisujemy graczy w osobnym węźle w tej samej bazie danych
        userRef = db.ref("clicker_players/" + userId);
        
        // Aktualizacja podstawowych danych profilowych gracza w bazie
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
    // Słuchacz bazy w czasie rzeczywistym
    userRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data) {
            playerData.clicks = data.clicks || 0;
            playerData.clickPower = data.clickPower || 1;
            playerData.autoClickers = data.autoClickers || 0;
            renderGameUI();
        } else {
            // Pierwsze wejście nowego gracza do gry
            userRef.update({
                clicks: 0,
                clickPower: 1,
                autoClickers: 0
            });
        }
    });

    // Pętla Auto-Clickera działająca co sekundę
    setInterval(() => {
        if (playerData.autoClickers > 0 && userRef) {
            // Używamy transakcji dla zachowania bezpieczeństwa punktów
            userRef.child("clicks").transaction((currentClicks) => {
                return (currentClicks || 0) + playerData.autoClickers;
            });
        }
    }, 1000);
}

// Matematyczny algorytm skalowania kosztów ulepszeń (cena rośnie o 15% co poziom)
function getUpgradeCost(baseCost, count) {
    return Math.floor(baseCost * Math.pow(1.15, count));
}

function renderGameUI() {
    const scoreDisplay = document.getElementById("score-display");
    const cpsDisplay = document.getElementById("cps-display");
    
    // Elementy sklepu dla wersji EN
    const cost1El = document.getElementById("upgrade-1-cost");
    const count1El = document.getElementById("upgrade-1-count");
    const cost2El = document.getElementById("upgrade-2-cost");
    const count2El = document.getElementById("upgrade-2-count");

    // Elementy sklepu dla wersji PL
    const cost1PlEl = document.getElementById("upgrade-1-cost-pl");
    const count1PlEl = document.getElementById("upgrade-1-count-pl");
    const cost2PlEl = document.getElementById("upgrade-2-cost-pl");
    const count2PlEl = document.getElementById("upgrade-2-count-pl");

    if (scoreDisplay) scoreDisplay.textContent = playerData.clicks;
    if (cpsDisplay) cpsDisplay.textContent = playerData.autoClickers;

    // Obliczanie aktualnej ceny na podstawie poziomu ulepszenia
    const cost1 = getUpgradeCost(10, playerData.clickPower - 1);
    const cost2 = getUpgradeCost(50, playerData.autoClickers);
    const owned1 = playerData.clickPower - 1;
    const owned2 = playerData.autoClickers;

    // Renderowanie cen i poziomów dla wersji EN
    if (cost1El) cost1El.textContent = cost1;
    if (count1El) count1El.textContent = owned1;
    if (cost2El) cost2El.textContent = cost2;
    if (count2El) count2El.textContent = owned2;

    // Renderowanie cen i poziomów dla wersji PL (DODANE!)
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

    // Zmiana języka gry
    const langBtn = document.getElementById("game-lang-btn");
    if (langBtn) {
        langBtn.addEventListener("click", (e) => {
            e.preventDefault();
            currentLang = (currentLang === "en") ? "pl" : "en";
            updateLanguageUI();
        });
    }

    // Logowanie Discord (OAuth2)
    const loginBtn = document.getElementById("discord-login-btn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            // Wpisujemy sztywny adres URL, zakodowany dokładnie pod ustawienia bazy i Discorda
            const redirectUri = encodeURIComponent("https://klik.info-atlas.pl/");
            window.location.href = "https://discord.com/oauth2/authorize?client_id=1510567895212494930&response_type=code&redirect_uri=https%3A%2F%2Fklik.info-atlas.pl.&scope=identify";
        });
    }

    // Wylogowanie z gry
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("discord_clicker_token");
            if (userRef) userRef.off(); // Odpięcie nasłuchiwania bazy danych
            window.location.reload();
        });
    }

    // Klikanie w cel (Liska) - zabezpieczone transakcją
    const clickTarget = document.getElementById("game-click-target");
    if (clickTarget) {
        clickTarget.addEventListener("click", () => {
            if (!userRef) return;
            
            // Bezpieczna inkrementacja klików
            userRef.child("clicks").transaction((currentClicks) => {
                return (currentClicks || 0) + playerData.clickPower;
            });
            
            // Efekt squish (zgodny z czasem 0.12s w Twoim CSS)
            clickTarget.classList.add("squish-effect");
            setTimeout(() => {
                clickTarget.classList.remove("squish-effect");
            }, 120);
        });
    }

    // SKLEP: Kupowanie siły kliknięcia (Upgrade 1) - Zabezpieczone transakcją
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
                alert(currentLang === "pl" ? "Masz za mało punktów!" : "Not enough points!");
            }
        });
    }

    // SKLEP: Kupowanie Auto-Clickera (Upgrade 2) - Zabezpieczone transakcją
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
                alert(currentLang === "pl" ? "Masz za mało punktów!" : "Not enough points!");
            }
        });
    }
});
