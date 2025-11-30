// Google Calendar Connection Script

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Starting Google Calendar initialization...');
    
    // Wait a bit for Google libraries to load
    setTimeout(initializeGoogleCalendar, 1000);
});

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

        // Set up refresh button
        const refreshBtn = document.getElementById('refresh-calendar-btn');
        if (refreshBtn) {
            refreshBtn.onclick = handleRefreshClick;
        }
    }
}

function handleRefreshClick() {
    console.log('🔄 Manually refreshing calendars...');

    // Refresh main calendar iframe
    const mainIframe = document.getElementById('calendar-iframe');
    if (mainIframe && mainIframe.src) {
        mainIframe.src = mainIframe.src;
    }

    // Refresh today's agenda iframe
    const agendaIframe = document.getElementById('today-agenda-iframe');
    if (agendaIframe && agendaIframe.src) {
        agendaIframe.src = agendaIframe.src;
    }

    showNotification('📅 Calendars refreshed!', 'success');
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
        // Get user's calendar info - fetch ALL calendars
        const response = await gapi.client.calendar.calendarList.list({
            minAccessRole: 'reader',
            showHidden: false
        });

        const calendars = response.result.items || [];
        const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];
        const userEmail = primaryCalendar.id;

        console.log(`📧 Connected as: ${userEmail}`);
        console.log(`📅 Found ${calendars.length} calendars`);

        // Update UI
        document.getElementById('connect-calendar-btn').style.display = 'none';
        document.getElementById('connection-status').style.display = 'inline-block';
        document.getElementById('user-email').textContent = userEmail;

        const overlay = document.getElementById('calendar-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        // Build iframe URL with ALL calendars
        const iframe = document.getElementById('calendar-iframe');
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Build URL with multiple calendar sources
        let iframeSrc = `https://calendar.google.com/calendar/embed?`;

        // Add each calendar as a source (show all calendars)
        calendars.forEach((cal, index) => {
            // Only add calendars that are selected to be shown
            if (cal.selected !== false) {
                iframeSrc += `src=${encodeURIComponent(cal.id)}&`;
                // Add color for each calendar
                if (cal.backgroundColor) {
                    const colorNumber = index % 24; // Google Calendar has 24 color options
                    iframeSrc += `color=${encodeURIComponent(cal.backgroundColor.replace('#', '%23'))}&`;
                }
            }
        });

        // Add display options
        iframeSrc += `ctz=${encodeURIComponent(userTimezone)}`;
        iframeSrc += `&mode=MONTH`;
        iframeSrc += `&showTitle=0`;
        iframeSrc += `&showNav=1`;
        iframeSrc += `&showDate=1`;
        iframeSrc += `&showPrint=0`;
        iframeSrc += `&showTabs=1`;        // Show tabs to switch between calendars
        iframeSrc += `&showCalendars=1`;   // Show calendar list on the side

        iframe.src = iframeSrc;

        // Update Today's Events iframe (AGENDA view)
        const todayIframe = document.getElementById('today-agenda-iframe');
        if (todayIframe) {
            let agendaSrc = `https://calendar.google.com/calendar/embed?mode=AGENDA`;

            // Add all calendars to agenda view too
            calendars.forEach((cal) => {
                if (cal.selected !== false) {
                    agendaSrc += `&src=${encodeURIComponent(cal.id)}`;
                }
            });

            agendaSrc += `&ctz=${encodeURIComponent(userTimezone)}`;
            agendaSrc += `&showTitle=0&showNav=0&showDate=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0`;

            todayIframe.src = agendaSrc;
        }

        // Show success message
        showNotification(`✅ Successfully connected ${calendars.length} calendars!`, 'success');

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

    // Reset today's agenda iframe
    const todayIframe = document.getElementById('today-agenda-iframe');
    if (todayIframe) {
        todayIframe.src = 'https://calendar.google.com/calendar/embed?mode=AGENDA&showTitle=0&showNav=0&showDate=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&height=400&wkst=1&ctz=America/Chicago&src=en.usa%23holiday%40group.v.calendar.google.com';
    }

    // Clear upcoming events
    document.getElementById('upcoming-events').innerHTML = '<p class="no-events-text">Connect your calendar to see upcoming events</p>';
    
    showNotification('Disconnected from Google Calendar', 'info');
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