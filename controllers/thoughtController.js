const { Thought, User } = require("../models");
const errorHandler = require("../utils/errorHandler");
const ObjectId = require("mongoose").Types.ObjectId;
const { LRUCache } = require("lru-cache");
const options = {
  max: 100,
  ttl: 60000, // overkill for this app, lol. Just playing around with caching
};
const cache = new LRUCache(options);

cache.set("testKey", "testValue");
console.log(cache.get("testKey")); // should log "testValue"

setTimeout(() => {
  console.log(cache.get("testKey")); // should log "undefined" or "null" after TTL expires
}, 61000);

module.exports = {
  // Get all thoughts
  getAllThoughts: async (req, res, next) => {
    try {
      const cacheKey = `thoughts-page-${req.query.page || 1}-limit-${
        req.query.limit || 10
      }`;

      const cachedResponse = cache.get(cacheKey);
      if (cachedResponse) {
        return res.json(cachedResponse);
      }

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const totalThoughts = await Thought.countDocuments(); // Get total number of thoughts
      const thoughts = await Thought.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      // Loop through each thought and add the reaction count to it
      const thoughtsWithCounts = thoughts.map((thought) => {
        const thoughtObj = thought.toObject();
        thoughtObj.reactionCount = thoughtObj.reactions
          ? thoughtObj.reactions.length
          : 0;
        return thoughtObj;
      });

      const totalPages = Math.ceil(totalThoughts / limit);

      const response = {
        totalThoughts,
        totalPages,
        currentPage: page,
        thoughts: thoughtsWithCounts, // Return thoughts with counts here
      };

      cache.set(cacheKey, response);
      res.json(response);
    } catch (err) {
      next(err);
    }
  },

  // Get a single thought by id
  getThoughtById: async (req, res, next) => {
    try {
      const thought = await Thought.findById(req.params.id)
        .select("thoughtText createdAt userId reactions")
        .populate({
          path: "userId",
          select: "username",
        });

      if (!thought) {
        return res.status(404).json({ message: "Thought not found" });
      }

      const thoughtWithCount = thought.toObject();
      thoughtWithCount.reactionCount = thought.reactionCount;

      // Extract and rename the userId
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

  createThought: async (req, res, next) => {
    try {
      const newThought = await Thought.create(req.body); // Create the thought

      // Find the user by their username and update their thoughts array
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

  // Update a thought by id
  updateThought: async (req, res, next) => {
    try {
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

  // Delete a thought by id
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

  // To create a reaction stored in a single thought's reactions array field
  createReaction: async (req, res, next) => {
    try {
      const targetThought = await Thought.findById(req.params.thoughtId);

      if (!targetThought)
        return res.status(404).json({ message: "Thought not found" });

      const user = await User.findById(req.body.userId);

      if (!user) return res.status(404).json({ message: "User not found" });

      if (targetThought.userId.toString() === req.body.userId) {
        return res
          .status(403)
          .json({ message: "You cannot react to your own thought!" });
      }

      // Add the username to the reaction body before saving
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

  // To pull and remove a reaction by the reaction's reactionId value
  deleteReaction: async (req, res, next) => {
    try {
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
