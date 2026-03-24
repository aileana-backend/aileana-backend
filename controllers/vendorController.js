const knex = require("../config/pg");
const smileClient = require("../config/smile-client");
const { uploadBufferToCloudinary } = require("../helpers/cloudUpload");
const { randomUUID: uuidv4 } = require("crypto");

const STATUS_FIELDS = [
  "id",
  "full_name",
  "business_name",
  "phone_number",
  "country",
  "city",
  "document_type",
  "front_image_url",
  "back_image_url",
  "selfie_url",
  "shop_name",
  "shop_category",
  "shop_description",
  "years_of_experience",
  "website",
  "bank_name",
  "account_number",
  "account_name",
  "terms_agreed",
  "terms_agreed_at",
  "status",
  "rejection_reason",
  "rejection_details",
  "basic_info_submitted",
  "document_uploaded",
  "selfie_submitted",
  "business_details_submitted",
  "payout_method_submitted",
  "created_at",
  "updated_at",
];

function currentStep(v) {
  if (!v || !v.basic_info_submitted) return 1;
  if (!v.document_uploaded) return 2;
  if (!v.selfie_submitted) return 3;
  if (!v.business_details_submitted) return 4;
  if (!v.payout_method_submitted) return 5;
  if (!v.terms_agreed) return 6;
  return 7; // submitted
}

// ─── Step 1: Basic personal info ────────────────────────────────────────────
const submitBasicInfo = async (req, res) => {
  try {
    const { full_name, business_name, phone_number, country, city } = req.body;

    if (!full_name || !phone_number || !country || !city) {
      return res.status(400).json({
        success: false,
        msg: "full_name, phone_number, country and city are required",
      });
    }

    const existing = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (existing && existing.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a vendor" });
    }

    const data = {
      user_id: req.user.id,
      full_name,
      business_name: business_name || null,
      phone_number,
      country,
      city,
      basic_info_submitted: true,
      updated_at: new Date(),
    };

    let verification;
    if (existing) {
      [verification] = await knex("vendor_verifications")
        .where({ user_id: req.user.id })
        .update(data)
        .returning(STATUS_FIELDS);
    } else {
      [verification] = await knex("vendor_verifications")
        .insert({ ...data, created_at: new Date() })
        .returning(STATUS_FIELDS);
    }

    return res.json({ success: true, data: verification, step: currentStep(verification) });
  } catch (err) {
    console.error("submitBasicInfo error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 2: Upload document images (front required, back optional) ──────────
const uploadDocument = async (req, res) => {
  try {
    const { document_type } = req.body;

    const validTypes = ["national_id", "passport", "drivers_license"];
    if (!document_type || !validTypes.includes(document_type)) {
      return res.status(400).json({
        success: false,
        msg: "document_type must be one of: national_id, passport, drivers_license",
      });
    }

    const verification = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.basic_info_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Complete basic info first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a vendor" });
    }

    const frontFile = req.files?.front?.[0];
    if (!frontFile) {
      return res
        .status(400)
        .json({ success: false, msg: "Front image is required" });
    }

    const frontResult = await uploadBufferToCloudinary(
      frontFile.buffer,
      `vendor_kyc/${req.user.id}/front_${uuidv4()}`,
      "image",
      "vendor_kyc"
    );

    let back_image_url = null;
    const backFile = req.files?.back?.[0];
    if (backFile) {
      const backResult = await uploadBufferToCloudinary(
        backFile.buffer,
        `vendor_kyc/${req.user.id}/back_${uuidv4()}`,
        "image",
        "vendor_kyc"
      );
      back_image_url = backResult.secure_url;
    }

    const [updated] = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .update({
        document_type,
        front_image_url: frontResult.secure_url,
        back_image_url,
        document_uploaded: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({ success: true, data: updated, step: currentStep(updated) });
  } catch (err) {
    console.error("uploadDocument error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 3: Selfie + Smile Identity submission ──────────────────────────────
const submitSelfie = async (req, res) => {
  try {
    const verification = await knex("vendor_verifications")
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
        .json({ success: false, msg: "Already verified as a vendor" });
    }

    const selfieFile = req.file;
    if (!selfieFile) {
      return res
        .status(400)
        .json({ success: false, msg: "Selfie image is required" });
    }

    const selfieResult = await uploadBufferToCloudinary(
      selfieFile.buffer,
      `vendor_kyc/${req.user.id}/selfie_${uuidv4()}`,
      "image",
      "vendor_kyc"
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
      country: verification.country || "NG",
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

    const [updated] = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .update({
        selfie_url: selfieResult.secure_url,
        smile_job_id: jobId,
        selfie_submitted: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({ success: true, data: updated, step: currentStep(updated) });
  } catch (err) {
    console.error("submitSelfie error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 4: Business details ────────────────────────────────────────────────
const submitBusinessDetails = async (req, res) => {
  try {
    const { shop_name, shop_category, shop_description, years_of_experience, website } =
      req.body;

    if (!shop_name || !shop_category || !shop_description) {
      return res.status(400).json({
        success: false,
        msg: "shop_name, shop_category and shop_description are required",
      });
    }

    const verification = await knex("vendor_verifications")
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
        .json({ success: false, msg: "Already verified as a vendor" });
    }

    const [updated] = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .update({
        shop_name,
        shop_category,
        shop_description,
        years_of_experience: years_of_experience ? parseInt(years_of_experience) : null,
        website: website || null,
        business_details_submitted: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({ success: true, data: updated, step: currentStep(updated) });
  } catch (err) {
    console.error("submitBusinessDetails error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 5: Payout method ───────────────────────────────────────────────────
const submitPayoutMethod = async (req, res) => {
  try {
    const { bank_name, account_number, account_name } = req.body;

    if (!bank_name || !account_number || !account_name) {
      return res.status(400).json({
        success: false,
        msg: "bank_name, account_number and account_name are required",
      });
    }

    const verification = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.business_details_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Complete business details first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a vendor" });
    }

    const [updated] = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .update({
        bank_name,
        account_number,
        account_name,
        payout_method_submitted: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({ success: true, data: updated, step: currentStep(updated) });
  } catch (err) {
    console.error("submitPayoutMethod error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 6: Vendor agreement + final submission ─────────────────────────────
const submitApplication = async (req, res) => {
  try {
    const { terms_agreed } = req.body;

    if (!terms_agreed) {
      return res.status(400).json({
        success: false,
        msg: "You must agree to the Vendor Terms & Marketplace Policies",
      });
    }

    const verification = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.payout_method_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Complete payout method setup first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a vendor" });
    }

    if (verification.status === "pending") {
      return res
        .status(400)
        .json({ success: false, msg: "Application already submitted and under review" });
    }

    const [updated] = await knex("vendor_verifications")
      .where({ user_id: req.user.id })
      .update({
        terms_agreed: true,
        terms_agreed_at: new Date(),
        status: "pending",
        rejection_reason: null,
        rejection_details: null,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({
      success: true,
      msg: "Application submitted. We will review and notify you within 24–48 hours.",
      data: updated,
      step: currentStep(updated),
    });
  } catch (err) {
    console.error("submitApplication error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Resubmit documents (after rejection) ───────────────────────────────────
const resubmitDocuments = async (req, res) => {
  try {
    const verification = await knex("vendor_verifications")
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

    // Reset document and selfie steps so the user can re-upload
    const [updated] = await knex("vendor_verifications")
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

// ─── GET verification status ─────────────────────────────────────────────────
const getVerificationStatus = async (req, res) => {
  try {
    const verification = await knex("vendor_verifications")
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

    const verification = await knex("vendor_verifications")
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
      if (result?.Actions?.Selfie_Provided !== "1")  {
        rejectionDetails.push("Selfie Verification Failed");
      }
      if (rejectionDetails.length === 0) {
        rejectionDetails.push("Verification failed");
      }
    }

    await knex("vendor_verifications")
      .where({ smile_job_id: jobId })
      .update({
        status: isVerified ? "verified" : "rejected",
        smile_result: JSON.stringify(result),
        rejection_reason: isVerified ? null : (result?.ResultText || "Verification failed"),
        rejection_details: isVerified ? null : JSON.stringify(rejectionDetails),
        updated_at: new Date(),
      });

    if (isVerified) {
      await knex("users")
        .where({ id: verification.user_id })
        .update({ kyc_completed: true, updated_at: new Date() });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("smileCallback error:", err);
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
  submitBasicInfo,
  uploadDocument,
  submitSelfie,
  submitBusinessDetails,
  submitPayoutMethod,
  submitApplication,
  resubmitDocuments,
  getVerificationStatus,
  smileCallback,
};
