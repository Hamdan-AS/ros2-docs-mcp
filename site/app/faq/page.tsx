import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

const supportEmail = "qwerty_786@protonmail.com";

export const metadata: Metadata = {
  title: "FAQ - ROS2-Docs MCP",
  description: "Setup, quota, authentication, privacy, and support answers for ROS2-Docs MCP.",
};

export default async function FaqPage() {
  const requestHeaders = await headers();
  const romanUrdu = requestHeaders.get("x-ros2-docs-locale") === "ur-Latn";
  const supportUrl = requestHeaders.get("x-ros2-docs-support-url");
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/"><span className="brandMark">R2</span><span>ROS2-Docs</span></Link>
        <div className="navLinks"><Link href="/">Home</Link><Link href="/signup">Get access</Link><Link href="/privacy">Privacy</Link></div>
      </nav>
      <article className="legalPage">
        <header className="legalHeader">
          <p className="kicker">Help</p><h1>Frequently asked questions</h1>
          <p className="legalLead">The practical details for access, setup, limits, errors, and private data.</p>
        </header>
        <div className="faqList">
          <section><h2>{romanUrdu ? "Credits aur cooldown kaise kaam karte hain?" : "How do credits and cooldowns work?"}</h2><p>{romanUrdu
            ? <>Har authenticated HTTP request aik credit use karti hai. Default beta allowance 75 hai. 75th request successful hoti hai aur 48 ghantay ka cooldown start karti hai; cooldown ke duran <code>429</code>, exact <code>reset_at</code>, aur <code>Retry-After</code> milta hai.</>
            : <>Each authenticated HTTP request consumes one credit. The default beta allowance is 75. The 75th request succeeds and starts a 48-hour cooldown; requests during it return <code>429</code> with an authoritative <code>reset_at</code> time and <code>Retry-After</code> header.</>}</p></section>
          <section><h2>What do 401, 403, and 429 mean?</h2><p><code>401</code> means the key is missing, malformed, invalid, or revoked. <code>403</code> means a browser origin is not allowed. <code>429</code> means the active credit cycle is exhausted; wait until <code>reset_at</code>.</p></section>
          <section><h2>How do I connect?</h2><p>Use the Streamable HTTP endpoint shown on the home page and send <code>Authorization: Bearer r2d_your_key</code>. Copy the Claude Code or VS Code configuration from the setup section, keeping the key in an environment variable or password input.</p></section>
          <section><h2>Can I have more than one key?</h2><p>Each verified email has one active key. Repeating signup never reveals or silently replaces it. This keeps revocation and quotas isolated.</p></section>
          <section><h2>What if my key is lost or revoked?</h2><p>A raw key cannot be recovered because only its SHA-256 hash is stored. Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> for revocation or replacement; never include the old key in the message.</p></section>
          <section><h2>Why did verification pause?</h2><p>Codes expire after 10 minutes. Three incorrect codes trigger a two-hour pause. Resends wait at least 60 seconds and are limited to three sends per email in two hours.</p></section>
          <section><h2>What data is retained?</h2><p>The service uses a normalized email for signup and access administration, API-key and OTP hashes, quota state, request counts, and generic operational errors. It does not intentionally retain raw keys, raw OTPs, or search queries. See the <Link href="/privacy">privacy policy</Link> for providers and retention.</p></section>
          <section><h2>Is this an official ROS or Open Robotics service?</h2><p>No. It is an independent, best-effort open-source beta with no SLA.</p></section>
          <section><h2>{romanUrdu ? "Project ko support karna zaroori hai?" : "Do I have to support the project?"}</h2><p>{romanUrdu
            ? "Nahi. Service free aur fully functional rehti hai; support bilkul voluntary hai."
            : "No. The service remains free and fully functional; support is entirely voluntary."} {supportUrl && <a href={supportUrl}>{romanUrdu ? "Patreon par voluntary support" : "Voluntarily support it on Patreon"}</a>}</p></section>
        </div>
      </article>
    </main>
  );
}
