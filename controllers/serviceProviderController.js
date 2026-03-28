const knex = require("../config/pg");
const smileClient = require("../config/smile-client");
const { uploadBufferToCloudinary } = require("../helpers/cloudUpload");
const { randomUUID: uuidv4 } = require("crypto");

const STATUS_FIELDS = [
  "id",
  "user_id",
  "full_name",
  "phone_number",
  "country",
  "city",
  "service_name",
  "service_category",
  "service_description",
  "years_of_experience",
  "coverage_areas",
  "coverage_radius",
  "document_type",
  "front_image_url",
  "back_image_url",
  "selfie_url",
  "bank_name",
  "account_number",
  "account_name",
  "terms_agreed",
  "terms_agreed_at",
  "status",
  "rejection_reason",
  "rejection_details",
  "basic_info_submitted",
  "service_details_submitted",
  "service_coverage_submitted",
  "document_uploaded",
  "selfie_submitted",
  "payout_method_submitted",
  "created_at",
  "updated_at",
];

function currentStep(v) {
  if (!v || !v.basic_info_submitted) return 1;
  if (!v.service_details_submitted) return 2;
  if (!v.service_coverage_submitted) return 3;
  if (!v.document_uploaded) return 4;
  if (!v.selfie_submitted) return 5;
  if (!v.payout_method_submitted) return 6;
  if (!v.terms_agreed) return 7;
  return 8; // submitted
}

// ─── Step 1: Personal info ───────────────────────────────────────────────────
const submitBasicInfo = async (req, res) => {
  try {
    const { full_name, phone_number, country, city } = req.body;

    if (!full_name || !phone_number || !country || !city) {
      return res.status(400).json({
        success: false,
        msg: "full_name, phone_number, country and city are required",
      });
    }

    const existing = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (existing && existing.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a service provider" });
    }

    const data = {
      user_id: req.user.id,
      full_name,
      phone_number,
      country,
      city,
      basic_info_submitted: true,
      updated_at: new Date(),
    };

    let verification;
    if (existing) {
      [verification] = await knex("service_provider_verifications")
        .where({ user_id: req.user.id })
        .update(data)
        .returning(STATUS_FIELDS);
    } else {
      [verification] = await knex("service_provider_verifications")
        .insert({ ...data, created_at: new Date() })
        .returning(STATUS_FIELDS);
    }

    return res.json({ success: true, data: verification, step: currentStep(verification) });
  } catch (err) {
    console.error("sp submitBasicInfo error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 2: Service details ─────────────────────────────────────────────────
const submitServiceDetails = async (req, res) => {
  try {
    const { service_name, service_category, service_description, years_of_experience } =
      req.body;

    if (!service_name || !service_category || !service_description) {
      return res.status(400).json({
        success: false,
        msg: "service_name, service_category and service_description are required",
      });
    }

    const verification = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.basic_info_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Complete personal info first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a service provider" });
    }

    const [updated] = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .update({
        service_name,
        service_category,
        service_description,
        years_of_experience: years_of_experience ? parseInt(years_of_experience) : null,
        service_details_submitted: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({ success: true, data: updated, step: currentStep(updated) });
  } catch (err) {
    console.error("sp submitServiceDetails error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 3: Service coverage ─────────────────────────────────────────────────
const submitServiceCoverage = async (req, res) => {
  try {
    const { coverage_areas, coverage_radius } = req.body;

    if (!coverage_areas || !Array.isArray(coverage_areas) || coverage_areas.length === 0) {
      return res.status(400).json({
        success: false,
        msg: "coverage_areas must be a non-empty array",
      });
    }

    const verification = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.service_details_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Complete service details first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a service provider" });
    }

    const [updated] = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .update({
        coverage_areas,
        coverage_radius: coverage_radius || null,
        service_coverage_submitted: true,
        updated_at: new Date(),
      })
      .returning(STATUS_FIELDS);

    return res.json({ success: true, data: updated, step: currentStep(updated) });
  } catch (err) {
    console.error("sp submitServiceCoverage error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 4: Upload identity document ────────────────────────────────────────
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

    const verification = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.service_coverage_submitted) {
      return res
        .status(400)
        .json({ success: false, msg: "Complete service coverage first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a service provider" });
    }

    const frontFile = req.files?.front?.[0];
    if (!frontFile) {
      return res
        .status(400)
        .json({ success: false, msg: "Front image is required" });
    }

    const frontResult = await uploadBufferToCloudinary(
      frontFile.buffer,
      `sp_kyc/${req.user.id}/front_${uuidv4()}`,
      "image",
      "sp_kyc"
    );

    let back_image_url = null;
    const backFile = req.files?.back?.[0];
    if (backFile) {
      const backResult = await uploadBufferToCloudinary(
        backFile.buffer,
        `sp_kyc/${req.user.id}/back_${uuidv4()}`,
        "image",
        "sp_kyc"
      );
      back_image_url = backResult.secure_url;
    }

    const [updated] = await knex("service_provider_verifications")
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
    console.error("sp uploadDocument error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 5: Selfie + Smile Identity ─────────────────────────────────────────
const submitSelfie = async (req, res) => {
  try {
    const verification = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .first();

    if (!verification || !verification.document_uploaded) {
      return res
        .status(400)
        .json({ success: false, msg: "Upload your identity document first" });
    }

    if (verification.status === "verified") {
      return res
        .status(400)
        .json({ success: false, msg: "Already verified as a service provider" });
    }

    const selfieFile = req.file;
    if (!selfieFile) {
      return res
        .status(400)
        .json({ success: false, msg: "Selfie image is required" });
    }

    const selfieResult = await uploadBufferToCloudinary(
      selfieFile.buffer,
      `sp_kyc/${req.user.id}/selfie_${uuidv4()}`,
      "image",
      "sp_kyc"
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

    const [updated] = await knex("service_provider_verifications")
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
    console.error("sp submitSelfie error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 6: Payout method ───────────────────────────────────────────────────
const submitPayoutMethod = async (req, res) => {
  try {
    const { bank_name, account_number, account_name } = req.body;

    if (!bank_name || !account_number || !account_name) {
      return res.status(400).json({
        success: false,
        msg: "bank_name, account_number and account_name are required",
      });
    }

    const verification = await knex("service_provider_verifications")
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
        .json({ success: false, msg: "Already verified as a service provider" });
    }

    const [updated] = await knex("service_provider_verifications")
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
    console.error("sp submitPayoutMethod error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Step 7: Terms agreement + final submission ──────────────────────────────
const submitApplication = async (req, res) => {
  try {
    const { terms_agreed } = req.body;

    if (!terms_agreed) {
      return res.status(400).json({
        success: false,
        msg: "You must agree to the Service Provider Terms & Policies",
      });
    }

    const verification = await knex("service_provider_verifications")
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
        .json({ success: false, msg: "Already verified as a service provider" });
    }

    if (verification.status === "pending") {
      return res
        .status(400)
        .json({ success: false, msg: "Application already submitted and under review" });
    }

    const [updated] = await knex("service_provider_verifications")
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
    console.error("sp submitApplication error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── Resubmit after rejection ────────────────────────────────────────────────
const resubmitDocuments = async (req, res) => {
  try {
    const verification = await knex("service_provider_verifications")
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

    const [updated] = await knex("service_provider_verifications")
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
    console.error("sp resubmitDocuments error:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
};

// ─── GET verification status ─────────────────────────────────────────────────
const getVerificationStatus = async (req, res) => {
  try {
    const verification = await knex("service_provider_verifications")
      .where({ user_id: req.user.id })
      .select(STATUS_FIELDS)
      .first();

    return res.json({
      success: true,
      data: verification || null,
      step: currentStep(verification),
    });
  } catch (err) {
    console.error("sp getVerificationStatus error:", err);
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

    const verification = await knex("service_provider_verifications")
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

    await knex("service_provider_verifications")
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
        .update({ is_service_provider: true, updated_at: new Date() });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("sp smileCallback error:", err);
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
  submitServiceDetails,
  submitServiceCoverage,
  uploadDocument,
  submitSelfie,
  submitPayoutMethod,
  submitApplication,
  resubmitDocuments,
  getVerificationStatus,
  smileCallback,
};
