# Imports
from bs4 import BeautifulSoup
import requests
import json
import re
from playwright.sync_api import sync_playwright 
from datetime import datetime, timedelta
import re

# Variables & Constants
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
ATHLETIC_CALENDAR_LINK = "https://fightingillini.com/calendar"

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

    # Cost of the event, assume to be 0 unless otherwise specified
    event_info["cost"] = 0.0
    
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
            case "price" | "cost":
                event_info["cost"] = details[key]

    # Cleanup
    for key in event_info:
        if isinstance(event_info[key], str):
            event_info[key] = event_info[key].strip()
    
    return event_info

def get_state_farm_center_event_info(link: str):
    # Scrapes the html from the event page
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0")
        page.goto(link, wait_until="networkidle")
        html_text = page.content()
        browser.close()
    soup = BeautifulSoup(html_text, "lxml")
    
    # Dictonary to store event info
    event_info = {}
    
    # Name of the event
    event_info["title"] = soup.find("h1", class_="title").text
    
    # Description for the event, if given
    event_info["description"] = ""
    desc = soup.find("div", class_="description_inner").find_all("p")
    if desc != None:
        event_info["description"] = " ".join([text.text for text in desc])

    # Hard-Coded data, same for all events
    event_info["location"] = "State Farm Center 1800 S 1st St, Champaign, IL 61820"
    event_info["tag"] = "Entertainment"
    event_info["host"] = "State Farm Center"

    # Sidebar data
    sidebar = soup.find("ul", class_="eventDetailList") 
    event_info["start_date"] = sidebar.find("span", class_="m-date__month").text + sidebar.find("span", class_="m-date__day").text + sidebar.find("span", class_="m-date__year").text
    event_info["end_date"] = event_info["start_date"]
    event_info["start_time"] = sidebar.find("li", class_="item sidebar_event_starts").find("span").text.strip()
    event_info["end_time"] = (datetime.strptime(event_info['start_time'], "%I:%M %p") + timedelta(hours=3)).strftime("%I:%M %p")
    event_info["cost"] = sidebar.find("li", class_="item sidebar_ticket_prices").find("span").text

    # Cleanup
    for key in event_info:
        event_info[key] = event_info[key].strip()

    return event_info

def get_athletic_event_info(link: str):
    # TODO: Make custom scraper for athletic events
    pass

def scrape_general():
    # Scrapes General Events
    events = {}
    for calendar_link in GENERAL_CALENDAR_LINKS:
        # Scrapes the calendar page
        #link = calendar.find("a").attrs["href"]
        html_text = requests.get(calendar_link).text
        soup = BeautifulSoup(html_text, "lxml")
        event_listings = soup.find_all("div", class_="title")

        # Calls the function for general events using each link in the event_listings
        for i in range(0, len(event_listings)):
            event_link = "https://calendars.illinois.edu/" + event_listings[i].find("a").attrs["href"]
            events[event_link] = get_general_event_info(event_link)

def scrape_state_farm():
    events = {}
    # Scrapes State Farm Events
    html_text = requests.get(STATE_FARM_CENTER_CALENDAR_LINK).text
    soup = BeautifulSoup(html_text, "lxml")
    event_listings = soup.find_all("a", class_="more buttons-hide")

    # Calls the function for State Farm Center events using each link in the event_listings
    for i in range(0, len(event_listings)):
        event_link = event_listings[i].attrs["href"]
        events[event_link] = get_state_farm_center_event_info(event_link)

    return events

def scrape_athletics():
    events = {}
    # Scrapes Athletic Events
    html_text = requests.get(ATHLETIC_CALENDAR_LINK).text
    soup = BeautifulSoup(html_text, "lxml")
    event_listings = [] # TODO: Use soup to get a list of all event links

    # Calls the function for Athletic events using each link in the event_listings
    for i in range(0, len(event_listings)):
        event_link = event_listings[i].attrs["href"]
        events[event_link] = get_athletic_event_info(event_link)
    
    return events

def main():
    scrape_gen = input("Do you want to scrape General events? (y/n) ")
    if scrape_gen == "y":
        json_data_general = scrape_general()
        with open("general_events.json", "w", encoding="utf-8") as file:
            json.dump(json_data_general, file, indent=4, ensure_ascii=False)

    scrape_sf = input("Do you want to scrape State Farm Center events? (y/n) ")
    if scrape_sf == "y":
        json_data_state_farm = scrape_state_farm()
        with open("state_farm_events.json", "w", encoding="utf-8") as file:
            json.dump(json_data_state_farm, file, indent=4, ensure_ascii=False)

    scrape_ath = input("Do you want to scrape Athletic events? (y/n) ")
    if scrape_ath == "y":
        json_data_athletics = scrape_athletics()
        with open("athletic_events.json", "w", encoding="utf-8") as file:
            json.dump(json_data_athletics, file, indent=4, ensure_ascii=False)
    
if __name__ == "__main__":
    main()