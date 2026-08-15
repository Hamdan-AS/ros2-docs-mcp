// Distro lifecycle data served by the MCP server.
// Source of truth: config/distros.yaml (verified 2026-08-09 against REP 2000,
// docs.ros.org Releases table, endoflife.date/ros-2). Keep in sync with it —
// the config is locked.

export interface DistroInfo {
  name: string;
  full_name: string;
  released: string | null;
  eol: string | null;
  lts: boolean;
  in_scope: boolean;
  note?: string;
}

export const DISTROS: DistroInfo[] = [
  {
    name: "humble",
    full_name: "Humble Hawksbill",
    released: "2022-05-23",
    eol: "2027-05-31",
    lts: true,
    in_scope: true,
  },
  {
    name: "jazzy",
    full_name: "Jazzy Jalisco",
    released: "2024-05-23",
    eol: "2029-05-31",
    lts: true,
    in_scope: true,
  },
  {
    name: "lyrical",
    full_name: "Lyrical Luth",
    released: "2026-05-22",
    eol: "2031-05-31",
    lts: true,
    in_scope: true,
  },
  {
    name: "kilted",
    full_name: "Kilted Kaiju",
    released: "2025-05-23",
    eol: "2026-12-31",
    lts: false,
    in_scope: false,
    note: "Non-LTS, EOL imminent — excluded from ingestion.",
  },
  {
    name: "rolling",
    full_name: "Rolling Ridley",
    released: null,
    eol: null,
    lts: false,
    in_scope: false,
    note: "Rolling development distribution — excluded.",
  },
];
