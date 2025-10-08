# Imports
from bs4 import BeautifulSoup
import requests
import json
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

# Functions
def get_uiuc_event_info(link: str):
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
    event_info["description"] = ""
    desc = event.find("dd", class_="ws-description")
    if desc != None:
        event_info["description"] = desc.text

    # The rest of the details are stored in a dl, convert dt's and dd's into a dictionary
    details = dict(zip(
                [detail.text.strip().lower().replace(" ", "_") for detail in event.find_all("dt")], 
                [detail.text for detail in event.find_all("dd")]
                ))
                
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
                    else:
                        event_info["end_time"] = "11:59 PM"

                    if time[1] != "":
                        event_info["start_time"] = time[0] + " " + time[1].upper()       
                else:
                    event_info["start_time"] = "12:00 AM"
                    event_info["end_time"] = "11:59 PM"
            case _:
                event_info[key] = details[key]

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
        # Scrapes the calendar page
        link = calendar.find("a").attrs["href"]
        html_text = requests.get(link).text
        soup = BeautifulSoup(html_text, "lxml")
        if link == "http://www.thestatefarmcenter.com/":
            event_listings = soup.find_all("h3", class_="title")
            title_tag = "State Farm Center"
        else:
            event_listings = soup.find_all("div", class_="title")
            # Prints calendar name & link
            title_tag = soup.find("h1")

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

    # Prints skipped calendars, discuss if we're going to use these or not in our database
    print(f"Looked through {len(calendars)} calendars")
    print("These calendars do not have events or cannot be scraped with the scraper:")
    for link in no_events:
        print(link)

if __name__ == "__main__":
    main()