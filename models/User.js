const { Schema, model } = require("mongoose");

// Define User schema
const userSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      // Regular expression to validate email format
      match: [/.+@.+\..+/, "Please enter a valid e-mail address"],
    },
    // Array to store associated thoughts' ObjectIds
    thoughts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Thought",
      },
    ],
    // Array to store friend's ObjectIds
    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    versionKey: false, // Disable the version key (_v) in the document
    timestamps: true, // Automatically manage timestamp attributes (createdAt and updatedAt)
  }
);

// Create a virtual to get the count of friends
userSchema.virtual("friendCount").get(function () {
  return this.friends.length;
});

// Indexing on createdAt field for better read performance on sorted queries
userSchema.index({ createdAt: -1 });

// Create a User model using the user schema
const User = model("User", userSchema);

// Export the User model
module.exports = User;
