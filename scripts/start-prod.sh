#!/bin/bash
# Start the HealthDashboard in production mode on port 3000
cd /Volumes/OpenClaw/HealthDashboard
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
npm run build && npm run start -- --port 3000
