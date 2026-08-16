import type { Metadata } from "next";
import Link from "next/link";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Get beta access - ROS2-Docs MCP",
  description: "Verify your email and receive one private ROS2-Docs MCP beta key.",
};

export default function SignupPage() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/"><span className="brandMark">R2</span><span>ROS2-Docs</span></Link>
        <div className="navLinks"><Link href="/">Home</Link><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link></div>
      </nav>
      <article className="legalPage signupPage">
        <header className="legalHeader">
          <p className="kicker">Self-serve beta</p>
          <h1>Get your private key.</h1>
          <p className="legalLead">Verify your email, then receive one individually revocable <code>r2d_...</code> key. No manual approval or public GitHub issue is required.</p>
          <p className="effectiveDate">Public signup opens after a production email domain is verified.</p>
        </header>
        <div className="signupGrid">
          <SignupForm />
          <aside className="signupNotes">
            <h2>Before you start</h2>
            <ul>
              <li>The six-digit code expires after 10 minutes.</li>
              <li>Three wrong codes pause verification for two hours.</li>
              <li>Each verified email can have one active key.</li>
              <li>Store the emailed key in a password manager. It cannot be shown again.</li>
              <li>The free beta includes 75 credits, then a 48-hour cooldown.</li>
            </ul>
            <p>By continuing, you acknowledge the <Link href="/privacy">privacy policy</Link>. Need help? Read the <Link href="/faq">FAQ</Link>.</p>
          </aside>
        </div>
      </article>
    </main>
  );
}
