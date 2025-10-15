import os
import json
from datetime import datetime
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

def get_calendar_service():
    SCOPES = ["https://www.googleapis.com/auth/calendar"]
    creds = None
    
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    
    return build("calendar", "v3", credentials=creds)


def parse_date_time(date_str, time_str):
    try:
        date_formats = [
            "%b %d, %Y",
            "%B %d, %Y",
            "%Y-%m-%d",
        ]
        
        parsed_date = None
        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue
        
        if not parsed_date:
            raise ValueError(f"Could not parse date: {date_str}")
        
        time_formats = [
            "%I:%M %p",
            "%H:%M",
        ]
        
        parsed_time = None
        for fmt in time_formats:
            try:
                parsed_time = datetime.strptime(time_str, fmt).time()
                break
            except ValueError:
                continue
        
        if not parsed_time:
            parsed_time = datetime.strptime("09:00 AM", "%I:%M %p").time()
        
        full_datetime = datetime.combine(parsed_date.date(), parsed_time)
        return full_datetime.strftime("%Y-%m-%dT%H:%M:%S")
    
    except Exception as e:
        print(f"Error parsing date/time: {date_str} {time_str} - {e}")
        return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def validate_event_data(event_data):
    required_fields = ["title", "start_date", "start_time"]
    
    for field in required_fields:
        if field not in event_data or not event_data[field]:
            print(f"Missing required field '{field}' in event: {event_data.get('title', 'Unknown')}")
            return False
    
    if event_data.get("title") == "N/A" or event_data.get("description") == "N/A":
        return False
    
    return True


def create_calendar_event(event_data, service):
    try:
        if not validate_event_data(event_data):
            print(f"Skipping invalid event: {event_data.get('title', 'Unknown')}")
            return None
        
        start_datetime = parse_date_time(
            event_data.get("start_date", ""),
            event_data.get("start_time", "09:00 AM")
        )
        
        end_datetime = parse_date_time(
            event_data.get("end_date", event_data.get("start_date", "")),
            event_data.get("end_time", "10:00 AM")
        )
        
        description_parts = []
        if event_data.get("description") and event_data["description"] != "N/A":
            description_parts.append(event_data["description"])
        
        if event_data.get("host"):
            description_parts.append(f"\nHost: {event_data['host']}")
        
        if event_data.get("tag"):
            description_parts.append(f"Category: {event_data['tag']}")
        
        if event_data.get("cost"):
            cost = event_data["cost"]
            if cost != 0.0 and cost != "0.0":
                description_parts.append(f"Cost: {cost}")
        
        description = "\n".join(description_parts) if description_parts else "No description available"
        
        event = {
            "summary": event_data.get("title", "Untitled Event"),
            "description": description,
            "location": event_data.get("location", ""),
            "start": {
                "dateTime": start_datetime,
                "timeZone": "America/Chicago"
            },
            "end": {
                "dateTime": end_datetime,
                "timeZone": "America/Chicago"
            }
        }
        
        created_event = service.events().insert(calendarId="primary", body=event).execute()
        print(f"Event created: {event_data['title']}")
        print(f"Link: {created_event.get('htmlLink')}")
        return created_event
    
    except Exception as e:
        print(f"Error creating event '{event_data.get('title', 'Unknown')}': {e}")
        return None


def load_json_events(json_file_path):
    try:
        with open(json_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            return list(data.values())
        elif isinstance(data, list):
            return data
        else:
            print(f"Unexpected JSON format in {json_file_path}")
            return []
    
    except FileNotFoundError:
        print(f"File not found: {json_file_path}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from {json_file_path}: {e}")
        return []


def add_scraped_events_to_calendar(json_files):
    print("Authenticating with Google Calendar...")
    service = get_calendar_service()
    
    total_added = 0
    total_skipped = 0
    
    for json_file in json_files:
        print(f"\nProcessing: {json_file}")
        events = load_json_events(json_file)
        
        if not events:
            print(f"No events found in {json_file}")
            continue
        
        print(f"Found {len(events)} events in {json_file}")
        
        for event_data in events:
            result = create_calendar_event(event_data, service)
            if result:
                total_added += 1
            else:
                total_skipped += 1
    
    print("\n" + "="*50)
    print(f"Successfully added {total_added} events to calendar")
    print(f"Skipped {total_skipped} invalid events")
    print("="*50)


if __name__ == "__main__":
    json_files = [
        "general_events.json",
        "state_farm_events.json",
    ]
    
    print("Starting to add scraped events to Google Calendar...")
    print(f"Processing {len(json_files)} JSON file(s)\n")
    
    add_scraped_events_to_calendar(json_files)