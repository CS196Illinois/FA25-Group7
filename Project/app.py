from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Base directory for this module
BASE_DIR = Path(__file__).resolve().parent

# Add the calander directory to the Python path so we can import from readEmail
sys.path.append(os.path.join(os.path.dirname(__file__), 'calander'))

from readEmail import (
    fetch_emails,
    parse_email_content
)

load_dotenv()

# Creates the flask app
app = Flask(__name__)
CORS(app)

# Get environment variables for Microsoft auth
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")

# Loads the home page
@app.route("/")
def index():
    return render_template("index.html")

# Email processing endpoints
@app.route("/api/process_emails", methods=["POST"])
def process_emails():
    """Fetch emails, parse them, and return events (no Firebase storage)"""
    try:
        data = request.json
        amount = data.get("amount", 5)

        # Validate amount
        if amount < 1 or amount > 25:
            amount = 5

        # Fetch emails from Outlook
        emails = fetch_emails(TENANT_ID, CLIENT_ID, amount)

        if not emails:
            return jsonify({"error": "No emails fetched or authentication failed"}), 400

        # Parse each email for events
        all_parsed_events = []
        for email in emails:
            parsed = parse_email_content(email)
            if parsed and "events" in parsed:
                all_parsed_events.extend(parsed["events"])

        # Filter out incomplete events
        valid_events = []
        for event in all_parsed_events:
            if event.get("title") and event.get("start_date"):
                # Skip JUNK events
                if not event.get("description", "").startswith("JUNK"):
                    # Format event for display
                    formatted_event = format_email_event(event)
                    valid_events.append(formatted_event)

        return jsonify({
            "status": "success",
            "emails_processed": len(emails),
            "events_found": len(all_parsed_events),
            "events": valid_events
        })

    except Exception as e:
        print(f"Error processing emails: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Streaming endpoint for real-time event processing
@app.route("/api/process_emails_stream", methods=["GET"])
def process_emails_stream():
    """Fetch and parse emails with streaming updates"""
    import json

    # Get amount from request BEFORE the generator (must be in request context)
    amount = request.args.get("amount", 5, type=int)

    # Validate amount
    if amount < 1 or amount > 25:
        amount = 5

    def generate():
        try:
            # Fetch emails from Outlook
            yield f"data: {json.dumps({'type': 'status', 'message': 'Fetching emails...'})}\n\n"
            emails = fetch_emails(TENANT_ID, CLIENT_ID, amount)

            if not emails:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No emails fetched or authentication failed'})}\n\n"
                return

            yield f"data: {json.dumps({'type': 'status', 'message': f'Fetched {len(emails)} emails. Parsing for events...'})}\n\n"

            # Parse each email and stream results
            total_events = 0
            for i, email in enumerate(emails):
                yield f"data: {json.dumps({'type': 'progress', 'current': i + 1, 'total': len(emails)})}\n\n"

                parsed = parse_email_content(email)
                if parsed and "events" in parsed:
                    for event in parsed["events"]:
                        if event.get("title") and event.get("start_date"):
                            if not event.get("description", "").startswith("JUNK"):
                                formatted_event = format_email_event(event)
                                total_events += 1
                                # Stream each event as it's found
                                yield f"data: {json.dumps({'type': 'event', 'event': formatted_event})}\n\n"

            # Send completion message
            yield f"data: {json.dumps({'type': 'complete', 'emails_processed': len(emails), 'events_found': total_events})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return app.response_class(generate(), mimetype='text/event-stream')


def format_email_event(event):
    """Format parsed email event for display"""
    # Parse dates and times
    start_date = event.get("start_date")
    end_date = event.get("end_date", start_date)
    start_time = event.get("start_time", "12:00 AM")
    end_time = event.get("end_time", "11:59 PM")

    # Convert to ISO datetime format for consistency with browse events
    try:
        start_dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %I:%M %p")
        start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%S-06:00")
        # Format readable date
        formatted_start_date = start_dt.strftime("%B %d, %Y")
    except:
        # Fallback if parsing fails
        start_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S-06:00")
        formatted_start_date = start_date

    try:
        end_dt = datetime.strptime(f"{end_date} {end_time}", "%Y-%m-%d %I:%M %p")
        end_iso = end_dt.strftime("%Y-%m-%dT%H:%M:%S-06:00")
    except:
        # Fallback if parsing fails
        end_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S-06:00")

    return {
        "summary": event.get("title", "Untitled Event"),
        "description": event.get("description", ""),
        "location": event.get("location", ""),
        "start": start_iso,
        "end": end_iso,
        "start_date": formatted_start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time,
        "tag": "Email Import"
    }

if __name__ == "__main__":
    app.run(debug=True)