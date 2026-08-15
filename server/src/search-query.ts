export function buildDocsSearchQuery(query: string, distro: string | undefined, limit: number): {
  sql: string;
  params: Array<string | number>;
} {
  const params: Array<string | number> = [query, limit];
  let distroFilter = "";
  if (distro) {
    params.push(distro);
    distroFilter = "AND dc.distro = $3";
  }

  return {
    params,
    sql: `SELECT dc.distro, p.name AS package, dc.section_title,
                 dc.content, dc.source_url
            FROM doc_chunks dc
            JOIN packages p ON p.id = dc.package_id
           WHERE to_tsvector('english', dc.section_title || ' ' || dc.content)
                 @@ plainto_tsquery('english', $1)
             ${distroFilter}
           ORDER BY ts_rank(
                      to_tsvector('english', dc.section_title || ' ' || dc.content),
                      plainto_tsquery('english', $1)
                    ) DESC
           LIMIT $2`,
  };
}
