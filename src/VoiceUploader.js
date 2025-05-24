import React, { useState } from "react";

const VoiceUploader = () => {
  const [status, setStatus] = useState("");

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "audio/wav") {
      setStatus("❌ Please upload a valid .wav file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setStatus("⏫ Uploading...");

    try {
      const res = await fetch("https://ac38-3-237-33-70.ngrok-free.app/upload-voice", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("✅ Voice uploaded successfully.");
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setStatus("❌ Upload failed.");
    }
  };

  return (
    <div>
      <h4>Upload Speaker Voice</h4>
      <input type="file" accept=".wav" onChange={handleUpload} />
      <p>{status}</p>
    </div>
  );
};

export default VoiceUploader;
