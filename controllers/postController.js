const Post = require("../models/Post");

const createPost = async (req, res) => {
  try {
    const { content, type, media } = req.body;

    if (!content && (!media || media.length === 0)) {
      return res.status(400).json({ error: "Content or media is required" });
    }

    const post = await Post.create({
      user: req.user._id,
      type: type || "normal",
      content,
      media: media || [],
    });

    res.json(post);
  } catch (err) {
    console.error("createPost error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
};
const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "first_name last_name username")
      .populate("comments.user", "first_name last_name username")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error("getPosts error:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

const likePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { likes: req.user._id } }, // prevents duplicates
      { new: true }
    );
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "Failed to like post" });
  }
};

const commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text)
      return res.status(400).json({ error: "Comment text is required" });

    const post = await Post.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: {
            user: req.user._id,
            text,
          },
        },
      },
      { new: true }
    ).populate("comments.user", "first_name last_name username");

    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "Failed to add comment" });
  }
};
module.exports = { createPost, getPosts, likePost, commentPost };
