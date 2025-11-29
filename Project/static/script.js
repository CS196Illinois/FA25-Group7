// EventFlow - Complete Client-Side Application
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import CalendarClient from "./calendar-client.js";

// ==================== CONFIGURATION ====================
const GOOGLE_API_KEY = "AIzaSyA7uXknS3AhXWG5IpcfdnI2eNo6-6hcmMA";
const GOOGLE_CLIENT_ID = "985871831044-dao07nebhsmstom8althg48hfrg97oeo.apps.googleusercontent.com";
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAKfE_dl9zp5U_BVaqOmsdbjKjb-2KOlFA",
    authDomain: "eventflowdatabase.firebaseapp.com",
    databaseURL: "https://eventflowdatabase-default-rtdb.firebaseio.com",
    projectId: "eventflowdatabase",
    storageBucket: "eventflowdatabase.firebasestorage.app",
    messagingSenderId: "611561258590",
    appId: "1:611561258590:web:16a4d352f06bdbbfad3ecf",
    measurementId: "G-0C45LS13MN"
};

// ==================== GLOBAL STATE ====================
let allEvents = []; // Scraped events from Firebase (for browse section)
let googleCalendarEvents = []; // User's Google Calendar events (for upcoming section)
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let googleCalendarClient = null;
let firebaseApp = null;
let database = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Firebase
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    database = getDatabase(firebaseApp);

    // Initialize Google Calendar Client (waits for GAPI internally)
    googleCalendarClient = new CalendarClient();

    // Load events from Firebase
    await loadEventsFromFirebase();

    // Initialize all components
    initializeUpcomingEvents();
    initializeBrowseEvents();
    initializeConnectionButtons();
});

// ==================== FIREBASE INTEGRATION ====================
async function loadEventsFromFirebase() {
    const eventsRef = ref(database, 'scraped_events');

    return new Promise((resolve) => {
        onValue(eventsRef, (snapshot) => {
            allEvents = [];
            const data = snapshot.val();

            if (data) {
                // Get the latest entry (Firebase stores with unique keys)
                const latestKey = Object.keys(data).sort().pop();
                const latestData = data[latestKey];

                if (latestData && latestData.data) {
                    // Convert Firebase data to events array
                    for (let id in latestData.data) {
                        let event = latestData.data[id];

                        // Parse ISO format dates
                        if (event.start && event.end) {
                            const startDate = new Date(event.start);
                            const endDate = new Date(event.end);

                            event.start_date = startDate.toLocaleDateString();
                            event.start_time = startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                            event.end_time = endDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                            event.title = event.summary;
                            event.host = event.organizer?.displayName || 'N/A';
                            event.event_link = event.htmlLink;
                        }

                        event.id = id;

                        // Skip past events
                        if (!isEventInPast(event)) {
                            allEvents.push(event);
                        }
                    }
                }
            }

            // Sort events
            sortEventsByTime();

            // Update UI
            setupCategories();
            displayBrowseEvents(allEvents);
            displayUpcomingEvents();

            resolve();
        }, {
            onlyOnce: false // Listen for real-time updates
        });
    });
}

// ==================== UPCOMING EVENTS (LEFT PANEL) ====================
function initializeUpcomingEvents() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            displayUpcomingEvents();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            displayUpcomingEvents();
        });
    }

    displayUpcomingEvents();
}

function displayUpcomingEvents() {
    const container = document.getElementById('upcoming-events-list');
    const monthYearDisplay = document.getElementById('current-month-year');
    const prevBtn = document.getElementById('prev-month');

    if (!container) return;

    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    if (monthYearDisplay) {
        monthYearDisplay.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }

    // Show/hide prev button - only show if viewing a future month
    const now = new Date();
    const currentDate = new Date(currentYear, currentMonth, 1);
    const nowDate = new Date(now.getFullYear(), now.getMonth(), 1);

    if (prevBtn) {
        if (currentDate > nowDate) {
            prevBtn.style.visibility = 'visible';
        } else {
            prevBtn.style.visibility = 'hidden';
        }
    }

    // Filter Google Calendar events for current month
    const monthEvents = googleCalendarEvents.filter(event => {
        // Parse from ISO string in event.start
        const eventDate = event.start ? new Date(event.start) : parseEventDate(event.start_date);
        if (!eventDate || isNaN(eventDate.getTime())) return false;
        return eventDate.getMonth() === currentMonth &&
               eventDate.getFullYear() === currentYear;
    });

    // Clear container
    container.innerHTML = '';

    if (monthEvents.length === 0) {
        container.innerHTML = '<p class="no-events-text">No upcoming events this month</p>';
        return;
    }

    // Create compact cards
    monthEvents.forEach(event => {
        const card = document.createElement('div');
        card.className = 'compact-event-card';

        const title = document.createElement('div');
        title.className = 'compact-event-title';
        title.textContent = event.title || 'Untitled Event';

        const date = document.createElement('div');
        date.className = 'compact-event-date';
        date.textContent = `📅 ${event.start_date}`;

        const moreBtn = document.createElement('button');
        moreBtn.className = 'compact-more-btn';
        moreBtn.innerHTML = '⋮';
        moreBtn.title = 'More details';
        moreBtn.addEventListener('click', () => showEventDetails(event));

        card.appendChild(title);
        card.appendChild(date);
        card.appendChild(moreBtn);

        container.appendChild(card);
    });
}

// ==================== BROWSE EVENTS (RIGHT PANEL) ====================
function initializeBrowseEvents() {
    const searchInput = document.getElementById("search-events");
    const categorySelect = document.getElementById("filter-category");
    const detailModal = document.getElementById("detail-modal");
    const closeButton = document.getElementById("close-detail");

    // Search listener
    if (searchInput) {
        searchInput.addEventListener('input', searchEvents);
    }

    // Category filter listener
    if (categorySelect) {
        categorySelect.addEventListener('change', searchEvents);
    }

    // Modal close listeners
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            detailModal.style.display = 'none';
        });
    }

    if (detailModal) {
        detailModal.addEventListener('click', (event) => {
            if (event.target === detailModal) {
                detailModal.style.display = 'none';
            }
        });
    }
}

function setupCategories() {
    const categorySelect = document.getElementById("filter-category");
    if (!categorySelect) return;

    let categories = [];

    // Get unique categories
    allEvents.forEach(event => {
        const tag = event.tag;
        if (tag && !categories.includes(tag)) {
            categories.push(tag);
        }
    });

    // Sort alphabetically
    categories.sort();

    // Clear existing options except "All"
    categorySelect.innerHTML = '<option value="all">All Categories</option>';

    // Add category options
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

function displayBrowseEvents(events) {
    const browseContainer = document.getElementById("browse-events");
    if (!browseContainer) return;

    browseContainer.innerHTML = '';

    if (events.length === 0) {
        browseContainer.innerHTML = '<p style="text-align: center; color: #888;">No events found</p>';
        return;
    }

    events.forEach(event => {
        const card = createEventCard(event);
        browseContainer.appendChild(card);
    });
}

function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event-card-browse';

    // Determine if all-day event
    let time = event.start_time;
    if (event.start_time === "12:00 AM" && event.end_time === "11:59 PM") {
        time = "All Day";
    }

    let html = '<div class="event-card-title">' + (event.title || 'Untitled Event') + '</div>';
    html += '<div class="event-card-info"><strong>📅</strong> ' + (event.start_date || 'Date TBA') + '</div>';
    html += '<div class="event-card-info"><strong>🕐</strong> ' + (time || 'Time TBA') + '</div>';
    html += '<div class="event-card-info"><strong>📍</strong> ' + (event.location || 'Location TBA') + '</div>';
    html += '<div class="event-card-footer">';
    html += '  <span class="event-tag">' + (event.tag || 'General') + '</span>';
    html += '  <div class="card-actions">';
    html += '    <button class="show-more-btn">Details</button>';
    html += '    <button class="add-to-calendar-btn">+ Add</button>';
    html += '  </div>';
    html += '</div>';

    card.innerHTML = html;

    // Add event listeners
    const detailsButton = card.querySelector('.show-more-btn');
    detailsButton.onclick = () => showEventDetails(event);

    const addButton = card.querySelector('.add-to-calendar-btn');
    addButton.onclick = () => addToGoogleCalendar(event);

    return card;
}

function showEventDetails(event) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;

    document.getElementById('detail-title').textContent = event.title || 'Untitled Event';
    document.getElementById('detail-date').textContent = event.start_date || 'TBA';

    // Parse times from ISO strings if needed
    let startTime = event.start_time;
    let endTime = event.end_time;

    if (event.start && event.end && (!startTime || !endTime)) {
        const start = new Date(event.start);
        const end = new Date(event.end);
        startTime = start.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        endTime = end.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    }

    // Handle all-day events
    if (startTime === "12:00 AM" && endTime === "11:59 PM") {
        document.getElementById('detail-time').textContent = "All Day";
    } else {
        document.getElementById('detail-time').textContent = (startTime || '') + ' - ' + (endTime || '');
    }

    document.getElementById('detail-location').textContent = event.location || 'TBA';
    document.getElementById('detail-host').textContent = event.host || 'N/A';
    document.getElementById('detail-tag').textContent = event.tag || 'General';
    document.getElementById('detail-description').textContent = event.description || 'No description available.';

    const linkElement = document.getElementById('detail-link');
    if (event.event_link) {
        linkElement.href = event.event_link;
        linkElement.style.display = 'inline-block';
    } else {
        linkElement.style.display = 'none';
    }

    modal.style.display = 'flex';
}

function searchEvents() {
    const searchInput = document.getElementById("search-events");
    const categorySelect = document.getElementById("filter-category");

    const searchText = searchInput.value.toLowerCase();
    const selectedCategory = categorySelect.value;

    const filtered = allEvents.filter(event => {
        // Check search text
        const matchesSearch = searchText === '' ||
            (event.title && event.title.toLowerCase().includes(searchText)) ||
            (event.description && event.description.toLowerCase().includes(searchText)) ||
            (event.location && event.location.toLowerCase().includes(searchText));

        // Check category
        const matchesCategory = selectedCategory === 'all' || event.tag === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    displayBrowseEvents(filtered);
}

// ==================== GOOGLE CALENDAR INTEGRATION ====================
function initializeConnectionButtons() {
    const connectBtn = document.getElementById('connect-calendar-btn');
    if (connectBtn) {
        connectBtn.addEventListener("click", async function() {
            try {
                // Initialize the Google Calendar connection
                await googleCalendarClient.connectGoogleCalendar(GOOGLE_API_KEY, GOOGLE_CLIENT_ID);

                // Fetch user's Google Calendar events
                const googleEvents = await googleCalendarClient.getGoogleCalendarEvents();
                console.log(`Fetched ${googleEvents.length} events from Google Calendar`);

                // Convert Google Calendar events to our format
                googleCalendarEvents = googleEvents.map(gEvent => {
                    // Use ISO strings directly from Google Calendar
                    const startISO = gEvent.start.dateTime || gEvent.start.date;
                    const endISO = gEvent.end.dateTime || gEvent.end.date;

                    const start = new Date(startISO);
                    const end = new Date(endISO);

                    return {
                        title: gEvent.summary,
                        description: gEvent.description || '',
                        location: gEvent.location || '',
                        start_date: start.toLocaleDateString(),
                        start_time: gEvent.start.dateTime ? start.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '12:00 AM',
                        end_time: gEvent.end.dateTime ? end.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '11:59 PM',
                        tag: 'Google Calendar',
                        host: gEvent.organizer?.displayName || gEvent.organizer?.email || 'Personal',
                        event_link: gEvent.htmlLink,
                        start: startISO,  // Store ISO string
                        end: endISO,      // Store ISO string
                        source: 'google'
                    };
                });

                // Display upcoming events from Google Calendar
                displayUpcomingEvents();

                // Update UI to show connected state
                const statusDiv = document.getElementById('connection-status');
                const emailSpan = document.getElementById('user-email');

                if (connectBtn) connectBtn.style.display = 'none';
                if (statusDiv) statusDiv.style.display = 'flex';
                if (emailSpan) {
                    const email = await googleCalendarClient.getGoogleCalendarEmail();
                    emailSpan.textContent = email;
                }
            } catch (error) {
                console.error('Error connecting to Google Calendar:', error);
                alert('Failed to connect. Please try again.');
            }
        });
    }

    const disconnectBtn = document.getElementById('disconnect-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', async function() {
            try {
                // Disconnect from Google Calendar and revoke access
                await googleCalendarClient.disconnectGoogleCalendar();

                // Clear Google Calendar events
                googleCalendarEvents = [];
                displayUpcomingEvents();

                // Update UI to show disconnected state
                const connectBtn = document.getElementById('connect-calendar-btn');
                const statusDiv = document.getElementById('connection-status');
                const emailSpan = document.getElementById('user-email');

                if (connectBtn) connectBtn.style.display = 'block';
                if (statusDiv) statusDiv.style.display = 'none';
                if (emailSpan) emailSpan.textContent = '';

                console.log('Disconnected from Google Calendar');
            } catch (error) {
                console.error('Error disconnecting:', error);
            }
        });
    }
}

/**
 * Add a scraped event to user's Google Calendar
 * Converts our event format to Google Calendar format and inserts it
 */
async function addToGoogleCalendar(event) {
    // Check if user is connected to Google Calendar
    if (!googleCalendarClient || !googleCalendarClient.isConnected()) {
        alert('Please connect your Google Calendar first!');
        return;
    }

    try {
        // Add the event using the CalendarClient
        // The client expects event.start and event.end as ISO datetime strings
        await googleCalendarClient.addGoogleCalendarEvent(event);

        alert(`"${event.title}" has been added to your Google Calendar!`);
    } catch (error) {
        console.error('Error adding event:', error);
        alert('Failed to add event to calendar. Please try again.');
    }
}

/**
 * Optional: Display Google Calendar events alongside scraped events
 * This function can merge user's personal calendar with campus events
 */
function displayGoogleCalendarEvents(googleEvents) {
    // Convert Google Calendar events to our format
    const convertedEvents = googleEvents.map(gEvent => {
        const start = new Date(gEvent.start.dateTime || gEvent.start.date);
        const end = new Date(gEvent.end.dateTime || gEvent.end.date);

        return {
            title: gEvent.summary,
            description: gEvent.description || '',
            location: gEvent.location || '',
            start_date: start.toLocaleDateString(),
            start_time: gEvent.start.dateTime ? start.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '12:00 AM',
            end_time: gEvent.end.dateTime ? end.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '11:59 PM',
            tag: 'Google Calendar',
            host: gEvent.organizer?.displayName || gEvent.organizer?.email || 'Personal',
            event_link: gEvent.htmlLink,
            start: gEvent.start.dateTime || gEvent.start.date,
            end: gEvent.end.dateTime || gEvent.end.date,
            source: 'google' // Mark as Google Calendar event
        };
    });

    // Merge with existing events and re-sort
    // allEvents = [...allEvents, ...convertedEvents];
    // sortEventsByTime();
    // displayBrowseEvents(allEvents);
    // displayUpcomingEvents();

    console.log('Google Calendar events ready to display:', convertedEvents.length);
}

// ==================== UTILITY FUNCTIONS ====================
function sortEventsByTime() {
    allEvents.sort((a, b) => {
        const dateA = getEventDateTime(a);
        const dateB = getEventDateTime(b);

        if (!dateA || !dateB) return 0;

        const dateDiff = dateA - dateB;
        if (dateDiff !== 0) return dateDiff;

        const timeA = a.start_time || '00:00';
        const timeB = b.start_time || '00:00';
        return timeA.localeCompare(timeB);
    });
}

function getEventDateTime(event) {
    if (!event.start_date || event.start_date === 'Date TBA') {
        return new Date('9999-12-31');
    }

    const dateStr = event.start_date;
    const timeStr = event.start_time || '00:00';
    const datetime = new Date(dateStr + ' ' + timeStr);

    if (isNaN(datetime.getTime())) {
        return new Date('9999-12-31');
    }

    return datetime;
}

function parseEventDate(dateStr) {
    if (!dateStr || dateStr === 'Date TBA') return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

function isEventInPast(event) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventDate = getEventDateTime(event);
    return eventDate < today;
}
