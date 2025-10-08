# Imports
from bs4 import BeautifulSoup
import requests
import json
<<<<<<< HEAD
from datetime import datetime, timedelta

# Variables & Constants
NUM_EVENTS = 1
events = {}
no_events = []

"""
TOOO:

-> IGNORE:
http://senate.illinois.edu/a_calendar.asp
https://extension.illinois.edu/global/events
http://illinois.edu/calendar/list/642

-> MAKE NEW SCRAPERS FOR:
http://www.thestatefarmcenter.com/
http://www.fightingillini.com/calendar.aspx

-> Make JSON consistent for each event

-> Add a tag feature in the JSON

-> Make different scrapers for each type of calendar (General, State Farm, Sports)

-> Clean up code and add more reusability
"""
=======
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
>>>>>>> 192aa6d95ee484b67954eb8ea418e7f538197294

# Functions
def get_general_event_info(link: str):
    # Scrapes the html from the event page
    html_text = requests.get(link).text
    soup = BeautifulSoup(html_text, "lxml")
    event = soup.find("section", class_="detail-content")

    # Dictonary to store event info
    event_info = {}

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

    # The rest of the details are stored in a dl, convert dt's and dd's into a dictionary
    details = dict(zip(
                [detail.text.strip().lower().replace(" ", "_") for detail in event.find_all("dt")], 
                [detail.text for detail in event.find_all("dd")]
                ))
<<<<<<< HEAD
                
    # Put each detail into our event_info dict
    for key in details:
        match key:
            case "date":
                # Splits up the date and time since they are in one string
                date_time = details[key].split("\xa0")
                # Adds the date/range of dates
                event_info["date"] = date_time[0].strip()
                # Converts the given time slot into start_time and end_time
                time = date_time[1].strip()
                if time != "All Day" and time != "":
                    time = time.split(" ")
                    if len(time) >= 5:
                        event_info["start_time"] = time[0] + " " + time[4].upper()
                        event_info["end_time"] = time[3] + " " + time[4].upper()
=======
    
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
>>>>>>> 192aa6d95ee484b67954eb8ea418e7f538197294
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

<<<<<<< HEAD
    # Converts dict object into json format and returns it        
    return json.dumps(event_info, indent=4, sort_keys=True)

def get_state_farm_center_event_info(link: str):
    # Scrapes the html from the event page
    html_text = requests.get(link).text
    soup = BeautifulSoup(html_text, "lxml")
    event = soup.find("div", class_="leftColumn")
    # Dictonary to store event info
    event_info = {}
    # Name of the event
    event_info["title"] = event.find("h1").text
    # Description for the event, if given
    event_info["description"] = ""
    desc = event.find("div", class_="description_inner")
    if desc != None:
        event_info["description"] = desc.text
    # The rest of the details are stored in a dl, convert dt's and dd's into a dictionary
    details = dict(zip(
                [detail.text.strip().lower().replace(" ", "_") for detail in event.find_all("div")], 
                [detail.text for detail in event.find_all("span")]
                ))
    for key in details:
        match key:
            case "Date":
                # Adds the date
                event_info["date"] = details[key].strip()
            case "Event Starts":
                # Finds start time
                start_time = details[key]
                # Adds the start time
                event_info["start_time"] = start_time.strip()
                start_time_obj = datetime.strptime(event_info['start_time'], "%I:%M %p")
                end_time_obj = start_time_obj + timedelta(hours=2)
                event_info['end_time'] = end_time_obj.strftime("%I:%M %p")

            case _:
                event_info[key] = details[key]



def main():
    # Scrapes the main calendar page
    html_text = requests.get("https://illinois.edu/resources/calendars.html").text
    soup = BeautifulSoup(html_text, "lxml")
    calendar_list = soup.find("ul", class_="ruled")
    calendars = calendar_list.find_all("li")

    for calendar in calendars:
=======
def scrape_general():
    # Scrapes General Events
    events = {}
    for calendar_link in GENERAL_CALENDARS:
>>>>>>> 192aa6d95ee484b67954eb8ea418e7f538197294
        # Scrapes the calendar page
        html_text = requests.get(calendar_link).text
        soup = BeautifulSoup(html_text, "lxml")
        if link == "http://www.thestatefarmcenter.com/":
            event_listings = soup.find_all("h3", class_="title")
            title_tag = "State Farm Center"
        else:
            event_listings = soup.find_all("div", class_="title")
            # Prints calendar name & link
            title_tag = soup.find("h1")

<<<<<<< HEAD
        # Skips calendar if there are no events
        if len(event_listings) == 0:
            no_events.append(link)
            continue

        # Checking if title provided
        if type(title_tag) != str:
            calendar_title = title_tag.text.strip()
        else:
            if title_tag:
                calendar_title = title_tag
            else:
                calendar_title = "Unknown Calendar Title"

        print(f"CALENDAR: {calendar_title} ({link}) \n")

        # Prints the first NUM_EVENTS events from the calendar, if any exist
        for i in range(0, min(len(event_listings), NUM_EVENTS)):
            event_link = "https://calendars.illinois.edu/" + event_listings[i].find("a").attrs["href"]
            # Handles links that don't work with general scraper
            if link == "http://www.thestatefarmcenter.com/":
                event_data = get_state_farm_center_event_info(event_link)
            else:
                event_data = get_uiuc_event_info(event_link)
            if event_data:
                events[event_link] = event_data
                print(f"Event #{str(i + 1)}: {event_link}")
                print(event_data, end="\n\n")

        print("-" * 100)
=======
        # Puts the event link and event info into the JSON for each event in the calendar
        for i in range(0, len(event_listings)):
            event_link = "https://calendars.illinois.edu/" + event_listings[i].find("a").attrs["href"]
            events[event_link] = get_general_event_info(event_link)

    return events
>>>>>>> 192aa6d95ee484b67954eb8ea418e7f538197294

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