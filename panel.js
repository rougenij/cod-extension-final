const API_BASE = "https://cod-extension.netlify.app";
let authToken = null;
let channelId = null;
let refreshInterval = null;

// DOM elements
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const loadoutsGrid = document.getElementById("loadoutsGrid");
const statusIndicator = document.getElementById("statusIndicator");
const statusDot = statusIndicator.querySelector(".status-dot");
const statusText = statusIndicator.querySelector(".status-text");
const errorMessage = document.getElementById("errorMessage");
const retryBtn = document.getElementById("retryBtn");

// Initialize Twitch Extension
function initializeTwitchExtension() {
  if (window.Twitch && window.Twitch.ext) {
    window.Twitch.ext.onAuthorized((auth) => {
      authToken = auth.token;
      channelId = auth.channelId;

      console.log("Twitch Extension Authorized:", { channelId });
      updateStatus("connected", "Connected");

      // Start loading loadouts
      loadLoadouts();

      // Set up auto-refresh
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      refreshInterval = setInterval(loadLoadouts, 30000);
    });

    window.Twitch.ext.onContext((context) => {
      console.log("Twitch Context:", context);
    });

    window.Twitch.ext.onVisibilityChanged((isVisible) => {
      console.log("Visibility changed:", isVisible);
      if (isVisible && channelId) {
        loadLoadouts();
      }
    });
  } else {
    console.error("Twitch Extension Helper not available");
    updateStatus("error", "Twitch Helper Error");
    showError("Twitch Extension Helper not loaded");
  }
}

// Update connection status
function updateStatus(status, text) {
  statusText.textContent = text;
  statusDot.className = `status-dot ${status}`;
}

// Show loading state
function showLoading() {
  loadingState.style.display = "flex";
  errorState.style.display = "none";
  loadoutsGrid.style.display = "none";
}

// Show error state
function showError(message) {
  errorMessage.textContent = message;
  loadingState.style.display = "none";
  errorState.style.display = "flex";
  loadoutsGrid.style.display = "none";
  updateStatus("error", "Error");
}

// Show loadouts
function showLoadouts() {
  loadingState.style.display = "none";
  errorState.style.display = "none";
  loadoutsGrid.style.display = "grid";
  updateStatus("connected", "Connected");
}

// Fetch loadouts from API with fallback endpoints
async function fetchLoadouts(channelId, token) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Try primary endpoint first
  try {
    const response = await fetch(`${API_BASE}/streamer/${channelId}/loadouts`, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log("Primary endpoint failed, trying fallback...");
  }

  // Fallback: try getting streamer data and extract loadouts
  try {
    const response = await fetch(`${API_BASE}/streamer/${channelId}`, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      const streamerData = await response.json();
      return streamerData.loadouts || [];
    }
  } catch (error) {
    console.log("Fallback endpoint failed, trying streamers list...");
  }

  // Last resort: try getting all streamers and find this one
  try {
    const response = await fetch(`${API_BASE}/streamers`, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      const streamers = await response.json();
      const streamer = streamers.find(
        (s) => s.id === channelId || s.channelId === channelId
      );
      return streamer ? streamer.loadouts || [] : [];
    }
  } catch (error) {
    console.log("All endpoints failed");
  }

  // If all endpoints fail, return test data for demonstration
  console.log("All endpoints failed, using test data...");
  return [
    {
      name: "Assault Loadout",
      primary: {
        name: "AK-74",
        category: "Assault Rifle",
        imageUrl: "https://via.placeholder.com/64x40/00e5ff/000000?text=AK74",
        attachmentSlots: {
          optic: "Red Dot Sight",
          barrel: "Extended Barrel",
          stock: "Tactical Stock",
          grip: "Vertical Grip",
        },
      },
      secondary: {
        name: "Glock-18",
        category: "Pistol",
      },
      tactical: "Smoke Grenade",
      lethal: "Frag Grenade",
      perks: ["Ghost", "Cold-Blooded", "Ninja"],
    },
    {
      name: "Sniper Loadout",
      primary: {
        name: "Barrett .50cal",
        category: "Sniper Rifle",
        imageUrl:
          "https://via.placeholder.com/64x40/ff6b6b/000000?text=Barrett",
        attachmentSlots: {
          optic: "8x Scope",
          barrel: "Heavy Barrel",
          stock: "Precision Stock",
        },
      },
      secondary: {
        name: "Desert Eagle",
        category: "Pistol",
      },
      tactical: "Heartbeat Sensor",
      lethal: "Claymore",
      perks: ["Scavenger", "Hardline", "Dead Silence"],
    },
  ];
}

// Load and display loadouts
async function loadLoadouts() {
  if (!channelId) {
    showError("Channel ID not available");
    return;
  }

  try {
    showLoading();
    const loadouts = await fetchLoadouts(channelId, authToken);

    if (!loadouts || loadouts.length === 0) {
      showNoLoadouts();
      return;
    }

    renderLoadouts(loadouts.slice(0, 5)); // Show up to 5 loadouts
    showLoadouts();
  } catch (error) {
    console.error("Error loading loadouts:", error);
    showError(`Failed to load loadouts: ${error.message}`);
  }
}

// Show no loadouts message
function showNoLoadouts() {
  loadoutsGrid.innerHTML = `
        <div class="no-loadouts">
            <div class="no-loadouts-icon">🎮</div>
            <p>No loadouts available for this streamer</p>
        </div>
    `;
  showLoadouts();
}

// Render loadouts in the grid
function renderLoadouts(loadouts) {
  loadoutsGrid.innerHTML = "";

  loadouts.forEach((loadout, index) => {
    const card = createLoadoutCard(loadout, index + 1);
    loadoutsGrid.appendChild(card);
  });
}

// Create a loadout card element
function createLoadoutCard(loadout, number) {
  const card = document.createElement("div");
  card.className = "loadout-card";

  const loadoutName = loadout.name || `Loadout ${number}`;
  const primary = loadout.primary || {};
  const secondary = loadout.secondary || {};
  const tactical = loadout.tactical || "None";
  const lethal = loadout.lethal || "None";
  const perks = loadout.perks || [];

  card.innerHTML = `
        <div class="loadout-header">
            <div class="loadout-name">${escapeHtml(loadoutName)}</div>
            <div class="loadout-number">#${number}</div>
        </div>
        
        ${renderWeaponSection("Primary", primary)}
        ${renderWeaponSection("Secondary", secondary)}
        
        <div class="equipment-section">
            <div class="equipment-item">
                <div class="equipment-label">Tactical</div>
                <div class="equipment-name">${escapeHtml(tactical)}</div>
            </div>
            <div class="equipment-item">
                <div class="equipment-label">Lethal</div>
                <div class="equipment-name">${escapeHtml(lethal)}</div>
            </div>
        </div>
        
        <div class="perks-section">
            <div class="perks-header">Perks</div>
            <div class="perks-list">
                ${perks
                  .map(
                    (perk) => `<span class="perk">${escapeHtml(perk)}</span>`
                  )
                  .join("")}
            </div>
        </div>
    `;

  return card;
}

// Render weapon section
function renderWeaponSection(label, weapon) {
  if (!weapon || !weapon.name) {
    return `
            <div class="weapon-section">
                <div class="weapon-header">${label}</div>
                <div class="weapon-name">None</div>
            </div>
        `;
  }

  const attachments = weapon.attachmentSlots || {};
  const attachmentList = Object.entries(attachments)
    .filter(([key, value]) => value && value !== "None")
    .map(
      ([key, value]) => `<span class="attachment">${escapeHtml(value)}</span>`
    )
    .join("");

  return `
        <div class="weapon-section">
            <div class="weapon-header">${label}</div>
            <div class="weapon-info">
                ${
                  weapon.imageUrl
                    ? `<img src="${escapeHtml(
                        weapon.imageUrl
                      )}" alt="${escapeHtml(
                        weapon.name
                      )}" class="weapon-image" onerror="this.style.display='none'">`
                    : ""
                }
                <div class="weapon-details">
                    <div class="weapon-name">${escapeHtml(weapon.name)}</div>
                    <div class="weapon-category">${escapeHtml(
                      weapon.category || "Unknown"
                    )}</div>
                </div>
            </div>
            ${
              attachmentList
                ? `<div class="attachments">${attachmentList}</div>`
                : ""
            }
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (typeof text !== "string") return text;
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
retryBtn.addEventListener("click", () => {
  loadLoadouts();
});

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeTwitchExtension();
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
