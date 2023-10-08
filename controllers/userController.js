const { User, Thought } = require("../models");
const errorHandler = require("../utils/errorHandler");
const mongoose = require("mongoose");
mongoose.set("debug", true);

module.exports = {
  // Get all users
  getAllUsers: async (req, res, next) => {
    try {
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

      const usersWithFriendCount = users.map((user) => {
        const userObj = user.toObject();
        userObj.friendCount = user.friends.length;

        // Transform the friends array to contain only usernames
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

  // Get a single user by id
  getUserById: async (req, res, next) => {
    try {
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

      const userWithFriendCount = user.toObject();
      userWithFriendCount.friendCount = user.friends.length;

      // Transform the friends array to contain only usernames
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

  // Update a user by id
  updateUser: async (req, res, next) => {
    try {
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

      const userWithFriendCount = user.toObject();
      userWithFriendCount.friendCount = user.friends.length;

      // Transform the friends array to contain only usernames
      userWithFriendCount.friends = userWithFriendCount.friends.map(
        (friendObj) => friendObj.username
      );

      res.json(userWithFriendCount);
    } catch (err) {
      next(err);
    }
  },

  // Delete a user by id
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

  // To add a new friend to a user's friend list
  addFriend: async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      const friend = await User.findById(req.params.friendId);

      if (!user || !friend) {
        return res.status(404).json({ message: "User or friend not found" });
      }

      // Check if the friend is already in the user's friend list
      if (user.friends.includes(req.params.friendId)) {
        return res
          .status(400)
          .json({ message: "This user is already a friend" });
      }

      user.friends.push(req.params.friendId);
      friend.friends.push(req.params.userId); // Mutual addition

      await user.save();
      await friend.save(); // Saving the mutual friend addition for the friend

      // Constructing the friendship message
      const friendshipMessage = `${user.username} + ${friend.username} are now friends`;

      res.json({ message: friendshipMessage });
    } catch (err) {
      next(err);
    }
  },

  // To remove a friend from a user's friend list
  deleteFriend: async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      const friend = await User.findById(req.params.friendId);

      if (!user || !friend) {
        return res.status(404).json({ message: "User or friend not found" });
      }

      if (!user.friends.includes(req.params.friendId)) {
        return res.status(400).json({ message: "This user is not a friend" });
      }

      user.friends = user.friends.filter(
        (friendId) => friendId.toString() !== req.params.friendId
      );

      friend.friends = friend.friends.filter(
        (userId) => userId.toString() !== req.params.userId
      ); // Mutual removal

      await user.save();
      await friend.save(); // Saving the mutual friend removal for the friend

      // Constructing the "no longer friends" message
      const noLongerFriendsMessage = `${user.username} and ${friend.username} are no longer friends`;

      res.json({ message: noLongerFriendsMessage });
    } catch (err) {
      next(err);
    }
  },
};
