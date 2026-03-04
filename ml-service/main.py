from fastapi import FastAPI
from pydantic import BaseModel
import joblib
# 1. Import CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 2. Add the middleware to allow your React app to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all apps to connect (great for local dev)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (POST, GET, etc.)
    allow_headers=["*"],
)


# Load the trained model
model = joblib.load("model/emotion_model.pkl")

# Define color mapping
EMOTION_COLORS = {
    "joy": "#FFD700",      # Gold/Yellow
    "anger": "#FF4500",    # OrangeRed
    "sadness": "#1E90FF",  # DodgerBlue
    "neutral": "#E0E0E0"   # LightGray
}

class Message(BaseModel):
    text: str

@app.post("/predict")
def predict_emotion(msg: Message):
    # Predict emotion
    prediction = model.predict([msg.text])[0]
    
    # Get color
    color = EMOTION_COLORS.get(prediction, "#E0E0E0")
    
    return {
        "emotion": prediction,
        "color": color
    }

# To run: uvicorn main:app --reload --port 8000