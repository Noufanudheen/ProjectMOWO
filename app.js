const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const uri = "mongodb+srv://project:bcaproject@project.hc2be.mongodb.net/?retryWrites=true&w=majority&appName=Project";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let db; // Global database reference

async function connectDB() {
    try {
        await client.connect();
        db = client.db('Public-Transport');
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err);
    }
}

// CORS configuration
const corsOptions = {
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Middleware setup
app.use(express.json());
app.use(express.static('public'));
app.use('/Front', express.static('Front'));
app.use(express.static(__dirname));
// -------------------------
// Fetch All Data
// -------------------------

app.get('/api/stops', async (req, res) => {
    try {
        const stops = await db.collection('stops').find().toArray();
        res.json(stops);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/routes', async (req, res) => {
    try {
        const routes = await db.collection('routes').find().toArray();
        res.json(routes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/route_stops', async (req, res) => {
    try {
        const routeStops = await db.collection('route_stops').find().toArray();
        res.json(routeStops);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bus', async (req, res) => {
    try {
        const buses = await db.collection('bus').find().toArray();
        res.json(buses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------
// Add Routes, Stops, and Buses
// -------------------------

// Add a stop (Rejects empty values)
app.post('/api/stops', async (req, res) => {
    try {
        const { stop_name} = req.body;

        // Validate input
        if (!stop_name) {
            return res.status(400).json({ error: "Both 'name' and 'location' are required." });
        }

        // Find the largest existing stop_id and increment it
        const lastStop = await db.collection('stops').find().sort({ stop_id: -1 }).limit(1).toArray();
        const nextStopId = lastStop.length > 0 ? lastStop[0].stop_id + 1 : 1; // If no stops, start from 1

        // Insert new stop
        const result = await db.collection('stops').insertOne({
            stop_id: nextStopId,  // Auto-incremented stop ID
            stop_name
        });

        res.status(201).json({ message: "Stop added successfully", stop_id: nextStopId });

    } catch (err) {
        console.error("Error adding stop:", err);
        res.status(500).json({ error: err.message });
    }
});

// Add multiple stops to a route (Rejects duplicates)
app.post('/api/route_stops', async (req, res) => {
    try {
        if (!Array.isArray(req.body) || req.body.length === 0) {
            return res.status(400).json({ error: "Request body should be a non-empty array." });
        }

        const bulkOperations = req.body.map(item => {
            if (!item.route_id || !item.stop_id || !item.time) {
                throw new Error("All fields ('route_id', 'stop_id', 'time') are required.");
            }

            return {
                updateOne: {
                    filter: { route_id: item.route_id, stop_id: item.stop_id },
                    update: { $setOnInsert: item },
                    upsert: true, // Prevent duplicates
                }
            };
        });

        const result = await db.collection('route_stops').bulkWrite(bulkOperations);
        res.status(201).json({ message: "Route stops added successfully", insertedCount: result.upsertedCount });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/bus', async (req, res) => {
    try {
        const { bus_name, route_id, time, direction } = req.body;

        // Validate input
        if (!bus_name || !route_id || !time || !direction) {
            return res.status(400).json({ error: 'Missing required fields: bus_name, route_id, time, or direction' });
        }

        // Ensure `route_id` is stored as Int32
        const routeIdInt = parseInt(route_id, 10);
        if (isNaN(routeIdInt)) {
            return res.status(400).json({ error: 'Invalid route_id format, must be a number' });
        }

        // Validate `direction` value
        const validDirections = ["Direct", "Reverse"];
        if (!validDirections.includes(direction)) {
            return res.status(400).json({ error: 'Invalid direction, must be "Direct" or "Reverse"' });
        }

        // Find the largest existing bus_id and increment it
        const lastBus = await db.collection('bus').find().sort({ bus_id: -1 }).limit(1).toArray();
        const nextBusId = lastBus.length > 0 ? lastBus[0].bus_id + 1 : 1; // If no buses, start from 1

        // Insert new bus with auto-incremented bus_id
        const result = await db.collection('bus').insertOne({
            bus_id: nextBusId,  // Auto-incremented bus ID
            bus_name,
            route_id: routeIdInt, // Ensure it's stored as Int32
            time,
            direction
        });

        res.status(201).json({ message: "Bus added successfully", bus: result.ops[0] });

    } catch (err) {
        console.error("Error adding bus:", err);
        res.status(500).json({ error: err.message });
    }
});

// -------------------------
// Delete Routes, Stops, and Buses
// -------------------------

// Delete a stop
app.delete('/api/stops/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        const result = await db.collection('stops').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Stop not found" });
        }

        res.status(200).json({ message: "Stop deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete route stop
app.delete('/api/route_stops/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        const result = await db.collection('route_stops').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Route stop not found" });
        }

        res.status(200).json({ message: "Route stop deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a bus
app.delete('/api/bus/:busId', async (req, res) => {
    try {
        const { busId } = req.params;
        if (!ObjectId.isValid(busId)) {
            return res.status(400).json({ error: "Invalid bus ID format" });
        }

        const result = await db.collection('bus').deleteOne({ _id: new ObjectId(busId) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Bus not found" });
        }

        res.status(200).json({ message: "Bus deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------
// Start the Server
// -------------------------
app.listen(port, async () => {
    await connectDB();
    console.log(`Server is running on http://localhost:${port}`);
});
