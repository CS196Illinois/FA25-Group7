from flask import Flask, render_template
# Creates the flask app
app = Flask(__name__)

# Loads the home page
@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)