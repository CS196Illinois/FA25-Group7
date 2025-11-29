/**
 * This class handles all interactions with Google Calendar API including:
 * - Authentication and authorization
 * - Fetching user's calendar events
 * - Adding/removing events from calendar
 * - Comments by Claude Code
 */
export default class CalendarClient {
    constructor() {
        // OAuth token client for handling authentication
        this.tokenClient = null;
        // Track if Google API (GAPI) is ready
        this.gapiInitialized = false;
        // Track if Google Identity Services (GIS) is ready
        this.gisInitialized = false;
    }

    /**
     * Connect to user's Google Calendar
     * Initializes both the API client and authentication system
     */
    async connectGoogleCalendar(apiKey, clientId) {
        await this.initializeGoogleAPI(apiKey);
        await this.initializeGoogleIdentityServices(clientId);
    }

    /**
     * Disconnect from Google Calendar and revoke access
     * Clears all tokens and resets state
     */
    async disconnectGoogleCalendar() {
        // Check if user is authenticated before disconnecting
        const token = gapi.client.getToken();
        if (!token) {
            alert('No connection to disconnect.');
            return;
        }

        // Revoke the OAuth token to fully disconnect
        google.accounts.oauth2.revoke(token.access_token);

        // Clear the token from GAPI client
        gapi.client.setToken(null);

        // Reset instance state
        this.tokenClient = null;
        this.gapiInitialized = false;
        this.gisInitialized = false;

        console.log('✅ Disconnected from Google Calendar');
    }

    /**
     * Initialize Google API (GAPI) client
     * This sets up the API with your key and loads the Calendar v3 API
     */
    async initializeGoogleAPI(apiKey) {
        // Wait for GAPI library to be available and load client
        await new Promise((resolve) => {
            const loadGAPI = () => {
                if (typeof gapi !== 'undefined') {
                    gapi.load('client', () => {
                        console.log('✅ GAPI client loaded');
                        resolve();
                    });
                } else {
                    setTimeout(loadGAPI, 100);
                }
            };
            loadGAPI();
        });

        try {
            // Initialize GAPI client with API key
            await gapi.client.init({
                apiKey: apiKey,
                // Load the Calendar API v3 schema
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            });

            this.gapiInitialized = true;
            console.log('✅ Google API initialized');
        } catch (error) {
            console.error('Error initializing GAPI:', error);
            // Retry initialization after 1 second if it fails
            setTimeout(() => this.initializeGoogleAPI(apiKey), 1000);
        }
    }

    /**
     * Initialize Google Identity Services (GIS)
     * This sets up OAuth2 authentication for requesting user permission
     */
    async initializeGoogleIdentityServices(clientId) {
        try {
            // Create OAuth2 token client with required scopes
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                // Request permission to read AND write calendar events
                scope: 'https://www.googleapis.com/auth/calendar.events',
                // Callback will be set when requesting access
                callback: ''
            });

            this.gisInitialized = true;
            console.log('✅ Google Identity Services initialized');
        } catch (error) {
            console.error('Error initializing GIS:', error);
            // Retry initialization after 1 second if it fails
            setTimeout(() => this.initializeGoogleIdentityServices(clientId), 1000);
        }
    }

    /**
     * Get the email address of the connected Google account
     * Useful for displaying who is currently connected
     */
    async getGoogleCalendarEmail() {
        try {
            // Fetch list of all calendars user has access to
            const response = await gapi.client.calendar.calendarList.list();

            // Find the primary (main) calendar
            const primaryCalendar = response.result.items.find(cal => cal.primary);

            // Return the calendar ID (which is the user's email)
            return primaryCalendar ? primaryCalendar.id : 'Unknown';
        } catch (error) {
            console.error("Error fetching email:", error);
            return null;
        }
    }

    /**
     * Fetch events from user's Google Calendar
     * Returns a promise that resolves with an array of calendar events
     */
    async getGoogleCalendarEvents() {
        // Make sure everything is initialized before proceeding
        if (!this.gapiInitialized || !this.gisInitialized || !this.tokenClient) {
            alert('Google Calendar is still loading. Please wait a moment and try again.');
            return [];
        }

        // Create a promise to handle the async OAuth flow
        return new Promise((resolve) => {
            // Set callback for when user completes OAuth flow
            this.tokenClient.callback = async (response) => {
                // Check for authentication errors
                if (response.error !== undefined) {
                    console.error('Auth error:', response);
                    alert('Failed to connect. Please try again.');
                    resolve([]);
                    return;
                }

                console.log('✅ Connected to Google Calendar');

                try {
                    // Fetch events from next 12 months
                    const timeMin = new Date();
                    const timeMax = new Date();
                    timeMax.setFullYear(timeMax.getFullYear() + 1);

                    const eventsResponse = await gapi.client.calendar.events.list({
                        'calendarId': 'primary',  // User's main calendar
                        'timeMin': timeMin.toISOString(),
                        'timeMax': timeMax.toISOString(),
                        'showDeleted': false,     // Don't show deleted events
                        'singleEvents': true,     // Expand recurring events
                        'maxResults': 250,        // Get up to 250 events
                        'orderBy': 'startTime'    // Sort chronologically
                    });

                    // Return the events array
                    resolve(eventsResponse.result.items || []);

                } catch (error) {
                    console.error('Error loading events:', error);
                    resolve([]);
                }
            };

            // Request access token from user
            if (gapi.client.getToken() === null) {
                // First time - show consent screen
                this.tokenClient.requestAccessToken({prompt: 'consent'});
            } else {
                // Already authorized - silently refresh
                this.tokenClient.requestAccessToken({prompt: ''});
            }
        });
    }

    /**
     * Add an event to user's Google Calendar
     * Accepts event data with start/end ISO datetime strings
     */
    async addGoogleCalendarEvent(event) {
        try {
            // Ensure user is authenticated
            if (!gapi.client.getToken()) {
                alert('Please connect your Google Calendar first!');
                return null;
            }

            // Convert our event format to Google Calendar format
            const calendarEvent = {
                'summary': event.title,
                'location': event.location || '',
                'description': event.description || '',
                'start': {
                    // Use the ISO datetime from Firebase (event.start)
                    'dateTime': event.start,
                    'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                'end': {
                    // Use the ISO datetime from Firebase (event.end)
                    'dateTime': event.end,
                    'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            };

            // Insert the event into user's calendar
            const request = await gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': calendarEvent
            });

            console.log('✅ Event added to calendar:', request.result);
            return request.result;
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;  // Re-throw so caller can handle
        }
    }

    /**
     * Remove an event from user's Google Calendar
     * Requires the event ID from Google Calendar
     */
    async removeGoogleCalendarEvent(eventId, calendarId = "primary") {
        try {
            // Ensure user is authenticated
            if (!gapi.client.getToken()) {
                alert('Please connect your Google Calendar first!');
                return null;
            }

            // Delete the event from calendar
            const request = await gapi.client.calendar.events.delete({
                calendarId,
                eventId,
            });

            console.log(`✅ Event removed: ${eventId}`);
            return request.result;
        } catch (error) {
            console.error("Failed to delete event:", error);
            throw error;  // Re-throw so caller can handle
        }
    }

    /**
     * Check if user is currently connected to Google Calendar
     * Returns true if we have a valid access token
     */
    isConnected() {
        return typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken() !== null;
    }
}
