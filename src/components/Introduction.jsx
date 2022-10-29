import React from "react";
import Link from "./Link";
import SocialLink from "./SocialLink";
import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons";

const Introduction = () => {
  return (
    <>
      <div className="text-gray-800 dark:text-gray-300 lg:max-w-6xl mx-auto">
        <div>
          <img
            src="https://www.gravatar.com/avatar/6007806184d8cbfc17fa57addfb752ee?s=300"
            className="rounded-full max-h-80 mx-auto my-20 border-4 border-green-600"
            alt="logo"
          />
        </div>
        <h1 className="text-3xl">
          Hello 👋🏽! I'm{" "}
          <strong>
            <Link href="https://twitter.com/pebabiion">@pebabion</Link> (Kelvin
            Nguyen Le)
          </strong>
        </h1>
        <div className="p-2 mb-1"></div>
        <div className="my-3">I'm a Data Engineer 👨‍🔧🔧⚙️🚀</div>
        <div className="my-3">
          I am currently living in Singapore 🇸🇬, a sunny tropical island 🌤🏖🌴 in
          Southeast Asia 🌏
        </div>
        <div className="my-3">
          I enjoy building applications/platforms with distributed systems,
          especially for AI and ML.
          <br />
          Feel free to head over to my GitHub for the projects that I am working
          on! 🔨🛠
        </div>
      </div>
      <div className="text-center flex justify-center flex-wrap text-2xl m-4 mb-4">
        <SocialLink
          href="https://github.com/pebabion"
          title="GitHub"
          icon={faGithub}
        ></SocialLink>
        <SocialLink
          href="https://www.linkedin.com/in/knguyen1794/"
          title="LinkedIn"
          icon={faLinkedin}
        ></SocialLink>
      </div>
    </>
  );
};
export default Introduction;
