import "./App.css";

import Link from "./components/Link";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="App">
      <div className="h-2 bg-green-600"></div>
      <header>
        <img
          src="https://github.com/pebabion.png"
          className="rounded-full max-h-80 mx-auto my-20"
          alt="logo"
        />
      </header>
      <main className="lg:max-w-6xl mx-auto">
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
      </main>
      <div className="p-2 mb-1"></div>
      <Footer></Footer>
    </div>
  );
}

export default App;
