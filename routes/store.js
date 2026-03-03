const express = require("express");
const router = express.Router();
const {
  getMyStore,
  updateStore,
  toggleStoreStatus,
  getAllStores,
} = require("../controllers/storeController");

const { auth } = require("../middleware/auth");

// User store routes
router.get("/my-store", auth, getMyStore);
router.put("/my-store", auth, updateStore);
router.patch("/my-store/status", auth, toggleStoreStatus);

// Admin
router.get("/all", auth, getAllStores);

module.exports = router;
