# Deployment Guide

## Prerequisites
- A web server (Apache, Nginx, or any static file server)
- An OpenWeather API key from https://openweathermap.org/api

## Setup Instructions

### 1. Configure API Key
```bash
# Copy the example config file
cp config.example.js config.js

# Edit config.js and add your API key
# OPENWEATHER_API_KEY = "your_actual_api_key_here"
```

### 2. Local Testing
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### 3. Production Deployment

#### Option A: Static Hosting (Netlify, Vercel, GitHub Pages)
1. Push to GitHub
2. Connect your repository to Netlify/Vercel
3. Set environment variables in the platform settings
4. Deploy automatically on push

#### Option B: Traditional Web Server
1. Upload all files to your web server
2. Configure the config.js file with your API key on the server
3. Ensure the server serves index.html for root requests

#### Option C: Docker Deployment
```bash
docker build -t weather-report .
docker run -p 8000:8000 weather-report
```

## Important Security Notes
- Never commit `config.js` with your actual API key
- Use `config.example.js` as a template
- Keep API keys in environment variables or `.env` files
- Add `config.js` and `.env` to `.gitignore`

## Environment Variables
For CI/CD pipelines, set the `OPENWEATHER_API_KEY` environment variable:
```bash
export OPENWEATHER_API_KEY="your_api_key"
```

## Troubleshooting
- **API errors**: Verify your API key is correct and valid
- **CORS issues**: This is a client-side app, API must support CORS
- **Not loading**: Check browser console for errors (F12)
