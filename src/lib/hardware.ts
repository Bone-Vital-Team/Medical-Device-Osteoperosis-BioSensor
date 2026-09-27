import type { ConnectionState } from "./model";
export interface RawFrame {
  currentUa: number;
  voltageV: number | null;
  signalDetected: boolean;
}
export interface PotentiostatAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(): Promise<RawFrame>;
}
/** EXAMPLE transport only. The team's firmware must intentionally emit this
 * newline-delimited JSON protocol. No commands or voltages are sent to hardware.
 * Creatinine is not derived from this single DPD current channel.
 */
export function parseDeviceFrame(line: string): RawFrame {
  const value = JSON.parse(line);
  if (
    !value ||
    value.protocol !== "bonevital-v1" ||
    typeof value.current_uA !== "number" ||
    !Number.isFinite(value.current_uA) ||
    typeof value.signal_detected !== "boolean" ||
    (value.voltage_V != null &&
      (typeof value.voltage_V !== "number" ||
        !Number.isFinite(value.voltage_V)))
  ) {
    throw new Error(
      "Invalid device frame. Expected bonevital-v1 with numeric current_uA and boolean signal_detected.",
    );
  }
  return {
    currentUa: value.current_uA,
    voltageV: value.voltage_V ?? null,
    signalDetected: value.signal_detected,
  };
}
interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}
interface SerialAPI {
  requestPort(): Promise<SerialPort>;
}
export function serialSupported() {
  return (
    typeof navigator !== "undefined" &&
    window.isSecureContext &&
    "serial" in navigator
  );
}
export class WebSerialAdapter implements PotentiostatAdapter {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private active = false;
  constructor(
    private onState: (state: ConnectionState) => void,
    private baudRate = 115200,
  ) {}
  async connect() {
    if (!serialSupported())
      throw new Error(
        "Web Serial is unavailable here. Use a supported desktop Chromium browser on HTTPS or localhost, or try simulated mode.",
      );
    if (this.port) throw new Error("Disconnect the current device first.");
    this.onState("connecting");
    try {
      const api = (navigator as Navigator & { serial: SerialAPI }).serial;
      const port = await api.requestPort();
      await port.open({ baudRate: this.baudRate });
      this.port = port;
      this.onState("connected");
    } catch (e) {
      this.port = null;
      this.onState("disconnected");
      throw e;
    }
  }
  async read(): Promise<RawFrame> {
    if (!this.port?.readable) throw new Error("Connect a serial device first.");
    if (this.active) throw new Error("A reading is already in progress.");
    this.active = true;
    this.onState("reading");
    const reader = this.port.readable.getReader();
    this.reader = reader;
    let timeout = false;
    const timer = setTimeout(() => {
      timeout = true;
      void reader.cancel().catch(() => {});
    }, 10000);
    let text = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done)
          throw new Error(
            timeout
              ? "No complete frame received within 10 seconds. Check firmware and baud rate."
              : "Device stream ended or was disconnected.",
          );
        text += decoder.decode(value, { stream: true });
        if (text.length > 65536) throw new Error("Device frame exceeds 64 KB.");
        const index = text.indexOf("\n");
        if (index >= 0) {
          const frame = parseDeviceFrame(text.slice(0, index).trim());
          this.onState("connected");
          return frame;
        }
      }
    } catch (e) {
      this.onState("error");
      throw e;
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
      this.reader = null;
      this.active = false;
    }
  }
  async disconnect() {
    if (this.reader) await this.reader.cancel().catch(() => {});
    const port = this.port;
    try {
      if (port) await port.close();
    } finally {
      this.port = null;
      this.onState("disconnected");
    }
  }
}
export class SimulatedAdapter implements PotentiostatAdapter {
  private connected = false;
  constructor(private noSignal = false) {}
  async connect() {
    this.connected = true;
  }
  async disconnect() {
    this.connected = false;
  }
  async read(): Promise<RawFrame> {
    if (!this.connected) throw new Error("Start the simulator first.");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      currentUa: this.noSignal
        ? 0
        : Number((13 + Math.random() * 6).toFixed(3)),
      voltageV: 0.3,
      signalDetected: !this.noSignal,
    };
  }
}
