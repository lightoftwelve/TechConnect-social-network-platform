const { Schema, model } = require("mongoose");
const { format } = require("date-fns");

// Define Reaction schema (for reactions on thoughts)
const reactionSchema = new Schema(
  {
    reactionId: {
      type: Schema.Types.ObjectId,
    },
    reactionBody: {
      type: String,
      required: true,
      maxlength: 280,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    // Format the date when retrieving it
    createdAt: {
      type: Date,
      default: Date.now,
      get: (createdAtVal) => format(createdAtVal, "MMMM do yyyy, h:mm:ss a"),
    },
  },
  {
    // Disable the version key (_v) in the document
    versionKey: false,
  }
);

// Define Thought schema
const thoughtSchema = new Schema(
  {
    thoughtText: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 280,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    username: {
      type: String,
      required: true,
    },
    // Format the date when retrieving it
    createdAt: {
      type: Date,
      default: Date.now,
      get: (createdAtVal) => format(createdAtVal, "MMMM do yyyy, h:mm:ss a"),
    },
    // Embed reaction schema for storing reactions on a thought
    reactions: [reactionSchema],
  },
  {
    // Disable the version key (_v) in the document
    versionKey: false,
  }
);

// Create a virtual to get the count of reactions
thoughtSchema.virtual("reactionCount").get(function () {
  return this.reactions.length;
});

// Indexing on createdAt field for better read performance on sorted queries
thoughtSchema.index({ createdAt: -1 });

// Create a Thought model using the thought schema
const Thought = model("Thought", thoughtSchema);

// Export the Thought model
module.exports = Thought;
