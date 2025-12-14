import pandas as pd
import joblib
from datasets import load_dataset
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

# 1. Download Data (GoEmotions)
print("Downloading dataset...")
dataset = load_dataset("go_emotions", "simplified")
df = pd.DataFrame(dataset['train'])

# 2. Map 27 emotions to 4 simple categories for colors
# 0-27 are indices. We group them manually.
# Joy (yellow): joy(17), love(18), admiration(0), amusement(2)...
# Anger (red): anger(2), annoyance(3), disapproval(10)...
# Sadness (blue): sadness(25), grief(16), remorse(24)...
# Neutral (gray): neutral(27)

def map_emotion(labels):
    # This is a simplified mapping logic
    first_label = labels[0] # Take the primary emotion
    
    joy_ids = [17, 18, 0, 2, 1, 20, 11] # joy, love, admiration, etc.
    anger_ids = [2, 3, 10, 12]          # anger, annoyance, etc.
    sadness_ids = [25, 16, 24, 9]       # sadness, grief, disappointment
    
    if first_label in joy_ids: return "joy"
    if first_label in anger_ids: return "anger"
    if first_label in sadness_ids: return "sadness"
    return "neutral"

print("Preprocessing data...")
df['target'] = df['labels'].apply(map_emotion)

# 3. Create a Pipeline (Vectorizer + Classifier)
model = make_pipeline(
    TfidfVectorizer(stop_words='english', max_features=5000),
    LogisticRegression(max_iter=1000)
)

# 4. Train
print("Training model... (this might take a minute)")
model.fit(df['text'], df['target'])

# 5. Save the model locally
joblib.dump(model, "model/emotion_model.pkl")
print("Success! Model saved to ml-service/model/emotion_model.pkl")