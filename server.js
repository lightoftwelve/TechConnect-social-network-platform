// Load environment variables
require("dotenv").config();

// Import necessary modules
const express = require("express");
const db = require("./config/connection");
const routes = require("./routes");
const errorHandler = require("./utils/errorHandler");

// Set up the port for the server
const PORT = process.env.PORT || 3001;

// Initialize an Express application
const app = express();

// Middleware to parse URL encoded data and JSON data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use routes from the routes module
app.use(routes);

// Error handling middleware
app.use(errorHandler);

// Log errors if any occur during MongoDB connection
db.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});

// Start the server once the MongoDB connection is open
db.once("open", () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}!`);
  });
});
