#!/bin/bash

# Start Python FastAPI server in background
echo "Starting Python FastAPI server..."
cd server && uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
PYTHON_PID=$!

# Wait for Python server to start
sleep 3

# Start frontend dev server
echo "Starting frontend development server..."
npm run dev

# Kill Python server when script exits
trap "kill $PYTHON_PID" EXIT