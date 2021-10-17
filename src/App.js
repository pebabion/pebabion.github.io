import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";

import Link from "./components/Link";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="App">
      <div className="p-1 mb-1 bg-success text-white"></div>
      <header className="App-header">
        <img
          src="https://github.com/pebabion.png"
          className="App-logo"
          alt="logo"
        />
      </header>
      <main>
        <h2>
          Hello 👋🏽! I'm{" "}
          <strong>
            <Link href="https://twitter.com/pebabiion">@pebabion</Link>
            (Kelvin Nguyen Le)
          </strong>
        </h2>
        <div className="p-2 mb-1"></div>
        <p>I'm a Data Engineer 👨‍🔧🔧⚙️🚀</p>
        <p>
          I am currently living in Singapore 🇸🇬, a sunny tropical island 🌤🏖🌴 in
          Southeast Asia 🌏
        </p>
        <p>
          I enjoy building applications/platforms with distributed systems,
          especially for AI and ML.
          <br />
          Feel free to head over to my GitHub for the projects that I am working
          on! 🔨🛠
        </p>
      </main>
      <div className="p-2 mb-1"></div>
      <Footer></Footer>
    </div>
  );
}

export default App;
