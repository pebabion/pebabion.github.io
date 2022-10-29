import "./App.css";

import Introduction from "./components/Introduction";
import Footer from "./components/Footer";

import { useStateContext } from "./contexts/ContextProvider";

function App() {
  const { currentMode } = useStateContext();
  return (
    <div className={currentMode === "Dark" ? "dark" : ""}>
      <div className="flex flex-col min-h-screen text-center dark:bg-main-dark-bg">
        <div className="h-2 bg-green-600" />
        <Introduction />
        <div className="mt-auto m-5">
          <Footer />
        </div>
      </div>
    </div>
  );
}

export default App;
