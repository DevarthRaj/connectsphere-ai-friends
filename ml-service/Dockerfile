# 1. Use a lightweight Python base image
FROM python:3.10-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy the "shopping list" first (better for Docker caching)
ENV FORCE_REBUILD=v2
COPY requirements.txt .

# 4. Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the code (including your 'model' folder)
COPY . .

# 6. Expose the port the API runs on
EXPOSE 8000

# 7. Start the server
# --host 0.0.0.0 is crucial! It lets Docker talk to the outside world.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]