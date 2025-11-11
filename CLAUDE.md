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
- Provides REST API at `/events` (GET returns all events, POST adds new events)
- Reads/writes event data to/from local [json/events.json](Project/json/events.json)
- Note: Flask app still uses local JSON; scrapers now send to Supabase separately

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
- Calendar grid with month/year navigation
- Events panel for selected day
- Upcoming events section (horizontal list)
- Browse events section (shows all scraped events)
- Add event modal form

**JavaScript ([static/script.js](Project/static/script.js))**
Handles:
- Calendar rendering and day selection
- Event loading via `/events` API
- Event creation (POST to `/events`)
- Modal interactions

**Styling ([static/style.css](Project/static/style.css))**
Clean, modern design with flexbox layout and color-coded event categories.

### Data Flow

```
Web Sources → scrape.py (via Modal) → Supabase (scraped_event_data table)

                            Local JSON files (json/*.json)
                                      ↓
                                   app.py → Frontend
                                      ↓
                         (optional) add_scraped_events.py → Google Calendar
```

**Important architectural note:** The scrapers now send data to Supabase via Modal scheduled runs, but the Flask app ([app.py](Project/app.py)) still reads from local JSON files ([json/events.json](Project/json/events.json)). This means there are two separate data stores:
1. **Supabase** - Cloud storage for scraped events (written by Modal)
2. **Local JSON** - Used by Flask app for serving the web interface

The local JSON files may need to be manually synced with Supabase data, or the Flask app could be updated to read from Supabase instead.

### Calendar Integration

[calendar/add_scraped_events.py](Project/calendar/add_scraped_events.py) bridges scraped events to Google Calendar via OAuth2. It validates event data, parses dates/times, and creates Google Calendar events with proper formatting.

## Key Files

- [Project/app.py](Project/app.py) - Flask web server
- [Project/scrape.py](Project/scrape.py) - All web scraping logic
- [Project/json/events.json](Project/json/events.json) - Master events file (~1MB)
- [Project/templates/index.html](Project/templates/index.html) - Main HTML template
- [Project/static/script.js](Project/static/script.js) - Frontend interactivity
- [Project/calendar/add_scraped_events.py](Project/calendar/add_scraped_events.py) - Google Calendar sync

## Technology Stack

- **Backend:** Flask, BeautifulSoup4, Playwright, Requests, Supabase client
- **Frontend:** Vanilla HTML/CSS/JavaScript (no frameworks)
- **Storage:** Supabase (cloud, for scraped data) + JSON files (local, for Flask app)
- **Scheduling:** Modal (serverless cron jobs)
- **APIs:** Google Calendar API (OAuth2)
