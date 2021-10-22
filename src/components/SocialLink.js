import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function SocialLink({ href, title, icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-green-600 hover:underline block h-6 my-4 mx-4"
    >
      <FontAwesomeIcon
        className="h-full"
        title={title}
        icon={icon}
      ></FontAwesomeIcon>
    </a>
  );
}
