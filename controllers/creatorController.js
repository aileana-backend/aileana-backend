const knex = require("../config/pg");
const smileClient = require("../config/smile-client");
const { uploadBufferToCloudinary } = require("../helpers/cloudUpload");
const { randomUUID: uuidv4 } = require("crypto");

const STATUS_FIELDS = [
  "id",
  "user_id",
  "content_categories",
  "document_type",
  "front_image_url",
  "back_image_url",
  "selfie_url",
  "guidelines_agreed",
  "guidelines_agreed_at",
  "status",
  "rejection_reason",
  "rejection_details",
  "category_submitted",
  "document_uploaded",
  "selfie_submitted",
  "created_at",
  "updated_at",
];

function currentStep(v) {
  if (!v || !v.category_submitted) return 1;
  if (!v.document_uploaded) return 2;
  if (!v.selfie_submitted) return 3;
  if (!v.guidelines_agreed) return 4;
  return 5; // submitted
}

// ─── Step 1: Content category selection ──────────────────────────────────────
const submitContentCategory = async (req, res) => {
  try {
    const { content_categories } = req.body;

    if (
      !content_categories ||
      !Array.isArray(content_categories) ||
      content_categories.length === 0
    ) {
      return res.status(400).json({
        success: false,
        msg: "content_categories must be a non-empty array",
      });
    }

    const existing = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (existing && existing.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a creator" });
    }

    const data = {
      user_id: req.user.id,
      content_categories,
      category_submitted: true,
      updated_at: new Date(),
    };

    let verification;
    if (existing) {
      [verification] = await knex("creator_verifications")
        .where({ user_id: req.user.id })
        .update(data)
        .returning(STATUS_FIELDS);
    } else {
      [verification] = await knex("creator_verifications")
        .insert({ ...data, created_at: new Date() })
        .returning(STATUS_FIELDS);
    }

    return res.json({
      success: true,
      data: verification,
      step: currentStep(verification),
    });
  } catch (err) {
    console.error("submitContentCategory error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 2: Upload identity document (front required, back optional) ─────────
const uploadDocument = async (req, res) => {
  try {
    const document_type = req.body.document_type?.trim();

    const validTypes = ["national_id", "passport", "drivers_license"];
    if (!document_type || !validTypes.includes(document_type)) {
      return res.status(400).json({
        success: false,
        msg: "document_type must be one of: national_id, passport, drivers_license",
      });
    }

    const verification = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.category_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Select your content category first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a creator" });
    }

    const frontFile = req.files?.front?.[0];
    if (!frontFile) {
      return res
        .status(400)
        .json({ success: false, msg: "Front image is required" });
    }

    const frontResult = await uploadBufferToCloudinary(
      frontFile.buffer,
      `creator_kyc/${req.user.id}/front_${uuidv4()}`,
      "image",
      "creator_kyc",
    );

    let back_image_url = null;
    const backFile = req.files?.back?.[0];
    if (backFile) {
      const backResult = await uploadBufferToCloudinary(
        backFile.buffer,
        `creator_kyc/${req.user.id}/back_${uuidv4()}`,
        "image",
        "creator_kyc",
      );
      back_image_url = backResult.secure_url;
    }

    const [updated] = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .update({
        document_type,
        front_image_url: frontResult.secure_url,
        back_image_url,
        document_uploaded: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({
      success: true,
      data: updated,
      step: currentStep(updated),
    });
  } catch (err) {
    console.error("uploadDocument error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 3: Selfie + Smile Identity submission ───────────────────────────────
const submitSelfie = async (req, res) => {
  try {
    const verification = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.document_uploaded) {
      return res.status(400).json({
        success: false,
        msg: "Upload your identity document first",
      });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a creator" });
    }

    const selfieFile = req.file;
    if (!selfieFile) {
      return res
        .status(400)
        .json({ success: false, msg: "Selfie image is required" });
    }

    const selfieResult = await uploadBufferToCloudinary(
      selfieFile.buffer,
      `creator_kyc/${req.user.id}/selfie_${uuidv4()}`,
      "image",
      "creator_kyc",
    );

    const jobId = uuidv4();
    const user = await knex("users").where({ id: req.user.id }).first();

    const partnerParams = {
      user_id: String(req.user.id),
      job_id: jobId,
      job_type: 1, // Biometric KYC
    };

    const idInfo = {
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      country: "NG",
      id_type: mapDocumentType(verification.document_type),
    };

    const images = [
      { image_type_id: 0, image: selfieResult.secure_url },
      { image_type_id: 2, image: verification.front_image_url },
    ];

    if (verification.back_image_url) {
      images.push({ image_type_id: 6, image: verification.back_image_url });
    }

    try {
      await smileClient.submit_job(partnerParams, images, idInfo, {
        return_job_status: false,
        return_image_links: false,
        use_enrolled_image: false,
      });
    } catch (smileErr) {
      console.error("Smile Identity submission error:", smileErr);
      // Continue — selfie saved, admin can review manually
    }

    const [updated] = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .update({
        selfie_url: selfieResult.secure_url,
        smile_job_id: jobId,
        selfie_submitted: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({
      success: true,
      data: updated,
      step: currentStep(updated),
    });
  } catch (err) {
    console.error("submitSelfie error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 4: Accept community guidelines + final submission ───────────────────
const submitApplication = async (req, res) => {
  try {
    const { guidelines_agreed } = req.body;

    if (!guidelines_agreed) {
      return res.status(400).json({
        success: false,
        msg: "You must agree to the Creator Community Guidelines",
      });
    }

    const verification = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.selfie_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Complete face verification first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a creator" });
    }

    if (verification.status === "pending") {
      return res.status(400).json({
        success: false,
        msg: "Application already submitted and under review",
      });
    }

    const [updated] = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .update({
        guidelines_agreed: true,
        guidelines_agreed_at: new Date(),
        status: "pending",
        rejection_reason: null,
        rejection_details: null,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({
      success: true,
      msg: "Application submitted. We will review and notify you shortly.",
      data: updated,
      step: currentStep(updated),
    });
  } catch (err) {
    console.error("submitApplication error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Resubmit documents after rejection ──────────────────────────────────────
const resubmitDocuments = async (req, res) => {
  try {
    const verification = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification) {
      return res
        .status(404)
        .json({ success: false, msg: "No verification record found" });
    }

    if (verification.status !== "rejected") {
      return res.status(400).json({
        success: false,
        msg: "Only rejected applications can be resubmitted",
      });
    }

    const [updated] = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .update({
        document_uploaded: false,
        selfie_submitted: false,
        front_image_url: null,
        back_image_url: null,
        selfie_url: null,
        smile_job_id: null,
        smile_result: null,
        status: "incomplete",
        rejection_reason: null,
        rejection_details: null,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({
      success: true,
      msg: "Ready to resubmit. Please re-upload your documents.",
      data: updated,
      step: currentStep(updated),
    });
  } catch (err) {
    console.error("resubmitDocuments error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── GET verification status ──────────────────────────────────────────────────
const getVerificationStatus = async (req, res) => {
  try {
    const verification = await knex("creator_verifications")
      .where({ user_id: req.user.id })
      .select(STATUS_FIELDS)
      .first();

    return res.json({
      success: true,
      data: verification || null,
      step: currentStep(verification),
    });
  } catch (err) {
    console.error("getVerificationStatus error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Smile Identity webhook (no auth) ────────────────────────────────────────
const smileCallback = async (req, res) => {
  try {
    const result = req.body;
    const jobId = result?.SmileJobID || result?.job_id;

    if (!jobId) {
      return res.status(400).json({ msg: "Missing job ID" });
    }

    const verification = await knex("creator_verifications")
      .where({ smile_job_id: jobId })
      .first();

    if (!verification) {
      return res.status(404).json({ msg: "Verification not found" });
    }

    const resultCode = result?.Actions?.Verify_ID_Number || result?.ResultCode;
    const isVerified = resultCode === "1012" || result?.ResultCode === "0810";

    const rejectionDetails = [];
    if (!isVerified) {
      if (result?.Actions?.Verify_ID_Number !== "1012") {
        rejectionDetails.push("Blurry ID Document");
      }
      if (result?.Actions?.Selfie_Provided !== "1") {
        rejectionDetails.push("Selfie Verification Failed");
      }
      if (rejectionDetails.length === 0) {
        rejectionDetails.push("Verification failed");
      }
    }

    await knex("creator_verifications")
      .where({ smile_job_id: jobId })
      .update({
        status: isVerified ? "verified" : "rejected",
        smile_result: JSON.stringify(result),
        rejection_reason: isVerified
          ? null
          : result?.ResultText || "Verification failed",
        rejection_details: isVerified ? null : JSON.stringify(rejectionDetails),
        updated_at: new Date(),
      });

    if (isVerified) {
      await knex("users")
        .where({ id: verification.user_id })
        .update({ is_creator: true, updated_at: new Date() });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("creator smileCallback error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

function mapDocumentType(docType) {
  const map = {
    national_id: "NATIONAL_ID",
    passport: "PASSPORT",
    drivers_license: "DRIVERS_LICENSE",
  };
  return map[docType] || "NATIONAL_ID";
}

module.exports = {
  submitContentCategory,
  uploadDocument,
  submitSelfie,
  submitApplication,
  resubmitDocuments,
  getVerificationStatus,
  smileCallback,
};
