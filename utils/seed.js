const connection = require("../config/connection");
const { User, Thought } = require("../models");
const { userData, thoughtData, reactionsPool } = require("./data");

// Log errors if any occur during MongoDB connection
connection.on("error", (err) =>
  console.error("MongoDB connection error: ", err)
);

// Once MongoDB is connected, seed the database
connection.once("open", async () => {
  console.log("connected");

  try {
    // Drop existing 'users' collection if it exists
    let userCheck = await connection.db
      .listCollections({ name: "users" })
      .toArray();
    if (userCheck.length) {
      await connection.dropCollection("users");
    }

    // Drop existing 'thoughts' collection if it exists
    let thoughtCheck = await connection.db
      .listCollections({ name: "thoughts" })
      .toArray();
    if (thoughtCheck.length) {
      await connection.dropCollection("thoughts");
    }

    // Insert users data into the database
    const insertedUsers = await User.collection.insertMany(userData);
    console.log("Insertion result:", insertedUsers);

    // Confirm successful user insertion
    const createdUsers = userData;
    console.log("Users inserted successfully!");

    if (!createdUsers || createdUsers.length === 0) {
      console.log("Throwing the error. createdUsers:", createdUsers);
      throw new Error("Error in user insertion.");
    }

    // Helper function to shuffle an array (Fisher-Yates shuffle)
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    // Helper function to get random friend IDs
    function getRandomFriendIds(allUsers, currentUser, numFriends) {
      let potentialFriends = allUsers.filter(
        (user) => user._id.toString() !== currentUser._id.toString()
      );
      shuffleArray(potentialFriends);
      return potentialFriends.slice(0, numFriends).map((friend) => friend._id);
    }

    // Assign friends to each user
    const maxFriends = 3;
    for (const user of createdUsers) {
      const friendIds = getRandomFriendIds(createdUsers, user, maxFriends);
      await User.findByIdAndUpdate(user._id, {
        $push: { friends: { $each: friendIds } },
      });
    }

    // Assign thoughts and reactions
    for (const thought of thoughtData) {
      const user = createdUsers.find(
        (user) => user.username === thought.username
      );
      if (user) {
        thought.userId = user._id;
        const createdThought = await Thought.create(thought);
        await User.findByIdAndUpdate(user._id, {
          $push: { thoughts: createdThought._id },
        });

        const reactionsToAdd = [];
        const numOfReactions = 2;

        for (let i = 0; i < numOfReactions; i++) {
          const validReactions = reactionsPool.filter(
            (r) => r.username !== thought.username
          );
          const reactionIndex = Math.floor(
            Math.random() * validReactions.length
          );
          reactionsToAdd.push(validReactions[reactionIndex]);
          const indexToRemove = reactionsPool.indexOf(
            validReactions[reactionIndex]
          );
          reactionsPool.splice(indexToRemove, 1);
        }

        await Thought.findByIdAndUpdate(createdThought._id, {
          $push: { reactions: { $each: reactionsToAdd } },
        });
      }
    }

    // Log success message after seeding
    console.log("Database seeded!");
    process.exit(0);
  } catch (err) {
    // Log and exit on errors
    console.error(err);
    process.exit(1);
  }
});
