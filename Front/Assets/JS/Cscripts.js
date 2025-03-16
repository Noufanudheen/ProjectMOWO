// combined_script.js - Combined database interaction, UI logic, and route finding

// --- Constants ---
const API_URL = 'http://localhost:3000/api'; // Replace with your actual API URL
const STOPS_ENDPOINT = `${API_URL}/stops`;
const ROUTES_ENDPOINT = `${API_URL}/routes`;
const ROUTE_STOPS_ENDPOINT = `${API_URL}/route_stops`;
const BUSES_ENDPOINT = `${API_URL}/bus`;

const LOADING_MESSAGE = "Searching for routes...";
const NO_RESULTS_MESSAGE = "No routes found. Please try different stops.";
const DEBOUNCE_DELAY = 250; // Not currently used

// --- Data (to be populated from API) ---
let stopsData = [];
let routesData = [];
let busesData = [];
let routeStopsData = [];

// --- DOM Elements (populated after DOMContentLoaded) ---
let icon, logo, bellIcon, container, menu, backdrop;
let currentState = null;

// --- Database Interaction Functions ---

async function fetchAllData() {
    try {
        const [stopsResponse, routesResponse, busesResponse, routeStopsResponse] = await Promise.all([
            fetch(STOPS_ENDPOINT),
            fetch(ROUTES_ENDPOINT),
            fetch(BUSES_ENDPOINT),
            fetch(ROUTE_STOPS_ENDPOINT)
        ]);

        if (!stopsResponse.ok || !routesResponse.ok || !busesResponse.ok || !routeStopsResponse.ok) {
            throw new Error("Failed to fetch data from one or more endpoints.");
        }

        stopsData = await stopsResponse.json();
        routesData = await routesResponse.json();
        busesData = await busesResponse.json();
        routeStopsData = await routeStopsResponse.json();

        // Pre-sort routeStopsData by route_id and stop_order *once*.  This is an optimization.
        routeStopsData.sort((a, b) => {
            if (a.route_id !== b.route_id) {
                return a.route_id - b.route_id; // Sort by route_id first
            }
            return a.stop_order - b.stop_order; // Then by stop_order
        });

        console.log('Stops Data:', stopsData);
        console.log('Routes Data:', routesData);
        console.log('Buses Data:', busesData);
        console.log('Route Stops Data:', routeStopsData);

    } catch (error) {
        console.error("Error fetching all data:", error);
        alert("Failed to load data. Please check your internet connection.");
        throw error; // Re-throw the error
    }
}

// --- findRoutes (Direct Route) - Correct and Efficient ---
async function findRoutes(fromStopId, toStopId) {
    console.log('findRoutes (direct) called:', fromStopId, toStopId);

    const fromStopRoutes = routeStopsData.filter(rs => rs.stop_id === parseInt(fromStopId)); //parseInt to make sure it's int
    const toStopRoutes = routeStopsData.filter(rs => rs.stop_id === parseInt(toStopId));

    const directRoutes = [];

    for (const fromRs of fromStopRoutes) {
        for (const toRs of toStopRoutes) {
            if (fromRs.route_id === toRs.route_id) { // Same route!
                const buses = getBusesOnRoute(fromRs.route_id);
                for (const bus of buses) {
                    // Check direction *and* stop order.  This is the key.
                    if (bus.direction === "Direct" && fromRs.stop_order < toRs.stop_order) {
                        directRoutes.push(bus);
                    } else if (bus.direction === "Reverse" && fromRs.stop_order > toRs.stop_order) {
                        directRoutes.push(bus);
                    }
                }
            }
        }
    }
    console.log("directRoutes", directRoutes)
    return directRoutes; // Returns an array of *bus* objects
}

// --- findConnectedRoutes (BFS, Time-Based) - Correct and Optimized ---
async function findConnectedRoutes(fromStopId, toStopId) {
    console.log(`Finding connected routes from ${fromStopId} to ${toStopId}`);

    // Initialize queue with the starting stop.  `path` will store the route sequence.
    const queue = [{ stopId: parseInt(fromStopId), routeId: null, path: [], totalTime: 0 }];
    const visitedStops = new Set(); // Keep track of visited stops/
    visitedStops.add(parseInt(fromStopId)); // Use number

    while (queue.length > 0) {
        const { stopId, routeId, path, totalTime } = queue.shift(); // Dequeue

        // Check if we've reached the destination stop
        if (stopId === parseInt(toStopId)) {
            // Found a path!  Reconstruct details.
            const routeIds = path.map(p => p.routeId).filter(r => r !== null);
            const buses = routeIds.flatMap(routeId => getBusesOnRoute(routeId));
            console.log("Connected Path Found:", { routes: routeIds, buses: buses, totalTime: totalTime });
             // Return path, buses, and total time
            return { routes: routeIds, buses: buses, totalTime: totalTime };
        }

        // Explore routes going through the current stop.
        const routes = Array.from(new Set(routeStopsData.filter(rs => rs.stop_id === stopId).map(rs => rs.route_id)));

        for (const nextRouteId of routes) {
            const stopsOnRoute = routeStopsData
                .filter(rs => rs.route_id === nextRouteId)
                .sort((a, b) => a.stop_order - b.stop_order); // Ensure stops are in order

            for (const nextStop of stopsOnRoute) {
                if (!visitedStops.has(nextStop.stop_id)) {
                    visitedStops.add(nextStop.stop_id);

                    // Calculate time to next stop (handle null/undefined).
                    const timeToNext = nextStop.time_to_next || 0;

                    // Enqueue the next stop, with updated path and totalTime.
                    queue.push({
                        stopId: nextStop.stop_id,
                        routeId: nextRouteId,
                         // Store timeToNext.
                        path: [...path, { routeId: nextRouteId, stopId: stopId, timeToNext: timeToNext }],
                        totalTime: totalTime + timeToNext
                    });
                }
            }
        }
    }

    console.log("No connected routes found.");
    return { routes: [], buses: [], totalTime: null }; // No path found
}


//Helper function to get buses
function getBusesOnRoute(routeId) {
    return busesData.filter(bus => bus.route_id === routeId);
}

// Helper function to get stop order
function getStopOrder(routeId, stopId) {
    const routeStop = routeStopsData.find(rs => rs.route_id === routeId && rs.stop_id === stopId);
    return routeStop ? routeStop.stop_order : null;
}

// Helper function to parse time string into minutes
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Helper function to format time from minutes back into HH:mm format
function formatTimeFromMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    return `${formattedHours}:${formattedMinutes}`;
}
// --- calculateArrivalTime (Corrected and Simplified) ---
function calculateArrivalTime(bus, fromStopId, toStopId) {
    const routeId = bus.route_id;
    const direction = bus.direction;
    const fromOrder = getStopOrder(routeId, fromStopId);
    const toOrder = getStopOrder(routeId, toStopId);

    if (fromOrder === null || toOrder === null) {
        return "N/A";
    }

    let startTimeMinutes = parseTimeToMinutes(bus.time);
    let travelTimeMinutes = 0;

    if (direction === "Direct") {
        // Direct: Add time_to_next *up to* toOrder
        for (let i = fromOrder; i < toOrder; i++) {
            const currentStop = routeStopsData.find(rs => rs.route_id === routeId && rs.stop_order === i);
            if (currentStop && currentStop.time_to_next !== null && currentStop.time_to_next !== undefined) {
                travelTimeMinutes += currentStop.time_to_next;
            } else {
                return "N/A"; // Invalid route data
            }
        }
    } else { // Reverse
        //Reverse: Add time_to_next values going *backwards* from fromOrder down to toOrder.
        for (let i = fromOrder; i > toOrder; i--) {
            const currentStop = routeStopsData.find(rs => rs.route_id === routeId && rs.stop_order === i);
            if (currentStop && currentStop.time_to_next !== null && currentStop.time_to_next !== undefined) {
                travelTimeMinutes += currentStop.time_to_next; //Still add the time
            } else {
                return "N/A";
            }
        }
    }

    return formatTimeFromMinutes(startTimeMinutes + travelTimeMinutes);
}

// --- UI Interaction and Event Handling (formerly scripts.js) ---

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

//Sets up event listeners for box clicks
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

//Handles clicks on boxes, distinguishing between back button clicks and other clicks
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
// --- Dropdown Functions (Modified for Filtering) ---
function setupDropdown(inputId, dropdownId) {
    const inputElement = document.getElementById(inputId);
    const dropdownElement = document.getElementById(dropdownId);

    // --- Important: No longer readonly ---
    inputElement.readOnly = false;

     inputElement.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdownElement.style.display = "block";
        loadStops(dropdownElement, inputElement);
    });

    // --- Input Event for Filtering ---
    inputElement.addEventListener("input", () => {
        filterStops(inputElement, dropdownElement);
    });

    // Close dropdown when clicking outside
   document.addEventListener("click", (event) => {
        if (!inputElement.contains(event.target) && !dropdownElement.contains(event.target)) {
            dropdownElement.style.display = "none";
        }
    });
}

function loadStops(dropdown, inputElement) {
    // Use importedStopsData if available, otherwise fetch
    if (stopsData.length > 0) {
        populateDropdown(stopsData, dropdown, inputElement);
    } else {
        fetch(`${API_URL}/stops`)
            .then(response => response.json())
            .then(stops => {
                populateDropdown(stops, dropdown, inputElement);
            })
            .catch(error => console.error("Error fetching stops:", error));
    }
}

function populateDropdown(stops, dropdown, inputElement) {
    // No sorting here, we'll sort on filter
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
     filterStops(inputElement, dropdown); //  Initially filter
}

// --- NEW: Filter Function ---
function filterStops(inputElement, dropdownElement) {
    const filterValue = inputElement.value.toLowerCase();

    // Get all dropdown items
    const items = dropdownElement.querySelectorAll('.dropdown-item');

    // Convert the NodeList to an array for easier manipulation
    const itemsArray = Array.from(items);

    // Sort the array alphabetically by textContent
    itemsArray.sort((a, b) => a.textContent.localeCompare(b.textContent));

    // Apply filtering and display
    itemsArray.forEach(item => {
    const stopName = item.textContent.toLowerCase();
        if (stopName.includes(filterValue)) {
            item.style.display = "block"; // Show matching items
        } else {
            item.style.display = "none";  // Hide non-matching items
        }
    });
}

//Enables or disables the search button based on stop selection
function checkSearchButton() {
    const fromStopId = document.getElementById("loc-from").dataset.stopId;
    const toStopId = document.getElementById("loc-to").dataset.stopId;
    const searchButton = document.getElementById("search-btn");
    searchButton.disabled = !(fromStopId && toStopId);
}

// --- handleSearch (Orchestrates Direct and Connected Search) ---
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
        const directBuses = await findRoutes(fromStopId, toStopId);
        displayBusResults(directBuses, 'direct', fromStopId, toStopId);

        // 2. If no direct routes, try to find connected routes
        if (directBuses.length === 0) {
            const connectedPath = await findConnectedRoutes(fromStopId, toStopId);
            if (connectedPath.routes.length > 0) {
                displayBusResults(connectedPath.buses, 'connected', fromStopId, toStopId);
            } else {
                displayNoResults(); // No direct or connected routes
            }
        }

    } catch (error) {
        console.error("Error during search:", error);
        alert("An error occurred during the search.");
    }
}

// --- Display Results ---
function displayBusResults(buses, type, fromStopId, toStopId) {
    const containerId = type === 'direct' ? 'direct-bus-data' : 'connected-bus-data';
    const resultsContainer = document.getElementById(containerId);
    const title = type === 'direct' ? 'Direct Buses' : 'Connected Buses';

    if (!buses || buses.length === 0) {
        resultsContainer.innerHTML += `<p>No ${type} routes found.</p>`;
        return;
    }

    buses.forEach(bus => {
        const route = routesData.find(route => route.route_id === bus.route_id);
        const arrivalTime = calculateArrivalTime(bus, fromStopId, toStopId); // Calculate arrival time
        const busDiv = document.createElement('div');
        busDiv.classList.add('bus-item');
        busDiv.innerHTML = `
            <h4>${title}</h4>
            <p><strong>Bus:</strong> ${bus.bus_name} (${bus.direction})</p>
            <p><strong>Route:</strong> ${route ? route.route_name : 'Unknown Route'}</p>
            <p><strong>Departure Time:</strong> ${bus.time}</p>
            <p><strong>Arrival Time:</strong> ${arrivalTime}</p>
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
    const endTop = window.innerHeight * -0.07;

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