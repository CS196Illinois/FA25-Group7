from flask import Flask, render_template, request, jsonify
import json, os

app = Flask(__name__)

DATA_FILE = "events.json"

# Load events
def load_events():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return []

# Save events
def save_events(events):
    with open(DATA_FILE, "w") as f:
        json.dump(events, f, indent=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/events", methods=["GET"])
def get_events():
    return jsonify(load_events())

@app.route("/events", methods=["POST"])
def add_event():
    data = request.json
    events = load_events()
    events.append(data)
    save_events(events)
    return jsonify({"message": "Event added successfully"}), 201

if __name__ == "__main__":
    app.run(debug=True)
