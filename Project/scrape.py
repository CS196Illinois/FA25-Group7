# Imports
from bs4 import BeautifulSoup
import requests
import json
import re

# Variables & Constants
GENERAL_CALENDARS = [
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
STATE_FARM_CENTER_CALENDAR = "https://www.statefarmcenter.com/events/all"
ATHLETIC_CALENDAR = "https://fightingillini.com/calendar"

# Functions
def get_general_event_info(link: str):
    # Scrapes the html from the event page
    html_text = requests.get(link).text
    soup = BeautifulSoup(html_text, "lxml")
    event = soup.find("section", class_="detail-content")

    # Dictonary to store event info
    event_info = {}

    # Name of the event
    event_info["title"] = event.find("h2").text

    # Description for the event, if given
    event_info["description"] = "N/A"
    desc = event.find("dd", class_="ws-description")
    if desc != None:
        event_info["description"] = desc.text

    # The rest of the details are stored in a dl, convert dt's and dd's into a dictionary
    details = dict(zip(
                [detail.text.strip().lower().replace(" ", "_") for detail in event.find_all("dt")], 
                [detail.text for detail in event.find_all("dd")]
                ))
    
    # Cost of the event, assume to be 0 unless otherwise specified
    event_info["cost"] = 0.0
    
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
            case "price" | "cost":
                event_info["cost"] = details[key]
    
    return event_info

def scrape_general():
    # Scrapes General Events
    events = {}
    for calendar_link in GENERAL_CALENDARS:
        # Scrapes the calendar page
        html_text = requests.get(calendar_link).text
        soup = BeautifulSoup(html_text, "lxml")
        event_listings = soup.find_all("div", class_="title")

        # Puts the event link and event info into the JSON for each event in the calendar
        for i in range(0, len(event_listings)):
            event_link = "https://calendars.illinois.edu/" + event_listings[i].find("a").attrs["href"]
            events[event_link] = get_general_event_info(event_link)

    return events

def scrape_state_farm():
    pass

def scrape_athletics():
    pass

def main():
    json_data_general = scrape_general()
    with open("general_events.json", "w", encoding="utf-8") as file:
        json.dump(json_data_general, file, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    main()