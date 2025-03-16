const apiUrl = "http://localhost:3000/api"; // Your backend API URL

// Fetch route stops and group them by route_id
function fetchRouteStops() {
    fetch(`${apiUrl}/route_stops`)
        .then((response) => response.json())
        .then((data) => {
            console.log('Route Stops Data:', data);
            const groupedByRoute = groupByRouteId(data);
            displayGroupedTables(groupedByRoute);
        })
        .catch((error) => console.error('Error fetching route stops:', error));
}

// Group the data by route_id
function groupByRouteId(routeStops) {
    return routeStops.reduce((grouped, stop) => {
        if (!grouped[stop.route_id]) {
            grouped[stop.route_id] = [];
        }
        grouped[stop.route_id].push(stop);
        return grouped;
    }, {});
}

// Display grouped tables
function displayGroupedTables(groupedByRoute) {
    const routeTablesDiv = document.getElementById('route-tables');
    routeTablesDiv.innerHTML = '';

    for (const routeId in groupedByRoute) {
        const routeStops = groupedByRoute[routeId];

        const table = document.createElement('table');
        table.style.border = '1px solid black';

        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Route ID</th>
                    <th>Stop ID</th>
                    <th>Stop Order</th>
                    <th>Time</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${routeStops.map(stop => `
                    <tr data-id="${stop._id}">
                        <td>${stop._id}</td>
                        <td>${stop.route_id}</td>
                        <td>${stop.stop_id}</td>
                        <td>${stop.stop_order}</td>
                        <td>${stop.time}</td>
                        <td><button class="delete-btn" onclick="deleteRouteStop('${stop._id}')">Delete</button></td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        routeTablesDiv.appendChild(table);
    }
}

// Delete route stop by ID
function deleteRouteStop(id) {
    fetch(`${apiUrl}/route_stops/${id}`, { method: 'DELETE' })
        .then(response => response.ok ? fetchRouteStops() : alert('Failed to delete route stop'))
        .catch(error => console.error('Error deleting route stop:', error));
}

// Initialize the page
document.addEventListener('DOMContentLoaded', fetchRouteStops);
