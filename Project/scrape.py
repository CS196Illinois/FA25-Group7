# Imports
from bs4 import BeautifulSoup
import requests
import json

# Variables & Constants
NUM_EVENTS = 3
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
    event_info["title"] = event.find("h2").text

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
                event_info["start_date"] = date_time[0].strip()
                event_info["end_date"] = date_time[0].strip()
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
        event_listings = soup.find_all("div", class_="title")

        # Skips calendar if there are no events
        if len(event_listings) == 0:
            no_events.append(link)
            continue

        # Prints calendar name & link
        print(f"CALENDAR: {soup.find("h1").text} ({link}) \n")

        # Prints the first NUM_EVENTS events from the calendar, if any exist
        for i in range(0, min(len(event_listings), NUM_EVENTS)):
            event_link = "https://calendars.illinois.edu/" + event_listings[i].find("a").attrs["href"]
            events[event_link] = get_uiuc_event_info(event_link)
            print(f"Event #{str(i + 1)}: {event_link}")
            print(events[event_link], end="\n\n")

        print("----------------------------------------------")

    # Prints skipped calendars, discuss if we're going to use these or not in our database
    print(f"Looked through {len(calendars)} calendars")
    print("These calendars do not have events or cannot be scraped with the scraper:")
    for link in no_events:
        print(link)

if __name__ == "__main__":
    main()