// frontend/src/pages/PolicyPage.jsx
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import useLocation for hash scrolling

const policyContent = {
    terms: { // NEW POLICY TYPE: Terms of Service
        title: 'Terms of Service — Inkwell AI',
        id: 'terms-of-service-section', // Unique ID for section
        content: (
            <>
                <p><strong>Effective Date: 2025-08-04</strong></p>
                <p><strong>Last Updated: 2025-08-04</strong></p>

                <h2>1. Introduction & Acceptance</h2>
                <p>Welcome to Inkwell AI (“we,” “our,” “us”). These Terms of Service (“Terms”) govern your access to and use of our services, including our website, applications, digital product generation, and any associated physical fulfillment (collectively, the “Services”).</p>
                <p>By using our Services, you agree to be bound by these Terms, as well as our <Link to="/policies#privacy-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Privacy Policy</Link>, <Link to="/policies#refund-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Refund Policy</Link>, <Link to="/policies#return-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Return Policy</Link>, and <Link to="/policies#shipping-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Shipping Policy</Link>, which form part of these Terms. If you do not agree, you must cease use immediately.</p>
                <p>These Terms comply with and are subject to the Australian Consumer Law (ACL) and the New Zealand Consumer Guarantees Act 1993 (CGA).</p>

                <h2>2. Definitions</h2>
                <ul>
                    <li><strong>Digital Product</strong> — Any AI-generated or downloadable file created through our platform.</li>
                    <li><strong>Physical Product</strong> — Any printed, bound, or otherwise manufactured product fulfilled via third-party printing/shipping providers.</li>
                    <li><strong>User</strong> — Any individual or entity accessing or using our Services.</li>
                    <li><strong>Order</strong> — A confirmed purchase made via our platform.</li>
                </ul>

                <h2>3. User Eligibility</h2>
                <p>To use the Services, you must:</p>
                <ul>
                    <li>Be 18 years or older or have the consent of a legal guardian.</li>
                    <li>Have the legal capacity to enter into a binding agreement.</li>
                    <li>Use the Services in compliance with all applicable laws.</li>
                </ul>

                <h2>4. Services Provided</h2>
                <p>Inkwell AI offers:</p>
                <ul>
                    <li>AI-powered content and book generation.</li>
                    <li>Optional printing and delivery of generated works.</li>
                    <li>Access to online previews and file downloads.</li>
                </ul>
                <p>We may alter or discontinue Services at any time, provided consumer rights under ACL/CGA are preserved.</p>

                <h2>5. Account Responsibilities</h2>
                <ul>
                    <li>You are responsible for keeping your account credentials secure.</li>
                    <li>You must ensure that the information provided is accurate and up to date.</li>
                    <li>You must not misuse or interfere with the Services.</li>
                </ul>

                <h2>6. Payment & Pricing</h2>
                <p>All prices are listed in AUD or NZD unless stated otherwise.</p>
                <p>Payments are processed securely via Stripe or other approved providers.</p>
                <p>We reserve the right to adjust pricing at any time, but not for orders already confirmed.</p>

                <h2>7. Review Before Purchase (Crucial Clause)</h2>
                <p>Before placing an order for any Digital or Physical Product, you acknowledge and agree that:</p>
                <ul>
                    <li>You have had the **full and complete opportunity to review all aspects** of your generated book and order — including but not limited to, the entire text content, available visual previews, product specifications, page layouts, formatting, spelling, grammar, and final pricing — before making payment.</li>
                    <li>You are **solely responsible** for thoroughly reviewing and ensuring all details (including content accuracy and aesthetic preferences) are correct and satisfactory before finalizing your purchase.</li>
                    <li>Once an order is confirmed, production or delivery will proceed as per our <Link to="/policies#refund-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Refund Policy</Link> and <Link to="/policies#return-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Return Policy</Link>.</li>
                    <li>Inkwell AI is not responsible for errors, omissions, or undesired subjective outputs (e.g., specific phrasing, plot elements, or visual interpretations by the AI that deviate from your personal ideal) resulting from your failure to adequately review and confirm your order prior to payment. **By completing your purchase, you explicitly acknowledge and accept the product as previewed.**</li>
                </ul>

                <h2>8. Intellectual Property</h2>
                <p>All source code, branding, and proprietary software remain the property of Inkwell AI.</p>
                <p>You retain ownership of original content you upload.</p>
                <p>AI-generated works may be used by you for personal or commercial purposes unless otherwise restricted.</p>

                <h2>9. User Content & Conduct</h2>
                <p>You warrant that any content you upload or input into our Services:</p>
                <ul>
                    <li>Does not infringe copyright, trademark, or other intellectual property rights of any third party.</li>
                    <li>Is not unlawful, defamatory, obscene, harmful, or otherwise prohibited under applicable law.</li>
                    <li>Complies with all content guidelines and policies published by Inkwell AI.</li>
                </ul>

                <h2>10. Disclaimers & Liability</h2>
                <p>Services are provided “as is,” with guarantees only to the extent required by law, including the Australian Consumer Law (ACL) and the New Zealand Consumer Guarantees Act 1993 (CGA).</p>
                <p>To the maximum extent permitted by law, our liability is limited to:</p>
                <ul>
                    <li>In the case of goods — replacement, repair, or refund of the purchase price.</li>
                    <li>In the case of services — resupply of the service or refund for the service fee.</li>
                </ul>
                <p>We are not liable for indirect or consequential losses.</p>

                <h2>11. Governing Law & Dispute Resolution</h2>
                <p>These Terms are governed by the laws of Queensland, Australia, and the laws of New Zealand where applicable. Disputes will first be resolved by good-faith negotiation, then mediation, before any court proceedings.</p>

                <h2>12. Changes to Terms</h2>
                <p>We may update these Terms at any time. Continued use of our Services constitutes acceptance of updated Terms. We will notify you of significant changes.</p>
            </>
        ),
    },
    privacy: {
        title: 'Privacy Policy — Inkwell AI',
        id: 'privacy-policy-section', // Unique ID
        content: (
            <>
                <p><strong>Compliance: Australian Privacy Act 1988 (Cth) &amp; NZ Privacy Act 2020</strong></p>

                <h2>1. Information We Collect</h2>
                <ul>
                    <li><strong>Account Data:</strong> Name, email address, and billing details provided during registration or purchase.</li>
                    <li><strong>Order Data:</strong> Details of your orders, including order history, file uploads (content generated for your books), and shipping addresses.</li>
                    <li><strong>Payment Data:</strong> Payment card information is handled directly by our secure payment processor, Stripe. We do not store your full credit card numbers on our servers.</li>
                    <li><strong>Technical Data:</strong> Includes your IP address, device type, browser information, and usage logs (pages visited, features used) to ensure service functionality and improve user experience.</li>
                    <li><strong>Cookies &amp; Tracking:</strong> We use cookies and similar technologies for session management, remembering your preferences, and for analytics purposes to understand how our Services are used.</li>
                </ul>

                <h2>2. How We Use Information</h2>
                <p>We use the collected information for the following purposes:</p>
                <ul>
                    <li>To deliver, maintain, improve, and secure our Services.</li>
                    <li>To process your transactions and fulfill your orders, including generating and printing your custom books.</li>
                    <li>To notify you about changes to our Services or policies.</li>
                    <li>To provide customer support and respond to your inquiries.</li>
                    <li>For fraud prevention, security, and compliance with legal and regulatory obligations.</li>
                    <li>To gather analysis or valuable information so that we can improve our Services.</li>
                </ul>

                <h2>3. Data Sharing</h2>
                <p>We may share your information with:</p>
                <ul>
                    <li><strong>Stripe:</strong> Our payment processor, to facilitate secure payment transactions.</li>
                    <li><strong>Cloudinary:</strong> For secure storage and hosting of your generated book files (PDFs and images).</li>
                    <li><strong>Third-party printing/shipping providers:</strong> To produce and deliver your physical book orders. This includes necessary shipping address and order details.</li>
                    <li><strong>Service Providers:</strong> Other third-party vendors who perform services on our behalf (e.g., analytics, email sending), under strict confidentiality agreements.</li>
                    <li><strong>Legal &amp; Compliance:</strong> As required by law, subpoena, or if we believe such action is necessary to comply with a legal obligation, protect our rights or property, prevent fraud or misconduct, or ensure the safety of our Users.</li>
                </ul>

                <h2>4. Your Rights (Australia & New Zealand)</h2>
                <p>In accordance with the Australian Privacy Act 1988 (Cth) and the New Zealand Privacy Act 2020, you have rights regarding your personal data:</p>
                <ul>
                    <li><strong>Access:</strong> You may request access to the personal information we hold about you.</li>
                    <li><strong>Correction:</strong> You may request corrections to any inaccurate or incomplete personal information.</li>
                    <li><strong>Deletion:</strong> You may request the deletion of your personal data, subject to legal and contractual obligations.</li>
                </ul>
                <p>To exercise these rights, please contact us using the details provided below.</p>

                <h2>5. Security</h2>
                <p>We implement robust security measures to protect your personal data from unauthorized access, alteration, disclosure, or destruction. These measures include encryption, secure servers, access controls, and regular security audits. However, no method of transmission over the Internet or electronic storage is 100% secure.</p>

                <h2>6. International Data Transfers</h2>
                <p>Where your data may be transferred to and processed in countries outside of Australia or New Zealand (e.g., for data hosting or third-party service providers), we ensure that appropriate safeguards are in place to protect your privacy rights in accordance with applicable laws.</p>

                <h2>7. Contact for Privacy</h2>
                <p>For any questions or concerns regarding this Privacy Policy or your personal data, please contact us at: 📧 <a href="mailto:contact@inkwellai.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">contact@inkwellai.com</a></p> {/* Replaced placeholder */}
            </>
        ),
    },
    shipping: {
        title: 'Shipping Policy — Inkwell AI',
        id: 'shipping-policy-section', // Unique ID
        content: (
            <>
                <h2>1. Processing Time</h2>
                {/* CRITICAL FIX: Wrapped list items in a proper <ul> tag */}
                <ul>
                    <li><strong>Digital Products (e.g., AI-generated digital book files):</strong> Orders are typically processed instantly or within 24 hours. You will receive a download link via email or through your account dashboard.</li>
                    <li><strong>Physical Products (e.g., printed books):</strong> Each physical book is a custom, print-on-demand product. Please allow <strong>2–7 business days for production and quality control</strong> before your order is dispatched from our printing partner.</li>
                </ul>

                <h2>2. Carriers & Tracking</h2>
                <p>We partner with reputable shipping carriers to deliver your orders. Once your physical book order has been dispatched, you will receive a shipping confirmation email containing your tracking number and a link to track your parcel. Our primary carriers include **Australia Post, FedEx, DHL, USPS, Royal Mail**.</p> {/* Replaced placeholder */}

                <h2>3. International Orders</h2>
                <p>We proudly ship to select international destinations. Please be aware that for international orders, customers are solely responsible for any applicable customs fees, import duties, taxes, or brokerage charges that may be imposed by their country's customs authorities upon delivery. These charges are outside of our control and are not included in the item price or shipping cost.</p>

                <h2>4. Lost/Damaged Parcels</h2>
                <p>In the unfortunate event that your parcel is lost in transit or arrives damaged, please contact us immediately. Claims for lost or damaged parcels must be lodged with Inkwell AI within <strong>14 days of the estimated delivery date or actual delivery (for damaged items)</strong>. We will assist you in resolving the issue with the shipping carrier or arranging a replacement in accordance with our <Link to="/policies#refund-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Refund Policy</Link> and <Link to="/policies#return-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Return Policy</Link>.</p>
            </>
        ),
    },
    refund: {
        title: 'Refund Policy — Inkwell AI',
        id: 'refund-policy-section', // Unique ID
        content: (
            <>
                <h2>1. Digital Products</h2>
                <p><strong>All sales of Digital Products are final.</strong> Given the instant and previewable nature of digital content, we do not offer refunds or exchanges for Digital Products once they have been delivered or accessed, except in cases of:</p>
                <ul>
                    <li>A proven technical fault preventing access or download of the file.</li>
                    <li>Non-delivery of the digital product due to our error.</li>
                </ul>
                <p>The "Review Before Purchase" clause in our <Link to="/policies#terms-of-service-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Terms of Service</Link> applies in full to all digital purchases. By completing your purchase, you acknowledge that you have reviewed the Digital Product's content and specifications via the provided preview prior to payment.</p>

                <h2>2. Physical Products</h2>
                <p>Refunds for Physical Products are granted strictly if the item is:</p>
                <ul>
                    <li><strong>Damaged:</strong> Arrived with damage sustained during shipping.</li>
                    <li><strong>Defective:</strong> Has a manufacturing defect (e.g., printing errors, missing pages, binding issues).</li>
                    <li><strong>Incorrect:</strong> The wrong product was sent to you due to our error.</li>
                </ul>
                <p>These conditions are in line with your consumer rights under the Australian Consumer Law (ACL) and the New Zealand Consumer Guarantees Act 1993 (CGA).</p>

                <h2>3. Process for Physical Product Refunds/Replacements</h2>
                <p>To request a refund or replacement for a damaged, defective, or incorrect physical product:</p>
                <ol>
                    <li>Email our support team at [support email] within <strong>14 days of delivery</strong>.</li>
                    <li>Include your order number, a detailed description of the issue, and clear photographic evidence of the damage or defect.</li>
                    <li>Our team will assess your claim and may provide further instructions, including a return shipping label if a physical return is required. Do not send products back without prior authorization.</li>
                </ol>
                <p>We aim to process valid refund requests within 7 business days of approval. Refunds will be issued to the original payment method. Replacements will be processed as new orders and shipped as quickly as possible.</p>
                <p>For clarity, dissatisfaction with the *content* of a physical book (e.g., phrasing, plot points, AI-generated images) is not grounds for a refund once the purchase has been made and the product was delivered as previewed, as per our "Review Before Purchase" clause in the <Link to="/policies#terms-of-service-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Terms of Service</Link>.</p>
            </>
        ),
    },
    return: {
        title: 'Return Policy — Inkwell AI',
        id: 'return-policy-section', // Unique ID
        content: (
            <>
                <h2>1. Eligibility for Returns</h2>
                <p>Returns are only accepted for physical goods that are:</p>
                <ul>
                    <li><strong>Defective:</strong> Possessing a manufacturing flaw (e.g., printing errors, faulty binding).</li>
                    <li><strong>Incorrect:</strong> The product received is not what was ordered (e.g., wrong title, format due to our error).</li>
                    <li><strong>Damaged:</strong> Incurred damage during shipping.</li>
                </ul>
                <p>This policy is in accordance with consumer guarantees under the Australian Consumer Law (ACL) and the New Zealand Consumer Guarantees Act 1993 (CGA).</p>
                <p><strong>Digital products cannot be "returned"</strong> once delivered. Please refer to our <Link to="/policies#refund-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Refund Policy</Link> for details regarding digital product issues.</p>

                <h2>2. Timeframe for Returns</h2>
                <p>All return requests must be initiated within <strong>14 days of the delivery date</strong> of your physical product. Requests made outside this timeframe may not be accepted.</p>

                <h2>3. How to Initiate a Return</h2>
                <p>To initiate a return for an eligible item, please follow these steps:</p>
                <ol>
                    <li>Email our support team at [Your Support Email] with the subject line "Return Request - [Your Order Number]".</li>
                    <li>In your email, include:
                        <ul>
                            <li>Your full name and order number.</li>
                            <li>A detailed description of the defect, damage, or incorrect item.</li>
                            <li>Clear photographs or a short video (if helpful) showing the issue.</li>
                        </ul>
                    </li>
                    <li>Our team will review your request and may provide further instructions, including a return shipping label if a physical return is required. Do not send products back without prior authorization.</li>
                </ol>

                <h2>4. Processing Returns</h2>
                <p>Once your return is approved and, if applicable, the item is received and inspected, we will notify you of the status. Approved returns will result in either:</p>
                <ul>
                    <li>A full refund issued to your original payment method (as per our <Link to="/policies#refund-policy-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Refund Policy</Link>), or</li>
                    <li>A replacement product shipped to you at no additional cost.</li>
                </ul>
                <p>We aim to process returns and issue refunds/replacements within 7 business days of approval or receipt of the returned item.</p>

                <h2>5. Content Dissatisfaction</h2>
                <p>As per our "Review Before Purchase" clause in the <Link to="/policies#terms-of-service-section" className="text-indigo-400 hover:text-indigo-300 transition-colors">Terms of Service</Link>, returns are not accepted based on subjective dissatisfaction with the AI-generated content (e.g., specific phrasing, plot elements, or image interpretations) once the purchase has been made and the product was delivered as previewed.</p>
            </>
        ),
    },
};

function PolicyPage() { // Removed default prop 'type = privacy' as it's now dynamically set by route
    const location = useLocation(); // Hook to get current URL and hash
    const initialPolicyType = location.hash ? location.hash.substring(1).replace('-section', '') : 'terms'; // Default to 'terms' or 'privacy' if no hash. Changed default to terms.

    // Derive the policy type from the URL hash, or fallback to 'terms'
    const policyType = Object.keys(policyContent).includes(initialPolicyType) ? initialPolicyType : 'terms';

    const data = policyContent[policyType];

    // Scroll to section on mount or hash change
    useEffect(() => {
        if (location.hash) {
            const id = location.hash.substring(1); // Remove '#'
            const element = document.getElementById(id);
            if (element) {
                // Use smooth scroll behavior
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else {
            // If no hash, scroll to top on initial load
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [location.hash, policyType]); // Rerun effect when hash or policyType changes

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

    const { title, content, id } = data; // Destructure ID as well

    return (
        <div className="fade-in max-w-4xl mx-auto bg-slate-800/50 p-8 md:p-12 rounded-2xl shadow-xl border border-slate-700">
            {/* Table of Contents / In-page navigation */}
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Policies</h2>
            <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-10 text-lg">
                {Object.keys(policyContent).map((key) => (
                    <Link
                        key={key}
                        to={`/policies#${policyContent[key].id}`}
                        className="px-3 py-1 rounded-md text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        {policyContent[key].title.split('—')[0].trim()}
                    </Link>
                ))}
            </nav>

            {/* Render all policy content sequentially */}
            {Object.keys(policyContent).map((key) => (
                <div key={key} id={policyContent[key].id} className="mb-12 last:mb-0"> {/* Use unique ID here */}
                    <h1 className="text-4xl font-bold font-serif text-white mb-6">
                        {policyContent[key].title}
                    </h1>
                    {/* CRITICAL FIX: Ensure ALL text is white within prose */}
                    <div className="prose prose-lg max-w-none text-slate-300 prose-p:text-white prose-li:text-white prose-strong:text-white prose-headings:text-amber-500 prose-a:text-indigo-400 prose-a:hover:text-indigo-300 prose-p:leading-relaxed">
                        {policyContent[key].content}
                    </div>
                </div>
            ))}

            <div className="mt-8 border-t border-slate-700 pt-6 text-center">
                <Link to="/" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                    &larr; Back to Home
                </Link>
            </div>
        </div>
    );
}

export default PolicyPage;