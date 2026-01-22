// const nodemailer = require("nodemailer");

// // const sendEmail = async (to, subject, htmlContent) => {
// //   try {
// //     const transporter = nodemailer.createTransport({
// //       host: process.env.MAIL_HOST,
// //       port: process.env.MAIL_PORT || 2525,
// //       auth: {
// //         user: process.env.MAILTRAP_USER,
// //         pass: process.env.MAILTRAP_PASS,
// //       },
// //     });

// //     const mailOptions = {
// //       from: `"AILEANA" <${process.env.MAILTRAP_USER}>`,
// //       to,
// //       subject,
// //       html: htmlContent,
// //     };

// //     await transporter.sendMail(mailOptions);
// //     console.log("Email sent successfully to", to);
// //   } catch (error) {
// //     console.error("Email send error:", error);
// //     throw new Error("Email could not be sent");
// //   }
// // };

// const sendEmail = async (to, subject, htmlContent) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.GOOGLE_EMAIL,
//         pass: process.env.GOOGLE_APP_PASSWORD,
//       },
//     });

//     const mailOptions = {
//       from: `"AILEANA" <${process.env.GOOGLE_EMAIL}>`,
//       to,
//       subject,
//       html: htmlContent,
//     };

//     await transporter.sendMail(mailOptions);
//     console.log("Email sent successfully to", to);
//   } catch (error) {
//     console.error("Email send error:", error);
//     throw new Error("Email could not be sent");
//   }
// };
// module.exports = sendEmail;

const nodemailer = require("nodemailer");

// 1. Create the transporter ONCE outside the function
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GOOGLE_EMAIL,
    pass: process.env.GOOGLE_APP_PASSWORD, // Ensure no spaces here!
  },
});

// Add this temporary check
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email Auth Failed:", error);
  } else {
    console.log("✅ Server is ready to take our messages");
  }
});

const sendEmail = async (to, subject, htmlContent) => {
console.log("check env",process.env.GOOGLE_EMAIL, process.env.GOOGLE_APP_PASSWORD);
  try {
    const mailOptions = {
      from: `"AILEANA" <${process.env.GOOGLE_EMAIL}>`,
      to,
      subject,
      html: htmlContent,
    };

    // 2. Reuse the existing transporter
    const info = await transporter.sendMail(mailOptions);
    console.log("check info", info);
    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    // 3. Log the actual error for debugging, but don't leak details to the user
    console.error("Nodemailer Error:", error.message);
    throw new Error("Email delivery failed");
  }
};

module.exports = sendEmail;
