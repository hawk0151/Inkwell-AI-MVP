// frontend/src/pages/PolicyPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

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
      </>
    ),
  },
  // NEW: Shipping Policy content
  shipping: {
    title: 'Shipping Policy',
    content: (
        <>
            <p>This is a placeholder for your Shipping Policy. This should explain your production and shipping process.</p>
            <h3 className="text-xl font-semibold mt-6 mb-2">1. Production Time</h3>
            <p>Each book is a custom, print-on-demand product. Please allow 5-7 business days for production before your order is shipped.</p>
            <h3 className="text-xl font-semibold mt-6 mb-2">2. Shipping Times & Costs</h3>
            <p>Shipping times and costs vary based on the destination and shipping method selected at checkout. Estimated delivery times will be provided once your order has shipped.</p>
            <h3 className="text-xl font-semibold mt-6 mb-2">3. International Shipping</h3>
            <p>We ship to select international destinations. Please be aware that customers are responsible for any customs fees, import duties, or taxes that may be imposed by their country's authorities.</p>
        </>
    )
  }
};

function PolicyPage({ type = 'privacy' }) {
  const data = policyContent[type];

  if (!data) {
    return (
        <div className="fade-in max-w-4xl mx-auto p-8 text-center">
            <h1 className="text-4xl font-bold text-white mb-6">Policy Not Found</h1>
            <p className="text-slate-300">The requested policy could not be found.</p>
            <div className="mt-8">
                <Link to="/" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                &larr; Back to Home
                </Link>
            </div>
        </div>
    );
  }

  const { title, content } = data;

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