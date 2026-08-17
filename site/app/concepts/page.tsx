"use client";

import { useState } from "react";
import "./concepts.css";

const concepts = [
  { id: "carbon", name: "Carbon Flow" },
  { id: "precision", name: "Precision Type" },
  { id: "signal", name: "Signal Wave" },
  { id: "blueprint", name: "Blueprint Path" },
  { id: "titanium", name: "Titanium Editorial" },
] as const;

type ConceptId = (typeof concepts)[number]["id"];

function LabSwitcher({ active, onChange }: { active: ConceptId; onChange: (id: ConceptId) => void }) {
  const selected = concepts.find((concept) => concept.id === active) ?? concepts[0];
  return (
    <header className="labSwitcher">
      <div className="labIdentity"><span>LOCAL UI LAB</span><strong>{selected.name}</strong></div>
      <div className="labTabs" role="tablist" aria-label="Choose a visual direction">
        {concepts.map((concept, index) => (
          <button key={concept.id} type="button" role="tab" aria-selected={active === concept.id} className={active === concept.id ? "active" : ""} onClick={() => onChange(concept.id)}>
            <span>0{index + 1}</span><b>{concept.name}</b>
          </button>
        ))}
      </div>
    </header>
  );
}

function CarbonTerminal() {
  return (
    <article className="c1 pageConcept">
      <nav className="c1Nav"><a href="#c1-top" className="c1Brand"><b>R2</b><span>ROS2_DOCS</span></a><div><a href="#c1-tools">TOOLS</a><a href="/faq">DOCS</a><a href="/signup">ACCESS ↗</a></div></nav>
      <section className="c1Hero" id="c1-top">
        <div className="c1Copy">
          <p className="monoLabel"><i /> MCP ENDPOINT / ONLINE</p>
          <h1>Ground truth<br />for <em>ROS 2.</em></h1>
          <p>Search source-linked documentation for Humble, Jazzy, and Lyrical without leaving your coding session.</p>
          <div className="c1Actions"><a href="/signup">REQUEST ACCESS</a><a href="#c1-tools">EXPLORE TOOLS ↓</a></div>
        </div>
        <div className="c1Terminal">
          <header><span>QUERY_0248</span><span>LIVE · 31MS</span></header>
          <div className="c1Command"><span>›</span><code>search_docs --distro jazzy<br />&nbsp;&nbsp;--query &quot;tf2 lookup transform&quot;</code></div>
          <p className="c1Found">FOUND 02 SOURCE-LINKED RESULTS</p>
          <ol>
            <li><span>01</span><div><strong>Using time (C++)</strong><small>docs.ros.org / jazzy / tf2</small></div><b>.94</b></li>
            <li><span>02</span><div><strong>Writing a listener</strong><small>docs.ros.org / jazzy / tutorial</small></div><b>.89</b></li>
          </ol>
          <footer><span>2,234 CHUNKS</span><span>63 RECORDS</span><i /></footer>
        </div>
      </section>
      <section className="c1Metrics" id="c1-tools"><article><span>01 / INDEX</span><strong>2,234</strong><small>documentation chunks</small></article><article><span>02 / DISTROS</span><strong>03</strong><small>Humble · Jazzy · Lyrical</small></article><article><span>03 / TOOLS</span><strong>02</strong><small>focused read-only surface</small></article></section>
      <footer className="c1Foot"><span>ROS2-DOCS MCP / INDEPENDENT OSS</span><a href="/privacy">MINIMAL DATA. CLEAR LIMITS. ↗</a></footer>
    </article>
  );
}

function PrecisionLight() {
  return (
    <article className="c2 pageConcept">
      <aside className="c2Rail"><b>R2</b><span>DOCUMENTATION<br />INTELLIGENCE</span><em>02</em></aside>
      <div className="c2Main">
        <nav className="c2Nav"><span>ROS2-DOCS / MCP</span><div><a href="#c2-system">SYSTEM</a><a href="/faq">FAQ</a><a href="/signup">BETA ACCESS</a></div></nav>
        <section className="c2Hero">
          <p>TECHNICAL REFERENCE / 2026</p>
          <h1>ROS 2<br /><span>answers</span><br />with receipts.</h1>
          <div className="c2Intro"><strong>Search the docs.<br />Keep the source.</strong><p>Ranked, distro-aware documentation directly inside Claude Code and Visual Studio Code.</p><a href="/signup">START HERE <span>→</span></a></div>
        </section>
        <section className="c2System" id="c2-system">
          <div className="c2SystemTitle"><span>01</span><h2>A precise interface,<br />not another knowledge base.</h2></div>
          <div className="c2Cards">
            <article><span>A</span><code>search_docs</code><p>Full-text ranking, direct sources, optional distribution filters.</p></article>
            <article><span>B</span><code>get_distro_status</code><p>Release, support, LTS, EOL, and index status in one call.</p></article>
            <article className="c2Blue"><span>C</span><strong>75</strong><p>free credits before a transparent 48-hour cooldown.</p></article>
          </div>
        </section>
        <footer className="c2Foot"><b>ROS2-DOCS</b><p>HUMBLE / JAZZY / LYRICAL</p><div><a href="/privacy">PRIVACY</a><a href="https://github.com/Hamdan-AS/ros2-docs-mcp">GITHUB ↗</a></div></footer>
      </div>
    </article>
  );
}

function SignalAmber() {
  return (
    <article className="c3 pageConcept">
      <header className="c3Top"><div><b>R2://DOCS</b><span>CONTROL SURFACE</span></div><div className="c3Ticker"><span>ENDPOINT</span><strong>ONLINE</strong><span>LATENCY</span><strong>031MS</strong><span>INDEX</span><strong>2234</strong></div><a href="/signup">AUTHORIZE ↗</a></header>
      <section className="c3Hero">
        <div className="c3Cross one" /><div className="c3Cross two" />
        <p>[ AUTHENTICATED DOCUMENTATION SIGNAL ]</p>
        <h1>LESS NOISE.<br /><em>MORE SOURCE.</em></h1>
        <div className="c3Orbit"><span>03</span><small>SUPPORTED<br />DISTROS</small></div>
      </section>
      <section className="c3Console">
        <div className="c3Prompt"><span>RUN / SEARCH_DOCS</span><code>query = <b>&quot;nav2 lifecycle manager&quot;</b><br />distro = <b>&quot;humble&quot;</b></code><a href="#c3-data">EXECUTE →</a></div>
        <div className="c3Readout" id="c3-data"><div className="c3Gauge"><i /><span>94%</span><small>SOURCE MATCH</small></div><div><p>TOP RESULT / 01</p><h2>Lifecycle Manager</h2><span>docs.nav2.org / configuration / packages</span></div></div>
      </section>
      <section className="c3Modules"><article><span>MOD_01</span><h3>SEARCH</h3><p>Ranked full-text retrieval with distro scoping.</p></article><article><span>MOD_02</span><h3>STATUS</h3><p>Release and support-state intelligence.</p></article><article><span>CAPACITY</span><h3>75 CR</h3><p>Final request succeeds, then 48h cooldown.</p></article><article><span>LOGGING</span><h3>MINIMAL</h3><p>No intentional raw-key or query retention.</p></article></section>
      <footer className="c3Foot"><span>SYS / ROS2-DOCS / BETA</span><div><a href="/faq">FAQ</a><a href="/privacy">PRIVACY</a><a href="https://github.com/Hamdan-AS/ros2-docs-mcp">SOURCE</a></div></footer>
    </article>
  );
}

function Blueprint() {
  return (
    <article className="c4 pageConcept">
      <header className="c4TitleBlock"><div><b>ROS2-DOCS</b><span>REMOTE MCP SERVER</span></div><dl><dt>DWG NO.</dt><dd>R2D-A01</dd><dt>REV.</dt><dd>0.3</dd><dt>STATUS</dt><dd>LIVE</dd></dl></header>
      <section className="c4Sheet">
        <div className="c4Copy"><p>SPECIFICATION / SEARCH SYSTEM</p><h1>Documentation,<br />mapped to your<br /><em>workflow.</em></h1><div><a href="/signup">CONNECT ENDPOINT →</a><span>Claude Code · VS Code · MCP Inspector</span></div></div>
        <div className="c4Diagram" aria-label="Documentation retrieval diagram">
          <div className="c4Node input"><span>01</span><strong>YOUR QUERY</strong><small>natural language</small></div>
          <div className="c4Line horizontal" /><div className="c4Line vertical" />
          <div className="c4Hub"><i /><b>R2</b><span>MCP</span></div>
          <div className="c4Node output"><span>03</span><strong>SOURCE RESULT</strong><small>ranked + linked</small></div>
          <div className="c4Node index"><span>02</span><strong>DOC INDEX</strong><small>2,234 chunks</small></div>
          <p className="c4Note n1">A. DISTRO FILTER</p><p className="c4Note n2">B. READ ONLY</p><p className="c4Note n3">C. 31MS SAMPLE</p>
        </div>
      </section>
      <section className="c4Legend"><h2>System legend</h2><div><article><span>01</span><strong>search_docs</strong><p>Full-text documentation retrieval.</p></article><article><span>02</span><strong>get_distro_status</strong><p>Release and index availability.</p></article><article><span>03</span><strong>75 / 48H</strong><p>Transparent free-use capacity.</p></article></div></section>
      <footer className="c4Foot"><p>INDEPENDENT OPEN-SOURCE PROJECT</p><div><a href="/faq">FAQ</a><a href="/privacy">PRIVACY</a><a href="https://github.com/Hamdan-AS/ros2-docs-mcp">REPOSITORY ↗</a></div></footer>
    </article>
  );
}

function Titanium() {
  return (
    <article className="c5 pageConcept">
      <nav className="c5Nav"><a href="#c5-top"><b>R2</b> ROS2-DOCS</a><span>INDEPENDENT / TECHNICAL / OPEN</span><div><a href="/faq">FAQ</a><a href="/signup">GET KEY ↗</a></div></nav>
      <section className="c5Hero" id="c5-top">
        <span className="c5Number">05</span>
        <p className="c5Kicker">THE DOCUMENTATION INTERFACE FOR ROS 2</p>
        <h1>Robots deserve<br /><em>better context.</em></h1>
        <aside><span>LIVE INDEX / 2026</span><strong>2,234</strong><p>source-linked chunks across Humble, Jazzy, and Lyrical.</p><a href="/signup">TRY THE BETA →</a></aside>
      </section>
      <section className="c5Statement"><p>ONE SMALL ENDPOINT</p><h2>Search less.<br />Build more.</h2><div><p>ROS2-Docs brings ranked official documentation into the place you are already writing code.</p><p>Two tools, read-only behavior, clear quotas, and a source URL on every result.</p></div></section>
      <section className="c5Marquee"><span>SEARCH_DOCS</span><i>+</i><span>GET_DISTRO_STATUS</span><i>+</i><span>READ_ONLY</span></section>
      <section className="c5Details"><article><span>01</span><h3>Grounded</h3><p>Every answer starts with indexed documentation and returns its source.</p></article><article><span>02</span><h3>Focused</h3><p>No sprawling tool surface. Only search and distribution status.</p></article><article><span>03</span><h3>Honest</h3><p>75 credits, then a visible 48-hour cooldown. No hidden paywall.</p></article></section>
      <footer className="c5Foot"><b>ROS2-DOCS MCP</b><p>Independent open-source project. ROS 2 is a trademark of Open Robotics.</p><div><a href="/privacy">PRIVACY</a><a href="https://github.com/Hamdan-AS/ros2-docs-mcp">GITHUB ↗</a></div></footer>
    </article>
  );
}

export default function ConceptsPage() {
  const [active, setActive] = useState<ConceptId>("carbon");
  return (
    <main className="uiLab">
      <LabSwitcher active={active} onChange={setActive} />
      {active === "carbon" && <CarbonTerminal />}
      {active === "precision" && <PrecisionLight />}
      {active === "signal" && <SignalAmber />}
      {active === "blueprint" && <Blueprint />}
      {active === "titanium" && <Titanium />}
    </main>
  );
}
