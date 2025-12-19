const API_BASE = "https://cod-extension.netlify.app";
let authToken = null;
let channelId = null;
let refreshInterval = null;

// DOM elements
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const loadoutsContainer = document.getElementById("loadoutsContainer");
const loadoutTabs = document.getElementById("loadoutTabs");
const loadoutContent = document.getElementById("loadoutContent");
const statusIndicator = document.getElementById("statusIndicator");
const statusDot = statusIndicator.querySelector(".status-dot");
const statusText = statusIndicator.querySelector(".status-text");
const errorMessage = document.getElementById("errorMessage");
const retryBtn = document.getElementById("retryBtn");

// State
let currentLoadouts = [];
let activeLoadoutIndex = 0;

// Initialize Twitch Extension
function initializeTwitchExtension() {
  if (window.Twitch && window.Twitch.ext) {
    window.Twitch.ext.onAuthorized((auth) => {
      authToken = auth.token;
      channelId = auth.channelId;

      updateStatus("connected", "Connected");

      // Start loading loadouts
      loadLoadouts();

      // Auto-refresh disabled
    });

    window.Twitch.ext.onContext((context) => {});

    window.Twitch.ext.onVisibilityChanged((isVisible) => {
      if (isVisible && channelId) {
        loadLoadouts();
      }
    });
  } else {
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
  loadoutsContainer.style.display = "none";
}

// Show error state
function showError(message) {
  errorMessage.textContent = message;
  loadingState.style.display = "none";
  errorState.style.display = "flex";
  loadoutsContainer.style.display = "none";
  updateStatus("error", "Error");
}

// Show loadouts
function showLoadouts() {
  loadingState.style.display = "none";
  errorState.style.display = "none";
  loadoutsContainer.style.display = "block";
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
    const response = await fetch(`${API_BASE}/api/loadouts/${channelId}`, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      const data = await response.json();
      // Convert object to array if needed
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return Object.values(data);
      }
      return data;
    }
  } catch (error) {
    console.log("Primary endpoint failed, trying fallback...");
  }

  // Fallback: try getting streamer data and extract loadouts
  try {
    const response = await fetch(`${API_BASE}/api/loadouts/${channelId}`, {
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

  // No more fallbacks - streamers endpoint doesn't exist
  console.log("Primary and fallback endpoints failed");

  // If all endpoints fail, throw error to see what's happening
  console.log("All endpoints failed");
  throw new Error(
    `All API endpoints failed for channel ${channelId}. Check console for details.`
  );
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

    currentLoadouts = loadouts.slice(0, 5); // Store up to 5 loadouts
    renderTabbedLoadouts(currentLoadouts);
    showLoadouts();
  } catch (error) {
    console.error("Error loading loadouts:", error);
    showError(`Failed to load loadouts: ${error.message}`);
  }
}

// Show no loadouts message
function showNoLoadouts() {
  loadoutTabs.innerHTML = "";
  loadoutContent.innerHTML = `
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

  const attachments = weapon.attachments || weapon.attachmentSlots || {};
  const attachmentList = Object.entries(attachments)
    .filter(([key, value]) => value && value !== "None")
    .map(([key, value]) => {
      // Handle both string values and object values with name property
      const attachmentName =
        typeof value === "string" ? value : value?.name || "Unknown";
      return `<span class="attachment">${escapeHtml(attachmentName)}</span>`;
    })
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

// Render tabbed loadouts interface
function renderTabbedLoadouts(loadouts) {
  if (!loadouts || loadouts.length === 0) {
    showNoLoadouts();
    return;
  }

  // Render tabs
  loadoutTabs.innerHTML = "";
  loadouts.forEach((loadout, index) => {
    const tab = document.createElement("div");
    tab.className = `loadout-tab ${
      index === activeLoadoutIndex ? "active" : ""
    }`;
    tab.textContent = loadout.name || `Loadout ${index + 1}`;
    tab.addEventListener("click", () => switchToLoadout(index));
    loadoutTabs.appendChild(tab);
  });

  // Render active loadout content
  renderActiveLoadout();
}

// Switch to a specific loadout tab
function switchToLoadout(index) {
  if (index < 0 || index >= currentLoadouts.length) return;

  activeLoadoutIndex = index;

  // Update tab states
  const tabs = loadoutTabs.querySelectorAll(".loadout-tab");
  tabs.forEach((tab, i) => {
    tab.classList.toggle("active", i === index);
  });

  // Render new content
  renderActiveLoadout();
}

// Render the currently active loadout
async function renderActiveLoadout() {
  if (!currentLoadouts[activeLoadoutIndex]) return;

  const loadout = currentLoadouts[activeLoadoutIndex];

  loadoutContent.innerHTML = `
    <div class="loadout-header">
      <div class="loadout-name">${escapeHtml(
        loadout.name || `Loadout ${activeLoadoutIndex + 1}`
      )}</div>
    </div>
    
    ${await renderWeaponSectionWithImage("Primary", loadout.primary)}
    ${await renderWeaponSectionWithImage("Secondary", loadout.secondary)}
    
    <div class="equipment-section">
      ${renderEquipmentItem("Tactical", loadout.tactical)}
      ${renderEquipmentItem("Lethal", loadout.lethal)}
      ${renderEquipmentItem("Field Upgrade", loadout.fieldUpgrade)}
    </div>
    
    <div class="perks-section">
      <div class="perks-header">Perks</div>
      <div class="perks-list">
        ${renderPerksWithImages(loadout.perks)}
      </div>
    </div>
  `;
}

// Render weapon section with image fetching - new layout: name, image, attachments
async function renderWeaponSectionWithImage(label, weapon) {
  if (!weapon || !weapon.name) {
    return `
      <div class="weapon-section">
        <div class="weapon-header">${label}</div>
        <div class="weapon-name">None</div>
      </div>
    `;
  }

  // Use the imageUrl from the backend data (already full URLs from Supabase)
  // Only use imageUrl if it's a valid full URL (not a relative path like "default.png")
  let imageUrl = weapon.imageUrl || weapon.image;
  if (imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = null; // Ignore invalid/relative paths
  }

  const attachments = weapon.attachments || weapon.attachmentSlots || {};
  const attachmentList = Object.entries(attachments)
    .filter(([key, value]) => value && value !== "None")
    .map(([key, value]) => {
      const attachmentName =
        typeof value === "string" ? value : value?.name || "Unknown";
      return `
        <div class="attachment-item">
          <span class="attachment-slot">${escapeHtml(key)}:</span>
          <span class="attachment">${escapeHtml(attachmentName)}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="weapon-section">
      <div class="weapon-header">${label}</div>
      <div class="weapon-name-large">${escapeHtml(weapon.name)}</div>
      <div class="weapon-category">${escapeHtml(
        weapon.category || "Unknown"
      )}</div>
      ${
        imageUrl
          ? `<div class="weapon-image-container">
              <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(
              weapon.name
            )}" class="weapon-image-large" onerror="this.parentElement.style.display='none'">
            </div>`
          : ""
      }
      ${
        attachmentList
          ? `<div class="attachments-list">${attachmentList}</div>`
          : ""
      }
    </div>
  `;
}

// Helper function to extract name from equipment object or string
function getEquipmentName(equipment) {
  if (!equipment) return "None";
  if (typeof equipment === "string") return equipment;
  if (typeof equipment === "object" && equipment.name) return equipment.name;
  return "None";
}

// Helper function to format perks array
function formatPerks(perks) {
  if (!perks || !Array.isArray(perks)) return "";

  return perks
    .map((perk) => {
      let perkName = "Unknown Perk";
      if (typeof perk === "string") {
        perkName = perk;
      } else if (typeof perk === "object" && perk.name) {
        perkName = perk.name;
      }
      return `<span class="perk">${escapeHtml(perkName)}</span>`;
    })
    .join("");
}

// Render equipment item with optional image
function renderEquipmentItem(label, equipment) {
  const name = getEquipmentName(equipment);
  let imageUrl = null;

  if (equipment && typeof equipment === "object" && equipment.imageUrl) {
    imageUrl = equipment.imageUrl;
    if (imageUrl && !imageUrl.startsWith("http")) {
      imageUrl = null;
    }
  }

  return `
    <div class="equipment-item">
      <div class="equipment-label">${escapeHtml(label)}</div>
      ${
        imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(
              name
            )}" class="equipment-image" onerror="this.style.display='none'">`
          : ""
      }
      <div class="equipment-name">${escapeHtml(name)}</div>
    </div>
  `;
}

// Render perks with optional images
function renderPerksWithImages(perks) {
  if (!perks || !Array.isArray(perks)) return "";

  return perks
    .map((perk) => {
      let perkName = "Unknown Perk";
      let imageUrl = null;

      if (typeof perk === "string") {
        perkName = perk;
      } else if (typeof perk === "object" && perk) {
        perkName = perk.name || "Unknown Perk";
        imageUrl = perk.imageUrl;
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = null;
        }
      }

      return `
        <div class="perk-item">
          ${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(
                  perkName
                )}" class="perk-image" onerror="this.style.display='none'">`
              : ""
          }
          <span class="perk">${escapeHtml(perkName)}</span>
        </div>
      `;
    })
    .join("");
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
