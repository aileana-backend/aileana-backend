// const crypto = require("crypto");

// const IV_LENGTH = 16;
// const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
//   ? Buffer.from(process.env.ENCRYPTION_KEY, "hex") // or "base64"
//   : crypto.randomBytes(32);

// // Encrypt text
// function encrypt(text) {
//   const iv = crypto.randomBytes(IV_LENGTH);
//   const cipher = crypto.createCipheriv(
//     "aes-256-cbc",
//     Buffer.from(ENCRYPTION_KEY),
//     iv
//   );
//   let encrypted = cipher.update(text, "utf8", "hex");
//   encrypted += cipher.final("hex");
//   return iv.toString("hex") + ":" + encrypted; // store IV with ciphertext
// }

// // Decrypt text
// function decrypt(text) {
//   const [ivHex, encryptedData] = text.split(":");
//   const iv = Buffer.from(ivHex, "hex");
//   const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
//   let decrypted = decipher.update(encryptedData, "hex", "utf8");
//   decrypted += decipher.final("utf8");
//   return decrypted;
// }

// module.exports = { encrypt, decrypt };

const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      iv,
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (error) {
    console.error("Encryption error:", error);
    return text;
  }
};

const decrypt = (text) => {
  if (!text || !text.includes(":")) return text;

  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      iv,
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    console.error("Decryption failed for content. Returning raw text.");
    return text;
  }
};

module.exports = { encrypt, decrypt };
