#-----------------------IMPORTS & VARIABLES-----------------------#
# Imports
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import modal
import os
from playwright.sync_api import sync_playwright 
import re
import requests
import firebase_admin
from firebase_admin import credentials, db
import json

# Variables & Constants
global event_count
GENERAL_CALENDAR_LINKS = [
    "https://calendars.illinois.edu/list/7",
    "https://calendars.illinois.edu/list/557",
    "https://calendars.illinois.edu/list/594",
    "https://calendars.illinois.edu/list/4756",
    "https://calendars.illinois.edu/list/596",
    "https://calendars.illinois.edu/list/62",
    "https://calendars.illinois.edu/list/597",
    "https://calendars.illinois.edu/list/637",
    "https://calendars.illinois.edu/list/4757",
    "https://calendars.illinois.edu/list/598"
]
STATE_FARM_CENTER_CALENDAR_LINK = "https://www.statefarmcenter.com/events/all"
ATHLETIC_TICKET_LINKS = [
    "https://fightingillini.com/sports/football/schedule",
    "https://fightingillini.com/sports/mens-basketball/schedule",
    "https://fightingillini.com/sports/womens-basketball/schedule",
    "https://fightingillini.com/sports/womens-volleyball/schedule"
]
#-----------------------HELPER FUNCTIONS-----------------------#
def parse_month_to_number(month_str):
    try:
        return datetime.strptime(month_str, "%B").month
    except ValueError:
        return datetime.strptime(month_str, "%b").month
#-----------------------SCRAPERS-----------------------#
# Individual Scrapers
def scrape_general():
    global event_count
    session = requests.Session()
    events = {}
    used = []

    for calendar_link in GENERAL_CALENDAR_LINKS:
        # Scrapes the calendar page
        html_text = session.get(calendar_link).text
        soup = BeautifulSoup(html_text, "lxml")
        event_listings = soup.find_all("div", class_="title")

        # Gets info for each event
        for i in range(0, len(event_listings)):
            event_link = "https://calendars.illinois.edu/" + event_listings[i].find("a").attrs["href"]
            
            event_id = event_link.split("eventId=")[1]
            if event_id in used:
                continue
            else:
                used.append(event_id)

            event_info = {}

            # Scrapes the html from the event page
            html_text = session.get(event_link).text
            soup = BeautifulSoup(html_text, "lxml")
            event = soup.find("section", class_="detail-content")

            # Name of the event
            name_tag = event.find("h2").text
            if name_tag:
                event_name = name_tag.strip()
            else: 
                event_name = "Unknown Event Name"
            event_info["summary"] = event_name

            # Description for the event, if given
            event_info["description"] = ""
            desc = event.find("dd", class_="ws-description")
            if desc != None:
                event_info["description"] = desc.text

            # Link for the event
            event_info["htmlLink"] = event_link
            
            # The rest of the details are stored in a dl, convert dt's and dd's into a dictionary
            details = dict(zip(
                        [detail.text.strip().lower().replace(" ", "_") for detail in event.find_all("dt")], 
                        [detail.text for detail in event.find_all("dd")]
                        ))
                        
            # Put each detail into our event_info dict
            for key in details:
                match key:
                    case "date":
                        date_string = details[key]
                        try:
                            # Initialize variables
                            month = day = year = None
                            start_hour = start_minute = end_hour = end_minute = None

                            # Parse dates - "Month Day, Year" or "Month Day, Year - Month Day, Year"
                            if date_match := re.search(r"(\w+)\s+(\d{1,2}),\s+(\d{4})", date_string):
                                month = date_match.group(1)
                                day = int(date_match.group(2))
                                year = int(date_match.group(3))

                            # Parse times - handle formats like "6:30 - 8:00 am" or "6:30 am - 8:00 pm"
                            # First check for time range with format "H:MM - H:MM am/pm" or "H:MM am - H:MM pm"
                            if time_range_match := re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)?\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm)", date_string, re.IGNORECASE):
                                # Start time
                                start_hour = int(time_range_match.group(1))
                                start_minute = int(time_range_match.group(2))
                                start_meridiem = time_range_match.group(3)  # May be None

                                # End time
                                end_hour = int(time_range_match.group(4))
                                end_minute = int(time_range_match.group(5))
                                end_meridiem = time_range_match.group(6).lower()

                                # If start time doesn't have am/pm, use the end time's am/pm
                                if not start_meridiem:
                                    start_meridiem = end_meridiem
                                else:
                                    start_meridiem = start_meridiem.lower()

                                # Convert start time to 24-hour
                                if start_meridiem == "pm" and start_hour != 12:
                                    start_hour += 12
                                elif start_meridiem == "am" and start_hour == 12:
                                    start_hour = 0

                                # Convert end time to 24-hour
                                if end_meridiem == "pm" and end_hour != 12:
                                    end_hour += 12
                                elif end_meridiem == "am" and end_hour == 12:
                                    end_hour = 0

                            elif time_match := re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", date_string, re.IGNORECASE):
                                # Single time only
                                start_hour = int(time_match.group(1))
                                start_minute = int(time_match.group(2))
                                start_meridiem = time_match.group(3).lower()

                                # Convert to 24-hour
                                if start_meridiem == "pm" and start_hour != 12:
                                    start_hour += 12
                                elif start_meridiem == "am" and start_hour == 12:
                                    start_hour = 0

                                # Default end time to 2 hours after start
                                end_hour = (start_hour + 2) % 24
                                end_minute = start_minute
                            else:
                                # No time found - all day event
                                start_hour, start_minute = 0, 0
                                end_hour, end_minute = 23, 59

                            # Build ISO format dates using Central Time
                            if None not in (month, day, year, start_hour, start_minute):
                                start_dt = datetime(year, parse_month_to_number(month), day, start_hour, start_minute, tzinfo=ZoneInfo("America/Chicago"))
                                event_info["start"] = start_dt.isoformat()
                            else:
                                event_info["start"] = ""

                            if None not in (month, day, year, end_hour, end_minute):
                                end_dt = datetime(year, parse_month_to_number(month), day, end_hour, end_minute, tzinfo=ZoneInfo("America/Chicago"))
                                event_info["end"] = end_dt.isoformat()
                            else:
                                event_info["end"] = ""
                        except Exception:
                            # If parsing fails, set empty dates
                            event_info["start"] = ""
                            event_info["end"] = ""
                    case "location":
                        event_info["location"] = details[key]
                    case "event_type":
                        event_info["tag"] = details[key]

            # Cleanup all the values in the dictionary
            event_info = {
                key: value.strip() if isinstance(value, str) else value
                for key, value in event_info.items()
            }

            # Add event info to the main dictionary
            events[event_count] = event_info
            event_count += 1

    return events

def scrape_state_farm():
    global event_count
    events = {}
    
    html_text = requests.get(STATE_FARM_CENTER_CALENDAR_LINK).text
    soup = BeautifulSoup(html_text, "lxml")
    event_listings = soup.find_all("a", class_="more buttons-hide")

    # Emulates a browser to handle the dynamic content
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0")
        for i in range(0, len(event_listings)):
            event_link = event_listings[i].attrs["href"]
            event_info = {}

            # Get all the static html content
            page.goto(event_link, wait_until="domcontentloaded")
            soup = BeautifulSoup(page.content(), "lxml")

            # Name of the event
            event_info["summary"] = soup.find("h1", class_="title").text

            # Description for the event, if given
            event_info["description"] = ""
            desc = soup.find("div", class_="description_inner")
            if desc != None:
                event_info["description"] = " ".join([text.text for text in desc.find_all("p")])

            # Link for the event
            event_info["htmlLink"] = event_link

            # Hard-Coded data, same for all events
            event_info["location"] = "State Farm Center 1800 S 1st St, Champaign, IL 61820"
            event_info["tag"] = "Entertainment"

            # Date data
            try:
                sidebar = soup.find("ul", class_="eventDetailList")

                # Extract date components
                month = sidebar.find("span", class_="m-date__month").text.strip()
                day = int(re.sub(r'\D', '', sidebar.find("span", class_="m-date__day").text.strip()))
                year = int(re.sub(r'\D', '', sidebar.find("span", class_="m-date__year").text.strip()))

                # Parse time - "H:MM am/pm" or "HH:MM am/pm"
                start_time_str = sidebar.find("li", class_="item sidebar_event_starts").find("span").text.strip()

                if time_match := re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", start_time_str, re.IGNORECASE):
                    hour = int(time_match.group(1))
                    minute = int(time_match.group(2))
                    meridiem = time_match.group(3).lower()

                    # Convert to 24-hour
                    if meridiem == "pm" and hour != 12:
                        hour += 12
                    elif meridiem == "am" and hour == 12:
                        hour = 0

                    start_dt = datetime(year, parse_month_to_number(month), day, hour, minute, tzinfo=ZoneInfo("America/Chicago"))
                    end_dt = start_dt + timedelta(hours=3)
                    event_info["start"] = start_dt.isoformat()
                    event_info["end"] = end_dt.isoformat()
                else:
                    event_info["start"] = ""
                    event_info["end"] = ""
            except Exception:
                event_info["start"] = ""
                event_info["end"] = ""

            # Cleanup all the values in the dictionary
            event_info = {
                key: value.strip() if isinstance(value, str) else value
                for key, value in event_info.items()
            }

            # Add event info to the main dictionary
            events[event_count] = event_info
            event_count += 1

        # Close the browser
        browser.close()

    return events

def scrape_athletics():
    global event_count
    session = requests.Session()
    events = {}

    for calendar_link in ATHLETIC_TICKET_LINKS:
        # Scrapes the calendar page
        html_text = session.get(calendar_link).text
        soup = BeautifulSoup(html_text, "lxml")
        event_listings = soup.find_all("li", class_="sidearm-schedule-home-game")

        # Type of sport info, used for the title
        if sport := re.match(r"[\d-]+ (.*) Schedule", soup.find("div", class_="sidearm-schedule-title").find("h2").text):
            sport = sport.group(1)
        else:
            sport = "Sport"

        for i in range(0, len(event_listings)):
            event_info = {}

            # Title of the event
            opponent = event_listings[i].find("div", class_="sidearm-schedule-game-opponent-name").find("a").text
            event_info["summary"] = f"{sport} Game: Illinois VS. {opponent}"

            # Hard coded values
            event_info["description"] = ""
            event_info["tag"] = "Athletics"

            # Link for the event
            event_info["htmlLink"] = calendar_link

            # Date of the event
            try:
                date_info = event_listings[i].find("div", class_="sidearm-schedule-game-opponent-date").find_all("span")

                # Parse date - "Month Day"
                if date_match := re.search(r"(\w+)\s+(\d+)", date_info[0].text):
                    month = date_match.group(1)
                    day = int(date_match.group(2))

                    # Determine year based on month
                    if month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"]:
                        year = datetime.now().year + 1
                    else:
                        year = datetime.now().year

                    # Parse time - "H:MM am/pm" or "HH:MM am/pm"
                    if time_match := re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", date_info[1].text, re.IGNORECASE):
                        hour = int(time_match.group(1))
                        minute = int(time_match.group(2)) if time_match.group(2) else 0
                        meridiem = time_match.group(3).lower()

                        # Convert to 24-hour
                        if meridiem == "pm" and hour != 12:
                            hour += 12
                        elif meridiem == "am" and hour == 12:
                            hour = 0

                        start_dt = datetime(year, parse_month_to_number(month), day, hour, minute, tzinfo=ZoneInfo("America/Chicago"))
                        end_dt = start_dt + timedelta(hours=3)
                        event_info["start"] = start_dt.isoformat()
                        event_info["end"] = end_dt.isoformat()
                    else:
                        event_info["start"] = ""
                        event_info["end"] = ""
                else:
                    event_info["start"] = ""
                    event_info["end"] = ""

            except Exception:
                event_info["start"] = ""
                event_info["end"] = ""

            # Location of the event
            location_info = event_listings[i].find("div", class_="sidearm-schedule-game-location").find_all("span")
            if len(location_info) > 1:
                event_info["location"] = f"{location_info[1].text}, {location_info[0].text}"
            else:
                event_info["location"] = f"{location_info[0].text}"

            # Cleanup
            event_info = {
                key: value.strip() if isinstance(value, str) else value
                for key, value in event_info.items()
            }

            events[event_count] = event_info
            # Increment event counter
            event_count += 1
    return events

# Scrape All Function
def scrape():
    global event_count
    event_count = 0
    combined_json_data = {}

    json_data_state_farm = scrape_state_farm()
    combined_json_data = combined_json_data | json_data_state_farm

    json_data_athletics = scrape_athletics()
    combined_json_data = combined_json_data | json_data_athletics

    json_data_general = scrape_general()
    combined_json_data = combined_json_data | json_data_general

    return combined_json_data
#-----------------------AUTO SCRAPE-----------------------#
# Creates the modal app
app = modal.App("daily-scraper")

# Install dependencies
image = (
    modal.Image.debian_slim()
    .pip_install("Flask", "beautifulsoup4", "lxml", "playwright", "requests", "firebase_admin")
    .run_commands("playwright install --with-deps chromium")
)

@app.function(
    schedule=modal.Cron("0 9 * * *"),  # Every day at 9 AM UTC
    image=image,
    secrets=[modal.Secret.from_name("firebase-creds")] # Gets our Firebase credentials from our secrets
)
def run_scraper():
    print("Initializing Firebase...")

    # Initialize Firebase Realtime Database with service account credentials from Modal secret
    # You need to get your database URL from Firebase Console
    if not firebase_admin._apps:
        cred_dict = json.loads(os.environ['FIREBASE_CREDENTIALS'])
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred, {
            'databaseURL': os.environ.get('FIREBASE_DATABASE_URL', 'https://eventflowdatabase-default-rtdb.firebaseio.com')
        })

    # Get Realtime Database reference
    ref = db.reference('scraped_events')

    # Run the scrape function from scrape.py
    print("Running scraper...")
    scraped_data = scrape()
    print(f"Scraper completed! Scraped {len(scraped_data)} events")

    ref = db.reference("/scraped_events")
    ref.set(scraped_data)

    print("✅ Data saved to Firebase Realtime Database!")
#-----------------------LOCAL TESTS-----------------------#
@app.local_entrypoint()
def test():
    run_scraper.remote()

def main():
    scrape()

if __name__ == "__main__":
    main()