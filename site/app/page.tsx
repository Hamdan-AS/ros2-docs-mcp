import { headers } from "next/headers";

const endpoint = "https://ros2-docs-mcp.sidiquihamdan148.workers.dev/mcp";
const supportEmail = "qwerty_786@protonmail.com";

export default async function Home() {
  const requestHeaders = await headers();
  const romanUrdu = requestHeaders.get("x-ros2-docs-locale") === "ur-Latn";
  const supportUrl = requestHeaders.get("x-ros2-docs-support-url");
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="ROS2-Docs home">
          <span className="brandMark">R2</span>
          <span>ROS2-Docs</span>
        </a>
        <div className="navLinks">
          <a href="#setup">Setup</a>
          <a href="#service">Service</a>
          <a href="/faq">FAQ</a>
          <a href="https://github.com/Hamdan-AS/ros2-docs-mcp">GitHub</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><span className="pulse" /> Beta preview · best effort</div>
        <h1>ROS 2 answers,<br /><span>grounded in the docs.</span></h1>
        <p className="heroCopy">
          Search indexed documentation for Humble, Jazzy, and Lyrical directly from
          your AI coding client. Every result includes its source.
        </p>
        <div className="heroActions">
          <a className="button primary" href="/signup">Beta access status</a>
          <a className="button secondary" href="#setup">Connect your client</a>
        </div>
        <div className="distroRow" aria-label="Supported ROS 2 distributions">
          <span>Humble</span><span>Jazzy</span><span>Lyrical</span>
        </div>
      </section>

      <section className="proof" aria-label="Service facts">
        <article><strong>2,234</strong><span>indexed chunks</span></article>
        <article><strong>63</strong><span>package/distro records</span></article>
        <article><strong>75 credits</strong><span>then 48h cooldown</span></article>
        <article><strong>2 tools</strong><span>small, focused surface</span></article>
      </section>

      <aside className="fundingBanner" aria-label="Free service capacity note">
        <div>
          <strong>{romanUrdu ? "Free, self-funded service" : "Free, independently funded service"}</strong>
          <p>{romanUrdu
            ? "75th credit ke baad 48 ghantay ka cooldown shuru hota hai taake yeh self-funded service available rahe."
            : "The 75th credit starts a 48-hour cooldown so this self-funded service can stay available."}</p>
        </div>
        {supportUrl && <a href={supportUrl}>{romanUrdu ? "Patreon par support karein" : "Support on Patreon"}</a>}
      </aside>

      <section className="section" id="setup">
        <div className="sectionIntro">
          <p className="kicker">Setup</p>
          <h2>Connect in a few minutes.</h2>
          <p>Keep your issued <code>r2d_…</code> key private. Never commit it or post it in an issue.</p>
        </div>

        <div className="setupGrid">
          <article className="setupCard">
            <div className="cardHeader"><span className="step">01</span><h3>Claude Code</h3></div>
            <p>Create <code>.mcp.json</code> in your project and set <code>ROS2_DOCS_MCP_API_KEY</code> in your environment.</p>
            <pre><code>{`{
  "mcpServers": {
    "ros2-docs": {
      "type": "http",
      "url": "${endpoint}",
      "headers": {
        "Authorization": "Bearer \${ROS2_DOCS_MCP_API_KEY}"
      }
    }
  }
}`}</code></pre>
          </article>

          <article className="setupCard">
            <div className="cardHeader"><span className="step">02</span><h3>VS Code</h3></div>
            <p>Run <strong>MCP: Open User Configuration</strong>, then use a password input so the key is not stored in the file.</p>
            <pre><code>{`{
  "servers": {
    "ros2-docs": {
      "type": "http",
      "url": "${endpoint}",
      "headers": {
        "Authorization": "Bearer \${input:ros2-docs-key}"
      }
    }
  },
  "inputs": [{
    "type": "promptString",
    "id": "ros2-docs-key",
    "description": "ROS2-Docs API key",
    "password": true
  }]
}`}</code></pre>
          </article>
        </div>

        <div className="tryIt">
          <span>Try asking</span>
          <p>“How do I look up a transform with tf2 in Jazzy? Cite the source.”</p>
        </div>
      </section>

      <section className="section toolsSection">
        <div className="sectionIntro">
          <p className="kicker">Tools</p>
          <h2>A deliberately small API.</h2>
        </div>
        <div className="toolList">
          <article><code>search_docs</code><p>Ranked full-text search with an optional distro filter and direct source URLs.</p></article>
          <article><code>get_distro_status</code><p>Release, LTS, end-of-life, and index status for the supported distributions.</p></article>
        </div>
      </section>

      <section className="section serviceSection" id="service">
        <div className="sectionIntro">
          <p className="kicker">Service notes</p>
          <h2>Clear limits. Minimal data.</h2>
        </div>
        <div className="serviceGrid">
          <article><h3>401</h3><p>Your key is missing, invalid, or revoked.</p></article>
          <article><h3>403</h3><p>Your browser origin is not on the allow-list.</p></article>
          <article><h3>429</h3><p>Your 75 credits are exhausted. Use the returned reset time to retry after the 48-hour cooldown.</p></article>
          <article><h3>Privacy</h3><p>We retain request counts and errors, not search queries or raw API keys.</p></article>
        </div>
        <div className="statusBar">
          <div><span className="pulse" /><strong>Service status</strong><small>Live health endpoint</small></div>
          <a href="https://ros2-docs-mcp.sidiquihamdan148.workers.dev/health">Check status ↗</a>
        </div>
      </section>

      <section className="cta">
        <p className="kicker">Small public beta</p>
        <h2>Bring better ROS 2 context into your next session.</h2>
        <p>Verify your email to receive one private, individually revocable key.</p>
        <a className="button light" href="/signup">Check beta access</a>
      </section>

      <footer>
        <span>ROS2-Docs MCP</span>
        <p>Independent open-source project. ROS 2 is a trademark of Open Robotics.</p>
        <div>
          <a href="https://github.com/Hamdan-AS/ros2-docs-mcp">Source</a>
          <a href={`mailto:${supportEmail}`}>Support</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </main>
  );
}
