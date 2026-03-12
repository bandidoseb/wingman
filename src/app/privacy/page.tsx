import Link from "next/link";

export default function PrivacyPage() {
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
          Privacy Policy
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
            This Privacy Policy explains how {COMPANY}, operated by {OPERATOR} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), collects, uses, and protects your personal information when you use our Service. By using {COMPANY}, you agree to the practices described in this policy.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>1. Information We Collect</h2>
          <p style={{ marginBottom: 12 }}>We collect the following types of information:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            {[
              "Account information: your email address, password (stored as a secure hash), and phone number when you sign up",
              "Profile data: your sales role, style preferences, call length, and offer details that you provide during onboarding",
              "Call data: prospect names, call outcomes, stage notes, and any transcripts or summaries you log in the Service",
              "Vault content: objection responses and sales signals you create or customize",
              "Billing information: your payment method details are collected and stored by Stripe — we never see or store your full card number",
              "Usage data: how you interact with the Service, including which features you use and when",
            ].map((item, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{item}</li>
            ))}
          </ul>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>2. How We Use Your Information</h2>
          <p style={{ marginBottom: 12 }}>We use the information we collect to:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            {[
              "Provide, operate, and improve the Service",
              "Personalize your experience based on your role and preferences",
              "Process subscription payments and manage your billing",
              "Send transactional emails such as account confirmations, password resets, and billing receipts",
              "Send optional performance summaries and coaching insights if you have opted in to those notifications",
              "Respond to your support requests and communications",
              "Detect, prevent, and address technical issues or misuse",
            ].map((item, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{item}</li>
            ))}
          </ul>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>3. AI Processing</h2>
          <p style={{ marginBottom: 16 }}>
            When you use AI-powered features such as call debriefs or coaching suggestions, your call data is sent to Anthropic&apos;s API for processing. This data is transmitted securely and is subject to Anthropic&apos;s usage policies. We do not use your personal data to train AI models, and we do not sell your data to any AI provider for training purposes.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>4. SMS Communications</h2>
          <p style={{ marginBottom: 16 }}>
            As part of the account verification process, we send a one-time SMS passcode to the phone number you provide. By entering your phone number and proceeding, you consent to receive this single transactional SMS. We do not send marketing texts. Message and data rates may apply. You can opt out of future transactional SMS by contacting us at <a href={`mailto:${EMAIL}`} style={{ color: "#007aff" }}>{EMAIL}</a>. For STOP/HELP instructions, reply STOP to opt out or HELP for assistance. Message frequency: one message per verification request.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>5. How We Share Your Information</h2>
          <p style={{ marginBottom: 12 }}>
            We do not sell your personal information. We may share your information only with the following trusted third-party service providers, and only as necessary to operate the Service:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            {[
              "Supabase — database hosting and authentication (your data is stored on Supabase's secure servers)",
              "Stripe — payment processing (Stripe handles all card data under PCI-DSS compliance)",
              "Anthropic — AI processing for coaching features (call-related data only, when you use AI features)",
            ].map((item, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginBottom: 16 }}>
            We may also disclose your information if required to do so by law, or if we believe such action is necessary to comply with legal obligations or protect the rights, property, or safety of us or others.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>6. Data Storage & Security</h2>
          <p style={{ marginBottom: 16 }}>
            Your data is stored in Supabase&apos;s managed Postgres database, protected by row-level security policies that ensure each user can only access their own data. We use HTTPS for all data in transit. While we take reasonable measures to protect your information, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>7. Data Retention</h2>
          <p style={{ marginBottom: 16 }}>
            We retain your personal data for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal or regulatory reasons (such as billing records).
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>8. Your Rights</h2>
          <p style={{ marginBottom: 12 }}>You have the right to:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            {[
              "Access the personal data we hold about you",
              "Correct inaccurate or incomplete data",
              "Request deletion of your account and associated personal data",
              "Opt out of non-essential communications at any time via your account settings",
              "Receive a copy of your data in a portable format upon request",
            ].map((item, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginBottom: 16 }}>
            To exercise any of these rights, please contact us at{" "}
            <a href={`mailto:${EMAIL}`} style={{ color: "#007aff" }}>{EMAIL}</a>. We will respond to all requests within 30 days.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>9. Cookies</h2>
          <p style={{ marginBottom: 16 }}>
            We use session cookies strictly for authentication purposes — to keep you logged in. We do not use advertising cookies or third-party tracking cookies. You can control cookie settings through your browser, though disabling cookies may prevent you from using certain features of the Service.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>10. Children&apos;s Privacy</h2>
          <p style={{ marginBottom: 16 }}>
            The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>11. Governing Law</h2>
          <p style={{ marginBottom: 16 }}>
            This Privacy Policy is governed by the laws of the State of {STATE}. By using the Service, you consent to the collection and use of information in accordance with this policy.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>12. Changes to This Policy</h2>
          <p style={{ marginBottom: 16 }}>
            We may update this Privacy Policy from time to time. We will notify you of material changes by updating the effective date above and, where appropriate, sending you an email notification. Your continued use of the Service after changes are posted constitutes your acceptance of the updated policy.
          </p>

          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#1c1c1e", marginTop: 36, marginBottom: 12 }}>13. Contact Us</h2>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy, please contact us at{" "}
            <a href={`mailto:${EMAIL}`} style={{ color: "#007aff" }}>{EMAIL}</a>.
          </p>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, marginBottom: 48, fontSize: 13, color: "#aeaeb2" }}>
          <Link href="/terms" style={{ color: "#007aff", textDecoration: "none" }}>Terms of Service</Link>
          {" · "}
          <Link href="/signup" style={{ color: "#007aff", textDecoration: "none" }}>Back to Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
