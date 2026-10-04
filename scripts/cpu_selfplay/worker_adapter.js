import { parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';

// Use a classic-script context: the browser script assigns an undeclared
// `onmessage`, which would throw if imported as an ES module.
const context = vm.createContext({
  onmessage: null,
  postMessage: (data) => parentPort.postMessage(data),
  performance: { now: () => Date.now() - workerData.t0 },
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
  console,
});
context.self = context;
vm.runInContext(workerData.source, context, { filename: workerData.filename });
if (typeof context.onmessage !== 'function') {
  throw new Error(`${workerData.filename} did not install an onmessage handler`);
}
parentPort.on('message', (data) => context.onmessage({ data }));
parentPort.postMessage({ harness: 'ready' });
