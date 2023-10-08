const router = require("express").Router();
const {
  getAllThoughts,
  getThoughtById,
  createThought,
  updateThought,
  deleteThought,
  createReaction,
  deleteReaction,
} = require("../../controllers/thoughtController");

// /api/thoughts/
router.route("/").get(getAllThoughts).post(createThought);

// /api/thoughts/:id
router
  .route("/:id")
  .get(getThoughtById)
  .put(updateThought)
  .delete(deleteThought);

// /api/:thoughtId/reactions
router.route("/:thoughtId/reactions").post(createReaction); // to create a reaction stored in a single thought's reactions array field

// /api/:thoughtId/reactions/:reactionId
router.route("/:thoughtId/reactions/:reactionId").delete(deleteReaction); // to pull and remove a reaction by the reaction's reactionId value

module.exports = router;
