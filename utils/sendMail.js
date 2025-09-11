const nodemailer = require("nodemailer");

// const sendEmail = async (to, subject, htmlContent) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.MAIL_HOST,
//       port: process.env.MAIL_PORT || 2525,
//       auth: {
//         user: process.env.MAILTRAP_USER,
//         pass: process.env.MAILTRAP_PASS,
//       },
//     });

//     const mailOptions = {
//       from: `"AILEANA" <${process.env.MAILTRAP_USER}>`,
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

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_EMAIL,
        pass: process.env.GOOGLE_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"AILEANA" <${process.env.GOOGLE_EMAIL}>`,
      to,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to", to);
  } catch (error) {
    console.error("Email send error:", error);
    throw new Error("Email could not be sent");
  }
};
module.exports = sendEmail;
