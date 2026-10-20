import "./NcsLevel.css";

export const NCS_LEVELS = [
  { level: 1, description: "구체적인 지시와 철저한 감독 아래 기초 지식을 활용해 단순하고 반복적인 과업을 수행하는 수준" },
  { level: 2, description: "일반적인 지시와 감독 아래 절차에 따라 과업을 수행하는 수준", context: "고등학교·기능사 과정" },
  { level: 3, description: "제한된 권한 안에서 기본 이론과 일반 지식을 활용해 다소 복잡한 과업을 수행하는 수준", context: "전문대학·산업기사 과정" },
  { level: 4, description: "일반적인 권한 안에서 제한된 이론과 지식을 활용해 복잡하고 다양한 과업을 수행하는 수준", context: "4년제 대학·기사 과정" },
  { level: 5, description: "포괄적인 권한 안에서 이론과 지식을 자유롭게 활용해 복잡하고 비일상적인 과업을 수행하는 수준" },
  { level: 6, description: "독립적인 권한 안에서 지식과 기술을 자유롭게 활용해 숙련된 과업을 수행하는 수준", context: "학사·기사 및 고숙련 업무" },
  { level: 7, description: "전문적인 이론과 지식을 활용해 광범위한 업무를 수행하고 다른 사람의 결과에도 책임지는 수준", context: "석사 과정" },
  { level: 8, description: "최고 수준의 이론과 지식을 활용해 새로운 이론을 만들고 조직 전반의 권한과 책임을 갖는 수준", context: "박사·기술사 과정" },
] as const;

export function NcsLevel({ level, compact = false }: { readonly level?: number | null; readonly compact?: boolean }) {
  const selected = NCS_LEVELS.find(item => item.level === level);
  return <details className={`ncs-level${compact ? " ncs-level--compact" : ""}`}>
    <summary>{selected ? `NCS ${level}수준` : "NCS 수준 안내"}<span aria-hidden="true"> ⓘ</span></summary>
    <div className="ncs-level-help">
      <p>NCS 수준은 업무의 복잡성, 권한과 책임을 설명해요. 나의 숙련도 점수가 아니에요.</p>
      <ol>{NCS_LEVELS.map(item => <li key={item.level} className={item.level === level ? "ncs-level-current" : undefined} aria-current={item.level === level ? "true" : undefined}>
        <strong>{item.level}수준</strong><span>{item.description}</span>{"context" in item && <small>이해를 돕는 예: {item.context}</small>}
      </li>)}</ol>
      <p className="ncs-level-caution">학력·자격 예시는 이해를 돕는 대략적인 참고이며 동등 학력, 응시 자격이나 채용 요건을 보장하지 않아요.</p>
      <a href="https://www.ncs.go.kr/mobile/rm01/TH10200103.do" target="_blank" rel="noopener noreferrer">NCS 공식 수준 체계 보기 ↗</a>
    </div>
  </details>;
}
