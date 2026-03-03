const express = require("express");

const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  createPost,
  getPosts,
  toggleLike,
  addComment,
  deleteComment,
  deletePost,
  getPost,
  getMyPost,
} = require("../controllers/postController");

const router = express.Router();

router.post("/posts", auth, upload.array("media", 5), createPost);
router.get("/post", auth, getPost);
router.get("/posts", auth, getPosts);
router.get("/posts/my", auth, getMyPost);
router.put("/posts/:postId/like", auth, toggleLike);
router.delete("posts/:postId", auth, deletePost);
router.delete("/:postId/comments/:commentId", auth, deleteComment);
router.post("/posts/:id/comment", auth, upload.single("audio"), addComment);

module.exports = router;
