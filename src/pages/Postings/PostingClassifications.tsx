import { Link } from "react-router-dom";
import { postingsHref, type PostingOccupationAssociation } from "../../services/resourcesApi";
import { AssociationProvenance, AssociationStatus } from "./OccupationContext";

export function PostingClassifications({ items, pending = false, unavailable = false }: {
  readonly items?: readonly PostingOccupationAssociation[];
  readonly pending?: boolean;
  readonly unavailable?: boolean;
}) {
  const ordered = [...(items ?? [])].sort((a, b) => {
    const current = (item: PostingOccupationAssociation) => item.source_freshness === "CURRENT" && item.catalog_freshness === "CURRENT";
    return Number(current(b)) - Number(current(a)) || a.occupation_scheme.localeCompare(b.occupation_scheme) || a.occupation_code.localeCompare(b.occupation_code);
  });
  return <section className="posting-classifications" aria-label="추론 직무 연결">
    <h3>추론 직무 연결</h3>
    {pending ? <p role="status">분류 연결을 확인하는 중…</p> : unavailable ? <p>추론 연결을 불러오지 못했어요.</p> : !ordered.length
      ? <p>{items ? "추론으로 연결된 직무가 없어요." : "추론 연결 정보가 제공되지 않았어요."}</p>
      : <>
        <p>공고 정보로 추정한 분류예요. 요구 역량이나 보유 역량으로 반영하지 않아요.</p>
        <ul>{ordered.map(item => <li key={item.association_id}>
          <Link to={postingsHref({ occupation: item.occupation_code })}><span>{item.occupation_scheme === "NCS" ? "NCS 직무" : "O*NET 직업"}</span><strong>{item.occupation_name || item.occupation_code}</strong><small>{item.occupation_code} ↗</small></Link>
          <AssociationStatus item={item} />
        </li>)}</ul>
        <AssociationProvenance items={ordered} />
      </>}
  </section>;
}
