// Backend API URL
const apiUrl = "http://localhost:3000/api";

// Utility Functions
function showError() {
    document.getElementById('error-message').classList.remove('hidden');
}

// Event Listeners
window.onload = () => {
    loadRoutes();
    loadStops();
    loadBuses();
};

let cachedRoutes = [];
let cachedStops = [];

document.getElementById('addStopBtn').onclick = () => {
    console.log("Add Stop Button Clicked");
    document.getElementById('stopForm').classList.remove('hidden');
    addnewstoprow(); // Add first stop row when form opens
};

document.getElementById('addBusBtn').onclick = () => {
    console.log("Add Bus Button Clicked");
    document.getElementById('busForm').classList.remove('hidden');
    addNewBusRow(); // Add first bus row when form opens
};

document.getElementById('addrtstBtn').onclick = () => {
    console.log("Add rtst Button Clicked");
    document.getElementById('rtstForm').classList.remove('hidden');
    addnewrtstrow(); // Add first stop row when form opens
};

document.getElementById('addRouteBtn').onclick = () => {
    console.log("Add Route Button Clicked");
    document.getElementById('routeForm').classList.remove('hidden');
    addnewrouterow(); // Add first stop row when form opens
};

document.getElementById('saveBusBtn').onclick = saveBuses;
document.getElementById('saveStopBtn').onclick = saveStops;
document.getElementById('saveRouteBtn').onclick = saveRoute;
document.getElementById('savertstBtn').onclick = savertstops;

// Dynamic Row Additions
function addnewrouterow() {
    const newRouteRowDiv = document.getElementById('newrouterow');
    const newRouteRow = document.createElement('div');
    newRouteRow.classList.add('route-row');
    newRouteRow.innerHTML = `
        <input type="number" class="route_id" placeholder="Route_ID" required>
        <input type="text" class="route_name" placeholder="Route name" required>
    `;
    newRouteRowDiv.appendChild(newRouteRow);
}

function addnewstoprow() {
    const newStopRowDiv = document.getElementById('newstoprow');
    const newStopRow = document.createElement('div');
    newStopRow.classList.add('stop-row');
    newStopRow.innerHTML = `
        <input type="text" class="stop_name" placeholder="Stop Name" required>
    `;
    newStopRowDiv.appendChild(newStopRow);
}

function addnewrtstrow() {
    const newrtstRowDiv = document.getElementById('newrtstrow');
    const newrtstRow = document.createElement('div');
    newrtstRow.classList.add('rtst-row');
    newrtstRow.innerHTML = `
        <select class="stop_id" required>
            <option value="">Select Stop</option>
            <!-- Stops will be populated dynamically here -->
        </select>
        <input type="number" class="stop_order" placeholder="Stop Order" required>
        <input type="number" class="time" placeholder="time from stop before it" required>
    `;
    newrtstRowDiv.appendChild(newrtstRow);

    // Populate dropdowns for the new row
     populateStopDropdownsForNewRow(newrtstRow, cachedStops);
}

function populateStopDropdownsForNewRow(newRow, stops) {
      const stopSelect = newRow.querySelector('.stop_id');
        stopSelect.innerHTML = '<option value="">Select Stop</option>';
        stops.forEach(stop => {
            const option = document.createElement('option');
            option.value = stop.stop_id;
            option.textContent = stop.stop_name;
            stopSelect.appendChild(option);
        });
}

function addNewBusRow() {
    const newBusRowDiv = document.getElementById('newbusrow');
    const rowCount = newBusRowDiv.querySelectorAll('.bus-row').length;
    const newRow = document.createElement('div');
    newRow.classList.add('bus-row');
    // All radio buttons in the *same group* must have the *same* name.
    newRow.innerHTML = `
        <input type="text" class="bus-name" placeholder="Bus Name" required>
        <select class="route-name" required>
            <option value="">Select Route</option>
        </select>
        <input type="time" class="bus-time" required>
        
        <label>
            <input type="radio" name="direction" value="Direct" checked> Direct
        </label>
        <label>
            <input type="radio" name="direction" value="Reverse"> Reverse
        </label>
    `;
    newBusRowDiv.appendChild(newRow);
    loadRoutesForBusForm(); // Load routes for the new row
}

// API Fetch Functions
// Function to load Routes and store them in cache
function loadRoutes() {
    // Check if routes are already cached
    if (cachedRoutes.length > 0) {
        populateRouteDropdowns(cachedRoutes);  // Populate dropdowns with cached data
        updateRoutesTable(cachedRoutes); // Update the routes table using cached data
    } else {
        fetch(`${apiUrl}/routes`)
            .then(response => response.json())
            .then(routes => {
                cachedRoutes = routes;  // Cache the fetched routes
                populateRouteDropdowns(routes);  // Populate dropdowns with fetched data
                updateRoutesTable(routes); // Update the routes table with fetched data
            })
            .catch(showError);
    }
}

// Function to load Stops and store them in cache
function loadStops() {
    // Check if stops are already cached
    if (cachedStops.length > 0) {
        populateStopDropdowns(cachedStops);  // Populate dropdowns with cached data
        updateStopsTable(cachedStops); // Update the stops table using cached data
    } else {
        fetch(`${apiUrl}/stops`)
            .then(response => response.json())
            .then(stops => {
                cachedStops = stops;  // Cache the fetched stops
                populateStopDropdowns(stops);  // Populate dropdowns with fetched data
                updateStopsTable(stops); // Update the stops table with fetched data
            })
            .catch(showError);
    }
}
// Function to update the Routes table (after loading routes)
function updateRoutesTable(routes) {
    const tableBody = document.getElementById('routes-table').querySelector('tbody');
    tableBody.innerHTML = ''; 
    routes.sort((a, b) => a.route_name.localeCompare(b.route_name)); // Sort alphabetically
    routes.forEach(route => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${route.route_name}</td>
            <td>${route.route_id}</td>
            <td>
                <button onclick="deleteRoute(${route.route_id})">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Function to update the Stops table (after loading stops)
function updateStopsTable(stops) {
    const tableBody = document.getElementById('stops-table').querySelector('tbody');
    tableBody.innerHTML = '';
    stops.sort((a, b) => a.stop_name.localeCompare(b.stop_name)); // Sort alphabetically
    stops.forEach(stop => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stop.stop_id}</td>
            <td>${stop.stop_name}</td>
            <td>
                <button onclick="deleteStop('${stop._id}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Helper function to populate the route dropdowns
function populateRouteDropdowns(routes) {
    document.querySelectorAll('.route_id').forEach(routeSelect => {
        routeSelect.innerHTML = '<option value="">Select Route</option>';
        routes.forEach(route => {
            const option = document.createElement('option');
            option.value = route.route_id;
            option.textContent = route.route_name;
            routeSelect.appendChild(option);
        });
    });
}

// Helper function to populate the stop dropdowns
function populateStopDropdowns(stops) {
    document.querySelectorAll('.stop_id').forEach(stopSelect => {
        stopSelect.innerHTML = '<option value="">Select Stop</option>';
        stops.forEach(stop => {
            const option = document.createElement('option');
            option.value = stop.stop_id;
            option.textContent = stop.stop_name;
            stopSelect.appendChild(option);
        });
    });
}

function loadBuses() {
    // Fetch both buses and routes simultaneously
    Promise.all([
        fetch(`${apiUrl}/bus`).then(response => response.json()),
        fetch(`${apiUrl}/routes`).then(response => response.json())
    ])
    .then(([buses, routes]) => {
        const tableBody = document.getElementById('bus-table').querySelector('tbody');
        tableBody.innerHTML = ''; // Clear existing rows

        buses.forEach(bus => {
            // Find the route name for the bus
            const route = routes.find(route => route.route_id === bus.route_id); // Match _id, not route_id
            const routeName = route ? route.route_name : 'Unknown Route';

            // Create a row for each bus
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${bus._id}</td> <!-- Using _id for display -->
                <td>${bus.bus_id}</td>
                <td>${bus.bus_name}</td>
                <td>${routeName}</td>
                <td>${bus.time || 'No Time Specified'}</td>
                <td>${bus.direction || 'Unknown'}</td>
                <td>
                    <button onclick="deleteBus('${bus._id}')">Delete</button> <!-- Pass _id correctly -->
                </td>
            `;
            tableBody.appendChild(row);
        });
    })
    .catch(showError);
}

function loadRoutesForBusForm() {
    fetch(`${apiUrl}/routes`)
        .then(response => response.json())
        .then(routes => {
            // Populate all dropdowns with class 'route-name'
            document.querySelectorAll('.route-name').forEach(routeSelect => {
                routeSelect.innerHTML = '<option value="">Select Route</option>';
                routes.forEach(route => {
                    const option = document.createElement('option');
                    option.value = route.route_id;
                    option.textContent = route.route_name;
                    routeSelect.appendChild(option);
                });
            });
        })
        .catch(showError);
}
// CRUD Operations
function deleteBus(busId) {
    fetch(`${apiUrl}/bus/${busId}`, { method: 'DELETE' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete bus');
            }
            return response.text();
        })
        .then(() => loadBuses()) // Reload buses after deletion
        .catch(showError);
}

function deleteStop(stopId) {
    fetch(`${apiUrl}/stops/${stopId}`, { method: 'DELETE' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete stop');
            }
            return response.text();
        })
        .then(() => loadStops()) // Reload stops after deletion
        .catch(showError);
}

function deleteRoute(routeId) {
    // Optional: Check if any buses or stops are associated with this route
    fetch(`${apiUrl}/route_stops?route_id=${routeId}`)
        .then(response => response.json())
        .then(routeStops => {
            if (routeStops.length > 0) {
                alert('Cannot delete this route as it has associated stops.');
                return;
            }
            // Proceed with deletion
            fetch(`${apiUrl}/routes/${routeId}`, { method: 'DELETE' })
                .then(loadRoutes)
                .catch(showError);
        })
        .catch(showError);
}

// Save Functions
function saveRoute() {
    const routeNames = document.querySelectorAll('.route_name');
    const routeIds = document.querySelectorAll('.route_id');
     const requests = [];

    for (let i = 0; i < routeNames.length; i++) {
        const routeName = routeNames[i].value.trim();
        const routeId = routeIds[i].value.trim();

        if (!routeName || !routeId) {
            alert('Please fill out all fields');
            return; // Stop if any field is empty
        }
         requests.push(
        fetch(`${apiUrl}/routes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ route_id: parseInt(routeId), route_name: routeName })
        }));
    }
        Promise.all(requests)
        .then(() => {
            alert('All stops added successfully');
            loadRoutes();
            location.reload()
        })
        .catch(showError);
}

function saveBuses() {
    const busRows = document.querySelectorAll('.bus-row');
    const requests = [];

    busRows.forEach(row => { // Corrected: Iterate over .bus-row elements
        const busName = row.querySelector('.bus-name').value.trim();
        const routeId = row.querySelector('.route-name').value.trim();
        const busTime = row.querySelector('.bus-time').value.trim();

        // *Correctly* get the selected radio button within the current row:
        const direction = row.querySelector('input[name="direction"]:checked').value;

        console.log(busName, routeId, busTime, direction); // Debugging

        if (!busName || !routeId || !busTime || !direction) {
            alert('Please fill out all fields for each bus.');
            return;
        }

        const request = fetch(`${apiUrl}/bus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bus_name: busName, route_id: parseInt(routeId), time: busTime, direction: direction }) // Correct data
        });
        requests.push(request);
    });

    Promise.all(requests)
        .then(() => {
            alert('Buses added successfully');
            loadBuses(); // Reload the bus list
            location.reload()
        })
        .catch(error => {
            console.error("Error adding buses:", error);
            alert("An error occurred while adding buses.");
        });
}

function saveStops() {
    const stopNames = document.querySelectorAll('.stop_name');
    const requests = [];

    for (let i = 0; i < stopNames.length; i++) {
        const stopName = stopNames[i].value.trim();

        if (!stopName) {
            alert('Please fill out all fields');
            return; // Stop if any field is empty
        }

        requests.push(
            fetch(`${apiUrl}/stops`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stop_name: stopName }) // Correct format
            })
        );
    }

    Promise.all(requests)
        .then(() => {
            alert('All stops added successfully');
            loadStops();
            location.reload()
        })
        .catch(showError);
}
// Save Route Stops Function
function savertstops(event) {
    event.preventDefault(); // Prevent double submission

    const saveButton = document.getElementById("savertstBtn");
    saveButton.disabled = true; // Disable the button to prevent multiple clicks

    const rows = document.querySelectorAll('.rtst-row');
    const routeId = document.querySelector('.route_id').value.trim();

    if (!routeId) {
        alert('Please select a route!');
        saveButton.disabled = false; // Re-enable button if validation fails
        return;
    }

    const data = [];

    for (const row of rows) {
        const stopId = row.querySelector('.stop_id').value.trim();
        const stopOrder = row.querySelector('.stop_order').value.trim();
        const time = row.querySelector('.time').value.trim();

        if (!stopId || !stopOrder || !time) {
            alert('Please complete all fields in each row.');
            saveButton.disabled = false; // Re-enable button if validation fails
            return;
        }

        data.push({
            route_id: routeId, 
            stop_id: stopId,
            stop_order: parseInt(stopOrder, 10),
            time_to_next: parseFloat(time),
        });
    }

    console.log('Sending Route Stops Data:', JSON.stringify(data));

    fetch(`${apiUrl}/route_stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    .then((response) => response.json())
    .then((result) => {
        saveButton.disabled = false; // Re-enable button after request is done
        if (result.error) {
            alert(`Failed to save route stops: ${result.error}`);
        } else {
            alert('Route stops saved successfully.');
            location.reload();
        }
    })
    .catch((error) => {
        saveButton.disabled = false; // Re-enable button if request fails
        console.error('Fetch Error:', error);
        alert('Failed to save route stops.');
    });
}
// Ensure event listener is only attached once
document.getElementById("savertstBtn").removeEventListener("click", savertstops);
document.getElementById("savertstBtn").addEventListener("click", savertstops);