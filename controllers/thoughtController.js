const { Thought, User } = require("../models");
const errorHandler = require("../utils/errorHandler");
const ObjectId = require("mongoose").Types.ObjectId;
const { LRUCache } = require("lru-cache");

// Cache configuration
const options = {
  max: 100,
  ttl: 60000, // overkill for this app, lol. Just playing around with caching
};
const cache = new LRUCache(options);

// Sample usage of the cache (for testing purposes)
cache.set("testKey", "testValue");
console.log(cache.get("testKey")); // should log "testValue"

setTimeout(() => {
  console.log(cache.get("testKey")); // should log "undefined" or "null" after TTL expires
}, 61000);

module.exports = {
  // Retrieve all thoughts, possibly paginated if more than 10
  getAllThoughts: async (req, res, next) => {
    try {
      // Generate cache key based on query parameters
      const cacheKey = `thoughts-page-${req.query.page || 1}-limit-${
        req.query.limit || 10
      }`;

      // Check if response is already in cache
      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        return res.json(cachedResponse);
      }

      // Determine pagination settings
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      // Retrieve thoughts from database
      const totalThoughts = await Thought.countDocuments(); // Get total number of thoughts
      const thoughts = await Thought.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      // Add reaction count to each thought
      const thoughtsWithCounts = thoughts.map((thought) => {
        const thoughtObj = thought.toObject();
        thoughtObj.reactionCount = thoughtObj.reactions
          ? thoughtObj.reactions.length
          : 0;
        return thoughtObj;
      });

      const totalPages = Math.ceil(totalThoughts / limit);

      // Construct response object
      const response = {
        totalThoughts,
        totalPages,
        currentPage: page,
        thoughts: thoughtsWithCounts, // Return thoughts with counts here
      };

      // Store response in cache
      cache.set(cacheKey, response);
      res.json(response);
    } catch (err) {
      next(err);
    }
  },

  // Retrieve a specific thought by its ID
  getThoughtById: async (req, res, next) => {
    try {
      // Fetch thought details and associated user info
      const thought = await Thought.findById(req.params.id)
        .select("thoughtText createdAt userId reactions")
        .populate({
          path: "userId",
          select: "username",
        });

      if (!thought) {
        return res.status(404).json({ message: "Thought not found" });
      }

      // Extract and format details for the response
      const thoughtWithCount = thought.toObject();
      thoughtWithCount.reactionCount = thought.reactionCount;

      const { userId, createdAt, thoughtText, reactions } = thoughtWithCount;
      const user = {
        _id: userId._id,
        username: userId.username,
      };

      // Map over the reactions array to format each reaction
      const formattedReactions = reactions.map((reaction) => ({
        _id: reaction._id,
        username: reaction.username,
        reactionBody: reaction.reactionBody,
        createdAt: reaction.createdAt,
      }));

      // Construct the response in the desired order
      const orderedThought = {
        _id: thoughtWithCount._id,
        createdAt: createdAt,
        thoughtText: thoughtText,
        user: user,
        reactions: formattedReactions,
        reactionCount: thoughtWithCount.reactionCount,
      };

      res.json(orderedThought);
    } catch (err) {
      next(err);
    }
  },

  // Add a new thought
  createThought: async (req, res, next) => {
    try {
      // Insert the new thought into the database
      const newThought = await Thought.create(req.body); // Create the thought

      // Update the user's list of thoughts
      const user = await User.findOne({ username: newThought.username }).select(
        "username thoughts"
      );

      if (user) {
        user.thoughts.push(newThought._id);

        console.log("Updated User Thoughts:", user.thoughts); // Diagnostic log

        await user.save(); // Save the user
      }

      res.status(201).json(newThought);
    } catch (err) {
      next(err);
    }
  },

  // Modify an existing thought
  updateThought: async (req, res, next) => {
    try {
      // Find the thought and update it
      const thought = await Thought.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });

      if (!thought)
        return res.status(404).json({ message: "Thought not found" });

      res.json(thought);
    } catch (err) {
      next(err);
    }
  },

  // Remove a thought
  deleteThought: async (req, res, next) => {
    try {
      const thought = await Thought.findByIdAndDelete(req.params.id);

      if (!thought)
        return res.status(404).json({ message: "Thought not found" });

      res.json({ message: "Thought deleted" });
    } catch (err) {
      next(err);
    }
  },

  // Add a reaction to a thought
  createReaction: async (req, res, next) => {
    try {
      const targetThought = await Thought.findById(req.params.thoughtId);
      if (!targetThought)
        return res.status(404).json({ message: "Thought not found" });

      const user = await User.findById(req.body.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Ensure users cannot react to their own thoughts
      if (targetThought.userId.toString() === req.body.userId) {
        return res
          .status(403)
          .json({ message: "You cannot react to your own thought!" });
      }

      // Add the reaction
      req.body.username = user.username;

      const updatedThought = await Thought.findByIdAndUpdate(
        req.params.thoughtId,
        { $push: { reactions: req.body } },
        { new: true, runValidators: true }
      );

      res.json(updatedThought);
    } catch (err) {
      next(err);
    }
  },

  // Remove a reaction from a thought
  deleteReaction: async (req, res, next) => {
    try {
      // Find and update the thought by removing the specific reaction
      const thought = await Thought.findByIdAndUpdate(
        req.params.thoughtId,
        {
          $pull: {
            reactions: { _id: new ObjectId(req.params.reactionId) },
          },
        },
        { new: true }
      );
      console.log(`Thought ID: ${req.params.thoughtId}`);
      console.log(`Reaction ID: ${req.params.reactionId}`);

      if (!thought)
        return res.status(404).json({ message: "Thought not found" });
      res.json(thought);
    } catch (err) {
      next(err);
    }
  },
};
