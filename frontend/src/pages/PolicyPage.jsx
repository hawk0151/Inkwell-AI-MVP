// frontend/src/pages/PolicyPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

// Central location for all policy content. 
// You should replace these placeholders with your actual policies.
const policyContent = {
  privacy: {
    title: 'Privacy Policy',
    content: (
      <>
        <p>This is a placeholder for your Privacy Policy. This policy should detail how you collect, use, store, and protect user data. It's crucial for building trust and complying with legal regulations.</p>
        <h3 className="text-xl font-semibold mt-6 mb-2">1. Data We Collect</h3>
        <p>Information you provide directly (e.g., email address, name, user-generated story content). Information collected automatically (e.g., usage data).</p>
        <h3 className="text-xl font-semibold mt-6 mb-2">2. How We Use Your Data</h3>
        <p>To provide and maintain our service, to notify you about changes, to provide customer support, and to gather analysis to improve our service.</p>
        <h3 className="text-xl font-semibold mt-6 mb-2">3. Data Security</h3>
        <p>We use industry-standard measures to protect your data. However, no method of transmission over the Internet is 100% secure.</p>
      </>
    ),
  },
  refund: {
    title: 'Refund Policy',
    content: (
      <>
        <p>This is a placeholder for your Refund Policy. Since you are selling customized physical goods, your policy will likely state that sales are final.</p>
        <h3 className="text-xl font-semibold mt-6 mb-2">1. General Policy</h3>
        <p>Due to the personalized nature of our products, all sales are final. We do not offer refunds or returns for custom-made books once an order has been placed and processed.</p>
        <h3 className="text-xl font-semibold mt-6 mb-2">2. Exceptions</h3>
        <p>Refunds or replacements will only be offered for products with manufacturing defects or damage sustained during shipping. Please see our Return Policy for more details.</p>
      </>
    ),
  },
  return: {
    title: 'Return Policy',
    content: (
      <>
        <p>This is a placeholder for your Return Policy. This should explain the process for handling damaged or defective items.</p>
        <h3 className="text-xl font-semibold mt-6 mb-2">1. Damaged or Defective Items</h3>
        <p>If your book arrives with a manufacturing defect (e.g., printing errors, binding issues) or has been damaged in transit, please contact us within 14 days of receipt.</p>
        <h3 className="text-xl font-semibold mt-6 mb-2">2. How to Initiate a Return</h3>
        <p>To initiate a return for a damaged or defective item, please email our support team at [Your Support Email] with your order number and clear photos of the damage. We will assess the issue and arrange for a replacement to be sent to you at no additional cost.</p>
        <p>We do not accept returns for any other reason.</p>
      </>
    ),
  },
};

function PolicyPage({ type = 'privacy' }) {
  const { title, content } = policyContent[type];

  return (
    <div className="fade-in max-w-4xl mx-auto bg-slate-800/50 p-8 md:p-12 rounded-2xl shadow-xl border border-slate-700">
      <h1 className="text-4xl font-bold font-serif text-white mb-6">{title}</h1>
      <div className="prose prose-lg max-w-none text-slate-300 prose-headings:text-amber-500 prose-p:leading-relaxed">
        {content}
      </div>
       <div className="mt-8 border-t border-slate-700 pt-6">
         <Link to="/" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            &larr; Back to Home
         </Link>
       </div>
    </div>
  );
}

export default PolicyPage;