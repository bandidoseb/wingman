import Link from "next/link";

export default function TermsPage() {
  // TODO: Replace "Sebastian Perez d/b/a Wingman" with your LLC name once formed
  const COMPANY = "Wingman";
  const OPERATOR = "Sebastian Perez d/b/a Wingman";
  const EMAIL = "support@getwingman.ai";
  const STATE = "Minnesota";
  const EFFECTIVE_DATE = "March 9, 2026";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f2f2f7",
        fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/signup"
          style={{ fontSize: 14, color: "#007aff", textDecoration: "none", display: "inline-block", marginBottom: 32 }}
        >
          ← Back
        </Link>

        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em", marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 14, color: "#8e8e93", marginBottom: 40 }}>
          Effective date: {EFFECTIVE_DATE}
        </p>

        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: "40px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
            fontSize: 15,
            color: "#3a3a3c",
            lineHeight: 1.8,
          }}
        >
          <p style={{ marginBottom: 24 }}>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of {COMPANY} (the &quot;Service&quot;), operated by {OPERATOR} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>1. The Service</h2>
          <p style={{ marginBottom: 16 }}>
            {COMPANY} is an AI-powered sales coaching platform designed to help sales professionals — including closers and setters — track calls, manage objection responses, and improve performance over time. The Service is intended for business use by adults 18 years of age or older.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>2. Accounts</h2>
          <p style={{ marginBottom: 16 }}>
            You must create an account to use the Service. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You agree to notify us immediately at {EMAIL} if you suspect unauthorized access to your account. We reserve the right to suspend or terminate accounts that violate these Terms.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>3. Subscriptions & Billing</h2>
          <p style={{ marginBottom: 16 }}>
            {COMPANY} is offered on a subscription basis. By subscribing, you authorize us to charge your payment method on a recurring basis at the rate associated with your selected plan. All payments are processed securely through Stripe. Prices are in US dollars and are subject to change with reasonable notice.
          </p>
          <p style={{ marginBottom: 16 }}>
            You may cancel your subscription at any time through the billing portal in your account settings. Cancellation takes effect at the end of the current billing period — you will retain access to the Service until then. We do not offer refunds for partial billing periods except where required by law.
          </p>
          <p style={{ marginBottom: 16 }}>
            If your payment fails, we may suspend access to your account until payment is resolved. We will attempt to notify you by email before or upon suspension.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>4. Acceptable Use</h2>
          <p style={{ marginBottom: 12 }}>You agree not to:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            {[
              "Use the Service for any unlawful purpose or in violation of any applicable laws or regulations",
              "Attempt to gain unauthorized access to any part of the Service or its related systems",
              "Reproduce, duplicate, copy, sell, or resell any part of the Service without our express written permission",
              "Upload or transmit malicious code, viruses, or any software that could harm the Service or other users",
              "Use the Service to store or transmit content that is defamatory, obscene, or infringes on third-party rights",
              "Circumvent, disable, or interfere with any security features of the Service",
            ].map((item, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{item}</li>
            ))}
          </ul>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>5. Your Content</h2>
          <p style={{ marginBottom: 16 }}>
            You retain ownership of all call notes, objection responses, and other content you input into the Service (&quot;Your Content&quot;). By using the Service, you grant us a limited, non-exclusive license to store and process Your Content solely to provide the Service to you. We do not use Your Content to train AI models or share it with third parties, except as described in our Privacy Policy.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>6. AI-Generated Content</h2>
          <p style={{ marginBottom: 16 }}>
            The Service uses AI to generate coaching suggestions, call summaries, and objection responses. These outputs are provided for informational and coaching purposes only. We do not guarantee the accuracy, completeness, or fitness of any AI-generated content for any particular purpose. You are solely responsible for how you apply any suggestions generated by the Service.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>7. Intellectual Property</h2>
          <p style={{ marginBottom: 16 }}>
            The Service, including its design, software, branding, and content created by us, is owned by {OPERATOR} and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works based on any part of the Service without our express written consent.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>8. Disclaimer of Warranties</h2>
          <p style={{ marginBottom: 16 }}>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>9. Limitation of Liability</h2>
          <p style={{ marginBottom: 16 }}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {OPERATOR.toUpperCase()} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>10. Termination</h2>
          <p style={{ marginBottom: 16 }}>
            We reserve the right to suspend or terminate your account and access to the Service at our sole discretion, with or without notice, for conduct that we determine violates these Terms or is harmful to other users, us, or third parties. Upon termination, your right to use the Service will immediately cease. Provisions of these Terms that by their nature should survive termination will survive.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>11. Indemnification</h2>
          <p style={{ marginBottom: 16 }}>
            You agree to indemnify, defend, and hold harmless {OPERATOR}, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses — including reasonable legal fees — arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your infringement of any third-party rights.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>12. Governing Law & Disputes</h2>
          <p style={{ marginBottom: 16 }}>
            These Terms shall be governed by and construed in accordance with the laws of the State of {STATE}, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in {STATE}, and you consent to the personal jurisdiction of such courts.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>13. Changes to These Terms</h2>
          <p style={{ marginBottom: 16 }}>
            We may update these Terms from time to time. When we do, we will revise the effective date at the top of this page and, where appropriate, notify you by email. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>14. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a href={`mailto:${EMAIL}`} style={{ color: "#007aff" }}>{EMAIL}</a>.
          </p>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, marginBottom: 48, fontSize: 13, color: "#aeaeb2" }}>
          <Link href="/privacy" style={{ color: "#007aff", textDecoration: "none" }}>Privacy Policy</Link>
          {" · "}
          <Link href="/signup" style={{ color: "#007aff", textDecoration: "none" }}>Back to Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
