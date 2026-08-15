import type { Metadata } from "next";
import Link from "next/link";

const repository = "https://github.com/Hamdan-AS/ros2-docs-mcp";
const contactEmail = "qwerty_786@protonmail.com";
const contactHref = `mailto:${contactEmail}`;

export const metadata: Metadata = {
  title: "Privacy policy — ROS2-Docs MCP",
  description: "How ROS2-Docs MCP processes, uses, and retains service data.",
};

export default function PrivacyPage() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="ROS2-Docs home">
          <span className="brandMark">R2</span>
          <span>ROS2-Docs</span>
        </Link>
        <div className="navLinks">
          <Link href="/">Home</Link>
          <a href={`${repository}#readme`}>Setup</a>
          <a href={repository}>GitHub</a>
        </div>
      </nav>

      <article className="legalPage">
        <header className="legalHeader">
          <p className="kicker">Privacy</p>
          <h1>Privacy policy</h1>
          <p className="legalLead">
            ROS2-Docs MCP keeps the data surface deliberately small. This policy
            explains what the hosted service processes, why it is needed, and how
            long it is retained.
          </p>
          <p className="effectiveDate">Effective August 15, 2026</p>
        </header>

        <div className="legalContent">
          <section>
            <h2>Scope</h2>
            <p>
              This policy applies to the ROS2-Docs landing site and the hosted MCP
              endpoint. The service searches an indexed copy of public ROS 2
              documentation and returns matching sections with source links.
            </p>
          </section>

          <section>
            <h2>Data we process</h2>
            <ul>
              <li>
                <strong>Access data:</strong> an operator-created customer label,
                service tier, optional credit limit, a SHA-256 hash of the issued API
                key, and key creation and last-used timestamps. Raw API keys are
                displayed when issued or replaced and are not stored in the service
                database.
              </li>
              <li>
                <strong>Usage data:</strong> the customer record, credits consumed,
                cooldown end time, and historical daily request counts used to
                enforce quotas and monitor the service.
              </li>
              <li>
                <strong>Request content:</strong> search text, an optional ROS 2
                distro, and a result limit are processed to answer a tool call. The
                application does not write search text to its project tables or
                intentionally include it in application logs.
              </li>
              <li>
                <strong>Operational data:</strong> HTTP status information and
                generic error events may be processed to keep the service reliable
                and investigate abuse. Application errors are deliberately logged
                without database URLs, API keys, search text, or driver details.
              </li>
            </ul>
            <p>
              The landing site does not use an account form, advertising tracker,
              or project-owned analytics cookie. Links to GitHub and the service
              health endpoint take you to those external services.
            </p>
          </section>

          <section>
            <h2>How data is used</h2>
            <p>
              Data is used only to authenticate access, enforce quotas, answer MCP
              requests, maintain security and reliability, troubleshoot failures,
              and administer or revoke customer access. ROS2-Docs does not sell
              personal data or use MCP request content for advertising.
            </p>
          </section>

          <section>
            <h2>Service providers</h2>
            <p>
              Cloudflare hosts the landing site and MCP Worker. Neon hosts the
              Postgres database. GitHub hosts the source repository, support path,
              and deployment automation. These providers may process infrastructure
              metadata under their own terms and privacy policies.
            </p>
          </section>

          <section>
            <h2>Retention and deletion</h2>
            <p>
              Customer records, API-key hashes, and current credit/cooldown state
              remain until access is revoked or the record is deleted. Historical
              daily usage records are automatically deleted after 90 days. Last-used
              timestamps remain with the customer record for access administration.
              Temporary acceptance-test users, keys, and usage rows are deleted
              after the test.
            </p>
            <p>
              A customer may request access revocation or deletion by emailing
              {" "}<a href={contactHref}>{contactEmail}</a>. Some provider-level
              security or infrastructure records may remain for the period required
              by the relevant provider.
            </p>
          </section>

          <section>
            <h2>Security</h2>
            <p>
              The service uses HTTPS, stores only API-key hashes, isolates customer
              quotas, and returns generic public errors. No internet service can
              guarantee absolute security, so customers must keep issued keys out of
              public repositories, screenshots, and support posts.
            </p>
          </section>

          <section>
            <h2>Contact and requests</h2>
            <p>
              Email <a href={contactHref}>{contactEmail}</a> for privacy, deletion,
              or support requests. GitHub issues are public: do not include an API
              key, database URL, private account information, or other secrets in an
              issue, screenshot, or other public post.
            </p>
          </section>

          <section>
            <h2>Policy changes</h2>
            <p>
              Material changes will be published on this page with a revised
              effective date. The repository history provides a public record of the
              policy source.
            </p>
          </section>
        </div>
      </article>

      <footer>
        <span>ROS2-Docs MCP</span>
        <p>Independent open-source project. ROS 2 is a trademark of Open Robotics.</p>
        <div>
          <a href={repository}>Source</a>
          <a href={contactHref}>Support</a>
          <a href="/privacy" aria-current="page">Privacy</a>
        </div>
      </footer>
    </main>
  );
}
