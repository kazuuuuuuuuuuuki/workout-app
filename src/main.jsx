import { createRoot } from "react-dom/client";
import App from "./App";

// ↓ ここを "#content" から "#root" に変更するだけ！
createRoot(document.querySelector("#root")).render(<App />);