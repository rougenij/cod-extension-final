const API_BASE = "https://cod-extension.netlify.app";
let authToken = null;
let channelId = null;
let currentConfig = {
  overlayEnabled: true,
  refreshInterval: 30,
};

// DOM elements
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const configForm = document.getElementById("configForm");
const connectionStatus = document.getElementById("connectionStatus");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const errorMessage = document.getElementById("errorMessage");
const retryBtn = document.getElementById("retryBtn");

// Form elements
const overlayEnabledInput = document.getElementById("overlayEnabled");
const refreshIntervalSelect = document.getElementById("refreshInterval");
const channelIdValue = document.getElementById("channelIdValue");
const backendStatus = document.getElementById("backendStatus");
const backendDot = document.getElementById("backendDot");
const backendStatusText = document.getElementById("backendStatusText");
const loadoutCount = document.getElementById("loadoutCount");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const saveSpinner = document.getElementById("saveSpinner");
const saveStatus = document.getElementById("saveStatus");
const saveMessage = document.getElementById("saveMessage");

// Initialize Twitch Extension
function initializeTwitchExtension() {
  if (window.Twitch && window.Twitch.ext) {
    window.Twitch.ext.onAuthorized((auth) => {
      authToken = auth.token;
      channelId = auth.channelId;

      console.log("Config Page Authorized:", { channelId });
      updateConnectionStatus("connected", "Connected to Twitch");

      // Update channel info
      channelIdValue.textContent = channelId || "Unknown";

      // Load configuration and test backend
      loadConfiguration();
      testBackendConnection();
    });

    window.Twitch.ext.onContext((context) => {
      console.log("Twitch Context:", context);
    });
  } else {
    console.error("Twitch Extension Helper not available");
    updateConnectionStatus("error", "Twitch Helper Error");
    showError("Twitch Extension Helper not loaded");
  }
}

// Update connection status
function updateConnectionStatus(status, text) {
  statusText.textContent = text;
  statusDot.className = `status-dot ${status}`;
}

// Update backend status
function updateBackendStatus(status, text) {
  backendStatusText.textContent = text;
  backendDot.className = `backend-dot ${status}`;
}

// Show loading state
function showLoading() {
  loadingState.style.display = "flex";
  errorState.style.display = "none";
  configForm.style.display = "none";
}

// Show error state
function showError(message) {
  errorMessage.textContent = message;
  loadingState.style.display = "none";
  errorState.style.display = "flex";
  configForm.style.display = "none";
}

// Show config form
function showConfigForm() {
  loadingState.style.display = "none";
  errorState.style.display = "none";
  configForm.style.display = "grid";
}

// Test backend connection
async function testBackendConnection() {
  try {
    updateBackendStatus("", "Testing...");

    const response = await fetch(`${API_BASE}/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      updateBackendStatus("connected", "Connected");

      // Try to get loadout count
      if (channelId) {
        getLoadoutCount();
      }
    } else {
      updateBackendStatus("error", `Error ${response.status}`);
    }
  } catch (error) {
    console.error("Backend connection test failed:", error);
    updateBackendStatus("error", "Connection Failed");
  }
}

// Get loadout count for the channel
async function getLoadoutCount() {
  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/api/loadouts/${channelId}`, {
      method: "GET",
      headers: headers,
    });

    if (response.ok) {
      const loadouts = await response.json();
      // Convert object to array if needed for counting
      let loadoutArray = loadouts;
      if (
        loadouts &&
        typeof loadouts === "object" &&
        !Array.isArray(loadouts)
      ) {
        loadoutArray = Object.values(loadouts);
      }
      loadoutCount.textContent = loadoutArray ? loadoutArray.length : 0;
    } else {
      loadoutCount.textContent = "2 (Test Data)";
    }
  } catch (error) {
    console.error("Failed to get loadout count:", error);
    loadoutCount.textContent = "2 (Test Data)";
  }
}

// Load configuration from API
async function loadConfiguration() {
  if (!channelId) {
    showError("Channel ID not available");
    return;
  }

  try {
    showLoading();

    // Try to load config from API
    const config = await fetchConfiguration(channelId, authToken);

    if (config) {
      currentConfig = { ...currentConfig, ...config };
    }

    // Update form with current config
    updateFormFromConfig();
    showConfigForm();
  } catch (error) {
    console.error("Error loading configuration:", error);

    // If config API is not available, use defaults and show form
    updateFormFromConfig();
    showConfigForm();

    // Show a warning about config API
    showSaveStatus(
      "Config API not available yet. Settings will be stored locally.",
      "error"
    );
  }
}

// Fetch configuration from API
async function fetchConfiguration(channelId, token) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/config/${channelId}`, {
    method: "GET",
    headers: headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Config doesn't exist yet, use defaults
      return null;
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Save configuration to API
async function saveConfiguration(channelId, token, config) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/config/${channelId}`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Update form inputs from current config
function updateFormFromConfig() {
  overlayEnabledInput.checked = currentConfig.overlayEnabled;
  refreshIntervalSelect.value = currentConfig.refreshInterval.toString();
}

// Update config from form inputs
function updateConfigFromForm() {
  currentConfig.overlayEnabled = overlayEnabledInput.checked;
  currentConfig.refreshInterval = parseInt(refreshIntervalSelect.value);
}

// Save configuration
async function handleSaveConfiguration() {
  if (!channelId) {
    showSaveStatus("Channel ID not available", "error");
    return;
  }

  try {
    // Show saving state
    saveBtn.disabled = true;
    saveSpinner.style.display = "inline-block";
    document.querySelector(".btn-text").textContent = "Saving...";

    // Update config from form
    updateConfigFromForm();

    // Try to save to API
    await saveConfiguration(channelId, authToken, currentConfig);

    showSaveStatus("Configuration saved successfully!", "success");
  } catch (error) {
    console.error("Error saving configuration:", error);

    // If API is not available, save locally
    localStorage.setItem(
      `cod-extension-config-${channelId}`,
      JSON.stringify(currentConfig)
    );
    showSaveStatus("Configuration saved locally (API not available)", "error");
  } finally {
    // Reset button state
    saveBtn.disabled = false;
    saveSpinner.style.display = "none";
    document.querySelector(".btn-text").textContent = "Save Configuration";
  }
}

// Show save status message
function showSaveStatus(message, type) {
  saveMessage.textContent = message;
  saveStatus.className = `save-status ${type}`;
  saveStatus.style.display = "block";

  // Hide after 5 seconds
  setTimeout(() => {
    saveStatus.style.display = "none";
  }, 5000);
}

// Handle test connection
async function handleTestConnection() {
  testBtn.disabled = true;
  testBtn.textContent = "Testing...";

  try {
    await testBackendConnection();
    showSaveStatus("Backend connection test completed", "success");
  } catch (error) {
    showSaveStatus("Backend connection test failed", "error");
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test Connection";
  }
}

// Event listeners
retryBtn.addEventListener("click", () => {
  loadConfiguration();
});

saveBtn.addEventListener("click", handleSaveConfiguration);
testBtn.addEventListener("click", handleTestConnection);

// Form change listeners
overlayEnabledInput.addEventListener("change", () => {
  // Visual feedback that settings have changed
  saveBtn.style.background = "linear-gradient(45deg, #ffc107, #ff9800)";
  setTimeout(() => {
    saveBtn.style.background = "linear-gradient(45deg, #00e5ff, #0099cc)";
  }, 200);
});

refreshIntervalSelect.addEventListener("change", () => {
  // Visual feedback that settings have changed
  saveBtn.style.background = "linear-gradient(45deg, #ffc107, #ff9800)";
  setTimeout(() => {
    saveBtn.style.background = "linear-gradient(45deg, #00e5ff, #0099cc)";
  }, 200);
});

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeTwitchExtension();
});

// Load saved config from localStorage if API is not available
function loadLocalConfig() {
  if (channelId) {
    const saved = localStorage.getItem(`cod-extension-config-${channelId}`);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        currentConfig = { ...currentConfig, ...config };
      } catch (error) {
        console.error("Error parsing saved config:", error);
      }
    }
  }
}
