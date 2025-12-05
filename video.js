const API_BASE = "https://cod-extension.netlify.app";
let authToken = null;
let channelId = null;
let refreshInterval = null;
let loadouts = [];
let currentLoadoutIndex = 0;
let isExpanded = true;

// DOM elements
const overlayWidget = document.getElementById("overlayWidget");
const widgetContent = document.getElementById("widgetContent");
const loadingOverlay = document.getElementById("loadingOverlay");
const errorOverlay = document.getElementById("errorOverlay");
const loadoutContent = document.getElementById("loadoutContent");
const loadoutTitle = document.getElementById("loadoutTitle");
const loadoutCounter = document.getElementById("loadoutCounter");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const toggleBtn = document.getElementById("toggleBtn");
const retryBtn = document.getElementById("retryBtn");

// Weapon elements
const primaryIcon = document.getElementById("primaryIcon");
const primaryName = document.getElementById("primaryName");
const primaryCategory = document.getElementById("primaryCategory");
const keyAttachment = document.getElementById("keyAttachment");
const keyAttachmentValue = document.getElementById("keyAttachmentValue");
const secondaryName = document.getElementById("secondaryName");
const tacticalName = document.getElementById("tacticalName");
const lethalName = document.getElementById("lethalName");

// Initialize Twitch Extension
function initializeTwitchExtension() {
  if (window.Twitch && window.Twitch.ext) {
    window.Twitch.ext.onAuthorized((auth) => {
      authToken = auth.token;
      channelId = auth.channelId;

      console.log("Video Overlay Authorized:", { channelId });

      // Start loading loadouts
      loadLoadouts();

      // Set up auto-refresh (30 seconds)
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      refreshInterval = setInterval(loadLoadouts, 30000);
    });

    window.Twitch.ext.onContext((context) => {
      console.log("Twitch Context:", context);
    });

    window.Twitch.ext.onVisibilityChanged((isVisible) => {
      console.log("Video Overlay Visibility:", isVisible);
      if (isVisible && channelId) {
        loadLoadouts();
      }
    });
  } else {
    console.error("Twitch Extension Helper not available");
    showError();
  }
}

// Show loading state
function showLoading() {
  loadingOverlay.style.display = "flex";
  errorOverlay.style.display = "none";
  loadoutContent.style.display = "none";
}

// Show error state
function showError() {
  loadingOverlay.style.display = "none";
  errorOverlay.style.display = "flex";
  loadoutContent.style.display = "none";
}

// Show loadout content
function showContent() {
  loadingOverlay.style.display = "none";
  errorOverlay.style.display = "none";
  loadoutContent.style.display = "block";
}

// Fetch loadouts from API
async function fetchLoadouts(channelId, token) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/streamer/${channelId}/loadouts`, {
    method: "GET",
    headers: headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Load and display loadouts
async function loadLoadouts() {
  if (!channelId) {
    showError();
    return;
  }

  try {
    showLoading();
    const fetchedLoadouts = await fetchLoadouts(channelId, authToken);

    if (!fetchedLoadouts || fetchedLoadouts.length === 0) {
      loadouts = [];
      showNoLoadouts();
      return;
    }

    loadouts = fetchedLoadouts.slice(0, 5); // Limit to 5 loadouts
    currentLoadoutIndex = Math.min(currentLoadoutIndex, loadouts.length - 1);

    updateLoadoutDisplay();
    updateNavigationButtons();
    showContent();
  } catch (error) {
    console.error("Error loading loadouts:", error);
    showError();
  }
}

// Show no loadouts state
function showNoLoadouts() {
  loadoutTitle.textContent = "No Loadouts";
  loadoutCounter.textContent = "0/0";
  primaryName.textContent = "No loadouts available";
  primaryCategory.textContent = "";
  secondaryName.textContent = "-";
  tacticalName.textContent = "-";
  lethalName.textContent = "-";
  primaryIcon.style.display = "none";
  keyAttachment.style.display = "none";

  updateNavigationButtons();
  showContent();
}

// Update the current loadout display
function updateLoadoutDisplay() {
  if (!loadouts || loadouts.length === 0) {
    showNoLoadouts();
    return;
  }

  const loadout = loadouts[currentLoadoutIndex];
  const loadoutNumber = currentLoadoutIndex + 1;

  // Update header
  loadoutTitle.textContent = loadout.name || `Loadout #${loadoutNumber}`;
  loadoutCounter.textContent = `${loadoutNumber}/${loadouts.length}`;

  // Update primary weapon
  const primary = loadout.primary || {};
  primaryName.textContent = primary.name || "None";
  primaryCategory.textContent = primary.category || "";

  // Update primary weapon icon
  if (primary.imageUrl) {
    primaryIcon.src = primary.imageUrl;
    primaryIcon.alt = primary.name || "Primary weapon";
    primaryIcon.style.display = "block";
    primaryIcon.onerror = () => {
      primaryIcon.style.display = "none";
    };
  } else {
    primaryIcon.style.display = "none";
  }

  // Update key attachment (show the first non-empty attachment)
  const attachments = primary.attachmentSlots || {};
  const keyAttachmentEntry = Object.entries(attachments).find(
    ([key, value]) => value && value !== "None"
  );

  if (keyAttachmentEntry) {
    keyAttachmentValue.textContent = keyAttachmentEntry[1];
    keyAttachment.style.display = "flex";
  } else {
    keyAttachment.style.display = "none";
  }

  // Update secondary info
  const secondary = loadout.secondary || {};
  secondaryName.textContent = secondary.name || "None";
  tacticalName.textContent = loadout.tactical || "None";
  lethalName.textContent = loadout.lethal || "None";
}

// Update navigation button states
function updateNavigationButtons() {
  const hasLoadouts = loadouts && loadouts.length > 0;
  const hasMultiple = loadouts && loadouts.length > 1;

  prevBtn.disabled = !hasMultiple || currentLoadoutIndex === 0;
  nextBtn.disabled =
    !hasMultiple || currentLoadoutIndex === loadouts.length - 1;

  if (!hasLoadouts) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }
}

// Navigate to previous loadout
function navigatePrevious() {
  if (currentLoadoutIndex > 0) {
    currentLoadoutIndex--;
    updateLoadoutDisplay();
    updateNavigationButtons();
  }
}

// Navigate to next loadout
function navigateNext() {
  if (currentLoadoutIndex < loadouts.length - 1) {
    currentLoadoutIndex++;
    updateLoadoutDisplay();
    updateNavigationButtons();
  }
}

// Toggle expand/collapse
function toggleExpanded() {
  isExpanded = !isExpanded;

  if (isExpanded) {
    widgetContent.classList.remove("collapsed");
    toggleBtn.classList.remove("collapsed");
    toggleBtn.textContent = "▼";
    toggleBtn.title = "Collapse";
  } else {
    widgetContent.classList.add("collapsed");
    toggleBtn.classList.add("collapsed");
    toggleBtn.textContent = "▲";
    toggleBtn.title = "Expand";
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (typeof text !== "string") return text;
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
prevBtn.addEventListener("click", navigatePrevious);
nextBtn.addEventListener("click", navigateNext);
toggleBtn.addEventListener("click", toggleExpanded);
retryBtn.addEventListener("click", loadLoadouts);

// Keyboard navigation
document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
    return; // Don't interfere with form inputs
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      navigatePrevious();
      break;
    case "ArrowRight":
      event.preventDefault();
      navigateNext();
      break;
    case " ":
    case "Enter":
      event.preventDefault();
      toggleExpanded();
      break;
  }
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
