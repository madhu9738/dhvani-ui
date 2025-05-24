
import React, { useState, useRef, useEffect } from "react";
import createVAD, { VADMode, VADEvent } from "@ozymandiasthegreat/vad";

const MicRecorderComponent = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
      setDevices(audioInputs);
      if (audioInputs.length > 0) setSelectedDeviceId(audioInputs[0].deviceId);
    });
  }, []);

  const startRecording = async () => {
    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined },
        });
        streamRef.current = stream;
      }

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      await audioContext.audioWorklet.addModule("/mic-processor.js");

      const vad = new (await createVAD())(VADMode.AGGRESSIVE, 16000);

      const source = audioContext.createMediaStreamSource(streamRef.current);
      const workletNode = new AudioWorkletNode(audioContext, "mic-processor");
      workletNodeRef.current = workletNode;

      source.connect(workletNode).connect(audioContext.destination);

      let silenceStart = Date.now();

      workletNode.port.onmessage = (event) => {
        const pcmData = event.data;
        try {
          const result = vad.processFrame(pcmData);
          if (result === VADEvent.VOICE) {
            silenceStart = Date.now();
          } else if (result === VADEvent.SILENCE) {
            if (Date.now() - silenceStart > 1000) {
              console.log("🛑 VAD detected silence, stopping recorder...");
              source.disconnect();
              workletNode.disconnect();
              if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
              }
              audioContext.close();
            }
          }
        } catch (err) {
          console.error("VAD error:", err);
        }
      };

      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        audioChunksRef.current = [];

        const formData = new FormData();
        formData.append("file", new File([audioBlob], "recording.wav"));

        try {
          const res = await fetch("https://d26c-3-237-33-70.ngrok-free.app/voice-assist", {
            method: "POST",
            body: formData,
          });

          const replyBlob = await res.blob();
          const audioURL = URL.createObjectURL(replyBlob);
          const audio = new Audio(audioURL);
          audioRef.current = audio;

          audio.onended = () => {
            console.log("🔁 Playback ended, restarting detection...");
            if (isRunning) setTimeout(() => startRecording(), 500);
          };

          audio.play();
        } catch (err) {
          console.error("❌ Error in send/receive:", err);
        }
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("❌ Error in startRecording:", error);
    }
  };

  const toggleRecording = () => {
    if (isRunning) {
      console.log("🛑 Stopping Smart Loop...");
      setIsRunning(false);
      mediaRecorderRef.current?.stop();
      workletNodeRef.current?.disconnect();
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    } else {
      console.log("▶️ Starting Smart Loop with AudioWorklet...");
      setIsRunning(true);
      startRecording();
    }
  };

  return (
    <div>
      <label>Select Microphone: </label>
      <select
        value={selectedDeviceId}
        onChange={(e) => setSelectedDeviceId(e.target.value)}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || "Unnamed device"}
          </option>
        ))}
      </select>
      <br />
      <button onClick={toggleRecording}>
        {isRunning ? "⏹ Stop" : "🎙 Start"}
      </button>
    </div>
  );
};

export default MicRecorderComponent;
