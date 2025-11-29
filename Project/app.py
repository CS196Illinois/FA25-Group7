from flask import Flask, render_template, request, jsonify
from firebase_admin import credentials, db
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Creates the flask app
app = Flask(__name__)

# Loads the home page
@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)
