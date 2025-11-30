from flask import Flask, render_template, request, jsonify
import firebase_admin
from firebase_admin import credentials, db
from dotenv import load_dotenv
import os
import json

# Load environment variables from .env file
load_dotenv()

# Creates the flask app
app = Flask(__name__)

# Initialize Firebase
if not firebase_admin._apps:
    # Load Firebase credentials from environment
    cred_dict = {
        "type": "service_account",
        "project_id": "eventflowdatabase",
        "private_key_id": "047287e0c8fb79d228b0eef09caeb5177a6bb725",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCS+DIKG7WD2p/P\nIoEFKnXUD92mh4uREYRTyyC8cfNkwUw4+rQtl+Ne+I19R1axF7Hr0mIdqlikcuqe\njD041/TeQUQsCWWa8WGARjJ5OhddwmpX/lA0l3l4uxzBMwcJnJQ9XmC/vvgxg+iw\nyRksd3Uy6He4APiLlQlDA5DBSuFKsFlPj3W7jpeTtQDtoZwWwhbEHdg11GHlxFPB\nmMU43YM6cNzo6XcJ7V934Pi59sCCsfeRKMWa7e7HWC0Odz9aIIsp+2ktUhIJQbJk\naZ/6o0bQEk8aRyoQQ2xTWsJ1fF12fvUdBk0zf0zh+dUos1oY5O+c18MnEAs42EIy\nYFE6fmxRAgMBAAECggEAEORW+AN0SunbWVbZZmsZbNy/+I52s59ESs87fX1JYMi4\nxonGIMFm4DkIJiCHbcZP7E9beJZmJsyQe9WZicmEevEccUVJONRKhRBMZ9ON8PhR\n+bggptLMIty6stf3FJs7DIym6RL9es9y9LLAYnR+c3H1pJ/z8TMZg+rKffTpzQgo\nOyIZMDvPt0kj1Ty3JPYg3uxCVOcVxbX7wTGyqqX/K/o/N0mopoWkIIaZ/KdNxDi2\np8QxSXfPVpE4hgwDeiEknTrY3KA8oraAeMsNjDIobGXdrs2EXzoSM7ZYgqJyEqwo\nAzKH3UJdeKAH7I3nv2zWQ3fmJlFKuUI1JmFbTmcOuQKBgQDFj12z6yW0a70ItFqv\nAWC/9qA3Z8iDCyKpjjGYE99cHLp1O7/GoEBs7LEfOC+O83Tpz7KSFEJm9U4FzM0/\nw3y4xSRaHCFoBoFZoqDcjOUo+OlWX/ZggsodeUlXbuHOkACxWj764b3Np7yWnJaT\nj5DDmWg/Vi8w5/vABQ6hvFCZdQKBgQC+ccKlTjWJPiHnhhV6/H4/+rRsCTgL5HqQ\np3vpnpKGafIuDUeZVIJkTm3W+7opo9FWzzbZdSFDzTHUOC5BG9PElTh1tLpIIfIl\nocS90AGgNYeNU3vkh36G/LcXsVE1kGG6I6eGh3IuxA15qcVjGVeDXTz9mP2Aa8fZ\nHEIC+IiP7QKBgQCi7HOrL+5dV0iCyDHNB4bhaKOCbb1njKReTlzJ/QGD9lEy4z5p\nsLjQ23XKuExISLCPLfEnFTwZqo1YrShLQI0316T+Bxrprgu4fyzIFg3ad0P/Lo6B\n0vqZye9ZAqGH9ywLFtC/l7Euy/j0AFkRgiExne7h5NJwM7BjEAicCzAxDQKBgAs7\nOEh5cUzTvjoiPTgQlf198pAAhy6kXdoUFomzkV6d9utiWxue0UXLHk00cUktYRYm\niEyQzNJr0ol6erfaRUXtqvO+IdJJNjej769mCgKBxam/B6p1ly+szbt2+JwZFLpe\nie20JTa+1zCao4pxnyifIg6urBybvqB+OyJjt+INAoGBAJTAUcNlZT/+Mf6LmBPi\nbChbQztUL88JXv4gkN/L3UaZ8iT1q4aeHJtzkdc11w+Qdls88GXJqghavMBkkwaq\nuBYvNsgpXvoSNx+iv24WrPNJ5hwv8sg4xdgVlGDRiYgy737van9dEz6fIN5Q0USo\nJXhfL4gOGjaLkliwgclNxh5+\n-----END PRIVATE KEY-----\n",
        "client_email": "firebase-adminsdk-fbsvc@eventflowdatabase.iam.gserviceaccount.com",
        "client_id": "101366443338011630199",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40eventflowdatabase.iam.gserviceaccount.com",
        "universe_domain":"googleapis.com"
    }
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred, {
        'databaseURL': "https://eventflowdatabase-default-rtdb.firebaseio.com"
    })

# Loads the home page
@app.route("/")
def index():
    return render_template("index.html")

# Returns a dictionary of scraped events from firebase
@app.route("/events", methods=["GET"])
def events():
    try:
        # Get reference to scraped_events in Firebase
        ref = db.reference('scraped_events')

        # Fetch all events
        scraped_data = ref.get()

        # If no data exists, return empty dict
        if scraped_data is None:
            return jsonify({})

        # Return the events dictionary
        return jsonify(scraped_data)

    except Exception as e:
        print(f"Error fetching events: {e}")
        return jsonify({"error": "Failed to fetch events"}), 500

if __name__ == "__main__":
    app.run(debug=True)