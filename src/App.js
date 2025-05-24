import React from "react";
import VoiceUploader from "./VoiceUploader";
import MicRecorder from "./MicRecorder";

function App() {
  return (
    <div className="App">
      <h2>🗣 Tara Voice Assistant</h2>
      <VoiceUploader />
      <hr />
      <MicRecorder />
    </div>
  );
}

export default App;
