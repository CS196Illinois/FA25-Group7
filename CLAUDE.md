# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Flask-based campus event aggregation web application that scrapes events from 15+ university sources and displays them in an interactive calendar interface. The project is called "Calendar Crew" (Group 7).

## Development Commands

### Running the Application
```bash
cd Project
python app.py
```
The Flask development server starts on `http://localhost:5000`.

### Running Scrapers

**Via Modal (Production):**
```bash
cd Project
modal run scrape.py
```
This executes all three scrapers and sends data to Supabase. Requires Modal CLI and Supabase credentials configured in Modal secrets.

**Local Testing:**
```bash
cd Project
python scrape.py
```
Runs scrapers locally (calls `scrape()` function without Modal/Supabase integration).

### Installing Dependencies
```bash
# Main application dependencies
cd Project
pip install -r requirements.txt

# Google Calendar integration dependencies
cd Project/calendar
pip install -r requirements.txt
```

### Google Calendar Integration
```bash
cd Project/calendar
python add_scraped_events.py
```
First run will prompt for OAuth authentication. Requires `credentials.json` from Google Cloud Console.

## Architecture

### Application Structure

**Flask Backend ([app.py](Project/app.py))**
- Serves the web interface via Jinja2 templating
- Provides REST API at `/events` (GET returns all events from Supabase)
- Reads event data directly from Supabase `scraped_event_data` table (latest entry)
- Uses environment variables from `.env` file for Supabase credentials

**Web Scrapers ([scrape.py](Project/scrape.py))**
Three independent scrapers collect events:
1. `scrape_general()` - Static HTML scraping with BeautifulSoup from 10 calendars.illinois.edu URLs
2. `scrape_state_farm()` - Dynamic scraping with Playwright (headless browser) for statefarmcenter.com
3. `scrape_athletics()` - HTML parsing from 4 fightingillini.com sports schedules

The `scrape()` function orchestrates all three, merges results, and removes duplicates. Events are returned as a dictionary with numbered keys containing event objects with fields: title, description, start_date, end_date, start_time, end_time, location, tag, host, event_link.

**Modal + Supabase Integration ([scrape.py](Project/scrape.py))**
The scraper is now integrated with Modal for serverless execution:
- `run_scraper()` - Modal function scheduled weekly (Mondays 9 AM UTC via `modal.Cron("0 9 * * 1")`)
- Scraped data is sent directly to Supabase `scraped_event_data` table instead of local JSON files
- Requires Modal secrets named `supabase-creds` with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Modal image installs dependencies from requirements.txt and Playwright with Chromium
- Use `modal run scrape.py` to trigger manually, or `test()` local entrypoint for remote testing

### Frontend Architecture

**Template ([templates/index.html](Project/templates/index.html))**
Single-page interface with:
- Google Calendar iframe integration (syncs with user's calendar)
- Browse events section with Firebase real-time database
- Email events section with Outlook email parsing
- Event detail modal and add event modal
- Toast notification system

**JavaScript Module Architecture**
The frontend uses ES6 modules with a clean separation of concerns:

**[static/script.js](Project/static/script.js)** - Core utilities and UI (exports shared functions):
- `formatDate()`, `formatTime()`, `parseEventData()` - Date/time formatting utilities
- `createEventCard(event, options)` - Unified event card creation (used by all sections)
- `showEventDetails(event, hideEventLink)` - Event detail modal
- `showToast()` - Toast notification system
- `refreshCalendars()` - Refresh Google Calendar iframes
- Email parsing UI and streaming event display
- Add event modal handling (manual + AI text parsing)

**[static/browse-events.js](Project/static/browse-events.js)** - Browse events (imports from script.js):
- Imports: `formatDate`, `formatTime`, `parseEventData`, `createEventCard`, `showEventDetails`, `showToast`, `refreshCalendars`
- Firebase integration for scraped events
- Event sorting, filtering, and search
- Category filtering

**[static/calendar-connect.js](Project/static/calendar-connect.js)** - Google Calendar integration (exports):
- `addEventToGoogleCalendar(event)` - Main function to add events to Google Calendar
- `isCalendarConnected()` - Check if user is connected
- Google API OAuth2 authentication flow
- Calendar iframe management

**Key Architecture Pattern:**
```
script.js (core utilities) ⟷ calendar-connect.js (calendar functions)
           ↑
    browse-events.js (imports both)
```

**Styling ([static/style.css](Project/static/style.css))**
- `.event-card` class for all event cards (unified styling)
- Email events section has custom grid sizing (300px minimum width)
- Toast notification styles
- Modal styles (800px wide detail modal)

### Data Flow

```
Web Sources → scrape.py (Modal) → Firebase Realtime Database
                                          ↓
                                   browse-events.js (frontend)
                                          ↓
User Outlook Email → app.py (Flask) → parse_email.py (OpenAI) → Email event cards
                                          ↓
                          User Google Calendar ← calendar-connect.js (OAuth2)
```

**Event Data Pipeline:**
1. **Scraped Events**: Modal scraper runs weekly → Firebase → Browse events section
2. **Email Events**: User triggers parse → Flask SSE stream → Email events section
3. **Calendar Sync**: Users can add any event → Google Calendar via OAuth2
4. **Event Cards**: All events use `createEventCard()` with `parseEventData()` for consistent 12-hour time formatting

### Calendar Integration

[calendar/add_scraped_events.py](Project/calendar/add_scraped_events.py) bridges scraped events to Google Calendar via OAuth2. It validates event data, parses dates/times, and creates Google Calendar events with proper formatting.

## Key Files

**Backend:**
- [Project/app.py](Project/app.py) - Flask server with email parsing endpoints (`/api/process_emails_stream`, `/api/parse_text`)
- [Project/email_parser/parse_email.py](Project/email_parser/parse_email.py) - Outlook email fetching + OpenAI event extraction
- [Project/web_scraper/scrape.py](Project/web_scraper/scrape.py) - Modal scraper → Firebase (BeautifulSoup + Playwright)

**Frontend:**
- [Project/templates/index.html](Project/templates/index.html) - Single-page application template
- [Project/static/script.js](Project/static/script.js) - **Core utilities** (exports shared functions)
- [Project/static/calendar-connect.js](Project/static/calendar-connect.js) - **Google Calendar API** (exports calendar functions)
- [Project/static/browse-events.js](Project/static/browse-events.js) - **Firebase events** (imports from script.js & calendar-connect.js)
- [Project/static/style.css](Project/static/style.css) - Application styling

**Configuration:**
- [Project/config.py](Project/config.py) - API credentials (not committed, alternative to .env)

## Technology Stack

- **Backend:** Flask, BeautifulSoup4, Playwright, OpenAI API (GPT-4), Microsoft Graph API (Outlook)
- **Frontend:** Vanilla ES6 JavaScript modules, Firebase Realtime Database, Google Calendar API (OAuth2)
- **Storage:** Firebase Realtime Database for scraped events
- **Scheduling:** Modal (serverless cron jobs, weekly scraper)
- **APIs:** Google Calendar (OAuth2), Microsoft Graph (Outlook), OpenAI (event extraction)

## Recent Updates

### Event Display Improvements
- Implemented chronological sorting of events by date and time
- Added client-side filtering to automatically hide past events
- Display "All Day" for events spanning full day (12:00 AM - 11:59 PM)
- Increased detail modal width to 800px for better content display

### Calendar Enhancements
- Fixed calendar rendering to use dynamic month/year instead of static today
- Added day-of-week headers (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
- Implemented functional month navigation with arrow buttons (← →)
- Added styled button controls with hover effects
- Current day highlighting works correctly across month changes

### Code Quality
- Created modular browse-events.js for event browsing functionality
- Added safety checks for DOM element existence before event listeners
- Fixed event data structure to use start_date/start_time/end_time fields consistently
- Removed deprecated local JSON files (now using Supabase exclusively)
