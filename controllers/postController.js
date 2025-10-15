const Post = require("../models/Post");
const User = require("../models/User");
const { uploadBufferToCloudinary } = require("../helpers/cloudUpload");
const { v4: uuidv4 } = require("uuid");
// const createPost = async (req, res) => {
//   try {
//     const { type, content } = req.body;
//     console.log("Incoming files:", req.files);
//     console.log("Body content:", req.body);

//     if (!content && (!req.files || req.files.length === 0)) {
//       return res.status(400).json({ message: "Content or media is required." });
//     }

//     const media = (req.files || []).map((file) => ({
//       url: file.path,
//       type: file.mimetype.startsWith("image")
//         ? "image"
//         : file.mimetype.startsWith("video")
//         ? "video"
//         : "audio",
//     }));

//     const post = await Post.create({
//       user: req.user.id,
//       type,
//       content,
//       media,
//     });

//     res.status(201).json({ message: "Post created successfully", post });
//   } catch (error) {
//     console.error("Create Post Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };
const createPost = async (req, res) => {
  try {
    const { type, content } = req.body;

    // Basic validation
    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: "Content or media is required." });
    }

    // create placeholder post with processing status
    const post = await Post.create({
      user: req.user.id,
      type: type || "normal",
      content: content || "",
      media: [],
      uploadStatus: "processing",
    });

    // respond immediately
    res.status(202).json({
      message: "Post accepted and is being processed",
      postId: post._id,
      status: post.uploadStatus,
    });

    // background processing (do not await)
    (async () => {
      try {
        console.log(`Background: processing files for post ${post._id}`);

        const files = req.files || [];

        if (files.length === 0) {
          // No files to upload, mark completed
          await Post.findByIdAndUpdate(post._id, { uploadStatus: "completed" });
          console.log(`Post ${post._id} marked completed (no files).`);
          return;
        }

        const mediaArr = [];

        for (const file of files) {
          try {
            const resource_type = file.mimetype.startsWith("image")
              ? "image"
              : file.mimetype.startsWith("video")
              ? "video"
              : "raw"; // audio/raw fallback

            // use uuid to avoid collisions
            const publicId = `${Date.now()}-${uuidv4()}`;

            console.log(
              `Uploading ${file.originalname} (size=${file.size}) to Cloudinary...`
            );

            const result = await uploadBufferToCloudinary(
              file.buffer,
              publicId,
              resource_type,
              "posts_media"
            );

            mediaArr.push({
              url: result.secure_url || result.url,
              type:
                resource_type === "image"
                  ? "image"
                  : resource_type === "video"
                  ? "video"
                  : "audio",
              // optionally set duration if returned (for videos)
              duration: result.duration || undefined,
            });
          } catch (err) {
            console.error("Error uploading a file for post", post._id, err);
            // continue with other files (or mark failure)
          }
        }

        // update post with media and mark completed
        await Post.findByIdAndUpdate(post._id, {
          media: mediaArr,
          uploadStatus: "completed",
        });
        console.log(
          `Background: Post ${post._id} updated with ${mediaArr.length} media items.`
        );
      } catch (bgErr) {
        console.error("Background processing error for post", post._id, bgErr);
        await Post.findByIdAndUpdate(post._id, { uploadStatus: "failed" });
      }
    })();
  } catch (err) {
    console.error("Create Post Error (controller top-level):", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Server error" });
    }
  }
};

const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "first_name last_name email")
      .populate("comments.user", "first_name last_name email")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error("Get Posts Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "username first_name last_name email")
      .populate("likes", "username email")
      .populate("comments.user", "username email");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
const getMyPost = async (req, res) => {
  try {
    const posts = await Post.find({ user: req.user._id })
      .populate("user", "username first_name last_name email")
      .populate("likes", "username email")
      .populate("comments.user", "username email");

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = post.likes.includes(req.user.id);

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (id) => id.toString() !== req.user.id.toString()
      );
    } else {
      post.likes.push(req.user.id);
    }

    await post.save();
    res.json({
      message: alreadyLiked ? "Unliked" : "Liked",
      likes: post.likes,
    });
  } catch (error) {
    console.error("Toggle Like Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const addComment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text && !req.file) {
      return res
        .status(400)
        .json({ message: "Comment must have text or audio" });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const audio = req.file ? { url: req.file.path, type: "audio" } : undefined;

    const comment = {
      user: req.user.id,
      text,
      audio,
      createdAt: new Date(),
    };

    post.comments.push(comment);
    await post.save();

    res.status(201).json({ message: "Comment added", comment });
  } catch (error) {
    console.error("Add Comment Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);

    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);

    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    comment.remove();
    await post.save();

    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Delete Comment Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.user.toString() !== req.user._id) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this post" });
    }

    await post.deleteOne();

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
module.exports = {
  createPost,
  getPosts,
  toggleLike,
  addComment,
  deleteComment,
  deletePost,
  getPost,
  getMyPost,
};
