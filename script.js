/* ============================================
    Obsługa przełączania języka
   ============================================ */
let currentLang = localStorage.getItem("game_lang") || "en";

function updateLanguageUI() {
    document.body.classList.remove("lang-pl", "lang-en");
    document.body.classList.add(`lang-${currentLang}`);
}

updateLanguageUI();

document.addEventListener("DOMContentLoaded", () => {
    const langBtn = document.getElementById("game-lang-btn");
    if (langBtn) {
        langBtn.addEventListener("click", () => {
            currentLang = (currentLang === "en") ? "pl" : "en";
            localStorage.setItem("game_lang", currentLang);
            updateLanguageUI();
        });
    }
});
/* ============================================
   Obsługa kliknięcia w cel gry
   ============================================ */
const clickTarget = document.getElementById("game-click-target");

clickTarget.addEventListener("click", () => {
    playerData.clicks += playerData.clickPower;
    userRef.child("clicks").set(playerData.clicks);
    
    clickTarget.classList.add("squish-effect");
    
    setTimeout(() => {
        clickTarget.classList.remove("squish-effect");
    }, 150);
});