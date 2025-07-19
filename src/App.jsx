import {useEffect, useState} from "react";
import "./App.css";
import ProcessTable from "./ProcessTable.jsx";
// import EventLog from "./EventLog.jsx";

function App() {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'pop');
    useEffect(() => {
        localStorage.setItem('theme', theme);
    }, [theme]);

    const [alertMessage, setAlertMessage] = useState("");
    const [alertVisible, setAlertVisible] = useState(false);
    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();
    });

    return (
      <div className=" scrollbox select-none bg-gray-900 h-fit text-gray-100" >

          <ProcessTable
              alertMessage={alertMessage} setAlertMessage={setAlertMessage}
              alertVisible={alertVisible} setAlertVisible={setAlertVisible}
          />

      </div>
  );
}

export default App;
