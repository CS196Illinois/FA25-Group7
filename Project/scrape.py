# Imports
from bs4 import BeautifulSoup
import requests
import json

def get_uiuc_event_info(link: str):
    # Scrapes the html from the event page
    html_text = requests.get(link).text
    soup = BeautifulSoup(html_text, "lxml")
    event = soup.find("section", class_="detail-content")

    # Dictonary to store event info
    event_info = {}

    # Name of the event
    event_info["title"] = event.find("h2").text

    # Picture for the event, if given
    event_info["image"] = ""
    img = event.find('img', id="image-detail-1")
    if img != None:
        event_info["image"] = img.attrs["src"] 

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

# DEMO of get_uiuc_event_info
html_text = requests.get("https://illinois.edu/resources/calendars.html").text
soup = BeautifulSoup(html_text, "lxml")
calendar_list = soup.find("ul", class_="ruled")
calendars = calendar_list.find_all("li")

events = {}
for calendar in calendars:
    link = calendar.find("a").attrs["href"]
    html_text = requests.get(link).text
    soup = BeautifulSoup(html_text, "lxml")
    event_listings = soup.find_all("div", class_="title")

    # Prints the first event from each calendar
    if len(event_listings) == 0:
        continue
    event_link = "https://calendars.illinois.edu/" + event_listings[0].find("a").attrs["href"]
    events[event_link] = get_uiuc_event_info(event_link)
    print("Event: " + event_link)
    print(events[event_link])