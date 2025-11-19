// Simple Google Calendar Connection Script

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for Google libraries to load
    setTimeout(initializeGoogleCalendar, 1000);
});

function initializeGoogleCalendar() {
    // Load GAPI client
    if (typeof gapi !== 'undefined') {
        gapi.load('client', initGapiClient);
    } else {
        console.log('Waiting for Google API to load...');
        setTimeout(initializeGoogleCalendar, 1000);
        return;
    }
    
    // Load GIS (Google Identity Services)
    if (typeof google !== 'undefined' && google.accounts) {
        initGisClient();
    } else {
        console.log('Waiting for Google Identity Services to load...');
        setTimeout(initializeGoogleCalendar, 1000);
        return;
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
    } catch (error) {
        console.error('Error initializing GAPI:', error);
    }
}

function initGisClient() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/calendar.readonly',
            callback: '', // Will be set during request
        });
        gisInited = true;
        console.log('✅ Google Identity Services initialized');
        
        // Enable the connect button
        const connectBtn = document.getElementById('connect-calendar-btn');
        if (connectBtn) {
            connectBtn.onclick = handleConnectClick;
        }
        
        const disconnectBtn = document.getElementById('disconnect-btn');
        if (disconnectBtn) {
            disconnectBtn.onclick = handleDisconnectClick;
        }
    } catch (error) {
        console.error('Error initializing GIS:', error);
    }
}

function handleConnectClick() {
    if (!gapiInited || !gisInited) {
        alert('Google Calendar is still loading. Please wait a moment and try again.');
        return;
    }

    tokenClient.callback = async (response) => {
        if (response.error !== undefined) {
            console.error('Auth error:', response);
            alert('Failed to connect. Please try again.');
            return;
        }
        
        console.log('✅ Connected to Google Calendar');
        await onCalendarConnected();
    };

    if (gapi.client.getToken() === null) {
        // Request access token
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Already have token
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function handleDisconnectClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
    }
    
    onCalendarDisconnected();
}

async function onCalendarConnected() {
    try {
        // Get user's calendar info
        const response = await gapi.client.calendar.calendarList.list({
            maxResults: 1
        });
        
        const primaryCalendar = response.result.items.find(cal => cal.primary) || response.result.items[0];
        const userEmail = primaryCalendar.id;
        
        // Update UI
        document.getElementById('connect-calendar-btn').style.display = 'none';
        document.getElementById('connection-status').style.display = 'inline-block';
        document.getElementById('user-email').textContent = userEmail;
        document.getElementById('calendar-overlay').style.display = 'none';
        
        // Update iframe to show user's calendar
        const iframe = document.getElementById('calendar-iframe');
        iframe.src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(userEmail)}&ctz=America/Chicago&mode=MONTH&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0`;
        
        // Load events
        await loadUserEvents();
        
        alert('✅ Successfully connected your Google Calendar!');
    } catch (error) {
        console.error('Error loading calendar:', error);
        alert('Error loading calendar. Please try again.');
    }
}

function onCalendarDisconnected() {
    // Reset UI
    document.getElementById('connect-calendar-btn').style.display = 'inline-block';
    document.getElementById('connection-status').style.display = 'none';
    document.getElementById('user-email').textContent = '';
    document.getElementById('calendar-overlay').style.display = 'flex';
    
    // Reset iframe to default calendar
    const iframe = document.getElementById('calendar-iframe');
    iframe.src = 'https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America/Chicago&mode=MONTH&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0';
    
    // Clear events
    document.getElementById('events-list').innerHTML = '<p class="no-events-text">Connect your calendar to see events</p>';
    document.getElementById('upcoming-events').innerHTML = '<p class="no-events-text">Connect your calendar to see upcoming events</p>';
    
    console.log('Disconnected from Google Calendar');
}

async function loadUserEvents() {
    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 10,
            'orderBy': 'startTime'
        });

        const events = response.result.items || [];
        
        // Display today's events
        displayTodayEvents(events);
        
        // Display upcoming events
        displayUpcomingEvents(events);
        
    } catch (error) {
        console.error('Error loading events:', error);
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
            <strong>${time}</strong> - ${event.summary || 'Untitled Event'}
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
    events.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const startDate = new Date(start);
        
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        eventCard.innerHTML = `
            <h4>${event.summary || 'Untitled Event'}</h4>
            <p>📅 ${startDate.toLocaleDateString()}</p>
            <p>🕐 ${event.start.dateTime ? startDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'All day'}</p>
            ${event.location ? `<p>📍 ${event.location}</p>` : ''}
        `;
        upcomingContainer.appendChild(eventCard);
    });
}


