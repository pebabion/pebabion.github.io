import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";

import Link from "./components/Link";

function App() {
  return (
    <div className="App">
      <div class="p-1 mb-1 bg-success text-white"></div>
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
        <div class="p-2 mb-1"></div>
        <p>I'm a Data Engineer 👨‍🔧🔧⚙️🚀</p>
        <p>
          I am currently living Singapore 🇸🇬, a sunny, tropical island 🌤🏖🌴 in
          Southeast Asia 🌏
        </p>
      </main>
    </div>
  );
}

export default App;
