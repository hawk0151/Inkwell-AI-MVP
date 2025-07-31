// backend/src/services/email.service.js

/**
 * Sends an order confirmation email to the user.
 * In a real application, this would integrate with a service like SendGrid, Mailgun, or Nodemailer.
 * This is a placeholder/simulation for now.
 * @param {string} userEmail - The recipient's email address.
 * @param {object} orderDetails - The details of the order.
 */
export const sendOrderConfirmationEmail = async (userEmail, orderDetails) => {
  console.log("--- SIMULATING EMAIL SEND ---");
  console.log(`To: ${userEmail}`);
  console.log(`Subject: Your Inkwell AI Order is Confirmed! (Order #${orderDetails.id})`);
  console.log(`Body:`);
  console.log(`Hi there,`);
  console.log(`Thank you for your purchase. Your custom book "${orderDetails.product_name}" is now being processed.`);
  console.log(`Total Price: $${orderDetails.total_price.toFixed(2)}`);
  console.log(`We will notify you again once it has been shipped.`);
  console.log("-------------------------------");
  
  // In a real app, you would have your email sending logic here.
  // For example, using Nodemailer:
  /*
  import nodemailer from 'nodemailer';
  const transporter = nodemailer.createTransport({ ... });
  await transporter.sendMail({
    from: '"Inkwell AI" <no-reply@inkwell.ai>',
    to: userEmail,
    subject: "Your Inkwell AI Order is Confirmed!",
    html: `<h1>Thank you for your order!</h1><p>Your custom book "${orderDetails.product_name}" is now being processed.</p>`
  });
  */
  
  console.log("Email simulation complete.");
  return Promise.resolve();
};
