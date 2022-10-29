import "./App.css";

import Introduction from "./components/Introduction";
import Footer from "./components/Footer";

import { useStateContext } from "./contexts/ContextProvider";

function App() {
  const { currentMode } = useStateContext();
  return (
    <div className={currentMode === "Dark" ? "dark" : ""}>
      <div className="text-center dark:bg-main-dark-bg">
        <div className="h-2 bg-green-600" />
        <div className="flex flex-col h-screen">
          <div className="mb-auto">
            <Introduction />
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}

export default App;
