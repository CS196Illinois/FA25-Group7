#-----------------------IMPORTS & VARIABLES-----------------------#
# Imports
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import modal
import os
from playwright.sync_api import sync_playwright 
import re
import requests
from supabase import create_client

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
            event_info["title"] = event_name

            # Description for the event, if given
            event_info["description"] = "N/A"
            desc = event.find("dd", class_="ws-description")
            if desc != None:
                event_info["description"] = desc.text

            # Link for the event
            event_info["event_link"] = event_link
            
            # The rest of the details are stored in a dl, convert dt's and dd's into a dictionary
            details = dict(zip(
                        [detail.text.strip().lower().replace(" ", "_") for detail in event.find_all("dt")], 
                        [detail.text for detail in event.find_all("dd")]
                        ))
                        
            # Put each detail into our event_info dict, matching the format of our JSON
            for key in details:
                match key:
                    case "date":
                        date_string = details[key]
                        # Looks for start/end dates using regex
                        if match_date := re.search(r"(\w+ \d{1,2}, \d+) *-* *(\w+ \d{1,2}, \d+)?", date_string):
                            event_info["start_date"] = match_date.group(1)
                            if match_date.group(2) is not None:
                                event_info["end_date"] = match_date.group(2)
                            else:
                                event_info["end_date"] = match_date.group(1)
                        else:
                            event_info["start_date"] = "N/A"
                            event_info["end_date"] = "N/A"
                        # Looks for start/end times using regex
                        if match_time := re.search(r"(\d+:\d+)[a-z -]*(\d+:\d+)?", date_string):
                            # Determines if start/end times are in AM/PM
                            startMeridiem = "AM"
                            endMerideiem = "PM"
                            if "am" in date_string and "pm" not in date_string:
                                endMerideiem = "AM"
                            elif "am" not in date_string and "pm" in date_string:
                                startMeridiem = "PM"
                            # Pulls the times from the regex and puts it in event info
                            event_info["start_time"] = match_time.group(1) + " " + startMeridiem
                            if match_time.group(2) is not None:
                                event_info["end_time"] = match_time.group(2) + " " + endMerideiem
                            else:
                                event_info["end_time"] = match_time.group(1) + " " + endMerideiem
                        else:
                            # Assumes 'All Day' if no match is found
                            event_info["start_time"] = "12:00 AM"
                            event_info["end_time"] = "11:59 PM"
                    case "location":
                        event_info["location"] = details[key]
                    case "event_type":
                        event_info["tag"] = details[key]
                    case "sponsor":
                        event_info["host"] = details[key]

            # Cleanup all the values in the dictionary
            event_info = {key: value.strip() for key, value in event_info.items()}

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
            event_info["title"] = soup.find("h1", class_="title").text

            # Description for the event, if given
            event_info["description"] = ""
            desc = soup.find("div", class_="description_inner")
            if desc != None:
                event_info["description"] = " ".join([text.text for text in desc.find_all("p")])

            # Link for the event
            event_info["event_link"] = event_link

            # Hard-Coded data, same for all events
            event_info["location"] = "State Farm Center 1800 S 1st St, Champaign, IL 61820"
            event_info["tag"] = "Entertainment"
            event_info["host"] = "State Farm Center"

            # Sidebar data
            sidebar = soup.find("ul", class_="eventDetailList") 
            event_info["start_date"] = sidebar.find("span", class_="m-date__month").text + sidebar.find("span", class_="m-date__day").text + sidebar.find("span", class_="m-date__year").text
            event_info["end_date"] = event_info["start_date"]
            event_info["start_time"] = sidebar.find("li", class_="item sidebar_event_starts").find("span").text.strip()
            try:
                event_info["end_time"] = (datetime.strptime(event_info['start_time'], "%I:%M %p") + timedelta(hours=3)).strftime("%I:%M %p")
            except ValueError:
                event_info["end_time"] = event_info["start_time"]

            # Cleanup all the values in the dictionary
            event_info = {key: value.strip() for key, value in event_info.items()}

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
            event_info["title"] = f"{sport} Game: Illinois VS. {opponent}"

            # Hard coded values
            event_info["description"] = ""
            event_info["tag"] = "Athletics"
            event_info["host"] = "Fighting Illini Athletics"

            # Link for the event
            event_info["event_link"] = calendar_link

            # Date of the event
            date_info = event_listings[i].find("div", class_="sidearm-schedule-game-opponent-date").find_all("span")  
            if date := re.match(r"^(\w+ \d+)", date_info[0].text):
                date = date.group(1)
                if date[0:3] in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"]:
                    date = date + ", " + str(datetime.now().year + 1)
                else:
                    date = date + ", " + str(datetime.now().year)
                event_info["start_date"] = date
                event_info["end_date"] = date
            else:
                event_info["start_date"] = "N/A"
                event_info["end_date"] = "N/A"
            
            # Time of the event
            try:
                time = re.match(r"^(\d{1,2}).*(\d{2})? (am|AM|pm|PM)", date_info[1].text)
                hour = time.group(1)
                minute = time.group(2)
                meridiem = time.group(3).lower()
                if minute == None:
                    minute = "00"
                time = f"{hour}:{minute} {meridiem}"
                event_info["start_time"] = time
                event_info["end_time"] = (datetime.strptime(event_info['start_time'], "%I:%M %p") + timedelta(hours=3)).strftime("%I:%M %p")
            except Exception:
                if sport == "Football":
                    event_info["start_time"] = "11:00 am"
                    event_info["end_time"] = "2:00 pm"
                else:
                    event_info["start_time"] = "7:00 pm"
                    event_info["end_time"] = "10:00 pm"

            # Location of the event
            location_info = event_listings[i].find("div", class_="sidearm-schedule-game-location").find_all("span")
            if len(location_info) > 1:
                event_info["location"] = f"{location_info[1].text}, {location_info[0].text}"
            else:
                event_info["location"] = f"{location_info[0].text}"

            # Cleanup
            for key in event_info:
                event_info[key] = event_info[key].strip()

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
app = modal.App("weekly-scraper")

# Install everything from requirements.txt
image = (
    modal.Image.debian_slim().
    pip_install_from_requirements("requirements.txt").
    run_commands("playwright install --with-deps chromium")
)

@app.function(
    schedule=modal.Cron("0 9 * * 1"),  # Every Monday at 9 AM UTC
    image=image,
    secrets=[modal.Secret.from_name("supabase-creds")] # Gets our Supabase URL and Service key from our secrets
)

def run_scraper():    
    print("Connecting to Supabase...")

    # Creates the client with our credentials
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_KEY']
    ) 
    
    # Run the scrape function from scrape.py
    print("Running scraper...")
    scraped_data = scrape()
    print(f"Scraper completed!")

    # Save to Supabase data table
    response = supabase.table('scraped_event_data').insert({
        'data': scraped_data
    }).execute()
    
    # Success message
    print(f"✅ Data saved to Supabase! ID: {response.data[0]['id']}")
#-----------------------LOCAL TESTS-----------------------#
@app.local_entrypoint()
def test():
    run_scraper.remote()

def main():
    scrape()

if __name__ == "__main__":
    main()