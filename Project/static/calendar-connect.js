// Google Calendar Connection Script

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Starting Google Calendar initialization...');
    // Display current date
    updateCurrentDate();
    
    // Wait a bit for Google libraries to load
    setTimeout(initializeGoogleCalendar, 1000);
});

function updateCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = new Date().toLocaleDateString('en-US', options);
    }
}

function initializeGoogleCalendar() {
    // Check if credentials are set
    if (typeof GOOGLE_CLIENT_ID === 'undefined' || 
        typeof GOOGLE_API_KEY === 'undefined' || 
        GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID') || 
        GOOGLE_API_KEY.includes('YOUR_API_KEY')) {
        console.warn('⚠️ Google API credentials not configured');
        showCredentialsWarning();
        return;
    }

    // Load GAPI client
    if (typeof gapi !== 'undefined') {
        gapi.load('client', initGapiClient);
    } else {
        console.log('⏳ Waiting for Google API to load...');
        setTimeout(initializeGoogleCalendar, 1000);
        return;
    }
    
    // Load GIS (Google Identity Services)
    if (typeof google !== 'undefined' && google.accounts) {
        initGisClient();
    } else {
        console.log('⏳ Waiting for Google Identity Services to load...');
        setTimeout(initializeGoogleCalendar, 1000);
        return;
    }
}

function showCredentialsWarning() {
    const connectBtn = document.getElementById('connect-calendar-btn');
    if (connectBtn) {
        connectBtn.textContent = '⚠️ Configure API Credentials';
        connectBtn.onclick = () => {
            alert('Please configure your Google API credentials:\n\n' +
                  '1. Go to https://console.cloud.google.com/\n' +
                  '2. Create a project and enable Google Calendar API\n' +
                  '3. Create OAuth 2.0 credentials\n' +
                  '4. Add your credentials to the HTML file\n\n' +
                  'See instructions in the code comments.');
        };
    }
}

async function initGapiClient() {
    try {
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        });
        gapiInited = true;
        console.log('✅ Google API initialized');
        checkIfReady();
    } catch (error) {
        console.error('❌ Error initializing GAPI:', error);
        alert('Error initializing Google API. Please check your API key.');
    }
}

function initGisClient() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
            callback: '', // Will be set during request
        });
        gisInited = true;
        console.log('✅ Google Identity Services initialized');
        checkIfReady();
    } catch (error) {
        console.error('❌ Error initializing GIS:', error);
        alert('Error initializing Google Sign-In. Please check your Client ID.');
    }
}

function checkIfReady() {
    if (gapiInited && gisInited) {
        console.log('✅ Google Calendar ready');
        
        // Enable the connect button
        const connectBtn = document.getElementById('connect-calendar-btn');
        if (connectBtn) {
            connectBtn.onclick = handleConnectClick;
            connectBtn.style.opacity = '1';
            connectBtn.style.cursor = 'pointer';
        }
        
        // Set up disconnect button
        const disconnectBtn = document.getElementById('disconnect-btn');
        if (disconnectBtn) {
            disconnectBtn.onclick = handleDisconnectClick;
        }
    }
}

function handleConnectClick() {
    if (!gapiInited || !gisInited) {
        alert('Google Calendar is still loading. Please wait a moment and try again.');
        return;
    }

    tokenClient.callback = async (response) => {
        if (response.error !== undefined) {
            console.error('❌ Auth error:', response);
            alert('Failed to connect to Google Calendar. Please try again.');
            return;
        }
        
        console.log('✅ Successfully authenticated');
        await onCalendarConnected();
    };

    if (gapi.client.getToken() === null) {
        // Request access token
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Skip display of account chooser and consent dialog for an existing session.
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleDisconnectClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            console.log('Token revoked');
        });
        gapi.client.setToken('');
    }
    
    onCalendarDisconnected();
}

async function onCalendarConnected() {
    try {
        // Get user's calendar info
        const response = await gapi.client.calendar.calendarList.list({
            maxResults: 10
        });
        
        const primaryCalendar = response.result.items.find(cal => cal.primary) || response.result.items[0];
        const userEmail = primaryCalendar.id;
        
        console.log('📧 Connected as:', userEmail);
        
        // Update UI
        document.getElementById('connect-calendar-btn').style.display = 'none';
        document.getElementById('connection-status').style.display = 'inline-block';
        document.getElementById('user-email').textContent = userEmail;
        
        const overlay = document.getElementById('calendar-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // Update iframe to show user's calendar
        const iframe = document.getElementById('calendar-iframe');
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        iframe.src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(userEmail)}&ctz=${encodeURIComponent(userTimezone)}&mode=MONTH&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0`;
        
        // Load events
        await loadUserEvents();
        
        // Show success message
        showNotification('✅ Successfully connected your Google Calendar!', 'success');
        
    } catch (error) {
        console.error('❌ Error loading calendar:', error);
        alert('Error loading calendar. Please try again.');
    }
}

function onCalendarDisconnected() {
    console.log('🔌 Disconnecting from Google Calendar');
    
    // Reset UI
    document.getElementById('connect-calendar-btn').style.display = 'inline-block';
    document.getElementById('connection-status').style.display = 'none';
    document.getElementById('user-email').textContent = '';
    
    const overlay = document.getElementById('calendar-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
    
    // Reset iframe to default calendar
    const iframe = document.getElementById('calendar-iframe');
    iframe.src = 'https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America/Chicago&mode=MONTH&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0';
    
    // Clear events
    document.getElementById('events-list').innerHTML = '<p class="no-events-text">Connect your calendar to see events</p>';
    document.getElementById('upcoming-events').innerHTML = '<p class="no-events-text">Connect your calendar to see upcoming events</p>';
    
    showNotification('Disconnected from Google Calendar', 'info');
}

async function loadUserEvents() {
    try {
        const now = new Date();
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
        
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': timeMin,
            'timeMax': timeMax,
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 50,
            'orderBy': 'startTime'
        });

        const events = response.result.items || [];
        console.log(`📅 Loaded ${events.length} events`);
        
        // Display today's events
        displayTodayEvents(events);
        
        // Display upcoming events
        displayUpcomingEvents(events);
        
    } catch (error) {
        console.error('❌ Error loading events:', error);
        showNotification('Error loading events', 'error');
    }
}

function displayTodayEvents(events) {
    const eventsPanel = document.getElementById('events-list');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEvents = events.filter(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        return eventDate >= today && eventDate < tomorrow;
    });

    if (todayEvents.length === 0) {
        eventsPanel.innerHTML = '<p class="no-events-text">No events today</p>';
        return;
    }

    eventsPanel.innerHTML = '';
    todayEvents.forEach(event => {
        const time = event.start.dateTime 
            ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'All day';
        
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item';
        eventDiv.innerHTML = `
            <div class="event-time">${time}</div>
            <div class="event-details">
                <strong>${escapeHtml(event.summary || 'Untitled Event')}</strong>
                ${event.location ? `<p class="event-location">📍 ${escapeHtml(event.location)}</p>` : ''}
            </div>
        `;
        eventsPanel.appendChild(eventDiv);
    });
}

function displayUpcomingEvents(events) {
    const upcomingContainer = document.getElementById('upcoming-events');
    
    if (events.length === 0) {
        upcomingContainer.innerHTML = '<p class="no-events-text">No upcoming events</p>';
        return;
    }

    upcomingContainer.innerHTML = '';
    
    // Show up to 10 upcoming events
    const upcomingEvents = events.slice(0, 10);
    
    upcomingEvents.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const startDate = new Date(start);
        
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.innerHTML = `
            <h4>${escapeHtml(event.summary || 'Untitled Event')}</h4>
            <p>📅 ${startDate.toLocaleDateString()}</p>
            <p>🕐 ${event.start.dateTime ? startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'All day'}</p>
            ${event.location ? `<p>📍 ${escapeHtml(event.location)}</p>` : ''}
            ${event.description ? `<p class="event-description">${escapeHtml(event.description.substring(0, 100))}${event.description.length > 100 ? '...' : ''}</p>` : ''}
        `;
        
        // Add click handler to show more details
        eventCard.style.cursor = 'pointer';
        eventCard.onclick = () => showEventDetails(event);
        
        upcomingContainer.appendChild(eventCard);
    });
}

function showEventDetails(event) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    
    const start = event.start.dateTime || event.start.date;
    const startDate = new Date(start);
    
    document.getElementById('detail-title').textContent = event.summary || 'Untitled Event';
    document.getElementById('detail-date').textContent = startDate.toLocaleDateString();
    document.getElementById('detail-time').textContent = event.start.dateTime 
        ? startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        : 'All day';
    document.getElementById('detail-location').textContent = event.location || 'No location';
    document.getElementById('detail-host').textContent = event.organizer?.email || 'Unknown';
    document.getElementById('detail-description').textContent = event.description || 'No description';
    
    const link = document.getElementById('detail-link');
    if (event.htmlLink) {
        link.href = event.htmlLink;
        link.style.display = 'inline-block';
    } else {
        link.style.display = 'none';
    }
    
    modal.style.display = 'flex';
}

// Helper function to escape HTML and prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notification helper
function showNotification(message, type = 'info') {
    // You can implement a toast notification here
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Export functions for use in other scripts
window.calendarAPI = {
    isConnected: () => gapi.client.getToken() !== null,
    getToken: () => gapi.client.getToken(),
    addEvent: async (eventDetails) => {
        if (!gapi.client.getToken()) {
            throw new Error('Not connected to Google Calendar');
        }
        
        return await gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': eventDetails
        });
    }
};