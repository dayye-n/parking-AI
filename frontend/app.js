// -----------------------------------------------------
//  CONFIG
// -----------------------------------------------------
const API_BASE_URL = "http://127.0.0.1:8000"; // or http://localhost:8000
let currentSortMode = "best";

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
        spaces: 34,
        rating: 4.3,
        type: "Covered",
        amenities: ["EV charging", "Guided parking"],
        confidence: 86
    }
];

const normalizeLot = (item, index = 0) => {
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
        spaces,
        rating,
        type,
        amenities: item.amenities ?? [],
        confidence,
        distanceText,
        durationText,
        directionsUrl,
        originSource: item.origin_source || item.originSource || null,
        requestOriginLat: item.request_origin_lat ?? null,
        requestOriginLng: item.request_origin_lng ?? null,
        recommendationScore: item.recommendation_score ?? null,
        congestionScore: item.congestion_score ?? null,
        aiNote: item.ai_note || item.aiNote || null,
        aiSummary: item.ai_summary || item.aiSummary || null,
        aiConfidence: item.ai_confidence ?? item.aiConfidence ?? null,
        aiInsights: Array.isArray(item.ai_insights)
            ? item.ai_insights
            : Array.isArray(item.aiInsights)
            ? item.aiInsights
            : null,
        aiPriority: item.ai_priority ?? item.aiPriority ?? null,
        aiSource: item.ai_source || item.aiSource || null
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
const aiSummaryEl        = document.getElementById("aiSummary");
const aiHighlightsEl     = document.getElementById("aiHighlights");
const aiStatusTag        = document.getElementById("aiStatusTag");
const preferenceInput    = document.getElementById("preferencePrompt");
const aiChatLog          = document.getElementById("aiChatLog");
const aiChatForm         = document.getElementById("aiChatForm");
const aiChatInput        = document.getElementById("aiChatInput");

let liveMap = null;
let autocomplete = null;
let parkingMarkers = [];
let originMarker = null;
let directionsService = null;
let directionsRenderer = null;
let lastOriginLabel = null;
let activeDirectionsRoute = null;
let aiChatHistory = [];
let aiChatPrimed = false;
let chatBusy = false;
let lastAICity = null;
let chatContextKey = "";
let lastLotsSnapshot = [];

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
    lastOriginLabel = originDisplayInput?.value || labelText || fallbackLabel;
    if (locationStatus) {
        locationStatus.textContent = "Location locked for live travel times.";
    }
    // Center map on origin
    if (liveMap) {
        liveMap.setCenter({ lat: latNum, lng: lngNum });
        liveMap.setZoom(14);
        updateOriginMarker(latNum, lngNum, lastOriginLabel);
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
            const lat = coords.latitude;
            const lng = coords.longitude;
            setOriginFields(lat, lng, "My Location");
            if (locationStatus) {
                locationStatus.textContent = "Location set! Searching for parking...";
            }
            // Optionally trigger search automatically
            if (form) {
                setTimeout(() => form.dispatchEvent(new Event("submit")), 500);
            }
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

// Autocomplete will be initialized after Google Maps loads

// -----------------------------------------------------
//  UTILITIES
// -----------------------------------------------------
const getStars = rating => "★".repeat(Math.round(rating));

const congestionLabel = (score) => {
    // Convert congestion score (0-1) to human-friendly label
    if (score === null || score === undefined) return "People: Unknown";
    if (score < 0.3) return "People: Low";
    if (score < 0.7) return "People: Moderate";
    return "People: High";
};

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
                    ${lot.aiPriority ? `<span class="ai-rank-pill">Opus #${lot.aiPriority}</span>` : ""}
                </div>
                <div class="lot-card__meta">
                    <span>${getStars(lot.rating)} ${lot.rating.toFixed(1)}</span>
                    ${lot.durationText ? `<span>${lot.durationText}</span>` : ""}
                    ${lot.distanceText ? `<span>${lot.distanceText}</span>` : ""}
                    <span>${lot.confidence}% confidence</span>
                    ${lot.congestionScore !== null && lot.congestionScore !== undefined ? `<span>${congestionLabel(lot.congestionScore)}</span>` : ""}
                </div>
                <div class="amenities">
                    ${lot.amenities.map(item => `<span>${item}</span>`).join("")}
                </div>
                ${lot.aiNote ? `<div class="ai-note"><strong>Opus:</strong> ${lot.aiNote}</div>` : ""}
                <div class="lot-card__footer">
                    <div class="lot-card__actions">
                        ${lot.directionsUrl ? `
                            <a class="ghost-link" href="${lot.directionsUrl}" target="_blank" rel="noopener">
                                Open in Maps
                            </a>
                        ` : ""}
                        <button class="ghost-link" onclick="showDirections(${lot.lat}, ${lot.lng}, '${lot.name.replace(/'/g, "\\'")}')" style="border: none; background: none; cursor: pointer; color: inherit; text-decoration: underline;">
                            Show route
                        </button>
                    </div>
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
    const avgConfidence =
        lots.reduce((sum, lot) => sum + (lot.confidence || 0), 0) / lots.length;

    statAvailability.textContent = totalSpaces;
    if (statRate) statRate.textContent = "—";
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
    const topLot = lots[0];

    mapOverlayHeadline.textContent =
        `${topLot.name} trending ${avgConfidence.toFixed(0)}% confidence`;
    mapOverlaySubline.textContent =
        `${topLot.spaces} open bays available`;
};

const renderChatHistory = () => {
    if (!aiChatLog) return;

    if (!aiChatHistory.length) {
        aiChatLog.innerHTML = `<div class="chat-tip">Ask Opus why these lots rank the way they do.</div>`;
        return;
    }

    aiChatLog.innerHTML = aiChatHistory
        .map(
            msg => `
            <div class="chat-bubble ${msg.role}">
                ${msg.content}
            </div>`
        )
        .join("");

    if (chatBusy) {
        aiChatLog.innerHTML += `<div class="chat-bubble assistant typing">Opus is thinking…</div>`;
    }

    aiChatLog.scrollTop = aiChatLog.scrollHeight;
};

const appendChatMessage = (role, content) => {
    if (!content) return;
    aiChatHistory.push({ role, content });
    renderChatHistory();
};

const primeChatWithSummary = summary => {
    if (!summary || aiChatPrimed) return;
    appendChatMessage("assistant", summary);
    aiChatPrimed = true;
};

const resetChatContext = (city, preferenceText) => {
    const key = `${city || ""}::${preferenceText || ""}`;
    if (key === chatContextKey) return;
    chatContextKey = key;
    aiChatHistory = [];
    aiChatPrimed = false;
    renderChatHistory();
};

const sendChatMessage = async message => {
    if (!message || !API_BASE_URL) return;
    appendChatMessage("user", message);
    chatBusy = true;
    renderChatHistory();

    const payload = {
        messages: aiChatHistory.map(item => ({
            role: item.role,
            content: item.content
        })),
        city: lastAICity,
        preference: preferenceInput?.value?.trim() || "",
        lot_ids: (lastLotsSnapshot || []).map(lot => String(lot.id))
    };

    try {
        const res = await fetch(`${API_BASE_URL}/opus-chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error(`Chat failed with status ${res.status}`);
        }
        const data = await res.json();
        appendChatMessage("assistant", data.reply || "Opus replied without content.");
    } catch (err) {
        console.warn("Opus chat failed:", err);
        appendChatMessage("assistant", "Opus is offline right now. Try again shortly.");
    } finally {
        chatBusy = false;
        renderChatHistory();
    }
};

const updateAIBriefing = (lots, preferenceText = "") => {
    if (!aiSummaryEl || !aiHighlightsEl) return;

    const trimmedPreference = preferenceText?.trim() || "";
    const notes = lots.filter(lot => lot.aiNote);
    const summaryHolder = lots.find(lot => lot.aiSummary);
    const insightsHolder = lots.find(
        lot => Array.isArray(lot.aiInsights) && lot.aiInsights.length
    );

    if (!lots.length && !trimmedPreference) {
        aiSummaryEl.textContent = "Share trip context above to unlock Opus guidance.";
        if (aiStatusTag) aiStatusTag.textContent = "Idle";
        aiHighlightsEl.innerHTML = `<li>Waiting for your next query.</li>`;
        return;
    }

    if (summaryHolder?.aiSummary) {
        aiSummaryEl.textContent = summaryHolder.aiSummary;
        const label = summaryHolder.aiSource === "cache"
            ? "Cached"
            : summaryHolder.aiSource === "fallback"
            ? "Offline"
            : "Opus Live";
        if (aiStatusTag) aiStatusTag.textContent = label;
        primeChatWithSummary(summaryHolder.aiSummary);
    } else if (trimmedPreference) {
        aiSummaryEl.textContent = "Opus is analyzing your preference against live lots.";
        if (aiStatusTag) aiStatusTag.textContent = "Thinking";
    } else {
        aiSummaryEl.textContent = "Add a note above to brief Opus about this ride.";
        if (aiStatusTag) aiStatusTag.textContent = "Idle";
    }

    if (insightsHolder?.aiInsights?.length) {
        aiHighlightsEl.innerHTML = insightsHolder.aiInsights
            .slice(0, 3)
            .map(
                insight => `
                <li>
                    <strong>Opus insight</strong>
                    <span>${insight}</span>
                </li>`
            )
            .join("");
        return;
    }

    if (notes.length) {
        aiHighlightsEl.innerHTML = notes
            .slice(0, 3)
            .map(
                lot => `
                <li>
                    <strong>${lot.name}</strong>
                    <span>${lot.aiNote}</span>
                </li>`
            )
            .join("");
    } else {
        aiHighlightsEl.innerHTML = `<li>${trimmedPreference ? "Listening for Opus response…" : "Opus is calibrating next insight."}</li>`;
    }
};

const updateHeroFeed = messages => {
    if (!heroFeedList) return;
    heroFeedList.innerHTML = messages.map(line => `<li>${line}</li>`).join("");
};

// Google Maps initialization
window.initGoogleMaps = async () => {
    try {
        const configRes = await fetch(`${API_BASE_URL}/config`);
        const config = await configRes.json();
        const apiKey = config.google_maps_api_key;
        
        if (!apiKey) {
            console.error("Google Maps API key not found");
            return;
        }

        // Load Google Maps script dynamically if not already loaded
        if (!window.google || !window.google.maps) {
            window.initGoogleMapsMapCallback = initGoogleMapsMap;
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions&callback=initGoogleMapsMapCallback`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
            return;
        }

        initGoogleMapsMap();
    } catch (err) {
        console.error("Failed to load Google Maps config:", err);
    }
};

const initGoogleMapsMap = () => {
    const mapEl = document.getElementById("mapPreview");
    if (!mapEl || !window.google) return;

    liveMap = new google.maps.Map(mapEl, {
        center: { lat: 25.2048, lng: 55.2708 },
        zoom: 12,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: liveMap,
        suppressMarkers: false,
    });

    // Initialize Places Autocomplete
    if (originDisplayInput && window.google.maps.places) {
        const citySelect = document.getElementById("city");
        const getCityBounds = () => {
            const city = citySelect?.value || "Dubai";
            const bounds = {
                "Dubai": { north: 25.5, south: 24.8, east: 55.6, west: 54.8 },
                "Abu Dhabi": { north: 24.7, south: 24.2, east: 54.8, west: 54.2 },
                "Sharjah": { north: 25.5, south: 25.2, east: 55.6, west: 55.2 },
            };
            return bounds[city] || bounds["Dubai"];
        };

        autocomplete = new google.maps.places.Autocomplete(originDisplayInput, {
            bounds: new google.maps.LatLngBounds(
                new google.maps.LatLng(getCityBounds().south, getCityBounds().west),
                new google.maps.LatLng(getCityBounds().north, getCityBounds().east)
            ),
            componentRestrictions: { country: "ae" },
            fields: ["geometry", "formatted_address", "name"],
        });

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.geometry) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const label = place.formatted_address || place.name || originDisplayInput.value;
                setOriginFields(lat, lng, label);
            }
        });

        // Update bounds when city changes
        if (citySelect) {
            citySelect.addEventListener("change", () => {
                if (autocomplete) {
                    autocomplete.setBounds(
                        new google.maps.LatLngBounds(
                            new google.maps.LatLng(getCityBounds().south, getCityBounds().west),
                            new google.maps.LatLng(getCityBounds().north, getCityBounds().east)
                        )
                    );
                }
            });
        }
    }
};

const updateOriginMarker = (lat, lng, label) => {
    if (!liveMap) return;
    
    if (originMarker) {
        originMarker.setMap(null);
    }
    
    originMarker = new google.maps.Marker({
        position: { lat, lng },
        map: liveMap,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#00bcd4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
        },
        title: label || "Origin",
    });

    const infoWindow = new google.maps.InfoWindow({
        content: `<strong>Origin</strong><br>${label || "Your location"}`,
    });
    originMarker.addListener("click", () => {
        infoWindow.open(liveMap, originMarker);
    });
};

const getOriginFromResults = lots => {
    const first = lots?.[0];
    if (first?.requestOriginLat && first?.requestOriginLng) {
        return { lat: first.requestOriginLat, lng: first.requestOriginLng };
    }
    if (originLatInput?.value && originLngInput?.value) {
        return {
            lat: parseFloat(originLatInput.value),
            lng: parseFloat(originLngInput.value)
        };
    }
    return null;
};

const plotLotsOnMap = (city, lots) => {
    if (!liveMap) return;
    
    // Clear existing parking markers
    parkingMarkers.forEach(marker => marker.setMap(null));
    parkingMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    const origin = getOriginFromResults(lots);

    if (origin?.lat && origin?.lng) {
        updateOriginMarker(origin.lat, origin.lng, lastOriginLabel || city);
        bounds.extend({ lat: origin.lat, lng: origin.lng });
    }

    lots.forEach(lot => {
        if (!lot.lat || !lot.lng) return;
        
        const marker = new google.maps.Marker({
            position: { lat: lot.lat, lng: lot.lng },
            map: liveMap,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#4caf50",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
            },
            title: lot.name,
        });

        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 8px;">
                    <strong>${lot.name}</strong><br />
                    ${lot.distanceText || ""} ${lot.durationText ? ` · ${lot.durationText}` : ""}
                    <br /><br />
                    <button onclick="showDirections(${lot.lat}, ${lot.lng}, '${lot.name.replace(/'/g, "\\'")}')" 
                            style="background: #00bcd4; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                        Get directions
                    </button>
                </div>
            `,
        });

        marker.addListener("click", () => {
            infoWindow.open(liveMap, marker);
        });

        parkingMarkers.push(marker);
        bounds.extend({ lat: lot.lat, lng: lot.lng });
    });

    if (bounds.getNorthEast().lat() !== bounds.getSouthWest().lat()) {
        liveMap.fitBounds(bounds, { padding: 50 });
    } else if (origin?.lat && origin?.lng) {
        liveMap.setCenter({ lat: origin.lat, lng: origin.lng });
        liveMap.setZoom(13);
    } else {
        liveMap.setCenter({ lat: 25.2048, lng: 55.2708 });
        liveMap.setZoom(11);
    }
};

// Global function for directions button
window.showDirections = (destLat, destLng, destName) => {
    if (!directionsService || !directionsRenderer || !liveMap) return;
    
    const origin = getOriginFromResults(lastLotsSnapshot);
    if (!origin?.lat || !origin?.lng) {
        alert("Please set an origin location first.");
        return;
    }

    directionsService.route(
        {
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destLat, lng: destLng },
            travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
            if (status === "OK") {
                directionsRenderer.setDirections(result);
                activeDirectionsRoute = result;
                
                // Close all info windows
                parkingMarkers.forEach(marker => {
                    google.maps.event.clearInstanceListeners(marker);
                });

                const mapPanel = document.getElementById("mapPreview");
                if (mapPanel?.scrollIntoView) {
                    mapPanel.scrollIntoView({ behavior: "auto", block: "center" });
                }
            } else {
                console.error("Directions request failed:", status);
                alert("Unable to calculate directions. Please try again.");
            }
        }
    );
};

const handleSortChange = mode => {
    currentSortMode = mode;
    if (form) {
        form.dispatchEvent(new Event("submit"));
    }
};

const updateOriginStatus = (city, originSource) => {
    if (!locationStatus) return;
    if (originSource === "user") {
        locationStatus.textContent = "Live ETAs powered by your shared location.";
        return;
    }
    if (originSource === "city") {
        locationStatus.textContent = `Using ${city} city center for ETA. Share your location for hyper-local routing.`;
        return;
    }
    locationStatus.textContent = "Share your location to unlock live travel times.";
};

// -----------------------------------------------------
//  API HELPERS
// -----------------------------------------------------
const withTimeout = (ms, controller) =>
    setTimeout(() => controller.abort(), ms);

const geocodeAddress = async (query, city) => {
    if (!API_BASE_URL || !query) return null;
    const params = new URLSearchParams({ text: query });
    if (city) params.append("city", city);

    try {
        const res = await fetch(`${API_BASE_URL}/geocode?${params.toString()}`);
        if (!res.ok) throw new Error("Geocode failed");
        return await res.json();
    } catch (err) {
        console.warn("Geocoding failed:", err);
        return null;
    }
};

const ensureOriginCoordinates = async city => {
    if (originLatInput?.value && originLngInput?.value) {
        return true;
    }
    const query = originDisplayInput?.value?.trim();
    if (!query) return false;
    
    // Try using Places Autocomplete first if available
    if (autocomplete && window.google && window.google.maps) {
        const geocoder = new google.maps.Geocoder();
        return new Promise((resolve) => {
            geocoder.geocode({ address: query, componentRestrictions: { country: "ae" } }, (results, status) => {
                if (status === "OK" && results[0]) {
                    const location = results[0].geometry.location;
                    setOriginFields(location.lat(), location.lng(), results[0].formatted_address || query);
                    resolve(true);
                } else {
                    // Fallback to backend geocoding
                    geocodeAddress(query, city).then(result => {
                        if (result?.lat && result?.lng) {
                            setOriginFields(result.lat, result.lng, result.label || query);
                            resolve(true);
                        } else {
                            if (locationStatus) {
                                locationStatus.textContent = "Unable to resolve that location. Try a different landmark.";
                            }
                            resolve(false);
                        }
                    });
                }
            });
        });
    }
    
    // Fallback to backend geocoding
    const result = await geocodeAddress(query, city);
    if (result?.lat && result?.lng) {
        setOriginFields(result.lat, result.lng, result.label || query);
        return true;
    }
    if (locationStatus) {
        locationStatus.textContent = "Unable to resolve that location. Try a different landmark.";
    }
    return false;
};

const fetchSuggestions = async payload => {
    if (!API_BASE_URL) return null;

    const controller = new AbortController();
    const timeout = withTimeout(3500, controller);

    try {
        const requestPayload = {
            ...payload,
            sort: currentSortMode
        };

        const res = await fetch(`${API_BASE_URL}/suggest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
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
    const preferenceText = preferenceInput?.value?.trim() || "";

    const vehicleType = vehicleEl
        ? vehicleEl.value.toLowerCase() === "ev"
            ? "ev"
            : "standard"
        : "standard";

    const durationHours = durationEl
        ? parseInt(durationEl.value, 10) || 1
        : 1;

    resetChatContext(city, preferenceText);
    lastAICity = city;
    lastLotsSnapshot = [];

    await ensureOriginCoordinates(city);
    setLoading(true);
    updateAIBriefing([], preferenceText);

    const payload = {
        city,
        results: 6,
        prefer_covered: preferCovered,
        vehicle_type: vehicleType,
        duration_hours: durationHours
    };
    if (originDisplayInput?.value?.trim()) {
        payload.origin_text = originDisplayInput.value.trim();
    }
    if (originLatInput?.value && originLngInput?.value) {
        payload.origin_lat = parseFloat(originLatInput.value);
        payload.origin_lng = parseFloat(originLngInput.value);
    }
    if (preferenceText) {
        payload.preference_prompt = preferenceText;
    }

    const apiResults = await fetchSuggestions(payload);
    const matches =
        apiResults && apiResults.length
            ? apiResults
            : filterFallbackLots(city);

    renderResults(matches);
    updateStats(matches);
    updateMapNarrative(city, matches);
    updateOriginStatus(city, matches[0]?.originSource);
    updateAIBriefing(matches, preferenceText);
    lastLotsSnapshot = matches;
    plotLotsOnMap(city, matches);

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
    const sortDistanceBtn = document.getElementById("sortDistance");
    const sortRatingBtn = document.getElementById("sortRating");
    const sortCongestionBtn = document.getElementById("sortCongestion");

    if (sortDistanceBtn) {
        sortDistanceBtn.addEventListener("click", () => handleSortChange("distance"));
    }
    if (sortRatingBtn) {
        sortRatingBtn.addEventListener("click", () => handleSortChange("rating"));
    }
    if (sortCongestionBtn) {
        sortCongestionBtn.addEventListener("click", () => handleSortChange("congestion"));
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
    updateAIBriefing([], "");

    // Initialize Google Maps
    if (window.google && window.google.maps) {
        initGoogleMapsMap();
    } else {
        initGoogleMaps();
    }

    findParking();          // run initial search
    setInterval(rotateDispatchFeed, 6000);

    renderChatHistory();
    if (aiChatForm) {
        aiChatForm.addEventListener("submit", event => {
            event.preventDefault();
            const text = aiChatInput?.value?.trim();
            if (!text) return;
            aiChatInput.value = "";
            sendChatMessage(text);
        });
    }
});
