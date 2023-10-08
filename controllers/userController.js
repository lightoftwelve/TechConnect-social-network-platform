const { User, Thought } = require("../models");
const errorHandler = require("../utils/errorHandler");
const mongoose = require("mongoose");
mongoose.set("debug", true);

module.exports = {
  // Retrieve all users with associated thoughts and friends
  getAllUsers: async (req, res, next) => {
    try {
      // Find all users and populate their associated thoughts and friends
      const users = await User.find()
        .select("_id username email thoughts")
        .populate({
          path: "thoughts",
          select: "_id thoughtText createdAt",
        })
        .populate({
          path: "friends",
          select: "username -_id",
        });

      // Add a friend count and transform friends to only include usernames
      const usersWithFriendCount = users.map((user) => {
        const userObj = user.toObject();
        userObj.friendCount = user.friends.length;
        userObj.friends = userObj.friends.map(
          (friendObj) => friendObj.username
        );

        return userObj;
      });

      res.json(usersWithFriendCount);
    } catch (err) {
      next(err);
    }
  },

  // Retrieve a single user by their ID
  getUserById: async (req, res, next) => {
    try {
      // Find user by ID and populate their associated thoughts and friends
      const user = await User.findById(req.params.id)
        .select("_id username email thoughts")
        .populate({
          path: "thoughts",
          select: "_id thoughtText createdAt",
        })
        .populate({
          path: "friends",
          select: "username -_id",
        });

      if (!user) return res.status(404).json({ message: "User not found" });

      // Add friend count and transform friends to only include usernames
      const userWithFriendCount = user.toObject();
      userWithFriendCount.friendCount = user.friends.length;
      userWithFriendCount.friends = userWithFriendCount.friends.map(
        (friendObj) => friendObj.username
      );

      res.json(userWithFriendCount);
    } catch (err) {
      next(err);
    }
  },

  // Create a new user
  createUser: async (req, res, next) => {
    try {
      const createdUser = await User.create(req.body);
      const user = {
        _id: createdUser._id,
        username: createdUser.username,
        email: createdUser.email,
      };

      console.log("Created User:", user);

      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },

  // Update an existing user by their ID
  updateUser: async (req, res, next) => {
    try {
      // Update user and populate their friends
      const user = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
        .select("_id username email friends")
        .populate({
          path: "friends",
          select: "username -_id",
        });

      if (!user) return res.status(404).json({ message: "User not found" });

      // Add friend count and transform friends to only include usernames
      const userWithFriendCount = user.toObject();
      userWithFriendCount.friendCount = user.friends.length;
      userWithFriendCount.friends = userWithFriendCount.friends.map(
        (friendObj) => friendObj.username
      );

      res.json(userWithFriendCount);
    } catch (err) {
      next(err);
    }
  },

  // Delete a user and their associated thoughts
  deleteUser: async (req, res, next) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Remove user's associated thoughts when deleting a user
      await Thought.deleteMany({ username: user.username });

      res.json({ message: "User deleted" });
    } catch (err) {
      next(err);
    }
  },

  // Add a user to another user's friend list (mutual friendship)
  addFriend: async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      const friend = await User.findById(req.params.friendId);

      if (!user || !friend) {
        return res.status(404).json({ message: "User or friend not found" });
      }

      // Ensure that the friend isn't already in the user's friend list
      if (user.friends.includes(req.params.friendId)) {
        return res
          .status(400)
          .json({ message: "This user is already a friend" });
      }

      user.friends.push(req.params.friendId);
      friend.friends.push(req.params.userId); // Add mutual friendship

      await user.save();
      await friend.save(); // Saving the mutual friend addition for the friend

      const friendshipMessage = `${user.username} + ${friend.username} are now friends`;

      res.json({ message: friendshipMessage });
    } catch (err) {
      next(err);
    }
  },

  // Remove a user from another user's friend list (mutual removal)
  deleteFriend: async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      const friend = await User.findById(req.params.friendId);

      if (!user || !friend) {
        return res.status(404).json({ message: "User or friend not found" });
      }

      // Ensure that the friend is in the user's friend list before removal
      if (!user.friends.includes(req.params.friendId)) {
        return res.status(400).json({ message: "This user is not a friend" });
      }

      user.friends = user.friends.filter(
        (friendId) => friendId.toString() !== req.params.friendId
      );

      friend.friends = friend.friends.filter(
        (userId) => userId.toString() !== req.params.userId
      ); // Mutual removal of friendship

      await user.save();
      await friend.save(); // Saving the mutual friend removal for the friend

      const noLongerFriendsMessage = `${user.username} and ${friend.username} are no longer friends`;

      res.json({ message: noLongerFriendsMessage });
    } catch (err) {
      next(err);
    }
  },
};
