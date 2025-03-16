const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://project:bcaproject@project.hc2be.mongodb.net/?retryWrites=true&w=majority&appName=Project'; // Replace with your MongoDB URI
const client = new MongoClient(uri);

let db;

async function connectToDb() {
    try {
        await client.connect();
        db = client.db('your-database-name'); // Replace with your database name
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

function getDb() {
    return db;
}

module.exports = { connectToDb, getDb };
