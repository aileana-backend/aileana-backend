const express = require("express");

const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  createPost,
  getPosts,
  toggleLike,
  addComment,
  deleteComment,
} = require("../controllers/postController");

const router = express.Router();

router.post("/posts", auth, upload.array("media", 5), createPost);

router.get("/posts", auth, getPosts);

router.put("/posts/:postId/like", auth, toggleLike);
router.delete("/:postId/comments/:commentId", auth, deleteComment);
router.post("/posts/:id/comment", auth, upload.single("audio"), addComment);

module.exports = router;
