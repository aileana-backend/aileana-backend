const express = require("express");
const { auth } = require("../middleware/auth");
const {
  getBillCategories,
  validateCustomer,
  buyAirtime,
  buyData,
  payCableTv,
  payElectricity,
  getBillStatus,
} = require("../controllers/utilitiesController");

const router = express.Router();

router.get("/utilities/categories", auth, getBillCategories);
router.post("/utilities/validate-customer", auth, validateCustomer);
router.post("/utilities/buy-airtime", auth, buyAirtime);
router.post("/utilities/buy-data", auth, buyData);
router.post("/utilities/cable-tv", auth, payCableTv);
router.post("/utilities/electricity", auth, payElectricity);
router.get("/utilities/status/:reference", auth, getBillStatus);

module.exports = router;
