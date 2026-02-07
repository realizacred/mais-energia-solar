import * as React from "react";

interface HoneypotFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Invisible honeypot field to catch bots
 * 
 * This field is hidden from users via CSS but bots will typically
 * fill it in, allowing us to detect automated submissions.
 */
export function HoneypotField({ value, onChange }: HoneypotFieldProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "-9999px",
        opacity: 0,
        height: 0,
        width: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <label htmlFor="website_url">
        Website (leave blank)
        <input
          type="text"
          id="website_url"
          name="website_url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </label>
      <label htmlFor="phone_confirm">
        Confirm phone (leave blank)
        <input
          type="text"
          id="phone_confirm"
          name="phone_confirm"
          value=""
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </label>
    </div>
  );
}
