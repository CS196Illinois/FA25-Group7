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
- Calendar grid with month/year navigation using arrow buttons (← →)
- Day-of-week headers (Sun-Sat) for better calendar readability
- Events panel for selected day
- Upcoming events section (horizontal list)
- Browse events section with search/filter capabilities
- Event detail modal (800px wide) for comprehensive event information
- Add event modal form

**JavaScript ([static/script.js](Project/static/script.js))**
Handles:
- Calendar rendering with dynamic month/year (fixes to use current view instead of constant today)
- Month navigation with arrow buttons
- Event loading via `/events` API
- Event creation (POST to `/events`)
- Modal interactions
- Current day highlighting

**JavaScript ([static/browse-events.js](Project/static/browse-events.js))**
Dedicated module for browse events section:
- Chronological event sorting by date and time (bubble sort)
- Client-side filtering to hide past events
- Search functionality across title, description, and location
- Category/tag filtering
- "All Day" display for events running 12:00 AM - 11:59 PM
- Event detail modal with full information display
- Dynamic event card generation

**Styling ([static/style.css](Project/static/style.css))**
Clean, modern design with:
- Flexbox and CSS Grid layouts
- Styled month control buttons with hover effects
- Responsive event cards in browse section
- Wide detail modal (800px) for better readability
- Color-coded event categories
- Smooth transitions and hover states

### Data Flow

```
Web Sources → scrape.py (via Modal) → Supabase (scraped_event_data table)
                                              ↓
                                           app.py → Frontend (dynamic event cards)
                                              ↓
                              (optional) add_scraped_events.py → Google Calendar
```

**Architecture:** The complete data pipeline is now unified through Supabase:
1. **Modal scraper** runs weekly, scrapes 1000+ events, stores in Supabase
2. **Flask backend** reads latest scraped data from Supabase on each request
3. **Frontend** dynamically renders event cards with search/filter capabilities
4. **No local JSON files** - all data flows through Supabase

### Calendar Integration

[calendar/add_scraped_events.py](Project/calendar/add_scraped_events.py) bridges scraped events to Google Calendar via OAuth2. It validates event data, parses dates/times, and creates Google Calendar events with proper formatting.

## Key Files

- [Project/app.py](Project/app.py) - Flask web server with Supabase integration
- [Project/scrape.py](Project/scrape.py) - All web scraping logic with Modal scheduling
- [Project/templates/index.html](Project/templates/index.html) - Main HTML template
- [Project/static/script.js](Project/static/script.js) - Calendar rendering and navigation
- [Project/static/browse-events.js](Project/static/browse-events.js) - Event browsing, sorting, and filtering
- [Project/static/style.css](Project/static/style.css) - Complete application styling
- [Project/calendar/add_scraped_events.py](Project/calendar/add_scraped_events.py) - Google Calendar sync
- [Project/.env](Project/.env) - Supabase credentials (not committed to git)

## Technology Stack

- **Backend:** Flask, BeautifulSoup4, Playwright, Requests, Supabase client, python-dotenv
- **Frontend:** Vanilla HTML/CSS/JavaScript (no frameworks, simple syntax for intro CS context)
- **Storage:** Supabase (cloud PostgreSQL for all scraped event data)
- **Scheduling:** Modal (serverless cron jobs, runs weekly on Mondays)
- **APIs:** Google Calendar API (OAuth2)

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
