// dblink.js - Database interaction and route finding logic

// Constants
const API_URL = 'http://localhost:3000/api'; // Replace with your actual API URL
const STOPS_ENDPOINT = `${API_URL}/stops`;
const ROUTES_ENDPOINT = `${API_URL}/routes`;
const ROUTE_STOPS_ENDPOINT = `${API_URL}/route_stops`;
const BUSES_ENDPOINT = `${API_URL}/bus`;

// Data (to be populated from API)
let stopsData = [];
let routesData = [];
let busesData = [];
let routeStopsData = [];

// Fetch all data (stops, routes, buses, route_stops)
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

        console.log('Stops Data:', stopsData);
        console.log('Routes Data:', routesData);
        console.log('Buses Data:', busesData);
        console.log('Route Stops Data:', routeStopsData);

    } catch (error) {
        console.error("Error fetching all data:", error);
        alert("Failed to load data. Please check your internet connection.");
        throw error;  // Re-throw to let the caller handle it (e.g., retry)
    }
}

// --- Modified findRoutes (Handles Direction) ---
async function findRoutes(fromStopId, toStopId) {
    console.log('findRoutes called with fromStopId:', fromStopId, 'toStopId:', toStopId);

    const fromStopRoutes = routeStopsData.filter(rs => rs.stop_id === fromStopId);
    const toStopRoutes = routeStopsData.filter(rs => rs.stop_id === toStopId);

    console.log("fromStopRoutes:", fromStopRoutes);
    console.log("toStopRoutes:", toStopRoutes);

    const directRoutes = [];

    for (const fromRs of fromStopRoutes) {
        for (const toRs of toStopRoutes) {
            if (fromRs.route_id === toRs.route_id) {
                // Same route, check direction and order
                const buses = getBusesOnRoute(fromRs.route_id); // Get all buses on this route
                for (const bus of buses) {
                    if (bus.direction === "Direct" && fromRs.stop_order < toRs.stop_order) {
                        // Direct bus, correct order
                        directRoutes.push(bus);
                    } else if (bus.direction === "Reverse" && fromRs.stop_order > toRs.stop_order) {
                         //Reverse bus, correct order
                        directRoutes.push(bus);
                    }
                }
            }
        }
    }
    console.log("directRoutes:", directRoutes)
    return directRoutes;
}

// --- Modified findConnectedRoutes (Handles Direction) ---
async function findConnectedRoutes(fromStopId, toStopId) {
    console.log(`Finding connected routes from ${fromStopId} to ${toStopId}`);

    const fromRoutes = routeStopsData.filter(rs => rs.stop_id === fromStopId)
                                     .map(rs => rs.route_id);
    const toRoutes = routeStopsData.filter(rs => rs.stop_id === toStopId)
                                   .map(rs => rs.route_id);

    console.log("fromRoutes", fromRoutes);
    console.log("toRoutes", toRoutes);

    const connectingRoutes = [];

    for (const fromRouteId of fromRoutes) {
        for (const toRouteId of toRoutes) {
            if (fromRouteId === toRouteId) continue;

            const fromRouteStops = routeStopsData.filter(rs => rs.route_id === fromRouteId)
                                                .map(rs => rs.stop_id);
            const toRouteStops = routeStopsData.filter(rs => rs.route_id === toRouteId)
                                              .map(rs => rs.stop_id);

            const fromRouteStopsOrder = routeStopsData.filter(rs => rs.route_id === fromRouteId);
            const toRouteStopsOrder = routeStopsData.filter(rs => rs.route_id === toRouteId);

            const commonStops = fromRouteStops.filter(stopId => toRouteStops.includes(stopId));

            console.log("fromRouteStops",fromRouteStops)
            console.log("toRouteStops",toRouteStops)
            console.log("commonStops", commonStops)


            if (commonStops.length > 0) {
                const fromStopOrder = fromRouteStopsOrder.find(rs => rs.stop_id === fromStopId).stop_order
                const toStopOrder = toRouteStopsOrder.find(rs => rs.stop_id === toStopId).stop_order;
                const connectingStopOrder = fromRouteStopsOrder.find(rs => rs.stop_id === commonStops[0]).stop_order
                
                console.log("fromStopOrder: ", fromStopOrder);
                console.log("toStopOrder: ", toStopOrder);
                console.log("connectingStopOrder", connectingStopOrder);
                // Check direction and order for potential connections
                const busesFrom = getBusesOnRoute(fromRouteId);
                const busesTo = getBusesOnRoute(toRouteId);

                for (const bus of busesFrom) {
                     if (bus.direction === "Direct" && fromStopOrder < connectingStopOrder) {
                        connectingRoutes.push(bus);
                    } else if (bus.direction === "Reverse" && fromStopOrder > connectingStopOrder) {
                        connectingRoutes.push(bus);
                    }
                }
                for(const bus of busesTo){
                    if (bus.direction === "Direct" && connectingStopOrder < toStopOrder) {
                        connectingRoutes.push(bus);
                    } else if (bus.direction === "Reverse" && connectingStopOrder > toStopOrder) {
                        connectingRoutes.push(bus);
                    }
                }
            }
        }
    }
     console.log("connectingRoutes:", connectingRoutes);
    return connectingRoutes;
}


//Helper function to get buses
function getBusesOnRoute(routeId) {
    return busesData.filter(bus => bus.route_id === routeId);
}

// --- Time Calculation Functions (Modified for Direction) ---

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
//Calculates and returns the estimated time of arrival
function calculateArrivalTime(bus, fromStopId, toStopId) {
    const routeId = bus.route_id;
    const direction = bus.direction;

    const fromOrder = getStopOrder(routeId, fromStopId);
    const toOrder = getStopOrder(routeId, toStopId);

    if (fromOrder === null || toOrder === null) {
        return "N/A"; // Stop not found on route
    }

    let startTimeMinutes = parseTimeToMinutes(bus.time);  //bus starting time
    // console.log("startTimeMinutes", startTimeMinutes)

    if (direction === "Direct") {
        // Traverse stops in ascending order
        for (let i = 1; i < fromOrder; i++) {
            const currentStop = routeStopsData.find(stop => stop.route_id === routeId && stop.stop_order === i)
             if (currentStop && currentStop.time_to_next !== null && currentStop.time_to_next !== undefined ) {
                startTimeMinutes += currentStop.time_to_next;

            }
        }
        for(let i = fromOrder; i < toOrder; i++){
             const currentStop = routeStopsData.find(stop => stop.route_id === routeId && stop.stop_order === i)
            if (currentStop && currentStop.time_to_next !== null && currentStop.time_to_next !== undefined ) {
                startTimeMinutes += currentStop.time_to_next;
            }
        }
    } else {  // "Reverse"
        //Traverse stops in descending order
       for (let i = routeStopsData.filter(stop => stop.route_id === routeId).length; i > fromOrder; i--) {
            const currentStop = routeStopsData.find(stop => stop.route_id === routeId && stop.stop_order === i);
            if (currentStop && currentStop.time_to_next !== null && currentStop.time_to_next !== undefined) {
                startTimeMinutes += currentStop.time_to_next;
            }

        }
        for(let i = fromOrder; i > toOrder; i--){
            const currentStop = routeStopsData.find(stop => stop.route_id === routeId && stop.stop_order === i)
            if (currentStop && currentStop.time_to_next !== null && currentStop.time_to_next !== undefined ) {
                startTimeMinutes -= currentStop.time_to_next;
            }
        }
    }

    return formatTimeFromMinutes(startTimeMinutes);
}


// Export functions and data that will be used in scripts.js
export {
    fetchAllData,
    findRoutes,
    findConnectedRoutes, // Export the new function
    stopsData,
    routesData,
    busesData,
    routeStopsData,
    calculateArrivalTime
};