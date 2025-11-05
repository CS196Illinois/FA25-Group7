from flask import Flask, request, jsonify
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from readEmail import (
    fetch_emails,
    parse_email_content,
    get_calendar_service,
    get_or_create_calendar,
    create_event
)

app = Flask(__name__)

TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")

calendar_service = get_calendar_service()
calendar_id = get_or_create_calendar(calendar_service, "Calendar Assistant")

@app.route("/emails", methods=["GET"])
def get_emails():
    amount = request.args.get("amount", default=5, type=int)
    if amount < 1 or amount > 25:
        amount = 5
    emails = fetch_emails(TENANT_ID, CLIENT_ID, amount)
    return jsonify({"emails": emails})

@app.route("/parse", methods=["POST"])
def parse_email():
    data = request.json
    email_content = data.get("email_content")
    if not email_content:
        return jsonify({"error": "Missing 'email_content'"}), 400

    parsed = parse_email_content(email_content)
    return jsonify(parsed)

@app.route("/create_event", methods=["POST"])
def create_calendar_event():
    data = request.json
    if not data:
        return jsonify({"error": "Missing event data"}), 400

    try:
        create_event(data, calendar_service, calendar_id)
        return jsonify({"status": "Event created successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/custom_event", methods=["POST"])
def custom_event():
    data = request.json
    description = data.get("description")
    if not description:
        return jsonify({"error": "Missing 'description'"}), 400

    # Add current date/time to help the model
    now = datetime.now()
    custom_input = f"Current date: {now.strftime('%Y-%m-%d')}, Current time: {now.strftime('%H:%M')}\n{description}"
    parsed_json = parse_email_content(custom_input)

    if not parsed_json or "events" not in parsed_json:
        return jsonify({"status": "No events found"})

    for e in parsed_json["events"]:
        if e.get("title") and e.get("start_date"):
            create_event(e, calendar_service, calendar_id)

    return jsonify({"status": "Custom event(s) created", "parsed": parsed_json})


if __name__ == "__main__":
    app.run(debug=True, port=5000)