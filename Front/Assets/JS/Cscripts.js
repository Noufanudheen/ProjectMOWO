// combined_script.js - Combined database interaction, UI logic, and route finding
// NOTE: This is a fully static version. Data is embedded in data.js

// --- Constants (API removed - using embedded data) ---
const LOADING_MESSAGE = "Searching for routes...";
const NO_RESULTS_MESSAGE = "No routes found. Please try different stops.";
const DEBOUNCE_DELAY = 250;

// --- Data (populated from embedded data.js) ---
let stopsData = [];
let routesData = [];
let busesData = [];
let routeStopsData = [];

// --- DOM Elements (populated after DOMContentLoaded) ---
let icon, logo, bellIcon, container, menu, backdrop;
let currentState = null;

// --- Data Initialization (from embedded data.js) ---
function initializeEmbeddedData() {
    // EMBEDDED_STOPS, EMBEDDED_ROUTES, and EMBEDDED_BUSES are defined in data.js
    // Transform to match expected format

    // Stops: { stop_id, stop_name, lat, lon }
    stopsData = EMBEDDED_STOPS.map(s => ({
        stop_id: s.id,
        stop_name: s.name || "Unnamed Stop",
        lat: s.latitude,
        lon: s.longitude
    }));

    // Routes: { route_id, route_name, from_stop_id, to_stop_id }
    routesData = EMBEDDED_ROUTES.routes.map(r => ({
        route_id: r.route_id,
        route_name: r.route_name || `${r.route_id}`,
        from_stop_id: r.from_stop_id,
        to_stop_id: r.to_stop_id,
        distance_km: r.distance_km
    }));

    // Buses: Now from separate EMBEDDED_BUSES array
    busesData = EMBEDDED_BUSES.buses.map(bus => ({
        _id: bus.bus_id,
        bus_id: bus.bus_id,
        bus_name: "Private Bus",
        route_id: bus.route_id,
        time: bus.departure_time,
        direction: "Forward"
    }));

    // Route Stops: In new format, routes are direct (from -> to), so create 2 entries per route
    routeStopsData = [];
    EMBEDDED_ROUTES.routes.forEach(route => {
        const fromStop = EMBEDDED_STOPS.find(s => s.id === route.from_stop_id);
        const toStop = EMBEDDED_STOPS.find(s => s.id === route.to_stop_id);

        routeStopsData.push({
            route_id: route.route_id,
            stop_id: route.from_stop_id,
            stop_name: fromStop ? fromStop.name : "Unknown",
            stop_order: 1
        });
        routeStopsData.push({
            route_id: route.route_id,
            stop_id: route.to_stop_id,
            stop_name: toStop ? toStop.name : "Unknown",
            stop_order: 2
        });
    });

    console.log('Embedded Data Loaded:', stopsData.length, 'stops,', routesData.length, 'routes,', busesData.length, 'buses');
}

// Legacy compatibility: fetchAllData now just calls initializeEmbeddedData
async function fetchAllData() {
    initializeEmbeddedData();
}

// --- findRoutes (Direct Route) - Match by stop name since IDs don't match ---
async function findRoutes(fromStopId, toStopId) {
    console.log('findRoutes called with IDs:', fromStopId, toStopId);

    // Look up stop names from IDs (stopsData uses stop_id, routes use different IDs)
    const fromStop = stopsData.find(s => s.stop_id === fromStopId);
    const toStop = stopsData.find(s => s.stop_id === toStopId);

    if (!fromStop || !toStop) {
        console.log('Stop not found in stopsData');
        return [];
    }

    const fromName = fromStop.stop_name.toLowerCase().trim();
    const toName = toStop.stop_name.toLowerCase().trim();

    console.log('Searching for routes from:', fromName, 'to:', toName);

    // Match routes by route_name which contains "from_name to to_name"
    const matchingRoutes = routesData.filter(route => {
        const routeName = route.route_name.toLowerCase();
        // Route names are formatted as "From Stop to To Stop"
        return routeName.includes(fromName) && routeName.includes(toName) &&
            routeName.indexOf(fromName) < routeName.indexOf(toName);
    });

    console.log('Matching routes found:', matchingRoutes.length);

    // Get all buses for these routes
    const directBuses = [];
    for (const route of matchingRoutes) {
        const buses = getBusesOnRoute(route.route_id);
        buses.forEach(bus => {
            directBuses.push({
                ...bus,
                route_name: route.route_name,
                distance_km: route.distance_km
            });
        });
    }

    console.log("directBuses found:", directBuses.length);
    return directBuses;
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
    const loginBtn = document.getElementById("LoginBtn");
    if (loginBtn) {
        loginBtn.style.display = "none";
        loginBtn.addEventListener('click', () => {
            window.location.href = 'Assets/Login.html';
        });
    }
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
    // Optimization: Do NOT render all 17,000 stops immediately.
    // Just clear and maybe show a prompt or the first few if manageable.
    dropdown.innerHTML = "";

    // Optional: Render first 20 just so it's not empty?
    // Or better, just wait for input. Let's render first 20.
    const initialBatch = stops.slice(0, 20);
    renderDropdownItems(initialBatch, dropdown, inputElement);
}

// --- NEW: Filter Function with Dynamic Rendering ---
function filterStops(inputElement, dropdownElement) {
    const filterValue = inputElement.value.toLowerCase();

    if (!filterValue) {
        // If empty, show default list (e.g. first 20)
        populateDropdown(stopsData, dropdownElement, inputElement);
        return;
    }

    // Filter raw data
    // Note: stopsData is available globally
    const filtered = stopsData.filter(stop =>
        stop.stop_name.toLowerCase().includes(filterValue)
    );

    // Sort? (Optional, maybe expensive on large arrays every keystroke, but okay for filter)
    // filtered.sort((a, b) => a.stop_name.localeCompare(b.stop_name));

    // Limit to 50
    const results = filtered.slice(0, 50);

    // Render
    renderDropdownItems(results, dropdownElement, inputElement);
}

// Helper to render items (extracted to avoid duplication)
function renderDropdownItems(items, dropdown, inputElement) {
    dropdown.innerHTML = "";

    if (items.length === 0) {
        const msg = document.createElement("div");
        msg.classList.add("dropdown-item");
        msg.textContent = "No stops found";
        msg.style.pointerEvents = "none";
        dropdown.appendChild(msg);
        return;
    }

    items.forEach(stop => {
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

    dropdown.style.display = "block";
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
        case 'menu': collapseMenu(); break;
        case 'searchBox': collapseBox(event); break;
        case 'notification': collapseNotifications(); break;
        default: redirectToHomePage();
    }
});

function redirectToHomePage() {
    window.location.href = "#home";
    showheaderIcons();
    currentState = null;
    const expandedBox = document.querySelector(".box.expanded");
    if (expandedBox) {
        const mockEvent = { stopPropagation: () => { } };
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
    if (menu) menu.classList.remove("hidden");
    container.classList.add("menu-open");
    backdrop.classList.add("menu-open");
    const loginBtn = document.getElementById("LoginBtn");
    if (loginBtn) loginBtn.style.display = "block";

    // Tiny delay to ensure transition happens if display changed
    setTimeout(() => {
        menu.style.transform = "translateX(200px)";
    }, 10);

    hideHeaderIcons();
    currentState = 'menu';
    history.pushState({ type: 'menu' }, null, "#menu");
}

function collapseMenu() {
    container.classList.remove("menu-open");
    backdrop.classList.remove("menu-open");
    const loginBtn = document.getElementById("LoginBtn");
    if (loginBtn) loginBtn.style.display = "none";
    menu.style.transform = "translateX(0)";

    // Add hidden after transition (0.6s)
    setTimeout(() => {
        if (menu) menu.classList.add("hidden");
    }, 600);

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

    // --- Create Spacer to prevent layout shift ---
    const spacer = document.createElement('div');
    spacer.style.height = `${rect.height}px`;
    // box.style.width is typically %, compute exact or copy
    spacer.style.width = getComputedStyle(box).width;
    spacer.style.margin = getComputedStyle(box).margin;
    // spacer.style.display = 'block'; // Default div
    spacer.style.visibility = 'hidden'; // Invisible placeholder
    box.parentNode.insertBefore(spacer, box);
    box.spacerElement = spacer; // Store reference directly
    // ---------------------------------------------

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

        // Remove Spacer
        if (box.spacerElement) {
            box.spacerElement.remove();
            box.spacerElement = null;
        }
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
    return function (...args) {
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

// --- AUTO-INITIALIZATION ---
function initializeApp() {
    console.log("Initializing App...");

    // 1. Initialize DOM references (Assign to globals)
    icon = document.querySelector(".icon");
    logo = document.querySelector(".logo");
    bellIcon = document.querySelector(".notification-icon");
    container = document.querySelector(".container");
    menu = document.getElementById("myLinks");
    backdrop = document.querySelector(".menu-backdrop");

    // 2. Setup menu listeners
    const menuToggle = document.getElementById("menuToggle");
    if (menuToggle) menuToggle.addEventListener('click', toggleMenu);

    const notifToggle = document.getElementById("notificationToggle");
    if (notifToggle) notifToggle.addEventListener('click', toggleNotifications);

    if (logo) logo.addEventListener("click", redirectToHomePage);

    const loginBtn = document.getElementById("LoginBtn");
    if (loginBtn) {
        loginBtn.style.display = "none";
        loginBtn.addEventListener('click', () => {
            // window.location.href = 'Assets/Login.html'; // Keep disabled for now
        });
    }

    // 3. Setup Box Listeners (Use existing function!)
    // This sets up interactions AND dropdowns for search
    if (typeof setupBoxEventListeners === 'function') {
        setupBoxEventListeners();
    } else {
        console.error("setupBoxEventListeners not found!");
    }

    // 4. Load Data
    if (typeof initializeDataAndUI === 'function') {
        initializeDataAndUI();
    } else {
        initializeEmbeddedData();
    }

    // 5. Hide Loading Screen
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }

    console.log("App Initialized.");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}