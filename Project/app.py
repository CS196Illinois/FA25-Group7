from flask import Flask, render_template, request, jsonify
import json, os
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Creates the supabase client
supabase = create_client(
    os.environ.get('SUPABASE_URL'),
    os.environ.get('SUPABASE_SERVICE_KEY')
)

# Creates the flask app
app = Flask(__name__)

# Load events from Supabase (latest entry by created_at timestamp)
def load_events():
    response = supabase.table('scraped_event_data').select('data').order('created_at', desc=True).limit(1).execute()
    if response.data and len(response.data) > 0:
        return response.data[0]['data']
    return {}

# Loads the home page
@app.route("/")
def index():
    events = load_events()
    return render_template("index.html", events=events)

# Grabs all the scraped events from supabase
@app.route("/events", methods=["GET"])
def get_events():
    return load_events()

@app.route("/userevents", methods=["POST"])
def save_user_events():
    ## TODO
    return None

if __name__ == "__main__":
    app.run(debug=True)
