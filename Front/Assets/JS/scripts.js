// scripts.js - UI interaction and display logic

import {
    fetchAllData,
    findRoutes,
    findConnectedRoutes,
    stopsData as importedStopsData,
    routesData as importedRoutesData,
    busesData as importedBusesData,
    routeStopsData as importedRouteStopsData,
    calculateArrivalTime
} from './dblink.js';

// Constants
const LOADING_MESSAGE = "Searching for routes...";
const NO_RESULTS_MESSAGE = "No routes found. Please try different stops.";
const DEBOUNCE_DELAY = 250;
const API_URL = "http://localhost:3000/api";

// DOM Elements
let icon, logo, bellIcon, container, menu, backdrop;
let currentState = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // DOM element references
    icon = document.querySelector(".icon");
    logo = document.querySelector(".logo");
    bellIcon = document.querySelector(".notification-icon");
    container = document.querySelector(".container");
    menu = document.getElementById("myLinks");
    backdrop = document.querySelector(".menu-backdrop");

    // Event listeners
    document.getElementById("LoginBtn").style.display = "none";
    document.getElementById("LoginBtn").addEventListener('click', () => {
        window.location.href = 'Assets/Login.html';
    });
    document.getElementById("menuToggle").addEventListener('click', toggleMenu);
    document.getElementById("notificationToggle").addEventListener('click', toggleNotifications);

    // Option Box Event Listeners
    setupBoxEventListeners();

    initializeDataAndUI();
    logo.addEventListener("click", redirectToHomePage);
});

function setupBoxEventListeners() {
    document.getElementById("privateBus").addEventListener('click', (event) => {
        handleBoxClick("privateBus", event);
    });
    document.getElementById("publicBus").addEventListener('click', (event) => {
        handleBoxClick("publicBus", event);
    });
    document.getElementById("travelAgency").addEventListener('click', (event) => {
        handleBoxClick("travelAgency", event);
    });
}

function handleBoxClick(boxId, event) {
    if (event.target.classList.contains('back-btn')) {
        collapseBox(event);
    } else if (!event.target.closest('.dropdown-container')) {
        expandSearchBox(document.getElementById(boxId));
    }

    if (boxId === "privateBus") {
        setupDropdown('loc-from', 'loc-from-options');
        setupDropdown('loc-to', 'loc-to-options');
        document.getElementById("search-btn").addEventListener('click', handleSearch);
    }
}

// --- Dropdown Functions ---
function setupDropdown(inputId, dropdownId) {
    const inputElement = document.getElementById(inputId);
    const dropdownElement = document.getElementById(dropdownId);

    inputElement.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdownElement.style.display = "block";
        loadStops(dropdownElement, inputElement);
    });

    document.addEventListener("click", (event) => {
        if (!inputElement.contains(event.target) && !dropdownElement.contains(event.target)) {
            dropdownElement.style.display = "none";
        }
    });
}
//Loads and populates stop data into a dropdown
function loadStops(dropdown, inputElement) {
    if (importedStopsData.length > 0) {
        populateDropdown(importedStopsData, dropdown, inputElement);
    } else {
        fetch(`${API_URL}/stops`)
            .then(response => response.json())
            .then(stops => {
                populateDropdown(stops, dropdown, inputElement);
            })
            .catch(error => console.error("Error fetching stops:", error));
    }
}

//Populates a dropdown with stop data
function populateDropdown(stops, dropdown, inputElement) {
    stops.sort((a, b) => a.stop_name.localeCompare(b.stop_name));
    dropdown.innerHTML = "";

    stops.forEach(stop => {
        const option = document.createElement("div");
        option.classList.add("dropdown-item");
        option.textContent = stop.stop_name;
        option.dataset.stopId = stop.stop_id;
        option.addEventListener("click", (event) => {
            event.stopPropagation();
            inputElement.value = stop.stop_name;
            inputElement.dataset.stopId = stop.stop_id;
            dropdown.style.display = "none";
            checkSearchButton();
        });
        dropdown.appendChild(option);
    });
}

//Enables or disables the search button based on stop selection
function checkSearchButton() {
    const fromStopId = document.getElementById("loc-from").dataset.stopId;
    const toStopId = document.getElementById("loc-to").dataset.stopId;
    const searchButton = document.getElementById("search-btn");
    searchButton.disabled = !(fromStopId && toStopId);
}

// --- handleSearch (NOW HANDLES BOTH DIRECT AND CONNECTED) ---
async function handleSearch() {
    const fromStopId = document.getElementById('loc-from').dataset.stopId;
    const toStopId = document.getElementById('loc-to').dataset.stopId;

    if (!fromStopId || !toStopId) {
        alert("Please select both 'From' and 'To' stops.");
        return;
    }

    // Clear previous results
    document.getElementById('direct-bus-data').innerHTML = '';
    document.getElementById('connected-bus-data').innerHTML = '';

    try {
        // 1. Try to find direct routes
        const directRoutes = await findRoutes(fromStopId, toStopId);
        displayBusResults(directRoutes, 'direct', fromStopId, toStopId);  // Display direct results

        // 2. If no direct routes, try to find connected routes
        if (directRoutes.length === 0) {
            const connectedRoutes = await findConnectedRoutes(fromStopId, toStopId);
             displayBusResults(connectedRoutes, 'connected', fromStopId, toStopId); // Display connected

            if(!connectedRoutes.length){
                displayNoResults();
            }
        }

    } catch (error) {
        console.error("Error during search:", error);
        alert("An error occurred during the search.");
    }
}

// --- Display Results (Modified to handle type and time) ---
function displayBusResults(buses, type, fromStopId, toStopId) {
    const containerId = type === 'direct' ? 'direct-bus-data' : 'connected-bus-data';
    const resultsContainer = document.getElementById(containerId);
    const title = type === 'direct' ? 'Direct Buses' : 'Connected Buses';

    resultsContainer.innerHTML = `<h3>${title}</h3>`;

    if (!buses || buses.length === 0) {
        resultsContainer.innerHTML += `<p>No ${type} routes found.</p>`;
        return;
    }

    buses.forEach(bus => {
        const route = importedRoutesData.find(route => route.route_id === bus.route_id);
        const arrivalTime = calculateArrivalTime(bus, fromStopId, toStopId); // Calculate arrival time
        const busDiv = document.createElement('div');
        busDiv.classList.add('bus-item');
        busDiv.innerHTML = `
            <p><strong>Bus:</strong> ${bus.bus_name} (${bus.direction})</p>
            <p><strong>Route:</strong> ${route ? route.route_name : 'Unknown Route'}</p>
            <p><strong>Departure Time:</strong> ${bus.time}</p>
            <p><strong>Arrival Time:</strong> ${arrivalTime}</p> <!-- Display arrival time -->
        `;
        resultsContainer.appendChild(busDiv);
    });
}

//Displays a message when no bus routes are found
function displayNoResults() {
    const direct = document.getElementById('direct-bus-data');
    const connected = document.getElementById('connected-bus-data')
    direct.innerHTML = `
        <div class="no-results">
            <p>No buses found.</p>
        </div>
    `;
    connected.innerHTML = `
        <div class="no-results">
            <p>No buses found.</p>
        </div>
    `;
}

// --- Option Handlers ---
function handlepublicBusClick(event) {
      if (event.target.classList.contains('back-btn')) {
            collapseBox(event);
        } else {
            expandSearchBox(document.getElementById("publicBus"));
        }
}

function handletravelAgencyClick(event) {
      if (event.target.classList.contains('back-btn')) {
            collapseBox(event);
        } else {
            expandSearchBox(document.getElementById("travelAgency"));
        }
}

// Combined Data Loading and UI Initialization
async function initializeDataAndUI() {
    try {
        await fetchAllData();
    } catch (error) {
        console.error("Error during initialization:", error);
    }
}

// --- Navigation and State Management ---

window.addEventListener('popstate', (event) => {
  switch (currentState) {
    case 'menu':      collapseMenu(); break;
    case 'searchBox': collapseBox(event); break;
    case 'notification': collapseNotifications(); break;
    default:          redirectToHomePage();
  }
});

function redirectToHomePage() {
    window.location.href = "#home";
    showheaderIcons();
    currentState = null;
      const expandedBox = document.querySelector(".box.expanded");
        if (expandedBox) {
            const mockEvent = { stopPropagation: () => {} };
            collapseBox(mockEvent);
        }

    history.replaceState({}, null, location.pathname);
}

// -------------------------------
// Menu and Overlay Controls
// -------------------------------
function toggleMenu() {
    currentState === 'menu' ? collapseMenu() : expandMenu();
}

function expandMenu() {
    container.classList.add("menu-open");
    backdrop.classList.add("menu-open");
    document.getElementById("LoginBtn").style.display = "block";
    menu.style.transform = "translateX(200px)";

    hideHeaderIcons();
    currentState = 'menu';
    history.pushState({ type: 'menu' }, null, "#menu");
}

function collapseMenu() {
    container.classList.remove("menu-open");
    backdrop.classList.remove("menu-open");
    document.getElementById("LoginBtn").style.display = "none";
    menu.style.transform = "translateX(0)";

    showheaderIcons();
    currentState = null;
    if (window.history.length > 1) {
        history.back();
    } else {
        window.location.href = "#home";
    }
}

// --- Expand and Collapse Functions for Search Boxes ---
function expandSearchBox(box) {
    hideHeaderIcons();
    const originalText = logo.textContent;
    logo.setAttribute("data-original-text", originalText);
    logo.innerHTML = `<i class="fa fa-arrow-left"></i> ${originalText}`;

    const rect = box.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const startTop = rect.top + scrollTop;
    const endTop = window.innerHeight * -0.03;

    box.dataset.originalTop = startTop;
    box.style.top = `${startTop}px`;

    box.classList.add("expanded");
    document.querySelector('.main').classList.add('box-expanded');
    document.body.classList.add('no-scroll');

    setTimeout(() => { box.style.top = `${endTop}px`; }, 10);
    setTimeout(() => {
        const searchInput = box.querySelector(".search-input");
        if (searchInput) searchInput.focus();
        const boxContent = box.querySelector('.box-content');
        if (boxContent) boxContent.style.opacity = 1;
    }, 500);

    currentState = 'searchBox';
    history.pushState({ type: 'searchBox' }, null, '#searchBox');
}

function collapseBox(event) {
    if (event) event.stopPropagation();

    const box = document.querySelector(".box.expanded");
    if (!box) return;

    const originalTop = parseFloat(box.dataset.originalTop) || 0;

    const boxContent = box.querySelector('.box-content');
    if (boxContent) boxContent.style.opacity = 0;

    box.style.top = `${originalTop}px`;

    setTimeout(() => {
        box.classList.remove("expanded");
        document.querySelector('.main').classList.remove('box-expanded');
        document.body.classList.remove('no-scroll');

        box.style.top = "";
        delete box.dataset.originalTop;
    }, 300);

    const fromInput = box.querySelector("#loc-from");
    const toInput = box.querySelector("#loc-to");
    if (fromInput) {
        fromInput.value = "";
        delete fromInput.dataset.stopId;
        const fromOptions = box.querySelector("#loc-from-options");
        if (fromOptions) fromOptions.style.display = "none";
    }
    if (toInput) {
        toInput.value = "";
        delete toInput.dataset.stopId;
        const toOptions = box.querySelector("#loc-to-options");
        if (toOptions) toOptions.style.display = "none";
    }

    const searchBtn = box.querySelector("#search-btn");
    if (searchBtn) searchBtn.disabled = true;

    showheaderIcons();
    const originalText = logo.getAttribute("data-original-text");
    if (originalText) logo.textContent = originalText;

    currentState = null;

    if (history.state && history.state.type === 'searchBox') {
        history.back();
    }
}

// -------------------------------
// Notification Handling
// -------------------------------
function toggleNotifications() {
    currentState === 'notification' ? collapseNotifications() : expandNotifications();
}

function expandNotifications() {
    const notificationsDiv = document.createElement('div');
    notificationsDiv.classList.add('notifications-div');
    notificationsDiv.id = 'notifications-content';
    notificationsDiv.innerHTML = `
        <div class="notifications-content">
            <h2>Notifications</h2>
            <p>No new notifications at this moment.</p>
        </div>
    `;
    document.body.appendChild(notificationsDiv);

    setTimeout(() => notificationsDiv.classList.add('visible'), 10);
     hideHeaderIcons();
    const originalText = logo.textContent;
    logo.setAttribute("data-original-text", originalText);
    logo.innerHTML = `<i class="fa fa-arrow-left"></i> ${originalText}`;

    currentState = 'notification';
    history.pushState({ type: 'notification' }, null, '#notification');
}

function collapseNotifications() {
    const notificationsDiv = document.getElementById('notifications-content');
    if (notificationsDiv) {
        notificationsDiv.classList.remove('visible');
        setTimeout(() => notificationsDiv.remove(), 300);
        showheaderIcons();

        const originalText = logo.getAttribute("data-original-text");
        if (originalText) logo.textContent = originalText;
    }
    currentState = null;
    if (window.history.length > 1) {
        history.back();
    } else {
        window.location.href = "#home";
    }
}

// -------------------------------
// Utility Functions
// -------------------------------
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

document.addEventListener("click", (event) => {
    if (container.classList.contains("menu-open") &&
        !menu.contains(event.target) &&
        !icon.contains(event.target)) {
        collapseMenu();
    }
});

function hideHeaderIcons() {
    icon.classList.add("hidden");
    logo.classList.add("hidden");
    bellIcon.classList.add("hidden");
    icon.classList.toggle("open");
}

function showheaderIcons() {
    icon.classList.remove("hidden");
    logo.classList.remove("hidden");
    bellIcon.classList.remove("hidden");
}