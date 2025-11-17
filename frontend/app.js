// -----------------------------------------------------
//  CONFIG
// -----------------------------------------------------
const API_BASE_URL = "http://127.0.0.1:8000"; // or http://localhost:8000

// -----------------------------------------------------
//  FALLBACK MOCK DATA (used if API fails)
// -----------------------------------------------------
const fallbackLots = [
    {
        id: 1,
        name: "Downtown Oasis Garage",
        city: "Dubai",
        lat: 25.2048,
        lng: 55.2708,
        distance_text: "450 m",
        duration_text: "3 min walk",
        price: 8,
        spaces: 27,
        rating: 4.8,
        type: "Covered",
        amenities: ["EV charging", "24/7 security", "Valet ready"],
        confidence: 92
    },
    {
        id: 2,
        name: "Marina Boardwalk Deck",
        city: "Dubai",
        lat: 25.0846,
        lng: 55.1389,
        distance_text: "1.1 km",
        duration_text: "4 min drive",
        price: 5,
        spaces: 53,
        rating: 4.4,
        type: "Outdoor",
        amenities: ["Shaded", "Camera patrol"],
        confidence: 84
    },
    {
        id: 3,
        name: "Corniche Business Hub",
        city: "Abu Dhabi",
        lat: 24.4857,
        lng: 54.3545,
        distance_text: "300 m",
        duration_text: "2 min walk",
        price: 7,
        spaces: 18,
        rating: 4.6,
        type: "Premium",
        amenities: ["EV charging", "Indoor", "License plate entry"],
        confidence: 88
    },
    {
        id: 4,
        name: "Al Majaz Waterfront",
        city: "Sharjah",
        lat: 25.3373,
        lng: 55.3813,
        distance_text: "650 m",
        duration_text: "4 min walk",
        price: 4,
        spaces: 45,
        rating: 4.1,
        type: "Outdoor",
        amenities: ["Shuttle", "Lighting"],
        confidence: 79
    },
    {
        id: 5,
        name: "Expo City Mobility Hub",
        city: "Dubai",
        lat: 24.9717,
        lng: 55.1552,
        distance_text: "2.2 km",
        duration_text: "6 min drive",
        price: 12,
        spaces: 12,
        rating: 4.9,
        type: "Premium",
        amenities: ["VIP valet", "CCTV", "Air conditioned"],
        confidence: 95
    },
    {
        id: 6,
        name: "Yas Mall Podium",
        city: "Abu Dhabi",
        lat: 24.4899,
        lng: 54.6034,
        distance_text: "900 m",
        duration_text: "5 min walk",
        price: 9,
        spaces: 34,
        rating: 4.3,
        type: "Covered",
        amenities: ["EV charging", "Guided parking"],
        confidence: 86
    }
];

const normalizeLot = (item, index = 0) => {
    const price = item.price ?? item.price_per_hour ?? 0;
    const spaces =
        item.spaces ??
        item.open_spots ??
        Math.max(5, Math.floor(Math.random() * 40));
    const rating = item.rating ?? 4 + Math.random() * 0.5;
    const type = item.type ?? (item.covered ? "Covered" : "Outdoor");
    const confidence =
        item.confidence ??
        Math.max(60, Math.min(99, 100 - (item.score || 0) * 5));
    const distanceText =
        item.distanceText || item.distance_text || item.distance || null;
    const durationText =
        item.durationText ||
        item.duration_text ||
        (item.travel_time_minutes
            ? `${Math.round(item.travel_time_minutes)} min`
            : null);
    const directionsUrl =
        item.directionsUrl ||
        item.directions_url ||
        (item.lat && item.lng
            ? `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`
            : null);

    return {
        id: item.id ?? index + 1,
        name: item.name,
        city: item.city,
        lat: item.lat,
        lng: item.lng,
        price,
        spaces,
        rating,
        type,
        amenities: item.amenities ?? [],
        confidence,
        distanceText,
        durationText,
        directionsUrl
    };
};

// fallback for dashboard tiles
const insightsDeck = [
    {
        title: "EV utilization up 32%",
        detail: "Expo City fast chargers nearing saturation. Suggest swapping two bays to slow charge demand.",
        tone: "warning"
    },
    {
        title: "Corniche traffic easing",
        detail: "Pedestrian wait times down to 3.2 min after directing overflow to Business District Hub.",
        tone: "success"
    },
    {
        title: "Night tariff opportunity",
        detail: "Sharjah waterfront demand remains high after midnight. Consider AED +2/hr for premium rows.",
        tone: "info"
    },
    {
        title: "Sensor drift detected",
        detail: "Bay 14 camera feed shows latency spike above threshold. Schedule recalibration.",
        tone: "danger"
    },
    {
        title: "Tourist buses inbound",
        detail: "Six coaches ETA 40 min require parallel bays near Dubai Creek entrance.",
        tone: "info"
    }
];

const timelineEvents = [
    { time: "09:10", title: "Museum drop-offs", detail: "Two pods rerouted to shaded lots to avoid 96% occupancy.", tone: "info" },
    { time: "09:40", title: "EV supercharge session", detail: "Allocating 6 bays to fleet partners.", tone: "success" },
    { time: "10:05", title: "Concert load-in", detail: "Expect surge of 1.7k vehicles. Deploy ambassadors at Gate 3.", tone: "warning" },
    { time: "10:50", title: "Policy sync", detail: "Publishing hourly tariff update to CMS.", tone: "info" }
];

const healthStatuses = [
    { label: "Telemetry ingestion", value: "Nominal · 24.4k msgs/min", tone: "success" },
    { label: "Pricing engine", value: "All shards synced", tone: "success" },
    { label: "Camera vision", value: "1 alert · recalibrate Bay 14", tone: "warning" },
    { label: "Incident inbox", value: "0 escalations", tone: "success" }
];

const dispatchQueue = [
    "Redirected driver Salman to Marina Deck L5, 32 slots free.",
    "Valet crew requested EV cable swap at Downtown Oasis.",
    "Tour bus permit confirmed for Gate C.",
    "Lighting automation triggered for Sharjah waterfront row B.",
    "Analytics flagged heat surge near Business Bay promenade."
];

// -----------------------------------------------------
//  DOM HOOKS
// -----------------------------------------------------
const resultsEl          = document.getElementById("results");
const statAvailability   = document.getElementById("statAvailability");
const statRate           = document.getElementById("statRate");
const statConfidence     = document.getElementById("statConfidence");
const form               = document.getElementById("searchForm");
const insightsList       = document.getElementById("insightsList");
const timelineEl         = document.getElementById("timeline");
const systemHealthList   = document.querySelector("#systemHealth .status-list");
const dispatchFeed       = document.getElementById("dispatchFeed");
const mapOverlayLabel    = document.getElementById("mapOverlayLabel");
const mapOverlayHeadline = document.getElementById("mapOverlayHeadline");
const mapOverlaySubline  = document.getElementById("mapOverlaySubline");
const heroFeedList       = document.querySelector("#liveFeed ul");
const originLatInput     = document.getElementById("originLat");
const originLngInput     = document.getElementById("originLng");
const originDisplayInput = document.getElementById("originDisplay");
const useLocationBtn     = document.getElementById("useLocation");
const locationStatus     = document.getElementById("locationStatus");

const setOriginFields = (lat, lng, labelText) => {
    if (!originLatInput || !originLngInput) return;
    originLatInput.value = String(lat);
    originLngInput.value = String(lng);
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const fallbackLabel =
        Number.isFinite(latNum) && Number.isFinite(lngNum)
            ? `Lat ${latNum.toFixed(4)}, Lon ${lngNum.toFixed(4)}`
            : "Location selected";
    if (originDisplayInput) {
        originDisplayInput.value = labelText ?? fallbackLabel;
    }
    if (locationStatus) {
        locationStatus.textContent = "Location locked for live travel times.";
    }
};

const requestBrowserLocation = () => {
    if (!navigator.geolocation) {
        if (locationStatus) {
            locationStatus.textContent = "Geolocation not supported in this browser.";
        }
        return;
    }
    if (locationStatus) {
        locationStatus.textContent = "Requesting location…";
    }
    navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
            setOriginFields(coords.latitude, coords.longitude);
        },
        () => {
            if (locationStatus) {
                locationStatus.textContent =
                    "Unable to fetch location. Please allow browser access.";
            }
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
};

if (useLocationBtn) {
    useLocationBtn.addEventListener("click", requestBrowserLocation);
}

// -----------------------------------------------------
//  UTILITIES
// -----------------------------------------------------
const formatCurrency = value => `${value.toFixed(0)} AED`;
const getStars = rating => "★".repeat(Math.round(rating));

const setLoading = isLoading => {
    if (!isLoading || !resultsEl) return;
    resultsEl.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;
};

// -----------------------------------------------------
//  RENDER FUNCTIONS
// -----------------------------------------------------
const renderResults = lots => {
    if (!resultsEl) return;

    if (!lots.length) {
        resultsEl.innerHTML = `
            <div class="empty-state">
                No curated matches yet. Try another city or time window.
            </div>
        `;
        return;
    }

    resultsEl.innerHTML = lots
        .map(lot => `
            <article class="lot-card">
                <div class="lot-card__header">
                    <div>
                        <h4>${lot.name}</h4>
                        <p class="secondary">
                            ${lot.city} · ${lot.type}
                            ${lot.distanceText ? ` · ${lot.distanceText}` : ""}
                        </p>
                    </div>
                    <span class="badge">${lot.spaces} open</span>
                </div>
                <div class="lot-card__meta">
                    <span>${getStars(lot.rating)} ${lot.rating.toFixed(1)}</span>
                    ${lot.durationText ? `<span>${lot.durationText}</span>` : ""}
                    ${lot.distanceText ? `<span>${lot.distanceText}</span>` : ""}
                    <span>${lot.confidence}% confidence</span>
                </div>
                <div class="amenities">
                    ${lot.amenities.map(item => `<span>${item}</span>`).join("")}
                </div>
                <div class="lot-card__footer">
                    <div class="price">
                        ${formatCurrency(lot.price)}
                        <small>/hr</small>
                    </div>
                    ${lot.directionsUrl ? `
                        <div class="lot-card__actions">
                            <a class="ghost-link" href="${lot.directionsUrl}" target="_blank" rel="noopener">
                                Get directions
                            </a>
                        </div>` : ""}
                </div>
            </article>
        `)
        .join("");
};

const updateStats = lots => {
    if (!statAvailability || !statRate || !statConfidence || !lots?.length) {
        if (statAvailability) statAvailability.textContent = "0";
        if (statRate) statRate.textContent = "0 AED";
        if (statConfidence) statConfidence.textContent = "0%";
        return;
    }

    const totalSpaces = lots.reduce((sum, lot) => sum + (lot.spaces || 0), 0);
    const avgPrice = lots.reduce((sum, lot) => sum + (lot.price || 0), 0) / lots.length;
    const avgConfidence =
        lots.reduce((sum, lot) => sum + (lot.confidence || 0), 0) / lots.length;

    statAvailability.textContent = totalSpaces;
    statRate.textContent = `${avgPrice.toFixed(1)} AED`;
    statConfidence.textContent = `${avgConfidence.toFixed(0)}%`;
};

const populateInsights = insights => {
    if (!insightsList) return;

    const source = insights && insights.length ? insights : insightsDeck;
    const sample = [...source].sort(() => Math.random() - 0.5).slice(0, 4);

    insightsList.innerHTML = sample
        .map(item => `
            <li class="insight ${item.severity || item.tone}">
                <strong>${item.title}</strong>
                <span>${item.detail}</span>
            </li>
        `)
        .join("");
};

const populateTimeline = events => {
    if (!timelineEl) return;

    const source = events && events.length ? events : timelineEvents;

    timelineEl.innerHTML = source
        .map(event => `
            <li class="${event.severity || event.tone}">
                <strong>${event.time}</strong>
                <p>${event.title}</p>
                <span>${event.detail}</span>
            </li>
        `)
        .join("");
};

const renderSystemHealth = statuses => {
    if (!systemHealthList) return;

    const source = statuses && statuses.length ? statuses : healthStatuses;

    systemHealthList.innerHTML = source
        .map(item => `
            <li class="${item.severity || item.tone}">
                <strong>${item.label}</strong>
                <span>${item.value}</span>
            </li>
        `)
        .join("");
};

const seedDispatchFeed = messages => {
    if (!dispatchFeed) return;

    const source = messages && messages.length ? messages : dispatchQueue;
    dispatchFeed.innerHTML = source.map(entry => `<li>${entry}</li>`).join("");
};

const rotateDispatchFeed = () => {
    if (!dispatchFeed) return;

    const message = dispatchQueue.shift();
    dispatchQueue.push(message);
    dispatchFeed.innerHTML = dispatchQueue.map(entry => `<li>${entry}</li>`).join("");
};

const updateMapNarrative = (city, lots) => {
    mapOverlayLabel.textContent = `${city} telemetry`;

    if (!lots.length) {
        mapOverlayHeadline.textContent = "Awaiting availability update";
        mapOverlaySubline.textContent = "Run a search to refresh the heatmap signal.";
        return;
    }

    const avgConfidence = lots.reduce((sum, lot) => sum + lot.confidence, 0) / lots.length;
    const avgPrice = lots.reduce((sum, lot) => sum + lot.price, 0) / lots.length;
    const topLot = lots[0];

    mapOverlayHeadline.textContent =
        `${topLot.name} trending ${avgConfidence.toFixed(0)}% confidence`;
    mapOverlaySubline.textContent =
        `${topLot.spaces} open bays - ${formatCurrency(avgPrice)} / hr average.`;
};

const updateHeroFeed = messages => {
    if (!heroFeedList) return;
    heroFeedList.innerHTML = messages.map(line => `<li>${line}</li>`).join("");
};

// -----------------------------------------------------
//  API HELPERS
// -----------------------------------------------------
const withTimeout = (ms, controller) =>
    setTimeout(() => controller.abort(), ms);

const fetchSuggestions = async payload => {
    if (!API_BASE_URL) return null;

    const controller = new AbortController();
    const timeout = withTimeout(3500, controller);

    try {
        const res = await fetch(`${API_BASE_URL}/suggest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
            throw new Error(`Suggest failed with status ${res.status}`);
        }

        const data = await res.json();
        return data.map((item, index) => normalizeLot(item, index));
    } catch (err) {
        console.warn("Falling back to mock parking lots:", err);
        clearTimeout(timeout);
        return null;
    }
};

const fetchInsights = async city => {
    try {
        const res = await fetch(`${API_BASE_URL}/insights?city=${encodeURIComponent(city)}`);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        return null;
    }
};

const fetchTimeline = async city => {
    try {
        const res = await fetch(`${API_BASE_URL}/timeline?city=${encodeURIComponent(city)}`);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        return null;
    }
};

const fetchStatusBoard = async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/status-board`);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        return null;
    }
};

const fetchDispatch = async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/dispatch`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.map(d => d.message);
    } catch {
        return null;
    }
};

// -----------------------------------------------------
//  SEARCH FLOW
// -----------------------------------------------------
const filterFallbackLots = city => {
    const candidates = fallbackLots.filter(lot => lot.city === city);
    const source = candidates.length ? candidates : fallbackLots;
    return source.map((lot, index) => normalizeLot(lot, index));
};

const findParking = async event => {
    event?.preventDefault();

    const city = document.getElementById("city").value;
    const preferCovered = document.getElementById("preferCovered").checked;

    // Optional: read vehicle + duration if the elements exist
    const vehicleEl = document.getElementById("vehicle");
    const durationEl = document.getElementById("duration");

    const vehicleType = vehicleEl
        ? vehicleEl.value.toLowerCase() === "ev"
            ? "ev"
            : "standard"
        : "standard";

    const durationHours = durationEl
        ? parseInt(durationEl.value, 10) || 1
        : 1;

    setLoading(true);

    const payload = {
        city,
        results: 6,
        prefer_covered: preferCovered,
        vehicle_type: vehicleType,
        duration_hours: durationHours
    };
    if (originLatInput?.value && originLngInput?.value) {
        payload.origin_lat = parseFloat(originLatInput.value);
        payload.origin_lng = parseFloat(originLngInput.value);
    }

    const apiResults = await fetchSuggestions(payload);
    const matches =
        apiResults && apiResults.length
            ? apiResults
            : filterFallbackLots(city);

    renderResults(matches);
    updateStats(matches);
    updateMapNarrative(city, matches);

    // dashboard side calls
    const [insights, timeline, statuses, dispatchMessages] = await Promise.all([
        fetchInsights(city),
        fetchTimeline(city),
        fetchStatusBoard(),
        fetchDispatch()
    ]);

    populateInsights(insights);
    populateTimeline(timeline);
    renderSystemHealth(statuses);
    seedDispatchFeed(dispatchMessages);
};

// -----------------------------------------------------
//  BOOTSTRAP
// -----------------------------------------------------
form.addEventListener("submit", findParking);

window.addEventListener("DOMContentLoaded", () => {
    const arrivalInput = document.getElementById("arrival");
    if (arrivalInput) {
        arrivalInput.value = new Date().toISOString().slice(0, 16);
    }

    if (locationStatus && !navigator.geolocation) {
        locationStatus.textContent = "Geolocation not supported in this browser.";
    }

    // initial placeholders while first API calls run
    populateInsights();
    populateTimeline();
    renderSystemHealth();
    seedDispatchFeed();
    updateHeroFeed([
        "Connecting to curb sensors…",
        "Syncing EV bay occupancy…",
        "Calibrating demand heatmap…"
    ]);

    findParking();          // run initial search
    setInterval(rotateDispatchFeed, 6000);
});
