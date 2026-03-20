# Cat Web App

A simple Node.js web application that fetches cat data from The Cat API and displays it as cards.

## Features

- Node.js + Express server
- Fetches cat data from an external API
- Displays multiple cards with:
  - Cat image
  - Cat information (breed name, origin, life span, temperament, description)
- English user interface

## Run locally

1. Install dependencies:
   npm install

2. Start the app:
   npm start

3. Open in your browser:
   http://localhost:3000

## Notes

- Data source: https://thecatapi.com/
- The server endpoint used by the frontend: `/api/cats?limit=9`
- If The Cat API is temporarily unavailable, the app shows a friendly error message.
