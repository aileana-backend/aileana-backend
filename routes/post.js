const express = require("express");

const { auth } = require("../middleware/auth");
const {
  createPost,
  getPosts,
  likePost,
  commentPost,
} = require("../controllers/postController");

const router = express.Router();

router.post("/posts", auth, createPost);

router.get("/posts", auth, getPosts);

router.post("/posts/:id/like", auth, likePost);

router.post("/posts/:id/comment", auth, commentPost);

module.exports = router;
