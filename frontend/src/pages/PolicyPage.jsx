import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import ReactMarkdown from 'react-markdown';
// FIX: Added icons for styling the policy headings
import { DocumentTextIcon, ShieldCheckIcon, LockClosedIcon, TruckIcon, ReceiptRefundIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

const policyContent = {
    terms: {
        title: 'Terms of Service — Inkwell AI',
        id: 'terms-of-service-section',
        content: `
> ***In short: By using Inkwell AI, you agree to our rules. You must be over 18 (or have permission) and are responsible for reviewing your book before you buy. We own our platform, but you own the rights to the stories you create.***

**Effective Date: 2025-08-30**
**Last Updated: 2025-08-30**

### 1. Introduction & Acceptance
Welcome to Inkwell AI (“we,” “our,” “us”). These Terms of Service (“Terms”) govern your use of our website, applications, AI content generation tools, and any related printing and shipping services (collectively, the “Services”). By using our Services, you agree to these Terms and our integrated [Copyright Policy](/policies#copyright-policy-section), [Privacy Policy](/policies#privacy-policy-section), [Refund Policy](/policies#refund-policy-section), [Return Policy](/policies#return-policy-section), and [Shipping Policy](/policies#shipping-policy-section). If you do not agree, you must stop using the Services. These Terms operate subject to the Australian Consumer Law (ACL) and the New Zealand Consumer Guarantees Act 1993 (CGA).

### 2. Definitions
-   **Digital Product** — Any AI-generated or downloadable file created through our platform.
-   **Physical Product** — Any printed, bound, or manufactured product delivered by our third-party printing and shipping partners.
-   **User** — Any individual or organisation accessing or using the Services.
-   **Order** — A confirmed purchase made through our platform.

### 3. Eligibility
To use our Services, you must:
-   Be 18 years or older, or have parental/guardian consent.
-   Have the legal capacity to enter into a binding contract.
-   Comply with all applicable laws and regulations.

### 4. Services Provided
We provide:
-   AI-powered story and image generation.
-   Optional printing, binding, and shipping of works.
-   Previews and downloadable files.
We may change, suspend, or discontinue Services at any time, without affecting your rights under the ACL or CGA.

### 5. Account Responsibilities
-   You are responsible for keeping your login details secure.
-   You must provide accurate and up-to-date account information.
-   You must not misuse, hack, or disrupt the Services.

### 6. Payments & Pricing
-   Prices are displayed in AUD or NZD unless otherwise noted.
-   Payments are processed via secure third-party providers (e.g., Stripe).
-   Prices may change, but confirmed orders will not be affected.

### 7. Review Before Purchase (Crucial Clause)
Before placing an order for any Digital or Physical Product, you acknowledge and agree that:
-   You have had the **full and complete opportunity to review all aspects** of your generated book and order — including but not limited to, the entire text content, available visual previews, product specifications, page layouts, formatting, spelling, grammar, and final pricing — before confirming payment.
-   You are **solely responsible** for thoroughly reviewing and ensuring all details (including content accuracy and aesthetic preferences) are correct and satisfactory.
-   Once confirmed, your order is final and subject only to the Refund Policy and Return Policy.
-   Inkwell AI is not liable for errors, omissions, or subjective dissatisfaction (such as phrasing, story direction, or design choices) if you did not correct or review them before payment. **By completing a purchase, you explicitly accept the product as previewed.**

### 8. Intellectual Property
For full details on intellectual property and copyright, please see our comprehensive [Copyright Policy](/policies#copyright-policy-section).

### 9. Disclaimers & Liability
Services are provided “as is,” with guarantees only to the extent required by law. To the maximum extent permitted by law, our liability is limited to:
-   For goods — replacement, repair, or refund of the purchase price.
-   For services — resupply of the service or a refund of the service fee.
We are not liable for any indirect, incidental, or consequential losses.
### 10. Governing Law & Dispute Resolution
For customers residing in Australia, these Terms are governed by the laws of the State of South Australia. The Australian Consumer Law (ACL) and New Zealand Consumer Guarantees Act (CGA) also apply as relevant. For customers residing in New Zealand, these Terms are governed by the laws of New Zealand. 

For customers residing in other countries, including the United States, European Union, or elsewhere, you agree that these Terms are governed by the laws of South Australia, and you will comply with all applicable local laws in your jurisdiction.

Any disputes arising from these Terms will be resolved by the following escalation process: first through **good-faith negotiation**, then through **formal mediation**, and only as a final resort, through litigation in the appropriate courts.

### 11. Account Termination
We reserve the right to suspend or terminate your account and access to the Services, without prior notice or liability, if you breach these Terms, including but not limited to submitting unlawful content or misusing the platform. Upon termination, your right to use the Services will immediately cease.

### 12. Changes to These Terms
We may update these Terms periodically. We will notify you of significant changes. Continued use of our Services after changes are posted constitutes your acceptance of the updated Terms.

For any questions about these Terms of Service, please contact us at **support@inkwell.net.au**.
`
    },
    copyright: {
        title: 'Copyright Policy — Inkwell AI',
        id: 'copyright-policy-section',
        content: `
> ***In short: We own our website and brand. You own the prompts you write. We give you full ownership rights to the AI-generated stories and images you create, along with the freedom to use them for personal or commercial projects, after payment is made.***

**Effective Date: 2025-08-30**
**Last Updated: 2025-08-30**

This section governs the ownership and use of all content and materials associated with the Inkwell AI platform.

### Our Intellectual Property
The Inkwell AI platform — including software, design, branding, logos, and all original site content (“Our IP”) — is the exclusive property of Inkwell AI. Our IP is protected by intellectual property laws, including the *Copyright Act 1968* (Cth) in Australia and the *Copyright Act 1994* (NZ) in New Zealand. You may not copy, distribute, or modify Our IP without our express written consent.

### Content You Provide
You retain full ownership and copyright in the original content you provide to the Service, such as your text prompts and uploaded images (“Your Content”). To provide the Service, you grant Inkwell AI a worldwide, non-exclusive, royalty-free license to use, reproduce, and modify Your Content for the sole purpose of generating your book, fulfilling your orders, and improving our Service. You warrant that you have all necessary rights to grant us this license and that Your Content does not infringe upon any third-party rights.

### Ownership of AI-Generated Content
The stories, text, and images created by the AI based on your prompts are defined as **"AI-Generated Content."** The ownership of copyright in AI-Generated Content is a complex area of law. Our goal is to provide you with the broadest possible rights to the content you create.

Therefore, subject to your full compliance with these Terms, **we hereby assign to you all right, title, and interest that Inkwell AI may have in the AI-Generated Content you create.**
-   For clarity, in **New Zealand**, under the *Copyright Act 1994*, authorship of a computer-generated work is typically assigned to the person who makes the arrangements for its creation. This assignment clause solidifies your ownership.
-   In **Australia**, where copyright law requires a human author, this assignment transfers to you any copyright that may be deemed to be owned by Inkwell AI.

We provide no warranty as to the validity or enforceability of copyright in AI-Generated Content. You are responsible for its lawful use. If future legislation alters ownership rights, these Terms will be interpreted to grant you the maximum rights permitted by such law.

### Moral Rights
To enable us to process, print, and deliver your works, you provide an **unconditional and irrevocable consent** allowing Inkwell AI and our partners to reproduce, adapt, or modify your content, even where such actions might otherwise infringe on your "moral rights" under Australian or New Zealand law, solely for the purposes of providing the Services.

For any questions about this Copyright Policy, please contact us at **support@inkwell.net.au**.
`
    },
    privacy: {
        title: 'Privacy Policy — Inkwell AI',
        id: 'privacy-policy-section',
        content: `
> ***In short: We collect the personal data needed to create your account, process your orders, and improve our service. We only share it with essential partners (like our printer and payment processor) and we never sell your data.***

**Effective Date: 2025-08-30**
**Last Updated: 2025-08-30**

### 1. Information We Collect
-   **Personal Data:** Name, email, shipping address, and payment details when you create an account or place an order.
-   **Technical Data:** IP address, browser type, usage logs, and cookies to improve our Service.

### 2. How We Use It
-   To deliver and improve our Services.
-   To process payments and ship orders.
-   To communicate with you about your account or purchases.
-   To comply with legal obligations.

### 3. Sharing Data
We share data with trusted partners (e.g., Stripe for payments, Lulu.com for printing) only as needed to provide the Services. We never sell your personal data.

### 4. Data Security
We use industry-standard encryption and safeguards to protect your information. However, no system is 100% secure.

### 5. Your Rights
You have the right to access, correct, or request deletion of your personal data by contacting us.

### 6. Data Retention
We retain your personal data only for as long as is necessary to provide you with our Services, comply with our legal obligations, resolve disputes, and enforce our agreements. Afterwards, it is securely deleted.

### 7. Use of Cookies
We use cookies to operate our Service, such as keeping you logged in and remembering preferences, and for analytics to understand how our Service is used.

### 8. International Data Transfers
Our service providers may be located overseas. As such, your personal information may be transferred to and processed in other countries. We take steps to ensure your data is protected.

### 9. Data Breach
If a data breach occurs that is likely to result in serious harm, we will notify you and the relevant authorities in line with our legal obligations.

### 10. Changes to This Policy
We may update this Privacy Policy. Continued use of the Service means you accept the changes.

For any questions about this Privacy Policy, please contact us at **support@inkwell.net.au**.
`
    },
    shipping: {
        title: 'Shipping Policy — Inkwell AI',
        id: 'shipping-policy-section',
        content: `
> ***In short: We print and ship via a third-party partner. Shipping times are estimates. Once your order is with the carrier, the risk of loss passes to you, as per consumer law.***

**Effective Date: 2025-08-30**
**Last Updated: 2025-08-30**

### 1. Order Processing
Orders are processed within 3-5 business days after payment confirmation. This does not include printing and delivery time.

### 2. Shipping & Fulfillment
Printing and delivery are handled by our third-party partner (Lulu.com). Shipping times and costs depend on your location and chosen method.

### 3. Delivery Times
Times are estimates and may be affected by customs, weather, or carrier delays. Tracking numbers are provided when available.

### 4. International Orders
Customers are responsible for any local customs duties, taxes, or import fees that may apply to their order.

### 5. Lost or Damaged Packages
If your order is lost or damaged in transit, email **support@inkwell.net.au** with your order number and photos of the damage. We will liaise with our partner to resolve the issue.

### 6. Risk of Loss
All physical products are made pursuant to a shipment contract. Once the package is with the shipping provider, the risk of loss and title for such items pass to you, the customer, except where required otherwise by the Australian Consumer Law (ACL) or Consumer Guarantees Act (CGA).

For any questions about this Shipping Policy, please contact us at **support@inkwell.net.au**.
`
    },
    refund: {
        title: 'Refund Policy — Inkwell AI',
        id: 'refund-policy-section',
        content: `
> ***In short: We do not refund digital products. Physical products can only be refunded or replaced if they are faulty, damaged, or significantly not as described. Claims must be made within 30 days of receiving your order.***

**Effective Date: 2025-08-30**
**Last Updated: 2025-08-30**

### 1. Digital Products
All sales of digital products are **final and non-refundable** once files have been generated or downloaded. Please use the review process thoroughly before purchase.

### 2. Physical Products
We comply with the ACL and CGA. Refunds or replacements apply only if items are:
-   **Faulty or damaged** upon arrival (e.g., printing errors, binding defects).
-   **Significantly different** from the description or the final preview you approved.

Refunds are **not available** for:
-   Change of mind.
-   Subjective dissatisfaction with AI-generated content that was present in the preview.
-   Typographical or grammatical errors you did not correct during the review process.

### 3. How to Request a Refund
-   Contact **support@inkwell.net.au** **within 30 days of receiving your order.**
-   Provide your order number and clear photos of the defect.
-   Approved refunds are returned to the original payment method within 5–10 business days.

For any questions about this Refund Policy, please contact us at **support@inkwell.net.au**.
`
    },
    return: {
        title: 'Return Policy — Inkwell AI',
        id: 'return-policy-section',
        content: `
> ***In short: As products are custom-made, we do not accept returns for change of mind. You can only request a replacement or refund for faulty or damaged items, as per our Refund Policy.***

**Effective Date: 2025-08-30**
**Last Updated: 2025-08-30**

### 1. General Policy
As our products are custom-made and printed on demand, we do not accept returns or exchanges for change of mind or other reasons not covered by consumer guarantees.

### 2. Faulty or Damaged Items
If your item arrives faulty or damaged, please see our Refund Policy for the steps to request a replacement or refund. All claims must be initiated within 30 days of receiving your product.

For any questions about this Return Policy, please contact us at **support@inkwell.net.au**.
`
    },
};

// This helper object maps a policy key to its corresponding icon
const policyIcons = {
    terms: DocumentTextIcon,
    copyright: ShieldCheckIcon,
    privacy: LockClosedIcon,
    shipping: TruckIcon,
    refund: ReceiptRefundIcon,
    return: ArrowPathIcon,
};

function PolicyPage() {
    const location = useLocation();

    useEffect(() => {
        if (location.hash) {
            const id = location.hash.substring(1);
            const element = document.getElementById(id);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [location.hash]);

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <PageHeader 
                    title="Our Policies"
                    subtitle="Terms of Service, Privacy, Shipping, and Refund Information."
                />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-slate-800/50 backdrop-blur-md p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-700"
                >
                    <h2 className="text-3xl font-bold text-white mb-6 text-center font-serif">Policy Sections</h2>
                    <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-12 border-b border-slate-700 pb-8 text-lg">
                        {Object.keys(policyContent).map((key) => (
                            <Link
                                key={key}
                                to={`/policies#${policyContent[key].id}`}
                                className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors duration-200"
                            >
                                {policyContent[key].title.split('—')[0].trim()}
                            </Link>
                        ))}
                    </nav>

                    {Object.keys(policyContent).map((key) => {
                        // FIX: Get the correct icon for the current policy section
                        const Icon = policyIcons[key];
                        return (
                            <div key={key} id={policyContent[key].id} className="mb-16 last:mb-0">
                                <h1 className="flex items-center text-4xl font-bold font-serif text-white mb-6 border-b border-slate-700 pb-4">
                                    {/* FIX: Render the icon next to the title */}
                                    {Icon && <Icon className="w-8 h-8 mr-4 text-amber-400 flex-shrink-0" />}
                                    {policyContent[key].title}
                                </h1>
                                {/* FIX: Tailwind's 'prose' plugin will style the blockquotes from our Markdown */}
                                <div className="prose prose-lg max-w-none text-slate-300 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-headings:text-amber-400 prose-a:text-indigo-400 prose-a:hover:text-indigo-300 prose-p:leading-relaxed prose-blockquote:text-sky-300 prose-blockquote:border-sky-400">
                                    <ReactMarkdown>{policyContent[key].content}</ReactMarkdown>
                                </div>
                            </div>
                        );
                    })}

                    <div className="mt-12 border-t border-slate-700 pt-8 text-center">
                        <Link to="/" className="text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
                            &larr; Back to Home
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default PolicyPage;