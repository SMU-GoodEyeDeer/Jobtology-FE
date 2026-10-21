import "./BrandLogo.css";

export function BrandIcon({ className = "" }: { readonly className?: string }) {
  return <svg className={`brand-icon ${className}`} viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="m8 26 9-15 12 10M8 26l21-5" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="8" cy="26" r="4" fill="currentColor" />
    <circle cx="17" cy="11" r="5" fill="currentColor" />
    <circle cx="29" cy="21" r="3.5" fill="currentColor" />
  </svg>;
}

export function BrandWordmark({ className = "" }: { readonly className?: string }) {
  return <span className={`brand-wordmark ${className}`}>Jobtology<span className="brand-period">.</span></span>;
}

export function BrandLogo({ className = "" }: { readonly className?: string }) {
  return <span className={`brand-logo ${className}`} role="img" aria-label="Jobtology">
    <BrandIcon /><span aria-hidden="true"><BrandWordmark /></span>
  </span>;
}
