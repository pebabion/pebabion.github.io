import React from "react";

export default function Link({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-green-600 hover:underline"
    >
      {children}
    </a>
  );
}
