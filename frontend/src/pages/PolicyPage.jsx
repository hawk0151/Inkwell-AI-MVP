import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';

const policyContent = {
    terms: {
        title: 'Terms of Service — Inkwell AI',
        id: 'terms-of-service-section',
        content: (
            <>
                <p><strong>Effective Date: 2025-08-05</strong></p>
                <p><strong>Last Updated: 2025-08-05</strong></p>
                <h2>1. Introduction & Acceptance</h2>
                <p>Welcome to Inkwell AI (“we,” “our,” “us”). These Terms of Service (“Terms”) govern your access to and use of our services, including our website, applications, digital product generation, and any associated physical fulfillment (collectively, the “Services”).</p>
                <p>By using our Services, you agree to be bound by these Terms, as well as our <Link to="/policies#privacy-policy-section">Privacy Policy</Link>, <Link to="/policies#refund-policy-section">Refund Policy</Link>, <Link to="/policies#return-policy-section">Return Policy</Link>, and <Link to="/policies#shipping-policy-section">Shipping Policy</Link>, which form part of these Terms. If you do not agree, you must cease use immediately.</p>
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
                    <li>You have had the <strong>full and complete opportunity to review all aspects</strong> of your generated book and order — including but not limited to, the entire text content, available visual previews, product specifications, page layouts, formatting, spelling, grammar, and final pricing — before making payment.</li>
                    <li>You are <strong>solely responsible</strong> for thoroughly reviewing and ensuring all details (including content accuracy and aesthetic preferences) are correct and satisfactory before finalizing your purchase.</li>
                    <li>Once an order is confirmed, production or delivery will proceed as per our <Link to="/policies#refund-policy-section">Refund Policy</Link> and <Link to="/policies#return-policy-section">Return Policy</Link>.</li>
                    <li>Inkwell AI is not responsible for errors, omissions, or undesired subjective outputs (e.g., specific phrasing, plot elements, or visual interpretations by the AI that deviate from your personal ideal) resulting from your failure to adequately review and confirm your order prior to payment. <strong>By completing your purchase, you explicitly acknowledge and accept the product as previewed.</strong></li>
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
        id: 'privacy-policy-section',
        content: (
            <>
                <p><strong>Effective Date: 2025-08-05</strong></p>
                <p><strong>Last Updated: 2025-08-05</strong></p>
                <h2>1. Information We Collect</h2>
                <p>We collect personal information you provide when you create an account, make a purchase, or interact with our Services. This may include your name, email address, and payment information.</p>
                <p>We also collect non-personal data, such as your IP address, browser type, and usage data to improve our Services.</p>
                <h2>2. How We Use Your Information</h2>
                <p>We use your information to:</p>
                <ul>
                    <li>Provide and maintain our Services.</li>
                    <li>Process transactions and fulfill orders.</li>
                    <li>Communicate with you about your account and orders.</li>
                    <li>Improve our website and user experience.</li>
                    <li>Comply with legal obligations.</li>
                </ul>
                <h2>3. Sharing Your Information</h2>
                <p>We may share your information with third-party service providers (e.g., Stripe for payments, Lulu.com for printing and shipping) as necessary to provide our Services. We do not sell your personal information to third parties.</p>
                <h2>4. Data Security</h2>
                <p>We use industry-standard security measures to protect your information, but no method of transmission over the internet or electronic storage is 100% secure.</p>
                <h2>5. Your Rights</h2>
                <p>You have the right to access, correct, or delete your personal information. You can do this by managing your account settings or contacting us directly.</p>
                <h2>6. Changes to This Policy</h2>
                <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>
            </>
        ),
    },
    shipping: {
        title: 'Shipping Policy — Inkwell AI',
        id: 'shipping-policy-section',
        content: (
            <>
                <p><strong>Effective Date: 2025-08-05</strong></p>
                <p><strong>Last Updated: 2025-08-05</strong></p>
                <h2>1. Order Processing</h2>
                <p>Orders are typically processed within 3-5 business days after payment is confirmed. This does not include the time it takes for printing and delivery.</p>
                <h2>2. Shipping & Fulfillment</h2>
                <p>We use third-party print-on-demand services (Lulu.com) for printing and shipping. As such, shipping times and costs are determined by the fulfillment partner and may vary based on your location and the selected shipping method.</p>
                <h2>3. Delivery Times</h2>
                <p>Delivery times are estimates and may be subject to delays beyond our control (e.g., customs, weather, postal service issues). Once your order is shipped, you will receive a tracking number from the fulfillment partner.</p>
                <h2>4. Shipping Costs</h2>
                <p>Shipping costs are calculated at checkout based on your delivery address and the selected shipping option. We may include a small margin to cover administrative costs.</p>
                <h2>5. International Shipping</h2>
                <p>We offer international shipping through our fulfillment partner. Please be aware that you may be responsible for any customs fees, taxes, or duties imposed by your country.</p>
                <h2>6. Lost or Damaged Packages</h2>
                <p>If your package is lost or arrives damaged, please contact us at **[support@inkwell.net.au]** with your order number and a description of the issue. We will work with our fulfillment partner to find a solution.</p>
            </>
        ),
    },
    refund: {
        title: 'Refund Policy — Inkwell AI',
        id: 'refund-policy-section',
        content: (
            <>
                <p><strong>Effective Date: 2025-08-05</strong></p>
                <p><strong>Last Updated: 2025-08-05</strong></p>
                <h2>1. Digital Products</h2>
                <p>Due to the nature of digital products, all sales of AI-generated digital content are **final and non-refundable** once the file has been generated and/or downloaded. Please review all content thoroughly before finalizing your purchase, as outlined in our <Link to="/policies#terms-of-service-section">Terms of Service</Link>.</p>
                <h2>2. Physical Products</h2>
                <p>For physical products, we comply with the Australian Consumer Law (ACL) and the New Zealand Consumer Guarantees Act 1993 (CGA). We offer refunds or replacements for products that are:</p>
                <ul>
                    <li>**Significantly different** from the description.</li>
                    <li>**Faulty or damaged** upon arrival (e.g., printing errors, manufacturing defects).</li>
                </ul>
                <p>We **do not offer refunds** for physical products for:</p>
                <ul>
                    <li>Changes of mind.</li>
                    <li>Subjective dissatisfaction with the AI-generated content (e.g., you don't like the story or images after a thorough preview).</li>
                    <li>Typographical or grammatical errors you failed to correct during the review process.</li>
                </ul>
                <h2>3. How to Request a Refund</h2>
                <p>To request a refund for a faulty or damaged physical product, you must:</p>
                <ul>
                    <li>Contact us at **[support@inkwell.net.au]** within 30 days of receiving your order.</li>
                    <li>Provide your order number and clear photos of the defect.</li>
                </ul>
                <p>We will then assess your claim and work with our fulfillment partner to provide a replacement or a refund if the claim is valid.</p>
            </>
        ),
    },
    return: {
        title: 'Return Policy — Inkwell AI',
        id: 'return-policy-section',
        content: (
            <>
                <p><strong>Effective Date: 2025-08-05</strong></p>
                <p><strong>Last Updated: 2025-08-05</strong></p>
                <h2>1. General Policy</h2>
                <p>Since our physical products are custom-made (print-on-demand), we do not accept returns or exchanges for reasons other than a product being faulty or damaged. This policy is in line with our responsibilities under the Australian Consumer Law (ACL) and the New Zealand Consumer Guarantees Act 1993 (CGA).</p>
                <h2>2. Faulty or Damaged Items</h2>
                <p>If you receive a faulty or damaged product, please refer to our <Link to="/policies#refund-policy-section">Refund Policy</Link> for instructions on how to proceed.</p>
            </>
        ),
    },
};

function PolicyPage() {
    const location = useLocation();

    useEffect(() => {
        if (location.hash) {
            const id = location.hash.substring(1);
            const element = document.getElementById(id);
            if (element) {
                // Use a timeout to ensure the page has rendered before scrolling
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

                    {Object.keys(policyContent).map((key) => (
                        <div key={key} id={policyContent[key].id} className="mb-16 last:mb-0">
                            <h1 className="text-4xl font-bold font-serif text-white mb-6 border-b border-slate-700 pb-4">
                                {policyContent[key].title}
                            </h1>
                            <div className="prose prose-lg max-w-none text-slate-300 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-headings:text-amber-400 prose-a:text-indigo-400 prose-a:hover:text-indigo-300 prose-p:leading-relaxed">
                                {policyContent[key].content}
                            </div>
                        </div>
                    ))}

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