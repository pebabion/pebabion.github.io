import React from "react";

export default function Link({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-success hover:underline"
    >
      {children}
    </a>
  );
}
