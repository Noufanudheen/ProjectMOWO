
// Simple IndexedDB Wrapper
const dbName = 'MowoCache';
const storeName = 'dataStore';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function getFromDB(key) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

function saveToDB(key, value) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

// Update Progress Bar UI
function updateProgress(percent, message) {
    const bar = document.getElementById('loading-bar');
    const text = document.getElementById('loading-text');
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = message || `Loading... ${percent}%`;
}

// Helper to execute script in global scope
function executeGlobalScript(content) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([content], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            URL.revokeObjectURL(url);
            resolve();
        };
        script.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        document.body.appendChild(script);
    });
}

// Main Loader Logic
async function initApp() {
    updateProgress(0, 'Initialize...');

    // Determine the correct path prefix (Root vs Front)
    let pathPrefix = 'Assets/JS/';
    try {
        const check = await fetch(pathPrefix + 'data.js', { method: 'HEAD' });
        if (!check.ok) pathPrefix = 'Front/Assets/JS/';
    } catch (e) {
        // Fallback or assume Front if root failed? 
        // If 'Assets/JS/' fails, likely we are in root and need 'Front/'
        pathPrefix = 'Front/Assets/JS/';
    }

    // Adjust for local file:// where HEAD might fail or fetch might throw
    // Simple heuristic: check if script tag src contains "Front"
    const scripts = document.getElementsByTagName('script');
    const myScript = Array.from(scripts).find(s => s.src.includes('loader.js'));
    if (myScript && myScript.src.includes('Front/Assets/JS/loader.js') && !window.location.pathname.includes('/Front/')) {
        // Called from root index.html to Front/.../loader.js
        pathPrefix = 'Front/Assets/JS/';
    } else {
        pathPrefix = 'Assets/JS/';
    }

    console.log("Detected path prefix:", pathPrefix);

    try {
        // 1. Check IndexedDB
        updateProgress(5, 'Checking cache...');
        let dataScript = await getFromDB('embeddedData');

        if (dataScript) {
            console.log("Loaded data from cache");
            updateProgress(80, 'Processing cached data...');
            // Add a small delay for UI to register
            await new Promise(r => setTimeout(r, 100));

            await executeGlobalScript(dataScript); // Execute via Blob

        } else {
            console.log("Downloading data...");
            updateProgress(10, 'Downloading data...');

            try {
                // 2. Fetch with Progress
                const response = await fetch(pathPrefix + 'data.js');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const contentLength = response.headers.get('content-length');
                const total = parseInt(contentLength, 10);
                let loaded = 0;

                const reader = response.body.getReader();
                const textDecoder = new TextDecoder("utf-8");
                dataScript = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    loaded += value.byteLength;
                    if (total) {
                        const percent = Math.round((loaded / total) * 100);
                        updateProgress(10 + (percent * 0.8), `Downloading... ${percent}%`);
                    }

                    dataScript += textDecoder.decode(value, { stream: true });
                }
                dataScript += textDecoder.decode(); // Flush

                // 3. Save to Cache
                updateProgress(95, 'Caching data...');
                try {
                    await saveToDB('embeddedData', dataScript);
                    console.log("Data saved to cache");
                } catch (e) {
                    console.warn("Failed to cache data:", e);
                }

                // 4. Execute Globally (via Blob)
                updateProgress(98, 'Initializing data...');
                await executeGlobalScript(dataScript);

                // 200ms delay to ensure everything is settled (optional but safe)
                await new Promise(r => setTimeout(r, 200));

            } catch (fetchError) {
                console.warn("Fetch failed, falling back to script tag...", fetchError);
                updateProgress(50, 'Loading from web...');

                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = pathPrefix + 'data.js';
                    script.onload = () => {
                        resolve();
                        loadApp(pathPrefix); // This line was moved to after the promise in the original code, but here it's inside the fallback.
                    };
                    script.onerror = reject;
                    document.body.appendChild(script);
                });
            }
        }

        loadApp(pathPrefix);

    } catch (err) {
        console.error("Critical Error loading app:", err);
        updateProgress(100, 'Error loading data. Check console.');
        alert("Failed to load application data. Please refresh.");
    }
}

function loadApp(pathPrefix) {
    updateProgress(100, 'Starting app...');
    // 5. Load Cscripts.js
    const appScript = document.createElement('script');
    appScript.src = pathPrefix + 'Cscripts.js';
    document.body.appendChild(appScript);
}

// Start
document.addEventListener('DOMContentLoaded', initApp);

