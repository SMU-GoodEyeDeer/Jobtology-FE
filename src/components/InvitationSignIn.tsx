import { useEffect, useRef, useState } from "react";
import { GoogleSignIn } from "./GoogleSignIn";
import { BrandLogo } from "./BrandLogo";
import "./InvitationSignIn.css";

const messages: Record<string, string> = {
  INVITATION_REQUIRED: "초대 코드가 필요한 계정이에요.",
  INVITATION_INVALID: "사용할 수 없는 초대 코드예요. 코드를 확인해 주세요.",
  ACCESS_EXPIRED: "이 계정의 이용 기간이 끝났어요. 관리자에게 연장을 요청해 주세요.",
  ACCESS_REVOKED: "이 계정의 이용이 중지되었어요. 관리자에게 문의해 주세요.",
};

function initialInvitation() {
  if (typeof window === "undefined") return { code: "", error: "" };
  const code = new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "";
  const errorCode = new URLSearchParams(window.location.search).get("auth_error") ?? "";
  return { code: /^[a-z2-7 -]{24,40}$/i.test(code) ? code : "", error: messages[errorCode] ?? "" };
}

export function InvitationSignIn() {
  const [initial] = useState(initialInvitation);
  const [open, setOpen] = useState(!!(initial.code || initial.error));
  const [step, setStep] = useState<"code" | "google">(initial.code ? "google" : "code");
  const [code, setCode] = useState(initial.code);
  const [accepted, setAccepted] = useState(initial.code);
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocus = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    if (hash.has("invite")) { hash.delete("invite"); url.hash = hash.toString(); }
    url.searchParams.delete("auth_error");
    // The invitation stays in component memory, outside logs, history and storage.
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    if (!node.open) node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (node.open) node.close();
    };
  }, [open]);

  useEffect(() => {
    if (open || !restoreTriggerFocus.current) return;
    restoreTriggerFocus.current = false;
    trigger.current?.focus();
  }, [open]);

  function dismiss() {
    if (busy) return;
    restoreTriggerFocus.current = true;
    setOpen(false); setStep("code"); setCode(""); setAccepted(""); setError("");
  }
  function continueWithCode(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().replace(/[ -]/g, "").toUpperCase();
    if (!/^[A-Z2-7]{24}$/.test(normalized)) {
      setError("초대 코드 24자리를 입력해 주세요."); return;
    }
    setAccepted(normalized); setError(""); setStep("google");
  }
  return <>
    <button ref={trigger} className="landing-cta" type="button" onClick={() => setOpen(true)}>
      Google로 시작하기<span className="landing-cta-arrow" aria-hidden="true">↗</span>
    </button>
    {open && <dialog ref={dialog} className="invitation-dialog" aria-labelledby="invitation-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClose={() => {
        const node = dialog.current;
        if (!node?.isConnected || node.open) return;
        if (busy) node.showModal(); else dismiss();
      }}>
      <header className="invitation-header"><BrandLogo /><button type="button" className="invitation-close" aria-label="닫기" disabled={busy} onClick={dismiss}>×</button></header>
      <h2 id="invitation-title">{step === "code" ? "초대 코드로 시작하기" : "Google 계정 연결"}</h2>
      {error && <p className="invitation-error" role="alert">{error}</p>}
      {step === "code" ? <form onSubmit={continueWithCode}>
        <label htmlFor="invitation-code">초대 코드</label>
        <input id="invitation-code" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} />
        <button type="submit" className="invitation-primary">계속</button>
        <button type="button" className="invitation-existing" onClick={() => { setAccepted(""); setError(""); setStep("google"); }}>이미 가입했어요 · 로그인</button>
      </form> : <>
        <p className="invitation-caption">{accepted ? "초대받은 계정으로 계속하세요." : "기존 계정으로 로그인하세요."}</p>
        <GoogleSignIn invitationCode={accepted || undefined} onBusyChange={setBusy} />
        <button className="invitation-existing" type="button" disabled={busy} onClick={() => { setStep("code"); setError(""); }}>초대 코드 입력으로 돌아가기</button>
      </>}
    </dialog>}
  </>;
}
