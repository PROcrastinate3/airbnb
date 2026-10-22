import { useState } from "react";

// Password field with a show / hide toggle. Accepts any normal <input> props.
export default function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`input pr-16 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
